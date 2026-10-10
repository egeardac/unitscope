import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` emits relative asset URLs, so the same build works at
// https://egeardac.github.io/unitscope/, at a domain root, or from a local folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/engine/**/*.test.ts', 'tests/components/**/*.test.tsx'],
    environment: 'node',
  },
});
