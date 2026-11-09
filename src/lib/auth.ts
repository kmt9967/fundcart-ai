import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';
import { db } from './db';
import { verifyToken, GUEST_COOKIE, signGuest } from './identity';

// Optional creator accounts (Supabase Auth over REST).
//
// Security model
// - Passwords go only to Supabase Auth; FundCart never stores them.
// - After Supabase confirms the credentials, FundCart sets its own HMAC-signed, httpOnly account cookie
//   (profile id + auth user id + expiry). Every ownership check stays server-side (owner_id === profile).
// - Claiming: when someone signs in from a browser that holds a signed guest cookie, that guest
//   profile's campaigns/payments/wishlist move to the account. The signed cookie is the proof of
//   possession; knowing a campaign URL is never enough. Other historical records are left unchanged.
// - Demo limitation: Supabase's built-in mailer only delivers to project members, so sign-up creates a
//   pre-confirmed user through the admin API (email is NOT verified in this demo) and password-reset
//   emails may not arrive until custom SMTP is configured. Both are stated in the UI.

const ACCOUNT_COOKIE = 'fc_acct';
const MAX_AGE = 60 * 60 * 24 * 30;

function supabaseUrl() { return env.supabaseUrl.replace(/\/$/, ''); }
function publishableKey() { return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''; }

function sign(payload: string) { return crypto.createHmac('sha256', env.sessionSecret).update(`acct:${payload}`).digest('base64url').slice(0, 43); }

export type Account = { profileId: string; authUserId: string; exp: number };

export function verifyAccountToken(token: string | undefined): Account | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [profileId, authUserId, expS, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(profileId) || !/^[0-9a-f-]{36}$/.test(authUserId) || !/^\d{9,11}$/.test(expS)) return null;
  const expected = sign(`${profileId}.${authUserId}.${expS}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const exp = Number(expS);
  if (exp * 1000 < Date.now()) return null;
  return { profileId, authUserId, exp };
}

export async function currentAccount(): Promise<(Account & { email: string | null }) | null> {
  const jar = await cookies();
  const a = verifyAccountToken(jar.get(ACCOUNT_COOKIE)?.value);
  if (!a) return null;
  const p = await db().from('profiles').select('email, auth_user_id').eq('id', a.profileId).maybeSingle();
  if (!p.data || p.data.auth_user_id !== a.authUserId) return null; // unlinked or tampered
  return { ...a, email: (p.data.email as string) || null };
}

type AuthResult = { ok: true; userId: string; email: string } | { ok: false; error: string; status: number };

async function gotrue(path: string, init: RequestInit & { admin?: boolean }): Promise<Response> {
  const key = init.admin ? env.supabaseSecretKey : publishableKey();
  return fetch(`${supabaseUrl()}/auth/v1${path}`, {
    ...init,
    headers: { apikey: key, ...(init.admin ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000), cache: 'no-store',
  });
}

export async function passwordSignIn(email: string, password: string): Promise<AuthResult> {
  const res = await gotrue('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.user?.id) return { ok: false, error: 'auth.errInvalid', status: 401 };
  return { ok: true, userId: j.user.id, email: j.user.email };
}

export async function createAccount(email: string, password: string): Promise<AuthResult> {
  const res = await gotrue('/admin/users', { method: 'POST', admin: true, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(j?.msg || j?.message || j?.error_description || '');
    if (/already|registered|exists/i.test(msg) || res.status === 422) return { ok: false, error: 'auth.errExists', status: 409 };
    if (/password/i.test(msg)) return { ok: false, error: 'auth.errWeak', status: 422 };
    return { ok: false, error: 'auth.errGeneric', status: 502 };
  }
  return passwordSignIn(email, password);
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  await gotrue(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: JSON.stringify({ email }) }).catch(() => null);
}

/** Set a new password using the short-lived recovery access token from the reset email link. */
export async function resetPassword(accessToken: string, password: string): Promise<AuthResult> {
  const res = await gotrue('/user', { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ password }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.id) return { ok: false, error: 'auth.errResetLink', status: 401 };
  return { ok: true, userId: j.id, email: j.email };
}

/**
 * Link the signed-in Supabase user to a FundCart profile and set the cookies.
 * Returns how many guest campaigns were claimed (moved) into the account.
 */
export async function linkAndSignIn(authUserId: string, email: string): Promise<{ profileId: string; claimed: number }> {
  const jar = await cookies();
  const guest = verifyToken(jar.get(GUEST_COOKIE)?.value);
  const existing = await db().from('profiles').select('id').eq('auth_user_id', authUserId).maybeSingle();
  let profileId: string; let claimed = 0;

  if (existing.data) {
    profileId = existing.data.id as string;
    if (guest && guest !== profileId) {
      const g = await db().from('profiles').select('auth_user_id').eq('id', guest).maybeSingle();
      if (g.data && !g.data.auth_user_id) {
        // Proof of possession: this browser holds the signed guest cookie for these records.
        const moved = await db().from('campaigns').update({ owner_id: profileId, updated_at: new Date().toISOString() }).eq('owner_id', guest).select('id');
        claimed = moved.data?.length || 0;
        await db().from('payment_orders').update({ user_id: profileId }).eq('user_id', guest);
        await db().from('ai_sessions').update({ user_id: profileId }).eq('user_id', guest);
        const wl = await db().from('wishlist_items').select('id, product_snapshot_id').eq('user_id', guest);
        for (const w of wl.data || []) await db().from('wishlist_items').update({ user_id: profileId }).eq('id', w.id).then(() => null, () => null);
      }
    }
  } else if (guest) {
    const g = await db().from('profiles').select('auth_user_id').eq('id', guest).maybeSingle();
    if (g.data && !g.data.auth_user_id) {
      await db().from('profiles').update({ auth_user_id: authUserId, email }).eq('id', guest);
      profileId = guest;
    } else {
      profileId = crypto.randomUUID();
      await db().from('profiles').insert({ id: profileId, display_name: email.split('@')[0].slice(0, 60), auth_user_id: authUserId, email });
    }
  } else {
    profileId = crypto.randomUUID();
    await db().from('profiles').insert({ id: profileId, display_name: email.split('@')[0].slice(0, 60), auth_user_id: authUserId, email });
  }
  await db().from('profiles').update({ email }).eq('id', profileId);

  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${profileId}.${authUserId}.${exp}`;
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE };
  jar.set(ACCOUNT_COOKIE, `${payload}.${sign(payload)}`, opts);
  // The guest identity becomes the account's profile, so existing ownership checks keep working.
  jar.set(GUEST_COOKIE, signGuest(profileId), { ...opts, maxAge: 60 * 60 * 24 * 90 });
  return { profileId, claimed };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCOUNT_COOKIE);
  jar.delete(GUEST_COOKIE);
}
