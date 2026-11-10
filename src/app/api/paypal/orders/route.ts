import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { currentUserId, ensureUser } from '@/lib/identity';
import { createOrder, PayPalError } from '@/lib/paypal';
import { logPaymentEvent } from '@/lib/payments';
import { getCampaignBySlug } from '@/lib/campaigns';
import { validateContribution, formatUSD } from '@/lib/money';
import { cleanText, findRecentProduct, saveSnapshot, fetchLiveProduct } from '@/lib/channel3';
import { sharedRateLimit, clientKey, bucketId } from '@/lib/ratelimit';
import { canContribute, requestCountry, POLICY_VERSION } from '@/lib/policy';
import { recordSecurityEvent } from '@/lib/security-events';
import { getLocale } from '@/i18n/server';
import { t } from '@/i18n';
import { receiptProvider, saveReceiptRequest, validEmail } from '@/lib/receipts';

export const runtime = 'nodejs';

const Contribution = z.object({
  kind: z.literal('contribution'),
  slug: z.string().min(3).max(60),
  amountCents: z.number().int(),
  supporterName: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(200).optional().default(''),
  anonymous: z.boolean().optional().default(false),
  /** Optional, private: only used to email a receipt after PayPal verifies the capture. */
  supporterEmail: z.string().trim().max(254).optional().default(''),
  locale: z.string().max(5).optional().default('en'),
  /** Honeypot: hidden from people, often filled by bots. */
  website: z.string().max(200).optional().default(''),
});
const Purchase = z.object({
  kind: z.literal('purchase'),
  slug: z.string().min(3).max(60),
  confirm: z.literal(true),
});
const Direct = z.object({
  kind: z.literal('direct'),
  externalId: z.string().min(3).max(40),
  confirm: z.literal(true),
});
const Body = z.discriminatedUnion('kind', [Contribution, Purchase, Direct]);

