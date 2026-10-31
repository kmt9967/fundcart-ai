import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { currentUserId, ensureUser } from '@/lib/identity';
import { createOrder, PayPalError } from '@/lib/paypal';
import { logPaymentEvent } from '@/lib/payments';
import { getCampaignBySlug } from '@/lib/campaigns';
import { validateContribution } from '@/lib/money';
import { cleanText, findRecentProduct, saveSnapshot } from '@/lib/channel3';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const Contribution = z.object({
  kind: z.literal('contribution'),
  slug: z.string().min(3).max(60),
  amountCents: z.number().int(),
  supporterName: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().max(200).optional().default(''),
  anonymous: z.boolean().optional().default(false),
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
  if (!rateLimit(`order:${clientKey(req)}`, 12, 60_000).ok) return Response.json({ error: 'Too many payment attempts. Please wait a minute.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'Invalid payment request.' }, { status: 400 });
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
      const userId = await ensureUser();
      if (campaign.status !== 'active') return Response.json({ error: campaign.status === 'cancelled' ? 'This campaign was cancelled.' : 'This campaign is no longer accepting contributions.' }, { status: 409 });
      const v = validateContribution(p.data.amountCents, totals.raisedCents, campaign.target_cents, campaign.allow_overfunding);
      if (!v.ok) return Response.json({ error: v.error }, { status: 422 });
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
      });
      if (ins.error) throw new Error(ins.error.message);
      await logPaymentEvent({ paymentOrderId, paypalOrderId: order.id, source: 'api', eventType: 'order.created', status: order.status, summary: { kind: 'contribution', amountCents: v.amountCents } });
      return Response.json({ orderId: order.id });
    }

    // Purchase: only the campaign owner, only after verified goal, only with explicit confirmation.
    const userId = await currentUserId();
    if (!userId || userId !== campaign.owner_id) return Response.json({ error: 'Only the campaign creator can approve the purchase.' }, { status: 403 });
    if (campaign.status !== 'goal_reached') return Response.json({ error: campaign.status === 'purchased' ? 'This purchase was already completed.' : 'The funding goal has not been reached with verified contributions yet.' }, { status: 409 });
    if (totals.raisedCents < campaign.target_cents) return Response.json({ error: 'Verified contributions are below the target.' }, { status: 409 });
    const amount = campaign.item_price_cents;
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
