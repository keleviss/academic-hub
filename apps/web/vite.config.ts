import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  cacheDir: '../../node_modules/.vite/apps/web',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@web-app/contracts': resolve(
        projectRoot,
        '../../packages/contracts/src/index.ts',
      ),
    },
  },
  server: {
    port: 4200,
    strictPort: true,
  },
  preview: {
    port: 4200,
    strictPort: true,
  },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
  },
});
