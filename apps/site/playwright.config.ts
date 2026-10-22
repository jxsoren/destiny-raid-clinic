import { defineConfig, devices } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

// Runs against the built site (just build first). astro preview stays in the foreground here.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4329',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm exec astro preview --port 4329 --ignore-lock',
    url: 'http://localhost:4329/styleguide/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
