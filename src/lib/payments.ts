import 'server-only';
import { formatUSD } from './money';
import { db } from './db';
import { captureOrder, extractCapture, getOrder, PayPalError, type PayPalOrder } from './paypal';
import { sendReceiptIfPending } from './receipts';

// Payment state machine. A payment only counts once PayPal itself reports a COMPLETED capture
// whose amount and currency match the order we created. Browser redirects never mark success.

export type CaptureOutcome =
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
export async function captureAndRecord(paypalOrderId: string, source: 'api' | 'webhook' = 'api'): Promise<CaptureOutcome> {
  const po = await db().from('payment_orders').select('*').eq('paypal_order_id', paypalOrderId).maybeSingle();
  if (po.error || !po.data) return { state: 'not_found', message: 'Unknown order.' };
  const order = po.data;

  let pp: PayPalOrder;
  try {
    pp = await getOrder(paypalOrderId);
    if (pp.status === 'APPROVED') pp = await captureOrder(paypalOrderId);
  } catch (e) {
    const err = e as PayPalError;
    // ORDER_ALREADY_CAPTURED → fetch the order again and reconcile from PayPal's truth.
    if (err.issue === 'ORDER_ALREADY_CAPTURED') {
      pp = await getOrder(paypalOrderId);
    } else {
      await logPaymentEvent({ paymentOrderId: order.id, paypalOrderId, source, eventType: 'capture.error', status: 'ERROR', summary: { message: err.message, issue: err.issue, debugId: err.debugId } });
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

  await db().from('payment_orders').update({ status: 'COMPLETED', capture_id: cap.captureId, capture_status: cap.status, updated_at: new Date().toISOString() }).eq('id', order.id);
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
    if (!alreadyRecorded) await refreshCampaignStatus(order.campaign_id);
    // Receipt only after a verified COMPLETED capture; idempotent across browser capture + webhook retries.
    const receipt = await sendReceiptIfPending(order.id, { captureId: cap.captureId, amountCents: cap.amountCents, currency: cap.currency });
    if (receipt === 'sent' || receipt === 'disabled' || receipt === 'failed') await logPaymentEvent({ paymentOrderId: order.id, paypalOrderId, source: 'system', eventType: `receipt.${receipt}`, status: receipt.toUpperCase() }).catch(() => {});
  } else if (order.kind === 'purchase' && order.campaign_id) {
    const upd = await db().from('campaigns').update({ status: 'purchased', updated_at: new Date().toISOString() }).eq('id', order.campaign_id).neq('status', 'purchased').select('id');
    alreadyRecorded = !upd.data?.length;
    if (!alreadyRecorded) {
      await db().from('campaign_updates').insert({ campaign_id: order.campaign_id, kind: 'purchase', body: `The creator approved and completed a separate PayPal Sandbox checkout for the item (capture ${cap.captureId}). No real product was purchased — this is a sandbox demo.` });
    }
  }
  return { state: 'completed', captureId: cap.captureId, amountCents: cap.amountCents, alreadyRecorded };
}

export async function campaignTotals(campaignId: string): Promise<{ raisedCents: number; supporterCount: number }> {
  const r = await db().from('campaign_totals').select('raised_cents, supporter_count').eq('campaign_id', campaignId).maybeSingle();
  return { raisedCents: Number(r.data?.raised_cents ?? 0), supporterCount: Number(r.data?.supporter_count ?? 0) };
}

/** Move a campaign to goal_reached when verified contributions meet the target. */
export async function refreshCampaignStatus(campaignId: string) {
  const c = await db().from('campaigns').select('id, status, target_cents').eq('id', campaignId).single();
  if (c.error || !c.data) return;
  const { raisedCents } = await campaignTotals(campaignId);
  if (c.data.status === 'goal_reached' && raisedCents < Number(c.data.target_cents)) {
    // A refund or reversal brought verified funds below the goal: purchase approval locks again.
    const upd = await db().from('campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('status', 'goal_reached').select('id');
    if (upd.data?.length) await logPaymentEvent({ source: 'system', eventType: 'campaign.below_goal', status: 'ACTIVE', summary: { campaignId, raisedCents } });
    return;
  }
  if (c.data.status === 'active' && raisedCents >= Number(c.data.target_cents)) {
    const upd = await db().from('campaigns').update({ status: 'goal_reached', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('status', 'active').select('id');
    if (upd.data?.length) {
      await db().from('campaign_updates').insert({ campaign_id: campaignId, kind: 'goal_reached', body: 'Goal reached with verified PayPal Sandbox contributions. The creator can now review and approve a separate purchase.' });
      await logPaymentEvent({ source: 'system', eventType: 'campaign.goal_reached', status: 'GOAL_REACHED', summary: { campaignId, raisedCents } });
    }
  }
}

/**
 * Apply a PayPal refund or reversal to the contribution with this capture id.
 * Called once per PayPal event (webhook events are deduplicated by event id before this runs).
 * Partial refunds reduce the verified total; a full refund or a reversal removes it.
 */
export async function applyRefund(captureId: string, refundCents: number, kind: 'REFUNDED' | 'REVERSED'): Promise<{ applied: boolean; campaignId?: string; status?: string; refundedCents?: number }> {
  const k = await db().from('contributions').select('id, campaign_id, amount_cents, refunded_cents, status').eq('capture_id', captureId).maybeSingle();
  if (!k.data) return { applied: false };
  const amount = Number(k.data.amount_cents);
  const refunded = kind === 'REVERSED' ? amount : Math.min(amount, Number(k.data.refunded_cents) + Math.max(0, refundCents));
  const status = kind === 'REVERSED' ? 'REVERSED' : refunded >= amount ? 'REFUNDED' : 'COMPLETED';
  await db().from('contributions').update({ refunded_cents: refunded, status }).eq('id', k.data.id);
  const campaignId = k.data.campaign_id as string;
  await db().from('campaign_updates').insert({ campaign_id: campaignId, kind: 'refund', body: kind === 'REVERSED'
    ? `A PayPal Sandbox payment (capture ${captureId}) was reversed. It no longer counts toward the goal.`
    : `PayPal Sandbox refunded ${formatUSD(refunded)} of a ${formatUSD(amount)} contribution (capture ${captureId}). The verified total was reduced.` });
  await refreshCampaignStatus(campaignId);
  return { applied: true, campaignId, status, refundedCents: refunded };
}
