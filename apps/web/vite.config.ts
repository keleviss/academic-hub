import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(projectRoot, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  const apiOrigin = env.API_ORIGIN || 'http://localhost:3000';

  return {
    root: projectRoot,
    envDir: workspaceRoot,
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
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4200,
      strictPort: true,
    },
    build: {
      outDir: '../../dist/apps/web',
      emptyOutDir: true,
    },
  };
});
