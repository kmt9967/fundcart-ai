// Runs before every unit/eval test file.
// The production Gemini key may only be used by the Vercel production deployment (see
// src/lib/ai/gemini-config.ts). Tests must never pose as production or opt into the production key,
// except the bounded compatibility check, which re-enables the override itself and caps its requests.
if (process.env.VERCEL_ENV === 'production') delete process.env.VERCEL_ENV;
if (!process.env.RUN_GEMINI_COMPAT) delete process.env.GEMINI_ALLOW_PROD_KEY;
