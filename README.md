# 賽爾對戰模擬器 Seer Battle Simulator

React + Vite + Express + Electron 的賽爾號對戰模擬器：組隊、戰鬥結算、魂印 Registry、Blockly 技能編輯、圖鑑 Codex、桌面打包。

遠端：https://github.com/wa0966766851-ship-it/new-chat.git（分支 `main`）
版本單一來源：`version.ts`（目前 `1.0.0`，須符合 semver，electron-builder 要用）。
入口：`index.html` → `src/main.tsx` → `src/App.tsx`。

## 系統需求

- Node.js 20+、npm
- Windows PowerShell（另有 `.bat` 一鍵腳本）
- 可選：`GEMINI_API_KEY`（沒有也能跑，只是 AI 生成類 API 會停用）

## 快速開始

```powershell
npm install
Copy-Item .env.example .env  # 之後把 GEMINI_API_KEY 填進 .env
npm run dev                 # tsx server.ts，前後端同源 http://localhost:3000
```

```bash
# bash / macOS / Linux 對照
npm install
cp .env.example .env
npm run dev
```

常用驗證：

```powershell
npm run lint   # tsc --noEmit
npm test       # 完整測試鏈（含 scopes / loading / data / ui）
npm run build  # vite build + esbuild server.ts → dist/
npm start      # node dist/server.cjs
```

沒有設定 `GEMINI_API_KEY` 時，`GET /api/ai-status` 會回 `{ enabled: false }`，
`/api/generate-elf`、`/api/analyze-elf`、`/api/parse-effect-text`、`/api/dissect-tokens` 會回 503，前端改走本地解析，不會炸場。

## 環境變數

| 變數 | 說明 |
|---|---|
| `GEMINI_API_KEY` | Gemini API 金鑰。AI Studio 會在執行期注入；本地開發請寫進 `.env`。沒設就停用 AI 端點。 |
| `APP_URL` | 對外 URL（self link / callback 用）。AI Studio 執行期注入。 |
| `PORT` | 伺服器埠，預設 `3000`（`server.ts` 讀 `process.env.PORT`）。 |
| `DISABLE_HMR` | 設為 `true` 會關 HMR 與檔案監看，避免 agent 改檔時畫面閃爍。 |

`.env*` 不進版控（見 `.gitignore`），只有 `.env.example` 會送上 GitHub。

## 指令一覽

以 `package.json` 為準：

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發啟動（`tsx server.ts`） |
| `npm start` | 生產啟動（`node dist/server.cjs`，要先 `build`） |
| `npm run build` | 前端 `vite build` + 後端 `esbuild server.ts → dist/server.cjs` |
| `npm run build:electron` | Electron 用的 bundle（`--packages=bundle`） |
| `npm run lint` | 型別檢查 |
| `npm test` | 全部測試：units、sprite 朝向、blocks 語意、異雷、聖靈邁爾斯、handled-skills、block 覆蓋率，再接 `test:loading` |
| `npm run test:loading` | codex / profile 延遲載入測試，再接 `test:data`、`test:ui`、`test:scopes` |
| `npm run test:scopes` | 體力與切換作用域語意測試（`tests/battleStateScopes.semantic.test.ts`） |
| `npm run test:data` | `pack_effect_data --check` + `gen_skill_references --check` |
| `npm run test:ui` | `uiFoundation` + `elfEditorLayout` |
| `npm run audit:bundle` | 打包體積稽核（要在 `build` 之後跑） |
| `npm run audit:blocks` | block 覆蓋率明細 |
| `npm run data:pack` | 產生 `codex.packed.json` / `blockLibrary.packed.json` 等衍生檔 |
| `npm run data:skills` | 產生 `skillReferences.generated.json` |
| `npm run gen:handled-skills` | 產生 handled-skills 清單 |
| `npm run package:portable` / `package:zip` | 可攜包（`scripts/package_portable.ps1`） |
| `npm run build:exe` / `build:exe-keep` | 產生 exe（前者 `--bump` 升版） |
| `npm run prepare:share` | 準備分享包（`tools/prepare_share.ts --force`） |
| `npm run electron:dev` | `build` 後用 `electron/main.cjs` 起桌面殼 |
| `npm run package:electron` | `electron-builder --config electron-builder.yml`（nsis + portable） |

