# Integration test report

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Vitest | 323 passed, 2 skipped | Unit, security, and embedded PostgreSQL in one run. Quote cases cover seller and amount changes and missing stock, currency and price evidence. |
| Chromium | 15 passed, 2 skipped | Loopback fixture. Covers ownership, four widths, wizard, receipts and persistence. Voice is simulated; the image UI uses a mocked Gemini response. The image endpoint rejects anonymous callers and unsupported content types. |
| TypeScript and production build | Passed | Combined branch build with the image route. |
| ESLint | Passed with one pre-existing unused-import warning | Retried after Playwright recreated its output folder. |
| Dependency audit | Zero findings | npm audit against the project lockfile. |
| Hosted database and payment | Blocked | No authorized isolated Supabase, PayPal Sandbox, webhook or email sink was configured. |
| Visual acceptance | Incomplete | Phase 2 Stitch captures are retained. Responsive browser regressions pass. The new voice/photo controls still need Stitch acceptance. |

Browser reproduction in PowerShell.

```powershell
npm run build
$env:E2E_PHASE2_FIXTURE = '1'
npm run test:e2e -- tests/e2e/phase-two.spec.ts tests/e2e/smoke.spec.ts
```

The fixture skips the real catalog streaming test and the configured-payment smoke test. The two Vitest skips are opt-in integration cases. See the [staging checklist](FINAL_DEPLOYMENT_REPORT.md) and [Phase 2 provider setup](PHASE_2_STITCH.md#isolated-acceptance-commands).
