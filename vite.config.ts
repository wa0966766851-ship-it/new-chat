import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Keep the release marker tied to the exact GitHub revision used for this build.
  // A missing Git checkout (for example an exported source archive) simply omits
  // the update prompt instead of marking a release with an invented version.
  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, encoding: 'utf8' }).trim();
  } catch { /* exported source without Git metadata */ }
  const version = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
  const builtAt = new Date().toISOString();
  const buildId = createHash('sha256').update(`${commit}:${version}:${builtAt}:${process.pid}`).digest('hex');
  return {
    plugins: [
      react(), tailwindcss(),
      {
        name: 'release-version',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ schemaVersion: 1, version, commit, buildId, builtAt }) });
        },
      },
    ],
    define: { __APP_COMMIT__: JSON.stringify(commit), __APP_BUILD_ID__: JSON.stringify(buildId), __APP_VERSION__: JSON.stringify(version) },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // 僅掃描正式入口，避免驗證伺服器把備份、報告與舊建置 HTML 當成應用入口。
    optimizeDeps: { entries: ['index.html'] },
    // 背景推演獨立載入正式引擎；ES worker 支援動態模組分塊。
    worker: {
      format: 'es',
      rollupOptions: { output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const file = id.replace(/\\/g, '/');
          // 資料／精靈註冊模組／通用引擎依既有模組邊界分塊。
          // 初始化順序與跨塊相容性由正式Worker測試鎖定，不改寫任何handler。
          if (file.includes('/src/effects/elves/')) return 'ai-elf-effects';
          if (/\/src\/effects\/(sequenceContract|sequenceClosureContract|astralContract)\.ts$/.test(file)) return 'ai-kit-contracts';
          if (/\/src\/blocks\/runtime\.ts$/.test(file)) return 'ai-block-runtime';
          if (/\/src\/data\/(blockLibraryData\.ts|blockLibrary\.packed\.json|packedJson\.ts)$/.test(file)) return 'ai-data-blocks';
          if (file.includes('/src/data/elfProfiles/')) return 'ai-data-profiles';
          if (/\/src\/data\/(reviewedSkillKits|reviewedSequenceSkillKits|migratedSequenceSkillKits)\.ts$/.test(file)) return 'ai-data-kits';
          if (/\/src\/data\/(descriptions\.compressed\.json|descriptionSources\.ts)$/.test(file)) return 'ai-data-descriptions';
          if (/\/src\/data\/defaultElves\.ts$/.test(file)) return 'ai-data-elves';
          if (/\/src\/data\/codex\.packed\.json$/.test(file)) return 'ai-data-codex';
          if (/\/src\/blocks\/parse\.ts$/.test(file)) return 'ai-description-parser';
        },
      } },
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
            // 描述解析為純函式；獨立快取，不強拆帶狀態的精靈 handler。
            if (/\/src\/blocks\/parse\.ts$/.test(normalized)) return 'effect-description-parser';
            if (/\/src\/data\/defaultElves\.ts$/.test(normalized)) return 'data-elves';
            // 百科壓縮資料（約350 kB）為純資料；獨立成塊，codexRegistry 邏輯塊才不會超過500 kB預算。
            if (/\/src\/data\/codex\.packed\.json$/.test(normalized)) return 'data-codex';
            // 跨首頁／百科／特殊模式共用的純函數，沒有 React 或狀態初始化相依。
            if (/\/src\/utils\/(elfSearch|controlSettings|safeStorage|elfDisplayRank)\.ts$/.test(normalized)) return 'ui-foundation';
            if (/\/src\/data\/(descriptions\.compressed\.json|descriptionSources\.ts|alienTraits\.ts|generalTraits\.ts|titles\.ts)$/.test(normalized)) {
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
        ignored: ['**/docs/**', '**/release/**', '**/releases/**', '**/dist/**', '**/build/**', '**/dist-electron/**', '**/.seer-cache/**', '**/_備份*/**'],
      },
    },
  };
});