Windows 另有：`啟動對戰模擬器.bat`、`停止對戰模擬器.bat`、`Build_EXE.bat`、`rebuild-portable-exe.bat`、`賽爾模擬器一鍵工具.bat`、`setup-env.bat`。

## 專案結構

```
index.html -> src/main.tsx -> src/App.tsx
  view: start | custom | battle | destiny_wheel | interstellar_exploration | test_runner
  懶載入： ElfEditor / Encyclopedia / DestinyWheelScreen / TestRunnerPage / BattleScreen / InterstellarHub

server.ts                  # Express + Vite 中介 + Gemini API + /seer/:kind/:file 圖資代理 + /images 靜態
src/App.tsx                # GameDataProvider + 隊伍 / 先發 / 套裝 / 稱號 state
src/main.tsx               # StrictMode + createRoot
src/types.ts               # Elf / Skill / SoulMark 等共用型別
src/components/            # BattleScreen（調度）+ BattleScreen.ui + BattleManager（reducer）
                           # StartScreen / ElfEditor(+Sections) / Encyclopedia / DestinyWheel / InterstellarHub
                           # BlocklyBuilder / ElfBlocklyPanel / KitEffectBuilder / InscriptionSystem 等
src/battle/                # timers / marks / survivalRules / damageSemantics / effectMeta
                           # contextBuilders / elfPositions / seerAssets / stateScopes（個人/陣營分離）
src/effects/               # 各精靈 Registry（handler 本體）；描述物已搬到 src/data/elfProfiles，原檔留 re-export
src/data/                  # defaultElves / elfRegistry / codex.json / codexRegistry / codexEntry（延遲解析）
                           # blockLibrary / packed 生成檔 / skillReferences.generated.json / elfProfiles/
                           # suitsAndEyewears / titles / inscriptionsCatalog / skillStones / traits
src/blocks/                # Blockly：model / parse / registry / runtime / custom / specs / kitEntries
src/contexts/              # GameDataContext（customElves + overrides + localStorage）
src/utils/                 # elfStats（能力正規邊界）/ statCalculator / extraElf / traitsEngine 等
src/lib/ / src/registries/ # 共用小工具 / 計數器
src/tests/ + tests/        # units / blocks.semantic / scopes / loading / sprite 朝向等
electron/                  # main.cjs + preload.cjs（appId: com.seer.battle.simulator）
scripts/ / tools/          # audit_bundle / pack_effect_data / gen_skill_references / build_exe / prepare_share
docs/                      # 傷害定義正典 / 修正計畫 / 效能報告 / 協作說明等
public/ / images/ / pet/ / 系/  # 官方快照與自製立繪（elf-art 優先於官方圖）
launcher/ / packaging/     # 本地啟動與可攜包腳本
```

別被根目錄的備份資料夾嚇到：`_修正前備份`、`_備份_20250927_還債前`、`_asset_backup`、`dist/`、`release/`、`node_modules/` 都不在版控重點內（見 `.gitignore`）。

## 後端速覽（server.ts）

前後端同源，開發期掛 `vite.middlewares`，生產期吃 `dist/` + SPA fallback：

- `GET /api/ai-status` → `{ enabled }`
- `POST /api/generate-elf`：自然語言 → 結構化精靈（含 decompositionReport）
- `POST /api/analyze-elf` / `/api/parse-effect-text` / `/api/dissect-tokens`：解析與 token 拆解
- `POST /api/get-title`：稱號相關
- `GET /seer/:kind/:file`：圖資代理；`/images` 靜態目錄
- 沒 key 的 AI 端點一律 503 + `aiDisabled: true`

