import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    // Pin the test DOM origin to the API base URL (@/config/api defaults to
    // http://localhost:8000). The MSW handlers use a mix of relative paths
    // (which resolve against location.origin) and absolute :8000 URLs; making
    // the origin :8000 lets both match. Without this, relative handlers resolve
    // to happy-dom's default :3000 and every API request is left unhandled —
    // which silently logs the seeded user out via AuthProvider's on-mount
    // /api/auth/me validation.
    environmentOptions: {
      happyDOM: { url: 'http://localhost:8000' },
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest scopes to src/. The e2e/ directory contains Playwright specs that
    // import from @playwright/test and would fail under vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/**/*.d.ts', 'src/test/**'],
    },
  },
})
