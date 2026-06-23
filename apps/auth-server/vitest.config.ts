import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{js,ts}'],
    setupFiles: [path.resolve(__dirname, '../../vitest.setup.js')],
    // Coverage (include scope + thresholds) is configured once at the repo root
    // (/vitest.config.ts). Vitest ignores per-project coverage config in projects
    // mode, so defining it here would be dead, misleading config.
  },
});
