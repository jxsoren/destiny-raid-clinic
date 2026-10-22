import { defineConfig } from 'vitest/config';

// Unit tests for build-time site logic (no DOM). Browser tests live in e2e/ (Playwright).
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
