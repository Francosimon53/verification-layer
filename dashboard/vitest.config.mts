import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Run from the dashboard folder with the root vitest binary:
//   ../node_modules/.bin/vitest run --config vitest.config.mts
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    include: ['app/**/*.test.ts', 'components/**/*.test.ts', 'lib/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
