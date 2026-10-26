import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

// Build-time tests use Node; component tests opt into jsdom with a file annotation.
export default defineConfig({
  plugins: [solid({ hot: false })],
  resolve: { conditions: ['development', 'browser'] },
  test: { environment: 'node', include: ['test/**/*.test.{ts,tsx}'] },
});
