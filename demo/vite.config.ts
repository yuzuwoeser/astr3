import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      'astr3/ephemeris': fileURLToPath(new URL('../src/ephemeris/index.ts', import.meta.url)),
      astr3: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
  build: { outDir: '../demo-dist', emptyOutDir: true },
});
