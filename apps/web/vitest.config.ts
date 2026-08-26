import { mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(viteConfig, {
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
