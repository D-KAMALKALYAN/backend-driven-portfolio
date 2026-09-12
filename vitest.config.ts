import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': '/src',
      // `import 'server-only'` throws outside a React Server Components
      // bundle, by design. Tests import server modules directly, so the
      // marker resolves to an empty module here.
      'server-only': path.resolve(__dirname, 'src/__tests__/stubs/server-only.ts'),
    },
  },
});
