import 'server-only';
import { canContribute } from './policy';
import { validateContribution } from './money';
import { db } from './db';
import { captureOrder, extractCapture, getOrder, PayPalError, type PayPalOrder } from './paypal';
import { sendReceiptIfPending } from './receipts';
import { recentEventCount, recordSecurityEvent } from './security-events';

// Payment state machine. A payment only counts once PayPal itself reports a COMPLETED capture
// whose amount and currency match the order we created. Browser redirects never mark success.

export type CaptureOutcome =
  | { state: 'approval_required' | 'campaign_closed'; message: string }
  | { state: 'completed'; captureId: string; amountCents: number; alreadyRecorded: boolean }
  | { state: 'pending'; captureId: string; status: string }
  | { state: 'not_approved'; status: string }
  | { state: 'not_found'; message: string }
  | { state: 'failed'; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logPaymentEvent(e: { paymentOrderId?: string | null; paypalOrderId?: string | null; source: 'api' | 'webhook' | 'system'; eventType: string; paypalEventId?: string | null; status?: string | null; summary?: any }) {
  const ins = await db().from('payment_events').insert({
    payment_order_id: e.paymentOrderId ?? null, paypal_order_id: e.paypalOrderId ?? null, source: e.source,
    event_type: e.eventType, paypal_event_id: e.paypalEventId ?? null, status: e.status ?? null, summary: e.summary ?? {},
  });
  // Unique violation on paypal_event_id = duplicate webhook delivery; that's expected and safe.
  if (ins.error && !/duplicate key/.test(ins.error.message)) throw new Error(`logPaymentEvent: ${ins.error.message}`);
  return !ins.error;
}

/**
 * Capture (if needed) and reconcile a PayPal order with our records. Safe to call repeatedly
 * (double clicks, refreshes, webhooks): the capture uses PayPal-Request-Id and the contribution
 * insert is guarded by unique constraints on payment_order_id and capture_id.
 */
export async function captureAndRecord(paypalOrderId: string, caller: { source: 'api'; userId: string } | { source: 'webhook'; reconcileOnly: boolean }): Promise<CaptureOutcome> {
  const { source } = caller;
  const po = await db().from('payment_orders').select('*').eq('paypal_order_id', paypalOrderId).maybeSingle();
  if (po.error) throw new Error('Payment order lookup failed.');
  if (!po.data || (caller.source === 'api' && po.data.user_id !== caller.userId)) return { state: 'not_found', message: 'Unknown order.' };
  const order = po.data;

  let pp: PayPalOrder;
  try {
    pp = await getOrder(paypalOrderId);
    if (pp.status === 'APPROVED' && !(caller.source === 'webhook' && caller.reconcileOnly)) {
      if (order.kind === 'purchase') {
        const approval = await db().from('purchase_approvals').select('id,campaign_id').eq('payment_order_id', order.id)
          .eq('user_id', order.user_id).eq('amount_cents', order.amount_cents).maybeSingle();
        if (approval.error) throw new Error('Purchase approval lookup failed.');
        if (!approval.data || approval.data.campaign_id !== order.campaign_id) {
          return { state: 'approval_required', message: 'A recorded approval is required for this purchase.' };
        }
      }
      if (order.campaign_id) {
        const campaign = await db().from('campaigns').select('status,moderation_status,deadline,country,target_cents,allow_overfunding,owner_id')
          .eq('id', order.campaign_id).maybeSingle();
        if (campaign.error) throw new Error('Campaign lookup failed.');
        const c = campaign.data;
        const open = c && ['approved', 'auto_approved'].includes(c.moderation_status)
          && (!c.deadline || c.deadline >= new Date().toISOString().slice(0, 10));
        if (!open) return { state: 'campaign_closed', message: 'This campaign cannot accept the payment.' };
        const totals = await campaignTotals(order.campaign_id);
        const allowed = order.kind === 'contribution'
          ? c.status === 'active' && canContribute(c.country, order.payer_country ?? 'XX').allowed
            && validateContribution(Number(order.amount_cents), totals.raisedCents, Number(c.target_cents), c.allow_overfunding).ok
          : c.status === 'goal_reached' && c.owner_id === order.user_id && totals.raisedCents >= Number(c.target_cents);
        if (!allowed) return { state: 'campaign_closed', message: 'This campaign cannot accept the payment.' };
      }
      pp = await captureOrder(paypalOrderId);
    }
  } catch (e) {
    const err = e as PayPalError;
    // ORDER_ALREADY_CAPTURED → fetch the order again and reconcile from PayPal's truth.
    if (err.issue === 'ORDER_ALREADY_CAPTURED') {
      pp = await getOrder(paypalOrderId);
    } else {
      await logPaymentEvent({ paymentOrderId: order.id, paypalOrderId, source, eventType: 'capture.error', status: 'ERROR', summary: { issue: err.issue, debugId: err.debugId } });
      // Decline-spike alert (card-testing signal): 5+ failed captures across the platform in 10 minutes.
      if ((await recentEventCount('capture.error', 10, 'payment_events', 'event_type')) >= 5) void recordSecurityEvent('decline_spike', 'alert', 'platform', { windowMinutes: 10 });
      return { state: 'failed', message: err.issue === 'INSTRUMENT_DECLINED' ? 'The payment method was declined. Please try another one in PayPal.' : 'PayPal could not complete this payment.' };
    }
  }

  if (pp.status !== 'COMPLETED') {
    await db().from('payment_orders').update({ status: pp.status, updated_at: new Date().toISOString() }).eq('id', order.id);
    return { state: 'not_approved', status: pp.status };
  }

  const cap = extractCapture(pp);
  if (!cap) return { state: 'failed', message: 'PayPal returned no capture.' };

  // Integrity checks: the captured amount/currency must equal what the server priced.
  if (cap.currency !== order.currency || cap.amountCents !== Number(order.amount_cents)) {
    await logPaymentEvent({ paymentOrderId: order.id, paypalOrderId, source, eventType: 'capture.mismatch', status: 'MISMATCH', summary: { expected: order.amount_cents, got: cap.amountCents, currency: cap.currency } });
    return { state: 'failed', message: 'Captured amount did not match the order. Flagged for review.' };
  }

  const recorded = await db().from('payment_orders').update({ status: cap.status === 'COMPLETED' ? 'COMPLETED' : cap.status, capture_id: cap.captureId, capture_status: cap.status, updated_at: new Date().toISOString() }).eq('id', order.id);
  if (recorded.error) throw new Error('Payment order update failed.');
  await logPaymentEvent({ paymentOrderId: order.id, paypalOrderId, source, eventType: 'order.captured', status: cap.status, summary: { captureId: cap.captureId, amountCents: cap.amountCents, currency: cap.currency } });

  if (cap.status !== 'COMPLETED') return { state: 'pending', captureId: cap.captureId, status: cap.status };

  let alreadyRecorded = false;
  if (order.kind === 'contribution') {
    const ins = await db().from('contributions').insert({
      campaign_id: order.campaign_id, payment_order_id: order.id, capture_id: cap.captureId,
      amount_cents: cap.amountCents, currency: cap.currency, supporter_name: order.supporter_name,
      supporter_message: order.supporter_message, is_anonymous: order.is_anonymous,
    });
    if (ins.error) {
      if (/duplicate key/.test(ins.error.message)) alreadyRecorded = true;
      else throw new Error(`record contribution: ${ins.error.message}`);
    }
    await refreshCampaignStatus(order.campaign_id);
    // Receipt only after a verified COMPLETED capture; idempotent across browser capture + webhook retries.
    const receipt = await sendReceiptIfPending(order.id, { captureId: cap.captureId, amountCents: cap.amountCents, currency: cap.currency });
    if (receipt === 'sent' || receipt === 'disabled' || receipt === 'failed') await logPaymentEvent({ paymentOrderId: order.id, paypalOrderId, source: 'system', eventType: `receipt.${receipt}`, status: receipt.toUpperCase() }).catch(() => {});
  } else if (order.kind === 'purchase' && order.campaign_id) {
    const upd = await db().from('campaigns').update({ status: 'purchased', updated_at: new Date().toISOString() }).eq('id', order.campaign_id).neq('status', 'purchased').select('id');
    if (upd.error) throw new Error('Campaign purchase update failed.');
    alreadyRecorded = !upd.data?.length;
    if (!alreadyRecorded) {
      await db().from('campaign_updates').insert({ campaign_id: order.campaign_id, kind: 'purchase', body: `The creator approved and completed a separate PayPal Sandbox checkout for the item (capture ${cap.captureId}). No real product was purchased — this is a sandbox demo.` });
    }
  }
  return { state: 'completed', captureId: cap.captureId, amountCents: cap.amountCents, alreadyRecorded };
}

export async function campaignTotals(campaignId: string): Promise<{ raisedCents: number; supporterCount: number }> {
  const r = await db().from('campaign_totals').select('raised_cents, supporter_count').eq('campaign_id', campaignId).maybeSingle();
  if (r.error) throw new Error('Campaign total lookup failed.');
  return { raisedCents: Number(r.data?.raised_cents ?? 0), supporterCount: Number(r.data?.supporter_count ?? 0) };
}

/** Move a campaign to goal_reached when verified contributions meet the target. */
export async function refreshCampaignStatus(campaignId: string) {
  const c = await db().from('campaigns').select('id, status, target_cents').eq('id', campaignId).single();
  if (c.error) throw new Error('Campaign status lookup failed.');
  if (!c.data) return;
  const { raisedCents } = await campaignTotals(campaignId);
  if (c.data.status === 'goal_reached' && raisedCents < Number(c.data.target_cents)) {
    // A refund or reversal brought verified funds below the goal: purchase approval locks again.
    const upd = await db().from('campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('status', 'goal_reached').select('id');
    if (upd.error) throw new Error('Campaign status update failed.');
    if (upd.data?.length) await logPaymentEvent({ source: 'system', eventType: 'campaign.below_goal', status: 'ACTIVE', summary: { campaignId, raisedCents } });
    return;
  }
  if (c.data.status === 'active' && raisedCents >= Number(c.data.target_cents)) {
    const upd = await db().from('campaigns').update({ status: 'goal_reached', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('status', 'active').select('id');
    if (upd.error) throw new Error('Campaign status update failed.');
    if (upd.data?.length) {
      await db().from('campaign_updates').insert({ campaign_id: campaignId, kind: 'goal_reached', body: 'Goal reached with verified PayPal Sandbox contributions. The creator can now review and approve a separate purchase.' });
      await logPaymentEvent({ source: 'system', eventType: 'campaign.goal_reached', status: 'GOAL_REACHED', summary: { campaignId, raisedCents } });
    }
  }
}

/** Apply the signed adjustment and its idempotency record as one database transaction. */
export async function applyRefund(input: { eventId: string; resourceId: string; captureId: string; currency: string; amountCents: number; reversed: boolean }) {
  const result = await db().rpc('apply_contribution_adjustment', {
    p_event_id: input.eventId, p_resource_id: input.resourceId, p_capture_id: input.captureId,
    p_currency: input.currency, p_amount: input.amountCents, p_reversed: input.reversed,
  });
  if (result.error) throw new Error('Contribution adjustment could not be recorded.');
  return result.data as 'applied' | 'unchanged' | 'duplicate' | 'missing' | 'mismatch' | 'unsupported';
}
