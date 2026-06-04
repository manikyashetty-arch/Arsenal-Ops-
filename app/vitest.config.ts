import path from 'path';
import { defineConfig } from 'vitest/config';

// Minimal Vitest config — node environment, `@` alias matching vite.config.ts.
// Kept separate from vite.config.ts so the app's React/inspect plugins don't
// load for pure-logic unit tests.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
