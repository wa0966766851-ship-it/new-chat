import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // 不可變的純資料獨立快取；不將含執行邏輯的模組強行拆入，以免循環初始化。
            const normalized = id.replace(/\\/g, '/');
            if (/\/src\/data\/(elfSourceText\.json|skillReferences\.generated\.json|alienTraits\.ts|generalTraits\.ts|titles\.ts)$/.test(normalized)) {
              return 'data-reference';
            }
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('blockly')) {
                return 'vendor-blockly';
              }
              if (id.includes('motion') || id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              return 'vendor-core';
            }
            // 應用程式頁面依 React.lazy 動態載入自動切分
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // 驗收報告、截圖與封裝產物不應造成正在編輯的頁面被整頁重載。
        ignored: ['**/docs/**', '**/release/**', '**/releases/**', '**/dist/**', '**/_備份*/**'],
      },
    },
  };
});
