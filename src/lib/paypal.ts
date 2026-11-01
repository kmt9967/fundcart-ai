import 'server-only';
import { env } from './env';
import { centsToPayPalValue, toCents } from './money';

// Thin, typed wrapper around the PayPal REST APIs (Sandbox only).
// Orders v2: create → buyer approves in PayPal → server captures → server verifies.

const BASE = 'https://api-m.sandbox.paypal.com';
let tokenCache: { token: string; exp: number } | null = null;

export class PayPalError extends Error {
  constructor(message: string, public status: number, public issue?: string, public debugId?: string) { super(message); }
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.paypalClientId}:${env.paypalSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new PayPalError('PayPal authentication failed', res.status);
  const json = await res.json();
  tokenCache = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return tokenCache.token;
}

async function call<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId; // PayPal-side idempotency
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!res.ok) {
    const issue = json?.details?.[0]?.issue || json?.name;
    throw new PayPalError(json?.details?.[0]?.description || json?.message || `PayPal API error ${res.status}`, res.status, issue, json?.debug_id);
  }
  return json as T;
}

export type PayPalOrder = {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  purchase_units: Array<{
    reference_id?: string;
    custom_id?: string;
    amount: { currency_code: string; value: string };
    payee?: { email_address?: string; merchant_id?: string };
    payments?: { captures?: Array<{ id: string; status: string; amount: { currency_code: string; value: string }; create_time?: string; final_capture?: boolean }> };
  }>;
  payer?: { payer_id?: string };
  links?: Array<{ href: string; rel: string }>;
};

export type CreateOrderInput = {
  referenceId: string;      // our payment_orders.id
  customId: string;         // campaign id or purchase approval id
  description: string;
  itemName: string;
  amountCents: number;
  payeeEmail?: string;      // sandbox receiving account
  brandName: string;
};

export async function createOrder(i: CreateOrderInput): Promise<PayPalOrder> {
  const value = centsToPayPalValue(i.amountCents);
  return call<PayPalOrder>('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: i.referenceId,
      custom_id: i.customId.slice(0, 127),
      description: i.description.slice(0, 127),
      ...(i.payeeEmail ? { payee: { email_address: i.payeeEmail } } : {}),
      amount: { currency_code: 'USD', value, breakdown: { item_total: { currency_code: 'USD', value } } },
      items: [{ name: i.itemName.slice(0, 127), quantity: '1', category: 'DIGITAL_GOODS', unit_amount: { currency_code: 'USD', value } }],
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: i.brandName.slice(0, 127),
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      },
    },
  }, `create-${i.referenceId}`);
}

export async function getOrder(orderId: string): Promise<PayPalOrder> {
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) throw new PayPalError('Invalid order id', 400);
  return call<PayPalOrder>('GET', `/v2/checkout/orders/${orderId}`);
}

export async function captureOrder(orderId: string): Promise<PayPalOrder> {
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) throw new PayPalError('Invalid order id', 400);
  return call<PayPalOrder>('POST', `/v2/checkout/orders/${orderId}/capture`, {}, `capture-${orderId}`);
}

/** Refund a capture (full when amountCents is omitted). requestKey makes retries idempotent per refund. */
export async function refundCapture(captureId: string, note: string, amountCents?: number, requestKey = 'full'): Promise<{ id: string; status: string }> {
  const body: Record<string, unknown> = { note_to_payer: note.slice(0, 255) };
  if (amountCents != null) body.amount = { value: centsToPayPalValue(amountCents), currency_code: 'USD' };
  return call('POST', `/v2/payments/captures/${captureId}/refund`, body, `refund-${captureId}-${requestKey}`);
}

/** Extract the verified capture from a PayPal order representation. */
export function extractCapture(order: PayPalOrder): { captureId: string; status: string; amountCents: number; currency: string } | null {
  const cap = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!cap) return null;
  return { captureId: cap.id, status: cap.status, amountCents: toCents(cap.amount.value), currency: cap.amount.currency_code };
}

/** Verify a webhook with PayPal's verify-webhook-signature API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyWebhook(headers: Headers, event: any): Promise<boolean> {
  if (!env.paypalWebhookId) return false;
  const res = await call<{ verification_status: string }>('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: env.paypalWebhookId,
    webhook_event: event,
  });
  return res.verification_status === 'SUCCESS';
}
