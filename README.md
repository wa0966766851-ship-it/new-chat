# 對戰模擬器 Battle Simulator

React + Vite + Express + Electron 製作的對戰模擬器：組隊、戰鬥結算、魂印 Registry、Blockly 技能編輯、圖鑑 Codex、桌面打包。

遠端：https://github.com/wa0966766851-ship-it/new-chat.git。`main`為主線，待驗收修改先保存在`codex/`工作分支。
版本來源：`version.ts`；同步`package.json`及`package-lock.json`的根版本，保持Electron與更新標記一致。
入口：`index.html` → `src/main.tsx` → `src/App.tsx`。

現況／稽核／檔案分類從 [文件入口](docs/README.md) 開始；[檔案地圖](docs/PROJECT_STRUCTURE.md) 區分原文、執行程式、生成產物與備份。

2026-11-04：[空間清理、檔案分工與桌面存檔保護](docs/audits/2026-11-04_專案結構清理與存檔保護.md)、[自製精靈動畫製作與驗收](docs/guides/自製精靈動畫製作與驗收.md)。

- 開發與工具：[維護腳本分類](scripts/README.md)、[測試入口](tests/README.md)
- 桌面版：[EXE建置與驗收](docs/guides/desktop-packaging.md)
- 接續工作：[整合開發日誌](docs/開發日誌.md)、[完整紀錄索引](docs/開發紀錄索引.md)、[截圖與空間整理](docs/guides/project-housekeeping.md)；[2026-10-19交接](docs/coordination/本輪收尾交接_20261019.md)保留供歷史核對。
- 歷史規劃：[歸檔索引](docs/archive/README.md)

## 模型輔助 AI 與對戰計時器

在「控制中心 → 對戰」設定。Gemini 模型輔助預設關閉；本機啟動後可填入自己的 API 金鑰，預設只在後端記憶體保留，Windows 可選擇加密記住。金鑰不寫入專案、瀏覽器設定或匯出檔，其他使用者須自行設定。啟用模型會把精簡的公開戰況及己方可知資訊送往 Google，可能產生費用；模型等待上限可設 1–120 秒，錯誤／逾時沿用本地 AI。死亡換人同樣使用這套決策。模型信心不是勝率，目前未宣稱勝率提升。

AI 可分別關閉攻擊／干擾、控制／異常、直接／附加傷害藥劑；預設全開。特殊藥劑、解除用途與指定幻化保留，人工操作不受 AI 偏好限制。

計時器預設「關閉計時器」，所有使用標準對戰畫面的賽制共用，選擇時間可設 5–60 秒。模式 1 逾時依明確的第五技能、普通技能 1–4、空過選擇，跳過不可選技能；死亡時改為隊伍第一個可合法登場的替補。模式 2 逾時持續託管，可手動關閉。雙人同屏各側分別處理；演出與等待 AI 不扣選擇時間。

驗證：`npm run test:decision-timer`。模型服務僅接受本機同源連線；不會自動讀取桌面 `api.txt`。請在設定頁自行貼入金鑰，再按「測試連線」。

## 獨立精靈圖鑑（含空白自製版）

圖鑑與模擬器放在同一倉庫，使用獨立視窗與存檔。支援多本圖鑑、自訂精靈／圖片／屬性、PNG與PDF匯出及含圖片備份。一般版只先載入精簡名單，點選精靈才讀取介紹和圖片；空白版初始零收錄，不載入內建名單。

```powershell
npm install
npm run atlas:build       # 檢查並建置圖鑑，完成後才切換版本
npm run atlas:start       # 一般圖鑑
npm run atlas:blank       # 空白自製圖鑑，獨立資料與視窗
npm run atlas:shortcuts   # 建立桌面捷徑（保留已有捷徑）
npm run atlas:sync        # 內建精靈更動後，更新輕量展示快照
npm run atlas:build       # 同步後再建置；桌面「更新精靈圖鑑」會一併同步
npm run atlas:dev         # 圖鑑開發服務，預設 http://127.0.0.1:3177
npm run test:atlas        # 存檔、匯入與空白版驗證
node tests/atlasLoading.browser.test.mjs  # 兩版載入、匯入、PNG/PDF實測，需先建置及安裝Edge/Chrome
```

AI新增內容：依 [通用工作流](encyclopedia/CONTENT_WORKFLOW.md) 與 [內容範本](encyclopedia/templates/content.example.json) 整理資料，執行 `npm run atlas:content -- input.json --out validated.json` 驗證；再從「匯入內容／備份」預覽並加入新圖鑑。缺失數值須先確認，匯入不覆蓋原有內容。

