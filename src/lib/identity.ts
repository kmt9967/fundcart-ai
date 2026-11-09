import 'server-only';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { env } from './env';
import { db } from './db';

// Lightweight guest identity: a random UUID in an HMAC-signed, httpOnly cookie.
// Judges can use the app instantly; campaign edits and purchase approval are bound to this identity.

const COOKIE = 'fc_uid';
export const GUEST_COOKIE = COOKIE;

function sign(id: string) {
  return crypto.createHmac('sha256', env.sessionSecret).update(id).digest('base64url').slice(0, 32);
}

/** Signed cookie value for a profile id (used when an account sign-in switches this browser's identity). */
export function signGuest(id: string): string { return `${id}.${sign(id)}`; }

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [id, sig] = token.split('.');
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const expected = sign(id);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}

/** Read the current guest id (null if none). */
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

/** Get or create the guest id. Only callable from Route Handlers / Server Actions (sets a cookie). */
export async function ensureUser(displayName?: string): Promise<string> {
  const existing = await currentUserId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  await db().from('profiles').upsert({ id, display_name: (displayName || 'Guest').slice(0, 60) });
  const jar = await cookies();
  jar.set(COOKIE, `${id}.${sign(id)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 });
  return id;
}
