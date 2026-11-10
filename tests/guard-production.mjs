// Shared guard for test scripts: automated runs must not spend the production Gemini quota.
// Against a local server the app itself refuses the production key (src/lib/ai/gemini-config.ts), so
// only remote targets are checked here. A deliberate, bounded production check needs ALLOW_PRODUCTION_AI=1.
export function guardProduction(base, { geminiCallsEstimate = 0, label = 'this script' } = {}) {
  const host = new URL(base).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (local) return;
  if (process.env.ALLOW_PRODUCTION_AI !== '1') {
    console.error(`Refusing to run ${label} against ${host}: it would use the production Gemini quota (about ${geminiCallsEstimate} model calls).\nRun it against a local server, or set ALLOW_PRODUCTION_AI=1 for a deliberate, bounded check.`);
    process.exit(2);
  }
  console.warn(`ALLOW_PRODUCTION_AI=1: running ${label} against ${host}; up to about ${geminiCallsEstimate} production Gemini calls.`);
}
