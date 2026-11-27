import path from 'node:path';
import { defineConfig, mergeConfig } from 'vite';
import simulatorConfig from './vite.config';

export default defineConfig(async environment => {
  const base = typeof simulatorConfig === 'function' ? await simulatorConfig(environment) : simulatorConfig;
  return mergeConfig(base, {
    build: {
      outDir: 'dist-online',
      rollupOptions: { input: path.resolve(__dirname, 'online.html') },
    },
    optimizeDeps: { entries: ['online.html'] },
  });
});
