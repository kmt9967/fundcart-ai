import 'server-only';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get supabaseUrl() { return req('SUPABASE_URL'); },
  get supabaseSecretKey() { return req('SUPABASE_SECRET_KEY'); },
  get channel3Key() { return req('CHANNEL3_API_KEY'); },
  get paypalClientId() { return req('PAYPAL_CLIENT_ID'); },
  get paypalSecret() { return req('PAYPAL_CLIENT_SECRET'); },
  get paypalEnv() { return (process.env.PAYPAL_ENV || 'sandbox') as 'sandbox'; },
  get paypalWebhookId() { return process.env.PAYPAL_WEBHOOK_ID || ''; },
  /** Sandbox account that receives campaign contributions (stands in for the creator's PayPal account). */
  get contributionPayeeEmail() { return process.env.PAYPAL_CONTRIBUTION_PAYEE_EMAIL || ''; },
  /** Sandbox account that receives the separate purchase (the demo store). */
  get storePayeeEmail() { return process.env.PAYPAL_STORE_PAYEE_EMAIL || ''; },
  get sessionSecret() { return req('SESSION_SECRET'); },
  get cronSecret() { return process.env.CRON_SECRET || ''; },
};

// Hard guard: this project must never talk to live PayPal.
if (process.env.PAYPAL_ENV && process.env.PAYPAL_ENV !== 'sandbox') {
  throw new Error('FundCart AI only supports PAYPAL_ENV=sandbox.');
}
