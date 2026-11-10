import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // setup strips the production Gemini override, so no unit/eval run can use the production key.
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', setupFiles: ['tests/unit/setup.ts'] },
});
