import 'server-only';
import { db } from './db';
import { formatUSD } from './money';
import { t, isLocale, type Locale } from '@/i18n';

// Transactional receipts for supporters, sent only after a verified PayPal capture.
//
// - The email is stored privately (supporter_receipts, server-only) and never shown publicly.
// - Sending happens from captureAndRecord, i.e. only after PayPal reports a COMPLETED capture whose
//   amount and currency match the server-priced order. Failed, pending or cancelled payments never
//   produce a "successful payment" receipt.
// - Idempotent: an atomic pending→sending claim means browser capture + webhook retries can't send twice.
// - Provider: Resend (free tier) when RESEND_API_KEY and RECEIPT_FROM are configured. Without them the
//   row is marked 'disabled' — we never pretend an email was sent.

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,190}\.[A-Za-z]{2,24}$/;
export function validEmail(s: string): boolean { return EMAIL_RE.test(s) && s.length <= 254; }

export async function saveReceiptRequest(paymentOrderId: string, email: string, locale: string): Promise<void> {
  if (!validEmail(email)) return;
  await db().from('supporter_receipts').insert({ payment_order_id: paymentOrderId, email: email.trim().toLowerCase(), locale: isLocale(locale) ? locale : 'en' });
}

export function receiptProvider(): { name: 'resend'; key: string; from: string } | null {
  const key = process.env.RESEND_API_KEY || ''; const from = process.env.RECEIPT_FROM || '';
  return key && from ? { name: 'resend', key, from } : null;
}

export type ReceiptData = { campaignTitle: string; amountCents: number; currency: string; paypalOrderId: string; captureId: string; capturedAt: string; locale: Locale; receiptUrl: string | null };

/** Plain, escaped HTML + text receipt. Every value is code-computed from verified records. */
export function renderReceipt(d: ReceiptData): { subject: string; html: string; text: string } {
  const L = d.locale; const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const amount = formatUSD(d.amountCents);
  const rows: Array<[string, string]> = [
    [t(L, 'mail.campaign'), d.campaignTitle], [t(L, 'mail.amount'), `${amount} ${d.currency}`], [t(L, 'mail.status'), t(L, 'mail.statusOk')],
    [t(L, 'mail.reference'), `${d.paypalOrderId} / ${d.captureId}`], [t(L, 'mail.date'), new Date(d.capturedAt).toUTCString()],
  ];
  const subject = t(L, 'mail.subject', { amount, title: d.campaignTitle.slice(0, 60) });
  const dir = L === 'ur' ? 'rtl' : 'ltr';
  const html = `<!doctype html><html lang="${L}" dir="${dir}"><body style="font-family:system-ui,sans-serif;background:#f6f7fb;padding:24px;color:#0e1330">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #e6e8f0">
<p style="font-weight:800;color:#5b3df5;margin:0">FundCart AI</p>
<h1 style="font-size:20px">${esc(t(L, 'mail.heading'))}</h1>
<p>${esc(t(L, 'mail.intro'))}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b7194">${esc(k)}</td><td style="padding:6px 0;font-weight:600" dir="auto">${esc(v)}</td></tr>`).join('')}</table>
${d.receiptUrl ? `<p><a href="${esc(d.receiptUrl)}" style="color:#5b3df5">${esc(t(L, 'mail.view'))}</a></p>` : ''}
<p style="background:#fff6e6;border-radius:12px;padding:12px;font-size:13px">${esc(t(L, 'mail.sandbox'))}</p>
<p style="font-size:12px;color:#6b7194">${esc(t(L, 'mail.footer'))}</p></div></body></html>`;
  const text = [`FundCart AI — ${t(L, 'mail.heading')}`, t(L, 'mail.intro'), '', ...rows.map(([k, v]) => `${k}: ${v}`), d.receiptUrl ? `\n${d.receiptUrl}` : '', '', t(L, 'mail.sandbox'), t(L, 'mail.footer')].join('\n');
  return { subject, html, text };
}

/**
 * Send the receipt for a verified contribution, at most once. Safe to call from both the browser
 * capture route and the webhook. Never throws (receipt problems must not affect payment recording).
 */
export async function sendReceiptIfPending(paymentOrderId: string, verified: { captureId: string; amountCents: number; currency: string }, fetchImpl: typeof fetch = fetch): Promise<'sent' | 'disabled' | 'none' | 'already' | 'failed'> {
  try {
    const provider = receiptProvider();
    // Atomic claim: only one caller moves pending → sending.
    const claim = await db().from('supporter_receipts').update({ status: provider ? 'sending' : 'disabled', attempts: 1 }).eq('payment_order_id', paymentOrderId).eq('status', 'pending').select('id, email, locale');
    if (claim.error) return 'none'; // e.g. table not migrated yet: behave as "no receipt requested"
    if (!claim.data?.length) {
      const row = await db().from('supporter_receipts').select('status').eq('payment_order_id', paymentOrderId).maybeSingle();
      return row.data ? 'already' : 'none';
    }
    if (!provider) return 'disabled';
    const r = claim.data[0];
    const po = await db().from('payment_orders').select('paypal_order_id, campaign_id, updated_at').eq('id', paymentOrderId).single();
    const camp = po.data?.campaign_id ? await db().from('campaigns').select('title').eq('id', po.data.campaign_id).maybeSingle() : { data: null };
    const site = process.env.SITE_URL || 'https://fundcart-ai.vercel.app';
    const mail = renderReceipt({ campaignTitle: camp.data?.title || 'FundCart AI', amountCents: verified.amountCents, currency: verified.currency, paypalOrderId: po.data?.paypal_order_id || '', captureId: verified.captureId, capturedAt: po.data?.updated_at || new Date().toISOString(), locale: isLocale(r.locale) ? r.locale : 'en', receiptUrl: `${site}/receipt/${po.data?.paypal_order_id}` });
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `receipt-${paymentOrderId}` },
      body: JSON.stringify({ from: provider.from, to: [r.email], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10000),
    });
    const j = await res.json().catch(() => ({})) as { id?: string; message?: string };
    if (!res.ok) { await db().from('supporter_receipts').update({ status: 'failed', last_error: `HTTP ${res.status}: ${(j.message || '').slice(0, 200)}` }).eq('id', r.id); return 'failed'; }
    await db().from('supporter_receipts').update({ status: 'sent', provider: 'resend', provider_message_id: j.id || null, sent_at: new Date().toISOString() }).eq('id', r.id);
    return 'sent';
  } catch {
    return 'failed';
  }
}
