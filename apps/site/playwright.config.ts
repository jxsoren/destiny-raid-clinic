import { defineConfig, devices } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

// Runs against the built site (just build first). astro preview stays in the foreground here.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // One worker on CI: the scenes render with software GL, and parallel pages starve each other.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4329',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec astro preview --port 4329 --ignore-lock',
    url: 'http://localhost:4329/styleguide/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