一般版存檔位於 `%LOCALAPPDATA%\SeerEncyclopedia`；空白版位於 `%LOCALAPPDATA%\SeerEncyclopediaBlank`。私人存檔、上傳圖片、建置檔與驗收截圖不提交Git。詳見 [圖鑑說明與檔案結構](encyclopedia/README.md)。

## 模擬器系統需求

- Node.js 24、npm（與網站建置及CI一致）
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
| `npm run package:electron` | 建置並封裝安裝版、免安裝版及網路安裝版；自動清理中間副本 |
| `npm run package:electron:inspect` | 同上，保留中間副本供成品驗收，驗收後再清理 |

Windows 另有：`Build_EXE.bat`、`rebuild-portable-exe.bat`、`setup-env.bat`。

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
- 精靈描述物已搬到 `src/data/elfProfiles/`（目前 17 份），`src/effects/*Registry.ts` 只留 handler + `re-export`，行為不變。
- `vite.config.ts` 用 `manualChunks` 拆 `vendor-lucide / vendor-charts / vendor-blockly / vendor-motion / vendor-core`，頁面靠 `React.lazy` 切分；`@` 指向 repo 根。

## 打包與發佈

- `electron-builder.yml`：`appId com.seer.battle.simulator`，`nsis + portable`，`extraResources` 帶 `dist / images / public / 系 / pet`。
- `npm run package:electron` 前會先跑 `build:electron`；可攜包走 `scripts/package_portable.ps1`。
- `dist/`、`dist-electron/`、`release/` 不進版控。

## 常見問題

- `npm test` 失敗先看是哪一段：units / blocks / codex loading / profile loading / data / ui / scopes 是串起來的，分段重跑比較快。
- `audit:bundle` 一定要在 `build` 之後跑，否則會拿到舊 `dist` 的數字。
- `launcher/server.log` 出現 `API key should be set` 表示 `.env` 沒填 key，AI 功能停用是正常的。

## 文件索引

- [決策模型協助積木分類、效能與空間盤點](docs/audits/2026-11-17_decision-classification-and-performance.md)：區分分類助手與實際積木執行器，記錄載入改善、磁碟占用及封存驗證。
- 本機備份維護：`py scripts/maintain_local_workspace.py` 先看計畫，加入 `--apply` 才壓縮核對並移除固定範圍的舊鬆散副本。以 `--restore .local-archives/maintenance-20261117/檔名.zip` 還原至新的測試目錄，詳見上述報告。

- 對戰 TXT：控制中心 → 戰鬥 →「保存對戰與 AI 決策 TXT」。預設開啟，每場一檔，最多保留 10 場，超額刪除最老一場；可下載、開啟資料夾或刪除。包含隊伍、體力／PP、狀態、行動、傷害／恢復帳本與 AI 候選評分，Gemini 有啟用時另記模型採用／回退資訊，不保存金鑰與思考鏈。戰鬥中約每秒分批寫入，強制關閉可能遺失最後尚未寫入的片段。單場上限 8 MiB，達上限會停止本場寫入並顯示訊息。舊版戰報可補存文字，無法補回已丟失回合。資料位於 `%LOCALAPPDATA%/SeerBattle/<專案識別>/battle-records`，不放進 Git；直接刪除當前場次 TXT 後，本場不會重新建立。
- 記錄檢查指令：`npm run test:battle-records`；決策／計時器檢查：`npm run test:decision-timer`。
- [近期對戰分析與記錄驗收](docs/audits/2026-11-17_battle-records-and-recent-analysis.md)。

- `AGENTS.md`：開發規範全文
- `docs/精靈清單_權威事實源.md`：**精靈總數與完整清單（權威來源，目前 47 隻）**
- `docs/傷害定義正典.md`：傷害分區定義
- `docs/體力與狀態作用域修正計畫_20260930.md`：體力與切換串位的修正邊界
- `docs/建置與載入效能修正_20260930.md`：打包體積與延遲載入紀錄
- `docs/下載與協作說明.md`、`docs/雲端AI更新指令_貼上版.md`、`docs/Codex自動更新網站指令.md`：協作流程

## 授權

應用程式碼含 Apache-2.0 標頭（見 `src/App.tsx`）。美術與數值資源請依原始來源與 `docs/` 說明使用。
