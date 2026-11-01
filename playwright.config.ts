import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Load .env.local for test-only sandbox buyer credentials (never committed).
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('='); if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1);
  }
}

// Optional device emulation, e.g. E2E_DEVICE="Pixel 7" or "iPhone 13" (still runs in Chrome).
const device = (() => {
  if (!process.env.E2E_DEVICE) return {};
  const d = { ...devices[process.env.E2E_DEVICE] } as Partial<(typeof devices)[string]>;
  delete d.defaultBrowserType; // keep running in Chrome
  return d;
})();

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  outputDir: 'test-results',
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-report.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    channel: 'chrome',
    headless: process.env.E2E_HEADED ? false : true,
    viewport: { width: 1366, height: 900 },
    ...device,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