## 架構約定（AGENTS.md 精簡版）

- Anti-Bloat：精靈專屬邏輯嚴禁硬塞 `BattleScreen.tsx`，一律走 `src/effects/*Registry`。
- Registry Pattern：`Record<SkillName, handler>`，在 `battleEventRegistry.ts` 用展開合併，戰鬥中只調 `BattleSkillRegistry[skill.name]?.(ctx)`。
- 語義流程：自然語言 → Trigger / Condition / Target / Action → 生成註冊表 → 掛 `BattleContext`（`get/setPlayerState`、`addLog`、各類 `applyDamage`、`applyStatusWithImmunityCheck`）。
- 作用域：`src/battle/stateScopes.ts` 區分個人 / 陣營。`下場後保留 = 同一 battleId 保留`，不是送給下一隻；只有文本寫 `己方所有 / 己方在場 / 指定下一隻`（如 fear_seed、花、demon_grudge、scarlett_holy_light 等）才保留陣營作用域。
- 能力邊界：`src/utils/elfStats.ts` 為準。有種族值就重算；舊存檔缺面板讀取走寬容版（保留原文可進編輯器修），新增 / 存檔走嚴格版（缺資料就報錯，不偽造數值）。

## 資料管線

- `codex.json`（全量）→ `codexRegistry.ts` + `codexEntry.ts`（`atoms` 延遲到第一次讀取才解析 + 快取，可被編輯器覆寫）。
- `npm run data:pack` 產生 `codex.packed.json` / `blockLibrary.packed.json`；`npm run data:skills` 產生 `skillReferences.generated.json`。這些是衍生檔，改源頭後要重跑，`test:data` 會檢查是否過期。
- 23 份精靈描述物已搬到 `src/data/elfProfiles/`，`src/effects/*Registry.ts` 只留 handler + `re-export`，行為不變。
- `vite.config.ts` 用 `manualChunks` 拆 `vendor-lucide / vendor-charts / vendor-blockly / vendor-motion / vendor-core`，頁面靠 `React.lazy` 切分；`@` 指向 repo 根。

## 打包與發佈

- `electron-builder.yml`：`appId com.seer.battle.simulator`，`nsis + portable`，`extraResources` 帶 `dist / images / public / 系 / pet`。
- `npm run package:electron` 前會先跑 `build:electron`；可攜包走 `scripts/package_portable.ps1`。
- `dist/`、`dist-electron/`、`release/` 都不進版控；要驗收新成果請用本次的新 build，舊 exe 不會自己更新。

## 常見問題

- `npm test` 失敗先看是哪一段：units / blocks / codex loading / profile loading / data / ui / scopes 是串起來的，分段重跑比較快。
- `audit:bundle` 一定要在 `build` 之後跑，否則會拿到舊 `dist` 的數字。
- 舊自訂精靈如果缺面板：列表照常顯示可進編輯器修；開戰 / 存檔時嚴格版會擋下並報錯，這是故意的，不要再加 `|| 100` 兜底。
- 看到整排 `LF will be replaced by CRLF` 是換行符提示，無害。
- `launcher/server.log` 出現 `API key should be set` 表示 `.env` 沒填 key，AI 功能停用是正常的。

## 文件索引

- `AGENTS.md`：開發規範全文
- `docs/傷害定義正典.md`：傷害分區定義
- `docs/體力與狀態作用域修正計畫_20260930.md`：體力與切換串位的修正邊界
- `docs/建置與載入效能修正_20260930.md`：打包體積與延遲載入紀錄
- `docs/下載與協作說明.md`、`docs/雲端AI更新指令_貼上版.md`、`docs/Codex自動更新網站指令.md`：協作流程

## 授權

應用程式碼含 Apache-2.0 標頭（見 `src/App.tsx`）。美術與數值資源請依原始來源與 `docs/` 說明使用。
