# 對戰模擬器 Battle Simulator

React + Vite + Express + Electron 製作的對戰模擬器：組隊編成、戰鬥結算、魂印 Registry、Blockly 技能編輯、圖鑑 Codex、桌面打包。

| | |
|---|---|
| 倉庫 | https://github.com/wa0966766851-ship-it/new-chat |
| 主線 | `main`（待驗收的改動先放 `codex/` 工作分支） |
| 版本來源 | `version.ts`，同步 `package.json` 與 `package-lock.json` 根版本 |
| 程式入口 | `index.html` → `src/main.tsx` → `src/App.tsx` |

## 系統需求

| 項目 | 版本 |
|---|---|
| Node.js | 20 以上 LTS（CI 用 20；網站包建置用 24） |
| npm | 隨 Node 附帶 |
| 系統 | Windows 可用桌面版與 `.bat` 腳本；網頁版跨平台 |

可選 `GEMINI_API_KEY`。**沒有也能完整遊玩**，只是 AI 生成類 API 會停用（回 503），前端自動改走本地解析，不會崩。

## 安裝

### 方式 A：下載桌面版（一般玩家）

1. 前往 [Releases](https://github.com/wa0966766851-ship-it/new-chat/releases)
2. 下載最新的 `*-portable.exe`（免安裝）或 `*-win-x64.exe`（安裝版）
3. 雙擊執行

免安裝版可放在任何資料夾直接跑；安裝版會建立開始功能表捷徑。

### 方式 B：從原始碼執行（開發者）

```powershell
git clone https://github.com/wa0966766851-ship-it/new-chat.git
cd new-chat
npm install
Copy-Item .env.example .env    # 需要 AI 功能才填 GEMINI_API_KEY
npm run dev                    # http://localhost:3000
```

```bash
# macOS / Linux
git clone https://github.com/wa0966766851-ship-it/new-chat.git
cd new-chat
npm install
cp .env.example .env
npm run dev
```

生產模式：

```powershell
npm run build    # vite build + esbuild server.ts → dist/
npm start        # node dist/server.cjs
```

## 更新

### 桌面版

程式內建更新檢查，直接比對 GitHub Releases：

1. 開啟程式 → 設定 → 更新
2. 按「檢查更新」
3. 有新版本時按「下載」

更新**不會自動覆寫**你正在用的程式。新版會下載到使用者資料夾下的 `updates` 目錄，通過 SHA-256 校驗後才提示你手動替換；下載前會先備份存檔與舊 EXE，出問題可以退回。

> 沒有附 `sha256:` digest 的 Release 會被拒絕自動下載，這是刻意的完整性保護。

### 原始碼版

```powershell
git pull origin main
npm install
npm run build
npm start
```

相依套件有變動時建議改用 `npm ci`，確保與 `package-lock.json` 完全一致。

## 桌面版打包

```powershell
npm run package:electron
```

產物在 `dist-electron/`：

| 檔案 | 說明 |
|---|---|
| `battle-simulator-<版本>-win-x64.exe` | NSIS 安裝版 |
| `battle-simulator-<版本>-portable.exe` | 免安裝版 |
| `battle-simulator-<版本>-web-setup.exe` | 網路安裝版（需保留 `nsis-web` 資源） |
| `seer-battle-simulator-<版本>-exe.zip` | 上述 EXE 的打包 |

打包會自動遞增修訂號並同步三個版本來源；要沿用目前版本，加上 `-- --keep-version`。

發佈到 Releases 時，EXE 的檔名要符合 `seer-battle-simulator-<版本>-portable.exe` 或 `seer-battle-simulator-<版本>-win-x64.exe`，更新檢查才找得到。

## 指令一覽

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發啟動（`tsx server.ts`，前後端同源） |
| `npm run build` | 前端 `vite build` + 後端 `esbuild server.ts → dist/server.cjs` |
| `npm start` | 生產啟動（需先 `build`） |
| `npm run lint` | 型別檢查（`tsc --noEmit`） |
| `npm test` | 完整測試鏈 |
| `npm run test:loading` | 延遲載入測試，再接 `test:data`、`test:ui`、`test:scopes` |
| `npm run test:data` | 衍生資料是否過期 |
| `npm run test:ui` | UI 版面語意測試 |
| `npm run test:scopes` | 體力與切換作用域語意 |
| `npm run audit:bundle` | 打包體積稽核（要在 `build` 之後跑） |
| `npm run audit:blocks` | Block 覆蓋率明細 |
| `npm run data:pack` | 產生 `codex.packed.json` / `blockLibrary.packed.json` |
| `npm run data:skills` | 產生 `skillReferences.generated.json` |
| `npm run gen:handled-skills` | 產生 handled-skills 清單 |
| `npm run build:electron` | Electron 用 bundle |
| `npm run electron:dev` | `build` 後用 `electron/main.cjs` 起桌面殼 |
| `npm run package:electron` | 建置並封裝安裝版／免安裝版／網路安裝版 |
| `npm run package:portable` / `package:zip` | 可攜包（`scripts/package_portable.ps1`） |
| `npm run build:exe` / `build:exe-keep` | 產生 EXE（前者升版） |
| `npm run prepare:share` | 準備分享包 |

Windows 另有：`Build_EXE.bat`、`rebuild-portable-exe.bat`、`setup-env.bat`。

## 環境變數

| 變數 | 說明 |
|---|---|
| `GEMINI_API_KEY` | Gemini API 金鑰；沒設就停用 AI 端點 |
| `APP_URL` | 對外 URL（self link / callback 用） |
| `PORT` | 伺服器埠，預設 `3000` |
| `DISABLE_HMR` | 設為 `true` 關閉 HMR 與檔案監看，避免改檔時畫面閃爍 |

`.env*` 不進版控，只有 `.env.example` 會送上 GitHub。

## 專案結構

```
index.html -> src/main.tsx -> src/App.tsx
  view: start | custom | battle | destiny_wheel | interstellar_exploration | test_runner
  懶載入： ElfEditor / Encyclopedia / DestinyWheelScreen / TestRunnerPage / BattleScreen / InterstellarHub

server.ts              # Express + Vite 中介 + Gemini API + /seer/:kind/:file 圖資代理
src/App.tsx            # GameDataProvider + 隊伍 / 先發 / 套裝 / 稱號 state
src/types.ts           # Elf / Skill / SoulMark 等共用型別
src/components/        # BattleScreen（調度）+ BattleScreen.ui + BattleManager（reducer）
                       # StartScreen / ElfEditor / Encyclopedia / DestinyWheel / InterstellarHub
                       # BlocklyBuilder / ElfBlocklyPanel / KitEffectBuilder 等
src/battle/            # timers / marks / survivalRules / damageSemantics / stateScopes
src/effects/           # 各精靈 Registry（handler 本體）
src/data/              # defaultElves / elfRegistry / codex / packed 生成檔 / elfProfiles
src/blocks/            # Blockly：model / parse / registry / runtime / custom / specs
src/modes/             # 特殊模式（星蝕迴廊等）
src/utils/             # elfStats / statCalculator / traitsEngine 等
electron/              # main.cjs / preload.cjs / update（更新服務）
scripts/ tools/        # audit_bundle / pack_effect_data / build_exe / prepare_share
docs/                  # 設計正典、修正紀錄、協作說明
public/ images/ pet/ 系/  # 官方快照與自製立繪（elf-art 優先於官方圖）
```

`dist/`、`dist-electron/`、`release/`、`node_modules/` 都不進版控。

## 後端端點

前後端同源：開發期掛 `vite.middlewares`，生產期吃 `dist/` + SPA fallback。

| 端點 | 說明 |
|---|---|
| `GET /api/ai-status` | 回 `{ enabled }` |
| `POST /api/generate-elf` | 自然語言 → 結構化精靈 |
| `POST /api/analyze-elf` | 精靈分析 |
| `POST /api/parse-effect-text` | 效果文字解析 |
| `POST /api/dissect-tokens` | 語義 token 拆解 |
| `GET /version.json` | 目前部署版本（更新比對用） |
| `GET /seer/:kind/:file` | 圖資代理 |

沒有 API key 時，AI 端點一律回 503 加 `aiDisabled: true`。

## 架構約定

詳見 [AGENTS.md](AGENTS.md)。

- **Anti-Bloat**：精靈專屬邏輯嚴禁塞進 `BattleScreen.tsx`，一律走 `src/effects/*Registry`。
- **Registry Pattern**：`Record<SkillName, handler>`，在 `battleEventRegistry.ts` 展開合併，戰鬥中只調 `BattleSkillRegistry[skill.name]?.(ctx)`。
- **語義流程**：自然語言 → Trigger / Condition / Target / Action → 生成註冊表 → 掛 `BattleContext`。
- **作用域**：`src/battle/stateScopes.ts` 區分個人／陣營。「下場後保留」= 同一 `battleId` 保留，不是送給下一隻；只有文本明寫「己方所有／己方在場／指定下一隻」才保留陣營作用域。
- **能力邊界**：`src/utils/elfStats.ts` 為準。有種族值就重算；舊存檔缺面板走寬容版（保留原文可進編輯器修），新增／存檔走嚴格版（缺資料就報錯，不偽造數值）。

## 資料管線

- `codex.json`（全量）→ `codexRegistry.ts` + `codexEntry.ts`（`atoms` 延遲解析並快取，可被編輯器覆寫）。
- `npm run data:pack` 產生 `codex.packed.json` / `blockLibrary.packed.json`；`npm run data:skills` 產生 `skillReferences.generated.json`。改源頭後要重跑，`test:data` 會檢查是否過期。
- `vite.config.ts` 用 `manualChunks` 拆 `vendor-lucide / vendor-charts / vendor-blockly / vendor-motion / vendor-core`，頁面靠 `React.lazy` 切分。

## 常見問題

- **`npm test` 失敗**：先看是哪一段。units / blocks / codex loading / profile loading / data / ui / scopes 是串起來的，分段重跑比較快。
- **`audit:bundle` 數字怪**：一定要在 `build` 之後跑，否則量到的是舊 `dist`。
- **舊自訂精靈缺面板**：列表照常顯示、可進編輯器修；開戰／存檔時嚴格版會擋下並報錯，這是故意的，不要加 `|| 100` 兜底。
- **整排 `LF will be replaced by CRLF`**：換行符提示，無害。
- **`API key should be set`**：`.env` 沒填 key，AI 功能停用是正常的。
- **更新下載失敗**：確認該 Release 的資產有 `sha256:` digest；沒有的話程式會拒絕下載。

## 文件索引

- [AGENTS.md](AGENTS.md)：開發規範全文
- [docs/README.md](docs/README.md)：文件入口
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)：檔案地圖
- [docs/下載與協作說明.md](docs/下載與協作說明.md)：給協作者的流程
- [docs/傷害定義正典.md](docs/傷害定義正典.md)：傷害分區定義

## 授權

應用程式碼含 Apache-2.0 標頭（見 `src/App.tsx`）。美術與數值資源請依原始來源與 `docs/` 說明使用。