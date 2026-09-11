import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default defineConfig((configEnv) => {
  const resolvedViteConfig =
    typeof viteConfig === 'function'
      ? viteConfig(configEnv as ConfigEnv)
      : viteConfig;

  return mergeConfig(resolvedViteConfig as UserConfig, {
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['./src/test/setup.ts'],
    },
  });
});
