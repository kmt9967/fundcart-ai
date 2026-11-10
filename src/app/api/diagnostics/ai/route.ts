import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { llmDiagnostics } from '@/lib/ai/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator-only Gemini usage diagnostics: configured models, which key project is in use (production /
// development / none, never the key), request counts, error classes, cooldowns and fallback reasons.
// Requires `Authorization: Bearer <CRON_SECRET>`; without a configured secret the endpoint does not exist.
export async function GET(req: Request) {
  const secret = env.cronSecret;
  if (!secret) return new Response('not found', { status: 404 });
  const given = Buffer.from(req.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return new Response('unauthorized', { status: 401 });
  return Response.json(llmDiagnostics(), { headers: { 'cache-control': 'no-store' } });
}
