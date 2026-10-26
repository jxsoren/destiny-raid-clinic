import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Unit tests do not need HMR; its virtual refresh URL is invalid on Windows.
  plugins: [solid({ hot: false })],
  resolve: { conditions: ['development', 'browser'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
