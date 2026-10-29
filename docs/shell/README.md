# 雙殼架構（Legacy Shell / Aegis Shell）

> 這份文件給**要接手的人**看。設計理由看 [PLAN.md](PLAN.md)，施工規範看 [KIT.md](KIT.md)，
> 每一輪做了什麼、踩了什麼坑看 [PROGRESS.md](PROGRESS.md)。

## 一句話

同一份遊戲，兩種外殼：**桌面工作台（Legacy）** 與 **手遊介面（Aegis）**，
共用同一份狀態與功能註冊表，可執行期切換，並用測試保證舊版不會落後。

## 怎麼用

1. 啟動 `npm run dev`
2. 桌面（≥1024px）預設進 Legacy；手機（<1024px）預設進 Aegis
3. 手動切換：Legacy → 右下角「Aegis 介面」；Aegis → 右上角「Legacy」
4. 偏好存在 `localStorage.seer_shell_preference`（`legacy` / `aegis` / `auto`）

## 架構

```
src/App.tsx                 只有狀態 + 兩個殼共用的 ShellBridge
src/shell/
  bridge.ts                 兩殼唯一的狀態介面
  features.ts               功能註冊表（單一事實來源）
  shellMode.ts              legacy / aegis / auto
  LegacyShell.tsx           舊外殼（行為不變）
  AegisShell.tsx            新外殼
  scenes/
    LegacyScenes.tsx        舊畫面路由（兩殼共用）
    LobbyScene.tsx          原生大廳
    TeamScene.tsx           原生編成
    BagScene.tsx            原生背包
  battleLaunch.ts           戰鬥啟動（兩殼共用）
  equipment.ts              裝備存取（與 Legacy 共用 localStorage）
  lastTeam.ts               隊伍摘要（出戰／待命語義）
  haptics.ts                觸覺回饋
  art/
    backdrop.tsx            環境場景層
    chrome.tsx              頂部列 / 側欄 / 底部導航
    gameUi.tsx              手遊元件
    ornaments.tsx           幾何裝飾
    figure.tsx              立繪底版（圖 404 時的幾何剪影）
    cardArt.ts              卡面素材表
    SceneTransition.tsx     場景轉場
    battleAegis.css         戰鬥畫面覆寫（限定 #aegis-shell）
    motion.css              reduced-motion
src/design/
  palette.ts                六態色票
  cues.ts                   動效拍點表
src/pwa/
  registerServiceWorker.ts  PWA 註冊
```

## 鐵則：舊版不得落後

| 層 | 機制 |
| --- | --- |
| 登記 | 新功能必須先在 `features.ts` 登記，否則不會出現在任何殼 |
| 委派 | 未重寫的畫面一律走 `LegacyScenes`，功能 100% 相同 |
| 測試 | `shellParity` + `shellRouteParity` 檢查兩邊都可達 |

**推論**：Aegis 最多「比較醜」，不可能「比較少」。

## 功能狀態

| 功能 | Legacy | Aegis |
| --- | --- | --- |
| 首頁 / 大廳 | ✅ | ✅ 原生 |
| 精靈自定 / 編成 | ✅ | ✅ 原生 |
| 背包 | ✅（整合在首頁） | ✅ 原生（從編成進） |
| 實戰演練 / 戰鬥 | ✅ | ✅ 委派 + CSS 微調 |
| 戰鬥百科 | ✅ | ✅ 委派（彈窗） |
| 命運之輪 | ✅ | ✅ 委派 |
| 星際探索 | ✅ | ✅ 委派 |
| 自動測試 | ✅ | ✅ 委派 |
| 更新與精靈 | ✅ | ✅ 委派 |
| 系統控制中心 | ✅ | ✅ 委派 |
| 效能探針 | ✅ | ✅ 委派 |

## 新增一個功能（三步）

```ts
// ① 登記（src/shell/features.ts）
{ id: "new_thing", label: "新功能", short: "新", kind: "screen", group: "play",
  legacy: false, aegis: { status: "planned", phase: 5 } }

// ② 在 Legacy 實作（src/shell/scenes/LegacyScenes.tsx 加分支）
// ③ 把 legacy 改 true；Aegis 尚未重寫就把 status 改成 "delegated"
```

**跳過 ①，`npm run test:shell` 會失敗。**

## 測試

```bash
npm run test:shell            # 13 組，不需要 dev server
npm run check:reduced-motion  # 需 dev server（實測瀏覽器行為）
```

| 測試 | 鎖住什麼 |
| --- | --- |
| `shellParity` | 功能註冊表完整性、色票、拍點、Phase 進度鎖 |
| `shellNavigation` | 背包入口、導航排除、戰鬥全螢幕、抽屜可開 |
| `shellRouteParity` | **8 個 view 兩殼皆可達**（目標核心） |
| `shellMotion` | reduced-motion 覆蓋 |
| `haptics` | 觸覺降級、強度分級、尊重 reduced-motion |
| `sceneTransition` | 轉場方向、時長來源、reduced-motion |
| `pwa` | manifest、SW 不快取 HTML、meta 標籤 |
| `capacitor` | appId、webDir、圖示共用 |
| `teamSummary` | 出戰／待命語義、壞存檔容錯 |
| `equipment` | 裝備 key 一致、P1/P2 隔離 |
| `battleLaunch` | 存檔優先、快速配對、賽制人數 |
| `battleAegisCss` | 戰鬥 CSS 作用域與各項修正 |
| `shellScenes.ui` | **三個原生畫面真的能渲染**（jsdom） |

## 驗收工具

```bash
node tools/ui_shot.mjs --preset mobile --pref aegis --out shots
node tools/ui_shot.mjs --click "編成>背包>精靈"        # 多段點擊
node tools/ui_shot.mjs --click-sel 'button[title="設定"]@@4000'  # 選擇器 + 延遲
node tools/ui_shot.mjs --measure '.hero-stage'          # 量 DOM
node tools/ui_shot.mjs --reduce-motion                  # 模擬 reduced-motion
```

**注意**：`--click` 每段只等 2.2 秒。戰鬥開場動畫是 2.6 秒，
所以要截戰鬥畫面必須用 `--click-sel` 跳過（或加大延遲）。

## 打包

| 目標 | 方式 | 狀態 |
| --- | --- | --- |
| 桌面 | Electron（既有） | ✅ |
| 網頁 | `npm run build` → `dist/` | ✅ |
| PWA | 同上（含 manifest + SW） | ✅ 加到主畫面即可 |
| Android | `npm run cap:android` | ⚠️ 需 Android SDK |

## 已知限制

1. **戰鬥畫面只做了外框與 CSS 微調**，技能盤未重寫（5 欄 × 390px，字偏小）
2. **命運之輪、星際探索仍是委派**，沒有原生畫面
3. **Capacitor 未實際建置**（本機無 Android SDK）
4. **`npm test` 完整鏈在 Windows 會因 esbuild 暫存而中斷** —— 繞過方式見 [KIT.md](KIT.md)
