import { z } from 'zod';
import { createAccount, linkAndSignIn, passwordSignIn, requestPasswordReset, resetPassword, signOut } from '@/lib/auth';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { getLocale } from '@/i18n/server';
import { t } from '@/i18n';

export const runtime = 'nodejs';

const Email = z.string().trim().toLowerCase().email().max(254);
const Password = z.string().min(8).max(72);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signup'), email: Email, password: Password }),
  z.object({ action: z.literal('login'), email: Email, password: z.string().min(1).max(72) }),
  z.object({ action: z.literal('logout') }),
  z.object({ action: z.literal('recover'), email: Email }),
  z.object({ action: z.literal('reset'), accessToken: z.string().min(20).max(4000), password: Password }),
]);

function origin(req: Request) {
  const h = req.headers; const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  return `${h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
}

// One endpoint for sign-up / sign-in / sign-out / password recovery. Rate limited; generic errors.
export async function POST(req: Request) {
  const locale = await getLocale();
  if (!rateLimit(`auth:${clientKey(req)}`, 10, 60_000).ok) return Response.json({ error: t(locale, 'auth.errRate') }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const paths = p.error.issues.map(i => i.path.join('.'));
    const weak = paths.includes('password') && !paths.includes('email');
    return Response.json({ error: t(locale, weak ? 'auth.errWeak' : 'auth.errInput') }, { status: 400 });
  }
  const d = p.data;
  if (d.action === 'logout') { await signOut(); return Response.json({ ok: true }); }
  if (d.action === 'recover') {
    await requestPasswordReset(d.email, `${origin(req)}/account/reset`);
    // Same answer whether or not the address exists (no account enumeration).
    return Response.json({ ok: true, message: t(locale, 'auth.recoverSent') });
  }
  const r = d.action === 'signup' ? await createAccount(d.email, d.password) : d.action === 'login' ? await passwordSignIn(d.email, d.password) : await resetPassword(d.accessToken, d.password);
  if (!r.ok) return Response.json({ error: t(locale, r.error as never) }, { status: r.status });
  const { claimed } = await linkAndSignIn(r.userId, r.email);
  return Response.json({ ok: true, claimed });
}
