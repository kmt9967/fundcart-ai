import 'server-only';
import { env } from '../env';

// Gemini (Google AI Studio free tier) over plain REST with JSON-schema constrained output.
// If no key is configured or the call fails, callers fall back to deterministic logic and the UI
// labels the result accordingly — we never pretend a fallback answer came from the model.

export type LlmResult<T> = { ok: true; data: T; model: string } | { ok: false; error: string };

export function llmAvailable(): boolean {
  return Boolean(env.geminiKey);
}

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<LlmResult<T>> {
  if (!env.geminiKey) return { ok: false, error: 'no_key' };
  // Try each configured model in order; fall through only on transient/availability errors.
  let lastError = 'llm_error';
  for (const model of env.geminiModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.3,
            maxOutputTokens: opts.maxOutputTokens ?? 4096,
            responseMimeType: 'application/json',
            responseSchema: opts.schema,
          },
        }),
        signal: AbortSignal.timeout(20000),
        cache: 'no-store',
      });
      if (!res.ok) {
        lastError = `llm_http_${res.status}`;
        if ([404, 408, 429, 500, 502, 503, 504].includes(res.status)) continue;
        return { ok: false, error: lastError };
      }
      const json = await res.json();
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
      if (!text) { lastError = 'llm_empty'; continue; }
      return { ok: true, data: JSON.parse(text) as T, model };
    } catch (e) {
      lastError = e instanceof Error ? e.name : 'llm_error';
    }
  }
  return { ok: false, error: lastError };
}
