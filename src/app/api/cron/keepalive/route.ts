import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

// Daily ping (Vercel Cron) so the free Supabase project is not paused during judging.
export async function GET(req: Request) {
  if (env.cronSecret && req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return new Response('unauthorized', { status: 401 });
  const r = await db().from('campaigns').select('id', { count: 'exact', head: true });
  return Response.json({ ok: !r.error, campaigns: r.count ?? 0, at: new Date().toISOString() });
}