export async function POST(req: Request) {
  const ip = clientKey(req);
  const rl = await sharedRateLimit([['order_ip_min', ip, 8, 60], ['order_ip_hour', ip, 40, 3600]]);
  if (!rl.ok) { void recordSecurityEvent('rate_limited', 'warn', bucketId('ip', ip), { route: 'orders', rule: rl.rule }); return Response.json({ error: 'Too many payment attempts. Please wait a minute.' }, { status: 429 }); }
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Invalid payment request.' }, { status: 400 });
  const locale = await getLocale();
  const paymentOrderId = crypto.randomUUID();

  // Direct purchase (Journey A): user approves a sandbox checkout for a product without a campaign.
  if (p.data.kind === 'direct') {
    try {
      const userId = await ensureUser();
      const product = await findRecentProduct(p.data.externalId);
      if (!product || product.priceCents == null) return Response.json({ error: 'This product has no live price.' }, { status: 422 });
      if (product.priceCents > 1_000_000) return Response.json({ error: 'Sandbox demo checkout is limited to $10,000.' }, { status: 422 });
      const snapshotId = await saveSnapshot(product);
      const order = await createOrder({
        referenceId: paymentOrderId, customId: snapshotId, description: `Sandbox purchase: ${product.title}`.slice(0, 127),
        itemName: product.title.slice(0, 120), amountCents: product.priceCents, payeeEmail: env.storePayeeEmail || undefined, brandName: 'FundCart Demo Store (Sandbox)',
      });
      await db().from('purchase_approvals').insert({ campaign_id: null, user_id: userId, product_snapshot_id: snapshotId, amount_cents: product.priceCents, approved_text: 'I approve a PayPal Sandbox checkout for this item. No real product will be purchased.', payment_order_id: null });
      const ins = await db().from('payment_orders').insert({ id: paymentOrderId, kind: 'purchase', campaign_id: null, user_id: userId, paypal_order_id: order.id, amount_cents: product.priceCents, currency: 'USD', payee_email: env.storePayeeEmail || null, status: order.status });
      if (ins.error) throw new Error(ins.error.message);
      await logPaymentEvent({ paymentOrderId, paypalOrderId: order.id, source: 'api', eventType: 'purchase.approved_by_user', status: order.status, summary: { amountCents: product.priceCents, snapshotId } });
      return Response.json({ orderId: order.id });
    } catch (e) {
      const err = e as PayPalError;
      await logPaymentEvent({ source: 'api', eventType: 'order.create_failed', status: 'ERROR', summary: { message: err.message, issue: err.issue, debugId: err.debugId } }).catch(() => {});
      return Response.json({ error: 'PayPal could not start this payment. Please try again.' }, { status: 502 });
    }
  }

  const data = await getCampaignBySlug(p.data.slug);
  if (!data) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  const { campaign, totals, product } = data;

  try {
    if (p.data.kind === 'contribution') {
      if (p.data.website) { void recordSecurityEvent('honeypot', 'warn', bucketId('ip', ip), { route: 'orders' }); return Response.json({ error: 'Invalid payment request.' }, { status: 400 }); }
      const userId = await ensureUser();
      if (campaign.status !== 'active') return Response.json({ error: campaign.status === 'cancelled' ? 'This campaign was cancelled.' : 'This campaign is no longer accepting contributions.' }, { status: 409 });
      // Moderation and country policy are enforced here, not only in the interface.
      if (!['auto_approved', 'approved'].includes(campaign.moderation_status ?? 'auto_approved')) return Response.json({ error: t(locale, 'trust.pending') }, { status: 409 });
      const payerCountry = requestCountry(req);
      const allowed = canContribute(campaign.country ?? null, payerCountry);
      if (!allowed.allowed) {
        void recordSecurityEvent('cross_border_block', 'info', campaign.id, { reason: allowed.reason, payerCountry, campaignCountry: campaign.country });
        return Response.json({ error: t(locale, allowed.messageKey as never), code: allowed.reason }, { status: 403 });
      }
      const vel = await sharedRateLimit([['contrib_user_campaign', `${userId}:${campaign.id}`, 3, 600], ['contrib_ip_campaign', `${ip}:${campaign.id}`, 5, 600], ['contrib_user_day', userId, 25, 86400]]);
      if (!vel.ok) { void recordSecurityEvent('rate_limited', 'warn', campaign.id, { route: 'contribution', rule: vel.rule }); return Response.json({ error: 'Too many contribution attempts for this campaign. Please wait a few minutes.' }, { status: 429 }); }
      // Duplicate guard: the same open order (same person, campaign and amount in the last 2 minutes) is reused, not created twice.
      const recent = await db().from('payment_orders').select('paypal_order_id').eq('user_id', userId).eq('campaign_id', campaign.id).eq('amount_cents', p.data.amountCents).eq('kind', 'contribution').in('status', ['CREATED', 'PAYER_ACTION_REQUIRED']).gte('created_at', new Date(Date.now() - 120_000).toISOString()).limit(1);
      if (recent.data?.[0]?.paypal_order_id) { void recordSecurityEvent('duplicate_payment', 'info', campaign.id, { reused: true }); return Response.json({ orderId: recent.data[0].paypal_order_id, reused: true }); }
      const v = validateContribution(p.data.amountCents, totals.raisedCents, campaign.target_cents, campaign.allow_overfunding);
      if (!v.ok) return Response.json({ error: v.error }, { status: 422 });
      if (p.data.supporterEmail && !validEmail(p.data.supporterEmail)) return Response.json({ error: 'Please enter a valid email address, or leave it empty.' }, { status: 422 });
      const order = await createOrder({
        referenceId: paymentOrderId, customId: campaign.id,
        description: `Contribution to "${campaign.title}" (FundCart AI sandbox demo)`,
        itemName: `Contribution: ${campaign.title}`, amountCents: v.amountCents,
        payeeEmail: env.contributionPayeeEmail || undefined, brandName: 'FundCart AI (Sandbox)',
      });
      const ins = await db().from('payment_orders').insert({
        id: paymentOrderId, kind: 'contribution', campaign_id: campaign.id, user_id: userId, paypal_order_id: order.id,
        amount_cents: v.amountCents, currency: 'USD', payee_email: env.contributionPayeeEmail || null, status: order.status,
        supporter_name: cleanText(p.data.supporterName, 40) || null, supporter_message: cleanText(p.data.message, 200) || null, is_anonymous: p.data.anonymous,
        payer_country: payerCountry === 'XX' ? null : payerCountry, policy_version: POLICY_VERSION,
      });
      if (ins.error) throw new Error(ins.error.message);
      // Store the receipt email only when a provider can actually send it; otherwise it is not collected.
      if (p.data.supporterEmail && receiptProvider()) await saveReceiptRequest(paymentOrderId, p.data.supporterEmail, p.data.locale).catch(() => {});
      await logPaymentEvent({ paymentOrderId, paypalOrderId: order.id, source: 'api', eventType: 'order.created', status: order.status, summary: { kind: 'contribution', amountCents: v.amountCents, receiptRequested: !!p.data.supporterEmail } });
      return Response.json({ orderId: order.id });
    }

    // Purchase: only the campaign owner, only after verified goal, only with explicit confirmation.
    const userId = await currentUserId();
    if (!userId || userId !== campaign.owner_id) return Response.json({ error: 'Only the campaign creator can approve the purchase.' }, { status: 403 });
    if (campaign.status !== 'goal_reached') return Response.json({ error: campaign.status === 'purchased' ? 'This purchase was already completed.' : 'The funding goal has not been reached with verified contributions yet.' }, { status: 409 });
    if (totals.raisedCents < campaign.target_cents) return Response.json({ error: 'Verified contributions are below the target.' }, { status: 409 });
    // Re-quote before purchase: the live price must still be covered (item price + the disclosed buffer).
    let amount = campaign.item_price_cents;
    if (product?.external_id) {
      const live = await fetchLiveProduct(product.external_id);
      const covered = campaign.item_price_cents + Number(campaign.buffer_cents ?? 0);
      if (live.state === 'gone' || (live.state === 'ok' && live.product.priceCents == null)) {
        await logPaymentEvent({ source: 'system', eventType: 'purchase.blocked_unavailable', status: 'BLOCKED', summary: { campaignId: campaign.id } });
        return Response.json({ error: 'This item is no longer available from the retailer. Choose an approved equivalent and tell supporters before buying.', code: 'item_unavailable' }, { status: 409 });
      }
      if (live.state === 'ok' && live.product.priceCents! > covered) {
        await db().from('campaigns').update({ live_price_cents: live.product.priceCents, price_rechecked_at: new Date().toISOString() }).eq('id', campaign.id);
        await db().from('campaign_updates').insert({ campaign_id: campaign.id, kind: 'price_change', body: `The item's live price changed from ${formatUSD(campaign.item_price_cents)} to ${formatUSD(live.product.priceCents)}, which is more than the goal covers. The purchase is paused until the creator re-quotes or chooses an approved equivalent.` });
        await logPaymentEvent({ source: 'system', eventType: 'purchase.blocked_price_change', status: 'BLOCKED', summary: { campaignId: campaign.id, snapshotCents: campaign.item_price_cents, liveCents: live.product.priceCents } });
        void recordSecurityEvent('price_changed', 'info', campaign.id, { from: campaign.item_price_cents, to: live.product.priceCents });
        return Response.json({ error: t(locale, 'trust.priceChanged', { old: formatUSD(campaign.item_price_cents), now: formatUSD(live.product.priceCents) }), code: 'price_changed' }, { status: 409 });
      }
      if (live.state === 'ok') {
        amount = Math.min(live.product.priceCents!, covered);
        await db().from('campaigns').update({ live_price_cents: live.product.priceCents, price_rechecked_at: new Date().toISOString() }).eq('id', campaign.id);
      } else {
        await logPaymentEvent({ source: 'system', eventType: 'purchase.price_recheck_unavailable', status: 'WARN', summary: { campaignId: campaign.id } });
      }
    }
    const order = await createOrder({
      referenceId: paymentOrderId, customId: campaign.id,
      description: `Sandbox purchase: ${product?.title ?? campaign.title}`.slice(0, 127),
      itemName: (product?.title ?? campaign.title).slice(0, 120), amountCents: amount,
      payeeEmail: env.storePayeeEmail || undefined, brandName: 'FundCart Demo Store (Sandbox)',
    });
    const approval = await db().from('purchase_approvals').insert({
      campaign_id: campaign.id, user_id: userId, product_snapshot_id: campaign.product_snapshot_id, amount_cents: amount,
      approved_text: 'I approve a separate PayPal Sandbox checkout for this item. No real product will be purchased.',
    }).select('id').single();
    const ins = await db().from('payment_orders').insert({
      id: paymentOrderId, kind: 'purchase', campaign_id: campaign.id, user_id: userId, paypal_order_id: order.id,
      amount_cents: amount, currency: 'USD', payee_email: env.storePayeeEmail || null, status: order.status,
    });
    if (ins.error) throw new Error(ins.error.message);
    if (approval.data) await db().from('purchase_approvals').update({ payment_order_id: paymentOrderId }).eq('id', approval.data.id);
    await logPaymentEvent({ paymentOrderId, paypalOrderId: order.id, source: 'api', eventType: 'purchase.approved_by_user', status: order.status, summary: { amountCents: amount, campaignId: campaign.id } });
    return Response.json({ orderId: order.id });
  } catch (e) {
    const err = e as PayPalError;
    await logPaymentEvent({ paymentOrderId: null, source: 'api', eventType: 'order.create_failed', status: 'ERROR', summary: { message: err.message, issue: err.issue, debugId: err.debugId } }).catch(() => {});
    return Response.json({ error: 'PayPal could not start this payment. Please try again.' }, { status: 502 });
  }
}
