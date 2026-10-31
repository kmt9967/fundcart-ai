'use client';

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useState } from 'react';

export type CaptureResult =
  | { state: 'completed'; captureId: string; amountCents: number; alreadyRecorded: boolean; orderId: string }
  | { state: 'pending'; captureId: string; status: string; orderId: string };

/**
 * PayPal Smart Buttons (Sandbox). The server creates the order (amount priced server-side),
 * the buyer approves inside PayPal, then the server captures and verifies. We only report success
 * when our server confirms a COMPLETED capture from PayPal.
 */
export function PayPalCheckout({ clientId, body, disabled, onResult, label = 'pay' }: {
  clientId: string;
  body: () => Record<string, unknown> | null;
  disabled?: boolean;
  onResult: (r: CaptureResult) => void;
  label?: 'pay' | 'checkout' | 'paypal';
}) {
  const [status, setStatus] = useState<{ kind: 'idle' | 'working' | 'error' | 'cancelled'; msg?: string }>({ kind: 'idle' });

  return (
    <div>
      <PayPalScriptProvider options={{ clientId, currency: 'USD', intent: 'capture', components: 'buttons', disableFunding: 'paylater,venmo' }}>
        <PayPalButtons
          style={{ layout: 'vertical', shape: 'rect', label, height: 45 }}
          disabled={disabled}
          forceReRender={[disabled]}
          createOrder={async () => {
            setStatus({ kind: 'working', msg: 'Creating your PayPal Sandbox order…' });
            const b = body();
            if (!b) { setStatus({ kind: 'error', msg: 'Please check the amount.' }); throw new Error('invalid'); }
            const res = await fetch('/api/paypal/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.orderId) { setStatus({ kind: 'error', msg: j.error || 'Could not start PayPal.' }); throw new Error(j.error || 'order failed'); }
            setStatus({ kind: 'working', msg: 'Waiting for approval in PayPal…' });
            return j.orderId as string;
          }}
          onApprove={async data => {
            setStatus({ kind: 'working', msg: 'Approved in PayPal. Capturing and verifying with PayPal…' });
            const res = await fetch(`/api/paypal/orders/${data.orderID}/capture`, { method: 'POST' });
            const j = await res.json().catch(() => ({}));
            if (j.state === 'completed' || j.state === 'pending') { setStatus({ kind: 'idle' }); onResult({ ...j, orderId: data.orderID }); return; }
            setStatus({ kind: 'error', msg: j.message || 'PayPal did not complete the payment.' });
          }}
          onCancel={() => setStatus({ kind: 'cancelled', msg: 'Payment cancelled in PayPal. Nothing was charged.' })}
          onError={() => setStatus(s => s.kind === 'error' ? s : { kind: 'error', msg: 'PayPal reported an error. Please try again.' })}
        />
      </PayPalScriptProvider>
      {status.msg && (
        <p role="status" className={`mt-2 text-sm ${status.kind === 'error' ? 'text-bad' : status.kind === 'cancelled' ? 'text-warn' : 'text-mute'}`}>{status.msg}</p>
      )}
    </div>
  );
}
