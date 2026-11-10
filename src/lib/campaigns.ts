import 'server-only';
import crypto from 'node:crypto';
import { db } from './db';
import { campaignTotals } from './payments';
import { fundingPercent, remainingCents } from './money';

export type CampaignRow = {
  id: string; slug: string; owner_id: string; creator_name: string; title: string; story: string; category: string | null;
  product_snapshot_id: string | null; item_price_cents: number; own_funds_cents: number; target_cents: number; currency: string;
  suggested_amounts_cents: number[]; image_url: string | null; visibility: string; status: string; allow_overfunding: boolean;
  deadline: string | null; is_demo_seed: boolean; created_at: string; updated_at: string;
  // Trust fields (migration 005; null/defaults on campaigns created before it).
  country?: string | null; need_category?: string | null; ranking_mode?: string; buffer_cents?: number; shipping_cents?: number; tax_cents?: number;
  gap_formula?: { price: number; shipping: number; tax: number; buffer: number; bufferPct: number; ownFunds: number; basisPrice?: number; ownerPaysDifferenceCents?: number } | null;
  moderation_status?: 'auto_approved' | 'pending_review' | 'approved' | 'rejected' | 'hidden'; moderation_reasons?: string[];
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected'; live_price_cents?: number | null; price_rechecked_at?: string | null; policy_version?: string | null;
};

/** Contributions are accepted, and the campaign is listed publicly, only after moderation allows it. */
export function isPubliclyActive(c: Pick<CampaignRow, 'moderation_status'>): boolean {
  return !c.moderation_status || c.moderation_status === 'auto_approved' || c.moderation_status === 'approved';
}

export function makeSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'campaign';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export async function getCampaignBySlug(slug: string) {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const c = await db().from('campaigns').select('*').eq('slug', slug).maybeSingle();
  if (!c.data) return null;
  const campaign = c.data as CampaignRow;
  const [totals, product] = await Promise.all([
    campaignTotals(campaign.id),
    campaign.product_snapshot_id ? db().from('product_snapshots').select('*').eq('id', campaign.product_snapshot_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const target = Number(campaign.target_cents);
  return {
    campaign: { ...campaign, item_price_cents: Number(campaign.item_price_cents), own_funds_cents: Number(campaign.own_funds_cents), target_cents: target, suggested_amounts_cents: (campaign.suggested_amounts_cents || []).map(Number) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product: product.data as any,
    totals: { ...totals, percent: fundingPercent(totals.raisedCents, target), remainingCents: remainingCents(totals.raisedCents, target) },
  };
}

/** Public, privacy-safe list of verified contributions (anonymous supporters are masked). */
export async function publicContributions(campaignId: string, limit = 50) {
  const r = await db().from('contributions').select('amount_cents, supporter_name, supporter_message, is_anonymous, created_at').eq('campaign_id', campaignId).eq('status', 'COMPLETED').order('created_at', { ascending: false }).limit(limit);
  return (r.data || []).map(x => ({
    amountCents: Number(x.amount_cents),
    name: x.is_anonymous || !x.supporter_name ? 'Anonymous supporter' : String(x.supporter_name),
    message: x.supporter_message ? String(x.supporter_message) : null,
    at: x.created_at as string,
  }));
}

export async function campaignUpdates(campaignId: string) {
  const r = await db().from('campaign_updates').select('id, kind, body, ai_generated, created_at').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(30);
  return r.data || [];
}

/** Owner-only full payment history (order + capture ids, statuses, timestamps). */
export async function paymentHistory(campaignId: string) {
  const orders = await db().from('payment_orders').select('id, kind, paypal_order_id, amount_cents, status, capture_id, capture_status, supporter_name, is_anonymous, created_at, updated_at').eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(200);
  const ids = (orders.data || []).map(o => o.paypal_order_id);
  const events = ids.length ? await db().from('payment_events').select('id, paypal_order_id, source, event_type, status, summary, created_at').in('paypal_order_id', ids).order('id', { ascending: true }) : { data: [] };
  const sys = await db().from('payment_events').select('id, paypal_order_id, source, event_type, status, summary, created_at').eq('source', 'system').contains('summary', { campaignId }).order('id');
  return { orders: orders.data || [], events: [...(events.data || []), ...(sys.data || [])].sort((a, b) => Number(a.id) - Number(b.id)) };
}
