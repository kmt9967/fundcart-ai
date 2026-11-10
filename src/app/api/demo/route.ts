import { NextResponse } from 'next/server';
import { DEMO_COOKIE, DEMO_MAX_AGE, newDemoToken } from '@/lib/demo';
import { sharedRateLimit, clientKey, bucketId } from '@/lib/ratelimit';
import { recordSecurityEvent } from '@/lib/security-events';

export const runtime = 'nodejs';

// Start or leave the read-only demo. Form POST (works without JavaScript); answers with a redirect.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const action = form?.get('action') === 'exit' ? 'exit' : 'start';
  const base = new URL(req.url);
  if (action === 'exit') {
    const res = NextResponse.redirect(new URL('/', base), 303);
    res.cookies.delete(DEMO_COOKIE);
    return res;
  }
  const ip = clientKey(req);
  const rl = await sharedRateLimit([['demo_ip_min', ip, 10, 60], ['demo_ip_day', ip, 200, 86400]]);
  if (!rl.ok) {
    void recordSecurityEvent('rate_limited', 'warn', bucketId('ip', ip), { route: 'demo' });
    return NextResponse.redirect(new URL('/demo?limited=1', base), 303);
  }
  const res = NextResponse.redirect(new URL('/demo', base), 303);
  res.cookies.set(DEMO_COOKIE, newDemoToken(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DEMO_MAX_AGE });
  return res;
}
