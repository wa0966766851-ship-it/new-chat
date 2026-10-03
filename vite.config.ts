import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execFileSync } from 'node:child_process';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Keep the release marker tied to the exact GitHub revision used for this build.
  // A missing Git checkout (for example an exported source archive) simply omits
  // the update prompt instead of marking a release with an invented version.
  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch { /* exported source without Git metadata */ }
  return {
    plugins: [
      react(), tailwindcss(),
      {
        name: 'release-version',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit }) });
        },
      },
    ],
    define: { __APP_COMMIT__: JSON.stringify(commit) },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      manifest: true,
      // 不使用 unsafe/property mangling：Blockly 公開 API 與工作區存檔格式需保持相容。
      minify: 'terser',
      terserOptions: { maxWorkers: 2, compress: { passes: 2 }, mangle: true, format: { comments: 'some' } },
      rollupOptions: {
        output: {
          // Keep chart-only dependencies with the lazy battle UI. Rollup's
          // implicit grouping would otherwise pull a 1 MB chart bundle into
          // the start screen even before a battle is opened.
          onlyExplicitManualChunks: true,
          manualChunks(id) {
            // 不可變的純資料獨立快取；不將含執行邏輯的模組強行拆入，以免循環初始化。
            const normalized = id.replace(/\\/g, '/');
            // 官方原始碼已依循環依賴群組／拓樸順序生成 ESM，不重新合回單體。
            const blocklyModule = normalized.match(/\/src\/vendor\/blockly\/(core-\d+)\.js$/);
            if (blocklyModule) return `blockly-${blocklyModule[1]}`;
            if (/\/src\/data\/defaultElves\.ts$/.test(normalized)) return 'data-elves';
            // 跨首頁／百科／特殊模式共用的純函數，沒有 React 或狀態初始化相依。
            if (/\/src\/utils\/(elfSearch|controlSettings|safeStorage|elfDisplayRank)\.ts$/.test(normalized)) return 'ui-foundation';
            if (/\/src\/data\/(elfSourceText\.json|skillReferences\.generated\.json|alienTraits\.ts|generalTraits\.ts|titles\.ts)$/.test(normalized)) {
              return 'data-reference';
            }
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
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
