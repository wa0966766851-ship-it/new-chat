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
        'buffer': 'buffer/',
      },
    },
    // 僅掃描正式入口，避免驗證伺服器把備份、報告與舊建置 HTML 當成應用入口。
    optimizeDeps: { entries: ['index.html'], exclude:['@seer-pet-anim/swf-bundle'],include:['buffer','pixi.js','eventemitter3','@arkntools/unity-js','@arkntools/unity-js-tools'],esbuildOptions:{define:{global:'globalThis'}} },
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
          // Worker 的第三方依賴原本全併進入口區塊（617 kB）。依套件邊界拆成獨立區塊，
          // 入口只留協調程式；ES worker 支援動態模組分塊，載入順序不變。
          if (file.includes('node_modules')) {
            // 同上：buffer-setup 必須與 buffer 同塊（ai-vendor），先於 @jimp 等讀取全域 Buffer 的模組求值。
            if (/node_modules\/@seer-pet-anim\/swf-bundle\/dist\/buffer-setup\.js$/.test(file)) return 'ai-vendor';
            if (/node_modules\/(?:pixi\.js|@pixi|@arkntools|@seer-pet-anim)\//.test(file)) return 'ai-vendor-pet';
            if (/node_modules\/(?:@jimp|@jsquash|pngjs|gifenc|gifuct-js|jszip|pako|wasm-webp)\//.test(file)) return 'ai-vendor-image';
            return 'ai-vendor';
          }
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
              // 精靈動作是選用功能；不可被通用 vendor-core 拉進首頁。
              // 精靈動作的依賴按「渲染引擎／Unity 解碼／圖像編解碼／其餘」分開，
              // 單一區塊不再超過 500 kB；分組只看套件邊界，不改任何執行順序。
              if (/node_modules\/(?:pixi\.js|@pixi)\//.test(normalized)) return 'vendor-pet-pixi';
              if (/node_modules\/@arkntools\//.test(normalized)) return 'vendor-pet-unity';
              if (/node_modules\/(?:@jimp|@jsquash|@tokenizer|@borewit|pngjs|exif-parser|file-type|gifenc|gifuct-js|strtok3|token-types|uint8array-extras|wasm-webp|wasm-feature-detect|jszip|pako|immediate|lie|js-binary-schema-parser)\//.test(normalized)) return 'vendor-pet-image';
              // 葉節點函式庫（不依賴其他精靈動作套件）獨立成 shared：若與 @seer-pet-anim 同塊，
              // 其他塊 ↔ actions 會互相靜態引入形成循環，載入時 zod／Buffer 在初始化前被使用（Cannot access before initialization），
              // 精靈動作永遠載入失敗。audit_bundle 以「區塊間不得有靜態引入循環」鎖定。
              if (/node_modules\/(?:es-toolkit|debug|ms|base64-js|earcut|eventemitter3|ismobilejs|aes-js|await-to-js|buffer|ieee754|parse-svg-path|setimmediate|tiny-lru|tinycolor2|zod)\//.test(normalized)) return 'vendor-pet-shared';
              // buffer-setup 把 Buffer 設到 globalThis；@jimp 等在模組求值時就讀全域 Buffer。必須與 buffer 同在最先求值的 shared 塊，
              // 否則 image 塊先於 actions 塊求值，載入時 ReferenceError: Buffer is not defined。
              if (/node_modules\/@seer-pet-anim\/swf-bundle\/dist\/buffer-setup\.js$/.test(normalized)) return 'vendor-pet-shared';
              if (/node_modules\/@seer-pet-anim\//.test(normalized)) return 'vendor-pet-actions';
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
        // 編輯器（含 AI 代理）存檔時會在來源目錄留下暫存目錄，被 watcher 抓到會 EBUSY 直接讓 dev server 崩潰，
        // 因此一併忽略所有以點開頭的暫存檔／暫存目錄。
        ignored: [
          '**/docs/**', '**/release/**', '**/releases/**', '**/dist/**', '**/build/**',
          '**/dist-electron/**', '**/.seer-cache/**', '**/_備份*/**',
          '**/.*.tmpdir/**', '**/*.tmpdir/**', '**/.*.tmp', '**/*.tmp', '**/.~*',
          // public 下的靜態圖只在啟動時掃描；大量／大檔寫入時被 watcher 抓到會 EBUSY 打死 dev server。
          '**/public/aegis/**', '**/public/elf-art/**', '**/public/elf-skins/**',
          '**/public/seer/**', '**/public/bg-thumbs/**', '**/public/eclipse/**',
        ],
      },
    },
  };
});
