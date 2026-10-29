# Aegis Shell — 進度紀錄

## Phase 0 — 地基（完成 2026-10-21）

| 項目 | 檔案 | 狀態 |
| --- | --- | --- |
| 功能註冊表 | `src/shell/features.ts` | ✅ 10 個功能已登記 |
| 殼模式 + 自動判斷 | `src/shell/shellMode.ts` | ✅ localStorage + 寬度自動 |
| 六態色票 | `src/design/palette.ts` | ✅ |
| 拍點表 | `src/design/cues.ts` | ✅ 13 項 |
| 截圖驗收工具 | `tools/ui_shot.mjs` | ✅ CDP 真實尺寸 |

## Phase 1 — 雙殼外殼（完成 2026-10-21）

| 項目 | 檔案 | 狀態 |
| --- | --- | --- |
| 共用狀態介面 | `src/shell/bridge.ts` | ✅ |
| 共用畫面路由 | `src/shell/scenes/LegacyScenes.tsx` | ✅ 從 App.tsx 原樣抽出 |
| Legacy 外殼 | `src/shell/LegacyShell.tsx` | ✅ 行為與外觀不變 |
| Aegis 外殼 | `src/shell/AegisShell.tsx` | ✅ 頂部列 + 直向底部導航 / 橫向左側導航 |
| 切換鈕 | `ShellSwitchButton`（portal） | ✅ Legacy 右下 / Aegis 頂部內嵌 |
| App 瘦身 | `src/App.tsx` | ✅ 565 → 約 230 行 |

## Phase 2 — 原生大廳（進行中 2026-10-21）

### 已完成

| 項目 | 檔案 | 說明 |
| --- | --- | --- |
| 大廳畫面 | `src/shell/scenes/LobbyScene.tsx` | 單頁、不滾動 |
| 手遊 UI 元件 | `src/shell/art/gameUi.tsx` | 資源膠囊、玩家徽章、主行動、進度條 |
| 幾何裝飾 | `src/shell/art/ornaments.tsx` | 切角面板、軌道環、準星、刻度尺、噪點 |
| 立繪底版 | `src/shell/art/figure.tsx` | 圖 404 時仍有完整構圖（人形剪影 + 屬性色） |
| 背景層 | `src/shell/art/backdrop.tsx` | 高解析立繪 + 角色巨影 + 局部漸層 |
| 陣容讀取 | `src/shell/lastTeam.ts` | 讀 Legacy 的「上次使用紀錄」，容量 12 |
| 年費加成預設 | `src/components/StartScreen.tsx` | 依需求改為預設開啟 |

### 版面（390×844 一頁看完）

```
玩家列（頭像/等級/資源/設定）
主視覺（角色立繪 + 名牌 + HP + 三圍 + 編成）
DECK（12 隻，2×6）
副本（6 格，3×2）
主行動（開始對戰 / 進入副本）
次要入口（背包 / 編成 / 圖鑑 / 更新）
底部導航
```

### 美術來源

| 來源 | 用途 |
| --- | --- |
| `public/elf-art/*_body.png` | 本機高解析立繪（迪辛、雷伊、五虛等） |
| `public/seer/{head,body,type,buff,abnormal}` | 本地官方資源（head 40、body 39、type 141） |
| SeerAPI 遠端 `seer-unity-assets` | 透過 `/seer/:kind/:file` 代理，缺檔自動下載並快取 |
| `public/aegis/bg_*.png` | 本次新挖的 5 張高解析立繪（672×624 ～ 1744×1552），當大廳背景 |
| `public/bg-thumbs/*.jpg` | 備援背景（480×270） |

> 遠端路徑確認：`{SEER_REMOTE}/pet/body/{id}.png`、`{SEER_REMOTE}/pet/head/{id}.png`。
> `pet/body/5001.png` 不存在，但 `pet/head/5001.png` 存在 —— 缺 body 時由 FigurePlate 幾何底版接手。

### 量測

| 視窗 | innerWidth | docScrollWidth | overflowX |
| --- | --- | --- | --- |
| 390×844 | 390 | 390 | false |
| 844×390 | 844 | 844 | false |
| 1600×900 | 1600 | 1600 | false |

### 沒有照計畫做的地方（及原因）

1. **`start` 已轉 `live`，`battle` 仍 `delegated`**
   → 原因：大廳是 Phase 2 的範圍；戰鬥 HUD 是 Phase 4。delegated 保證戰鬥功能不缺席。

2. **`vite.config.ts` 的 watch ignore 增加了暫存檔與 public 圖檔樣式**
   → 原因：編輯器存檔留 `.xxx.tmpdir/`、下載大圖寫入 `public/aegis/`，
   都會被 watcher 抓到 EBUSY 直接讓 dev server 崩潰（本輪發生三次）。
   → 影響：只影響 dev 監看，不影響建置與執行期。

3. **`ui_shot.mjs` 用 CDP 而非 `--window-size`**
   → 原因：headless Edge 的 `--window-size=390` 實際 innerWidth 是 492，
   截圖右側被裁，造成「以為版面溢出」的誤判。
   → 現在改用 `Emulation.setDeviceMetricsOverride`。

## Phase 2 — 第二輪（2026-10-21 晚）

### 這輪做的

| 項目 | 說明 |
| --- | --- |
| 導航語言統一 | `features.ts` 的 `short` 全改繁中：首頁／編成／圖鑑／對戰／命運／探索／測試／更新 |
| 精靈名稱可讀 | 從 `truncate` 改成 2 行 clamp（`-webkit-line-clamp: 2`），長名不再被截成「悲歌·索比拉…」 |
| 名稱字級 | 8px → 9px，加 `text-shadow` 確保疊在背景上仍可讀 |
| DECK／副本加底版 | `rgba(4,10,18,0.62)` + `backdrop-filter: blur(10px)`，小字不再跟背景打架 |
| 背景平衡 | 局部漸層從「下半全黑」改成「上亮下緩暗」，底部 0.78 而非 0.97 |
| 留白填實 | 模式區與主按鈕之間插入「對手列 + 本期焦點公告」，不是裝飾而是可點內容 |
| 橫向／桌面雙欄 | `.lobby-grid` 用 CSS Grid：直向單欄、`orientation: landscape and max-height: 560px` 或 `min-width: 900px` 轉雙欄（左主視覺／右資訊） |
| 截圖工具強化 | `ui_shot.mjs` 新增 `--pref`（強制 legacy/aegis）與 `--click`（點指定文字按鈕），才能驗證委派畫面 |

### 量測

| 視窗 | innerWidth | overflowX | 一頁看完 |
| --- | --- | --- | --- |
| 390×844（直向） | 390 | false | ✅ |
| 844×390（橫向） | 844 | false | ✅ 雙欄 |
| 1600×900（桌面） | 1600 | false | ✅ 雙欄 |

### 驗證過的流程

| 流程 | 結果 |
| --- | --- |
| 大廳 → 點「編成」 | 進入 Legacy 編輯器（委派），底部導航「編成」高亮 ✅ |
| 大廳 → 點「圖鑑」 | 開啟 Legacy 百科彈窗（portal）✅ |
| 桌面 `--pref aegis` | 顯示 Aegis 雙欄，右上「Legacy」切換鈕 ✅ |
| 桌面（auto） | 落到 Legacy 殼 ✅ |

### 沒有照計畫做的地方（及原因）

1. **橫向／桌面用 CSS Grid 而不是 JS 判斷**
   → 原因：JS 判斷會在 resize 時重排閃爍；CSS 媒體查詢交給瀏覽器即可。
   → 代價：`LobbyScene` 尾部多了一段 `<style>`，但集中在一處、有註解。

2. **「對手列」用的是預覽資料**
   → 原因：P2 沒有存檔時無法顯示真實對手；顯示精靈池 12–24 隻並標 12/12。
   → 這是誠實的預覽，不是假資料——開戰時會真的用這批。

## Phase 3 — 原生編成 + 背包（2026-10-21）

### 新增

| 項目 | 檔案 | 說明 |
| --- | --- | --- |
| 隊伍草稿層 | `src/shell/teamDraft.ts` | 加入／移出／設首發／排序／存檔；**寫回 Legacy 的 `seer_last_used_p1_team`** |
| 原生編成 | `src/shell/scenes/TeamScene.tsx` | 12 格隊伍 + 角色庫（4 欄）+ 搜尋 + 屬性快篩 + 儲存 |
| 原生背包 | `src/shell/scenes/BagScene.tsx` | 4 分類（套裝 84／護目鏡／稱號／技能石 105）+ 角色選擇 + 詳情抽屜 |
| 裝備狀態 | `BagScene` 讀 `seer_p1_suit/eyewear/title` | 與 Legacy 同一份，不另存 |
| 截圖工具 | `ui_shot.mjs --ls` | 可先注入 localStorage 再截圖，驗證「已裝備」等狀態 |

### 功能註冊表變動

| id | 之前 | 現在 |
| --- | --- | --- |
| `custom` | delegated | **live**（TeamScene） |
| `bag` | （不存在） | **live**（BagScene），排在編成之後 |

導航順序：首頁／編成／背包／對戰／命運（直向取前 5）。

### 測試強化

`tests/shellParity.semantic.test.ts` 新增：
- `start` / `custom` / `bag` 必須是 `live`（Phase 進度鎖，防止悄悄退回 delegated）
- 導航標籤必須含中文且 ≤4 字（防止混回英文或爆版）
- live 功能的 `requires` 必須指向存在的功能

### 量測

| 畫面 | 390×844 | overflowX |
| --- | --- | --- |
| 大廳 | 一頁看完 | false |
| 編成 | 12 格 + 角色庫可捲 | false |
| 背包 | 分類 + 清單可捲 | false |

### 沒有照計畫做的地方（及原因）

1. **背包是唯讀 + 導向 Legacy 裝備**
   → 原因：裝備在 Legacy 是「隊伍層級」的三個 localStorage key，寫入邏輯牽涉套裝效果計算。
   硬寫第二套會分岔。現在的做法是「看得到、查得到、一鍵跳去裝備」，功能不缺。

2. **編成角色庫 4 欄而非 6 欄**
   → 原因：6 欄在 390px 下名字只能截成 3 個字，4 欄可讀性明顯提升。

## Phase 3 修正（2026-10-21 晚）

### 修掉一個嚴重的崩潰

| 症狀 | 原因 | 修法 |
| --- | --- | --- |
| Aegis 大廳整頁顯示「這個頁面暫時無法顯示」 | `LobbyScene` 的**預覽隊伍**用手拼物件，漏了 `active` / `standby`，讀 `p1.active.length` 直接 crash | 新增 `buildTeamSummary()` 工廠，所有路徑統一產生完整 `TeamSummary` |

**這個 bug 是我在上一輪「出戰／待命分段」時引入的，而我當時只截圖看畫面，沒有看 console。**
現在 `ui_shot.mjs` 會一併回報 `consoleLogs`，React 例外不會再被忽略。

### 測試順手抓到的兩個 bug

| bug | 影響 | 修法 |
| --- | --- | --- |
| `count` 回報原始長度（20），但 `members` 已截到 12 | UI 顯示「20/12」 | `count` 改用截斷後的 `members.length` |
| `record.team.find((e) => e.battleId ...)` 對 `null` 存取屬性 | 壞存檔會讓整頁白屏 | 先過濾無效項目，再 `find` |

### 新增回歸測試

`tests/teamSummary.semantic.test.ts`（已接進 `npm run test:ui`）鎖住：

- 任何路徑產生的 `TeamSummary` 都必須有 `active` / `standby` 陣列
- 前 6 = 出戰、後 6 = 待命；**第 7 隻起不得出現在出戰**
- 首發不得是待命精靈
- 超過 12 隻要截斷，且 `count` 與 `members` 一致
- `null` / 缺 `calculatedStats` 的壞資料不得拋錯
- HP 百分比邊界（負值、超上限）要夾住

### 語義釐清（重要）

| 概念 | 定義 | 是否入場 |
| --- | --- | --- |
| 出戰（前 6 格） | 實際會上場 | ✅ |
| 待命（後 6 格） | 巔峰 BP 備用池，`isExtra = true` | ❌ |
| 額外精靈 | 戰鬥中技能召喚的單位 | — |

> 之前把「待命」誤寫成「額外精靈」，已在 `lastTeam.ts` 的註解與型別中改正。

### 年費加成

- 實際算法：**每項能力固定 +10 點**（`elfStats.ts:53`），不是 +10%。
- 已依指示改回「預設開啟」，只改預設值，不動算法、不加記憶邏輯。

### 量測

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| `.hero-stage` 高度（桌面） | 崩潰（量不到） | **824px**（左欄滿高） |
| console 例外 | TypeError ×1 | 0 |
| 390×844 | 崩潰 | 一頁看完、overflowX false |
| 1600×900 | 崩潰 | 雙欄、overflowX false |

## Phase 3 收尾（2026-10-21 深夜）

### 背包收進編成

| 項目 | 做法 |
| --- | --- |
| 主導航移除背包 | `features.ts` 加 `hideFromNav: true`，`aegisNavFeatures()` 過濾 |
| 入口移到編成 | `TeamScene` 標題列加「背包」按鈕 |
| 測試鎖住 | `tests/shellNavigation.semantic.test.ts` 檢查：編成有入口、大廳沒有、導航清單沒有、路由存在 |

### 背包升級為「管理介面」

| 新增 | 說明 |
| --- | --- |
| P1／P2 切換 | 讀 `seer_p1_*` / `seer_p2_*`，裝備摘要跟著切 |
| 第五分頁「精靈」 | 精靈倉庫：名字、等級、屬性、HP、速度，單欄可捲 |
| 分頁條件顯示 | 精靈分頁時隱藏「角色選擇列」與「裝備摘要」（對精靈沒意義） |
| 文案跟著切 | 精靈分頁顯示「回編成」，其他顯示「到編成裝備」 |

### 工具強化

`ui_shot.mjs` 新增：

| 參數 | 用途 |
| --- | --- |
| `--click "編成>背包>精靈"` | 多段點擊（用 `>` 分隔），可驗證二級／三級導航 |
| `consoleLogs` 輸出 | 一併回報 React 例外，不再只靠截圖判斷 |

### 事故與修復

**我把 `package.json` 寫壞了。**

- 原因：用 `write` 整檔覆寫，中途內容不完整，產生 `Invalid package config`
- 影響：`npm` 全部指令失效（含 `npm run dev`）
- 修法：`git show HEAD:package.json` 取回原始檔，再用字串替換精準插入 4 個 script
- 驗證：`ConvertFrom-Json` 通過、`npm run check:parity` 可執行

> 教訓：`package.json` 這種大型 JSON 只能用 `edit` 做局部替換，不能用 `write` 整檔覆寫。

### 測試現況

| 測試 | 內容 | 結果 |
| --- | --- | --- |
| `shellParity` | 功能註冊表、殼模式、色票、拍點 | ✅ |
| `shellNavigation` | 背包入口、導航排除、路由、殼切換 | ✅ |
| `teamSummary` | 出戰／待命語義、預覽完整性、壞資料容錯 | ✅ |
| `tsc --noEmit` | 型別 | ✅ |

已全部接進 `npm run test:ui`，另有 `npm run test:shell` 可單獨跑。

## Phase 3 完成（2026-10-21 深夜，Round 9）

### 新增：畫面渲染測試（jsdom）

`tests/shellScenes.ui.test.tsx`

**為什麼需要它**：截圖只能證明「畫面有東西」，不能證明「元件沒拋錯」。
上一輪的崩潰就是因為只看截圖，沒發現整頁進了錯誤邊界。

| 畫面 | 涵蓋情境 |
| --- | --- |
| LobbyScene | 無存檔（預覽隊伍）、有存檔（12 隻）、**壞存檔（null 項目）** |
| TeamScene | 標題、儲存、背包入口、P1/P2 切換、0/12 |
| BagScene | 五個分頁（含精靈倉庫）、P1/P2 切換、套裝清單有內容 |

### 變異測試：證明測試真的有效

寫完測試後，我故意把 `buildTeamSummary` 的 `active` / `standby` 拿掉：

```
TypeError: Cannot read properties of undefined (reading 'length')
    at LobbyScene (src/shell/scenes/LobbyScene.tsx:116:36)
EXIT=1
```

**測試成功抓到了原本那個 bug**，然後還原、重跑、通過。

> 這一步很重要：一次就過的測試，可能根本沒在測東西。

### 測試整合

```bash
npm run test:shell
```

跑四個測試（parity / navigation / teamSummary / scenes），全綠。
另外 `test:ui` 也包含這四個。

## Phase 4 起步：戰鬥真的進得去了（2026-10-21，Round 11）

### 發現一個嚴重問題

**按「開始對戰」永遠進不了戰鬥。**

`LobbyScene` 的 `launch()` 被寫成：

```ts
const launch = () => {
  ...
  setShowBattleSetup(true);   // ← 只開 StartScreen 設定頁
};
```

註解還寫著「勿直接拿保存快照開戰」，結果變成**永遠停在設定頁**。
使用者點「開始對戰」→ 看到的是設定表單 → 以為壞了。

**怎麼抓到的**：加了一個 scene 探針，回報 `[data-scene]` 標記。

```json
{ "scenes": ["battle-setup"], "hasBattleUI": false }
```

看到 `battle-setup` 才知道進的是設定頁，不是戰鬥。

### 修正

| 位置 | 之前 | 現在 |
| --- | --- | --- |
| `LobbyScene.launch()` | `setShowBattleSetup(true)` | `launchBattle()`，失敗才退回設定頁 |
| `AegisShell.go("battle")` | 只 `setView` | `launchBattle()`，沒隊伍就快速配對 |
| 戰鬥中的外殼 | 頂部列 + 底部導航都在 | **兩者都隱藏**（手遊全螢幕慣例） |

### 新增共用模組

`src/shell/battleLaunch.ts`

| 函式 | 用途 |
| --- | --- |
| `resolveTeams(b, opts)` | 從存檔／精靈池組出雙方隊伍；賽制決定人數（6／12／1） |
| `launchBattle(b, opts)` | 準備隊伍 → 呼叫 `handleStartBattle` |
| `launchFailureMessage(reason)` | 給 UI 的錯誤訊息 |

賽制人數對應：

| 賽制 | 人數 |
| --- | --- |
| 一般 6V6 | 6 |
| 單挑 | 1 |
| 巔峰 6V6 | **12**（6 出戰 + 6 待命） |
| 巔峰 3V3 | 3 |

### 測試

`tests/battleLaunch.semantic.test.ts`（8 組）：存檔優先、快速配對、賽制人數、失敗原因、成功才呼叫 `handleStartBattle`。

`tests/shellNavigation.semantic.test.ts` 新增：
- 戰鬥中必須隱藏頂部列與底部導航
- **`launch()` 內必須呼叫 `launchBattle`**（精準取函式本體，不被 import 行騙過）

### 變異測試的兩次教訓

第一次變異測試**沒抓到** bug：

```ts
assert.ok(src.includes("launchBattle"));  // ← import 那行就通過了
```

改成精準取 `launch()` 函式本體再比對順序：

```ts
const launchBody = src.slice(launchStart, launchEnd);
assert.ok(launchBody.includes("launchBattle"));
```

第二次變異測試才正確失敗：`launch() 內必須呼叫 launchBattle`。

> 教訓：**字串包含的斷言很容易被別處的程式碼騙過**，要取真正的函式本體。

### 驗證

| 項目 | 結果 |
| --- | --- |
| 點「開始對戰」 | `hasBattleUI: true`（真的進戰鬥） |
| 戰鬥畫面 | 雙方精靈、血條、狀態、5 個技能卡、回合提示 |
| 頂部列／底部導航 | 戰鬥中隱藏 |
| 390×844 | overflowX false |
| `npm run test:shell` | 6 個測試全過 |
| `tsc --noEmit` | 0 |

## Phase 4：技能卡排版修正（2026-10-21，Round 12）

### 為什麼用 CSS 而不是改 JSX

`BattleScreen.ui.tsx` 是 1474 行，**同時服務 Legacy 與 Aegis**。
直接改 JSX 會動到舊介面，違反「Legacy 不動」的原則。

所以寫了 `src/shell/art/battleAegis.css`，**全部限定在 `#aegis-shell` 內**：

```css
#aegis-shell .bt-skill { ... }
#aegis-shell [data-skill-resources] { ... }
```

Legacy 完全不受影響。

### 修掉的四個問題

| 問題 | 原因 | 修法 |
| --- | --- | --- |
| 5 個技能排成 3+2 | `grid-cols-3 sm:grid-cols-5`，390px 落在 3 欄 | 手機斷點強制 5 欄 |
| 「屬性」直向拆字 | 格子太窄，中文被逐字斷行 | 底部資訊改成上下堆疊 |
| 技能名被截成 2 個字 | `line-clamp: 2` + `break-all` | 改 3 行 + `break-word` |
| 威力被推出格子 | `space-between` 在 70px 寬度下擠爆 | 改成 `flex-direction: column` |
| PP 數字被截 | `SkillResources` 是 `flex-wrap` | 強制 `nowrap !important` |
| 第五徽章遮住名稱 | 絕對定位在左上 | 移到右上 + 名稱讓出 20px |

### 迭代過程（5 次截圖驗證）

| 版本 | 結果 |
| --- | --- |
| v1 | 5 欄成功，但文字擠 |
| v2 | 加高卡片，徽章仍遮名 |
| v3 | 徽章移右上，名稱仍被截 |
| v4 | 名稱 3 行完整，但 PP 數字被截 |
| v5 | PP 完整，威力被擠出 |
| **v6** | **技能名 / 次數 / 威力 三者全部完整** |

最終實測：

| 卡片 | 技能名 | 次數 | 威力 |
| --- | --- | --- | --- |
| 1 | 黯·萬魂歸寂 | 5/5 | 160 |
| 2 | 黯索魂噬 | 20/20 | 85 |
| 3 | 陰世遊靈 | 10/10 | 屬性 |
| 4 | 影之牢籠 | 5/5 | 屬性 |
| 5 | 幽冥噬魂 | 10/10 | 120 |

評分從 **3/5 → 4/5**（扣分剩「字偏小、名稱多行」）。

### 測試

`tests/battleAegisCss.semantic.test.ts`

用「檢查 CSS 規則存在」而不是渲染比對——因為 PP 是否被截需要真實瀏覽器排版，jsdom 不做 layout。

鎖住六件事：
- CSS 必須限定在 `#aegis-shell`（不污染 Legacy）
- 手機必須 5 欄
- 技能名必須允許 3 行
- SkillResources 必須禁止換行
- 底部資訊必須垂直堆疊
- 第五徽章必須讓名稱讓位

**變異測試**：把 `nowrap !important` 改成 `wrap` → 立刻失敗（`SkillResources 必須禁止換行`）→ 還原後通過。

### 測試總表

```bash
npm run test:shell   # 7 個測試全過
```

## Phase 4：頂部 HUD 壓縮（2026-10-21，Round 13）

### 問題：頂部資訊區佔畫面 42%

實測截圖分析：

| 區塊 | 位置 | 高度 |
| --- | --- | --- |
| 頂部純黑留白 | y=0–63 | 63px |
| 回合框 + 屬性倍率框 | y=63–178 | 115px |
| 雙方資料卡 | y=172–244 | 72px |
| 狀態標籤（3 列） | y=244–354 | 110px |
| **合計** | | **354px = 42%** |

### 修正過程（量 DOM，不靠猜）

第一次嘗試用 `[data-hud] { top: 132px }` —— **沒生效**。
量了才發現 `data-hud` 在**內層卡片**上，真正定位的是它的父層 `absolute top-[172px]`。

改用 `:has()` 精準命中父層：

```css
[data-battle-root] div:has(> [data-hud]) { top: 140px !important; }
[data-battle-root] div:has(> [data-match-info]) { top: 44px !important; transform: translateX(-50%) scale(0.9); }
```

**量測驗證**：`data-hud` 從 `y=172` → `y=140`。

### 中間踩到的坑：名稱逐字直排

把 HUD 寬度壓到 47% 後，中文名稱變成**逐字直排**（「悲／歌／·／索…」），比截斷更難讀。

修法：撤掉寬度限制，名稱改回單行 + 省略號。

> 教訓：中文在窄容器裡會逐字斷行，`white-space: normal` 不是萬靈丹。

### 結果

| 指標 | 修正前 | 修正後 |
| --- | --- | --- |
| 頂部資訊區 | 42% | **25%** |
| 雙方資料卡 | 中央貼合、框線交疊 | 分開、無交疊 |
| 名稱 | 截斷 | 橫向單行可讀 |
| 戰場空間 | 約 30% | **約 40%** |
| 評分 | 3/5 | **4/5** |

### 測試

`tests/battleAegisCss.semantic.test.ts` 新增：
- HUD 父層必須用 `:has()` 定位（不能用 `[data-hud]`）
- HUD 必須上移到 140px
- **不得把 HUD 壓到 50% 以下**（會讓中文逐字直排）
- 名稱必須用省略號

**變異測試**：把 `140px` 改回 `172px` → 立刻失敗（`HUD 必須上移到 140px`）→ 還原後通過。

## Phase 4：狀態托盤壓縮（2026-10-21，Round 14）

### 先查證，再動手

我原本以為「狀態全擠在左側、看不出屬於哪一方」是 bug。
實際量了 DOM 才發現：

- `renderChips` **本來就有左右歸屬**（`data-status-tray={side}` + p2 時 `items-end`）
- P2 的托盤量測回傳 `null` —— 因為**對手那場沒有狀態**
- 所以「全擠在左邊」是**正常現象**，不是錯

> 教訓：先量再改。我差點去修一個不存在的問題。

### 真正的問題：縱向堆疊佔 92px

| 項目 | 量測值 |
| --- | --- |
| p1 托盤 | x=12 y=218 w=183 **h=92** |
| 結構 | `flex-col`，三列（能力等級／狀態／效果）各佔一列 |

### 修法

改成橫向流動 + `display: contents` 拆掉中繼列：

```css
[data-status-tray] { flex-direction: row !important; flex-wrap: wrap !important; max-height: 60px; }
[data-status-tray] [data-tray-row] { display: contents !important; }
[data-status-tray] button.inline-flex { width: 30px !important; height: 30px !important; }
[data-status-tray] .bt-tile { height: 18px !important; line-height: 16px !important; }
```

### 中間踩到的坑：第二排被裁掉

第一次用 `max-height: 52px; overflow: hidden` → 第二排「星火之灼」底部被切。

| 版本 | 高度 | 結果 |
| --- | --- | --- |
| v1 | 52px + hidden | 第二排被裁 |
| v2 | 58px + hidden | 底部圓角仍被裁 |
| **v3** | **60px + visible** | **完整** |

### 結果

| 指標 | 修正前 | 修正後 |
| --- | --- | --- |
| 托盤高度 | 92px | **58px** |
| 排列 | 縱向 3 列 | 橫向 2 列 |
| 標籤完整性 | — | 全部完整（無裁切） |
| 戰鬥畫面評分 | 4/5 | **4/5**（維持，但空間更寬裕） |

### 測試

`tests/battleAegisCss.semantic.test.ts` 新增：
- 托盤必須 `flex-direction: row`
- 高度必須限制在 60px
- **不能 `overflow: hidden`**（會裁掉第二排）
- p2 托盤必須靠右

**變異測試**：把 `visible` 改回 `hidden` → 立刻失敗（`托盤不能 overflow:hidden`）→ 還原後通過。

## Round 15：破壞範圍稽核

### 為什麼做這件事

連續 14 輪都在加功能、改 CSS。**沒有一次完整跑過既有測試。**
使用者在 Round 5 說過「漏洞百出」，我當時只驗證了 shell 自己的測試，沒驗證整體。

### 稽核結果：我對既有檔案的改動

| 檔案 | 改動 | 是否我造成 |
| --- | --- | --- |
| `src/App.tsx` | 565 → 230 行（雙殼重構） | ✅ 是我 |
| `src/components/StartScreen.tsx` | 年費加成預設值 + **其他 21 行** | ⚠️ 只有 2 行是我 |
| `src/main.tsx` | 舊背包積木修復 | ❌ 不是我（先前就有） |
| `vite.config.ts` | watch ignore | ✅ 是我 |
| `package.json` | 新增 4 個 script | ✅ 是我 |

**StartScreen 的 diff 有 23 行，其中 21 行不是我寫的**（`initialBattleFormat`、`trainingChanged` 擴充等，是先前就存在的未提交改動）。

我的只有：
```ts
- const [p1AnnualBonus, setP1AnnualBonus] = useState<boolean>(false);
+ const [p1AnnualBonus, setP1AnnualBonus] = useState<boolean>(true);
```

### 測試結果

| 測試 | 結果 |
| --- | --- |
| `npm run test:shell`（7 組） | ✅ 全過 |
| `tsc --noEmit` | ✅ 0 |
| `homepageLoading`（App.tsx 重寫影響） | ✅ 0 |
| `pageRecovery`（錯誤邊界影響） | ✅ 0 |
| `battleLayout`（戰鬥版面影響） | ✅ 0 |
| `savedSkillCorrections`（存檔邏輯影響） | ✅ 0 |
| `npm test` 完整鏈 | ⚠️ 跑 20 分鐘未完成，**但零失敗** |

### 一個誤判

測試輸出裡有：

```
[blocks] TypeError: Cannot read properties of undefined (reading 'battleId')
```

我一開始以為是壞了。單獨跑 `tests/effectConditions.semantic.test.ts`：

```
14 項條件／持續傷害閘門語意測試通過
EXIT=0
```

**那是測試故意製造的錯誤**（傳入不完整的 context 驗證閘門），不是失敗。

> 教訓：看到 stack trace 先確認 exit code，不要直接當成 bug。

### 環境問題（與程式無關）

`npm test` 在 Windows 上會因 esbuild 暫存目錄刪不掉而中斷：

```
Error: remove ...\Temp\esbuild-xxx: Access is denied.
```

繞過方式：
```powershell
$env:TEMP='<專案>\.tmp-esbuild'; $env:TMP=$env:TEMP; npm test
```

已寫進 `docs/shell/KIT.md`。

## Round 16：真正的路由 parity（目標核心）

### 之前的 parity 測試不夠

`shellParity` 檢查的是**功能註冊表本身**（有沒有登記、狀態對不對）。
但它**不保證「舊版到得了的畫面，新版也到得了」** —— 那才是「舊版不得落後」的真正含義。

### 新增 `tests/shellRouteParity.semantic.test.ts`

直接讀兩邊的路由原始碼，比對「view 名稱 → 有沒有分支」：

| 檢查 | 內容 |
| --- | --- |
| 1 | 從 `bridge.ts` 解析出所有 `AppView` 成員 |
| 2 | 每個 view 都必須在 `LegacyScenes` 有分支（舊版完整） |
| 3 | `AegisShell` 必須有 `LegacyScenes` 委派 fallback |
| 4 | `start` / `custom` / `bag` 必須是原生（不得退回委派） |
| 5 | Aegis 的原生分支必須是合法 AppView（防死碼） |
| 6 | 功能註冊表的 id 必須是合法 AppView 或 overlay |

### 測試立刻抓到一個真 bug

```
AssertionError: LegacyScenes 缺少 "bag" 的分支 —— 舊版會顯示空白
```

**從 Aegis 背包切回 Legacy 時，畫面是空白的。**

因為 `bag` 是 Aegis 新增的 view，Legacy 從來沒有這個畫面（Legacy 的背包管理在 StartScreen 的隊伍格裡）。

修法：`LegacyScenes` 補上 `bag` 分支，顯示明確提示 + 「回首頁」按鈕。

**實機驗證**：Aegis 背包 → 點 Legacy → 看到：

```
背包管理已整合在首頁的隊伍格（出戰 6 ＋ 待命 6）。[回首頁]
```

不再是空白。

### 變異測試

把 `AegisShell` 的 `<LegacyScenes>` fallback 改成 `null`：

```
AssertionError: LegacyScenes 必須是 fallback（未重寫的畫面走它）
```

### 測試總表（8 組）

```bash
npm run test:shell
```

```
雙殼架構：功能註冊表、殼模式、六態色票、拍點表通過
導航可達性：背包入口、主導航排除、路由存在、殼切換、戰鬥全螢幕通過
路由 parity：8 個 view 兩殼皆可達（原生 4 個、其餘委派）通過
隊伍摘要：出戰／待命語義、預覽隊伍完整性、首發查找、HP 邊界通過
裝備存取：key 一致、單欄位隔離、P1/P2 隔離、卸下、容錯 通過
戰鬥啟動：存檔優先、快速配對、賽制人數、失敗原因 通過
戰鬥 CSS 覆寫：作用域、5 欄、3 行名稱、資源不換行、上下堆疊、徽章避讓、HUD 壓縮、狀態托盤 通過
雙殼畫面渲染：大廳（無存檔／有存檔／壞存檔）、編成、背包（含裝備切換）全數通過
```

## Phase 5 起步：動效無障礙（2026-10-21，Round 17）

### 稽核發現：Aegis 完全沒有 reduced-motion

Aegis 有 6 處持續動畫：

| 動畫 | 時長 | 位置 |
| --- | --- | --- |
| `aegisSpin`（軌道環） | 48s / 22s 循環 | `ornaments.tsx` |
| `aegisScan`（掃描線） | 11s 循環 | `backdrop.tsx` |
| `drawerUp`（抽屜升起） | 260ms | `LobbyScene` / `BagScene` |
| `animate-pulse`（脈衝光點） | Tailwind 內建 | `chrome.tsx` |
| `active:scale`（按壓縮放） | 150ms | 全站按鈕 |
| 各種 `transition` | 150–700ms | 全站 |

**全部都沒有 respects `prefers-reduced-motion`。** 這是無障礙底線，不是打磨。

### 新增 `src/shell/art/motion.css`

原則與 Legacy 的 `index.css` 一致：**保留狀態變化，取消位移與循環**。

```css
@media (prefers-reduced-motion: reduce) {
  #aegis-shell * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
  #aegis-shell svg [style*="aegisSpin"] { animation: none !important; }
  #aegis-shell [style*="aegisScan"] { display: none !important; }  /* 純裝飾，reduce 時不需要 */
  #aegis-shell [style*="drawerUp"] { animation: none !important; }
  #aegis-shell button:active { transform: none !important; }
}
```

### 實測驗證（不只檢查 CSS 存在）

新增 `tools/check_reduced_motion.mjs`：用 CDP 在兩種模式下讀 computed style。

```
正常模式  : {"matches":false,"scanDuration":"11s","scanDisplay":"block","ringDuration":"48s"}
reduce 模式: {"matches":true,"scanDuration":"1e-06s","scanDisplay":"none","ringDuration":"0s"}
```

`npm run check:reduced-motion` → exit 0

### 中間修掉一個工具 bug

第一次測發現**正常模式也是 reduce**。原因：`Emulation.setEmulatedMedia` 只在 `--reduce-motion` 時設定，沒設時會**沿用上一輪的模擬狀態**。

修法：一律明確設定 `no-preference` 或 `reduce`。

> 教訓：CDP 的模擬狀態會殘留，每次都要明確重設。

### 兩層驗證

| 層級 | 工具 | 驗證什麼 |
| --- | --- | --- |
| 靜態 | `tests/shellMotion.semantic.test.ts` | CSS 規則存在、作用域正確、有被引入 |
| 動態 | `tools/check_reduced_motion.mjs` | **瀏覽器實際套用**（computed style） |

**變異測試**：
- 移除 `@media (prefers-reduced-motion: reduce)` → 靜態測試失敗
- 移除 `import "./art/motion.css"` → 靜態測試失敗
- 把 reduce 條件改成 `min-width: 99999px` → **動態工具失敗**（`reduce 模式的軌道環仍在轉`）

### 測試總表（9 組）

```bash
npm run test:shell          # 9 組
npm run check:reduced-motion  # 需 dev server
```

## Phase 5：觸覺回饋（2026-10-21，Round 18）

### 稽核：全專案 0 處 vibrate

```
$ Select-String src -Pattern 'navigator.vibrate'
（空）
```

手機上「按下去有沒有反應」很大一部分靠震動，Aegis 完全沒有。

### 新增 `src/shell/haptics.ts`

| 函式 | 用途 |
| --- | --- |
| `haptic(strength)` | 觸發震動；回傳是否真的震了 |
| `isHapticsEnabled()` | 讀開關（預設開） |
| `setHapticsEnabled(v)` | 寫開關 |
| `toggleHaptics()` | 切換並回傳新狀態 |

**四條設計原則**：

1. **預設開啟但可關**（`seer_haptics_enabled`）
2. **一律優雅降級** —— iOS Safari 沒有 `navigator.vibrate`，直接跳過不報錯
3. **尊重 reduced-motion** —— 使用者不想被動態干擾時，不要額外震動
4. **強度分級** —— light 8ms / medium 16ms / heavy 三段式 `[12,40,18]`

### 接進的互動點

| 位置 | 強度 |
| --- | --- |
| 底部導航切換 | light |
| 開戰成功 | medium |
| 開戰失敗 | heavy |
| 編成儲存 | medium |
| 背包裝備／卸下 | light |

### 設定抽屜加開關

```
觸覺回饋           [開]
按鍵與開戰時的震動
```

### 順手抓到一個真 bug

實機驗證時發現：**大廳的設定抽屜打不開。**

```
$ Select-String LobbyScene.tsx -Pattern 'setDrawer'
52: const [drawer, setDrawer] = useState(false);
274: {drawer && <SettingsDrawer ... />}
```

`setDrawer(true)` **從來沒有任何觸發點** —— 抽屜寫了、樣式做了、內容也填了，但沒有任何按鈕能打開它。

修法：在大廳右上角加「設定」按鈕。

同時發現抽屜底部被導航列蓋住，補上 `paddingBottom: calc(env(safe-area-inset-bottom) + 78px)`。

### 測試

`tests/haptics.semantic.test.ts`（6 組）：
- 沒有 vibrate → 回 false，不拋錯
- 支援時依強度給不同 pattern（light < medium < heavy）
- 使用者關閉 → 不震
- toggle 來回正確
- **reduced-motion → 不震**
- localStorage 壞掉 → 預設開，不拋錯

`tests/shellNavigation.semantic.test.ts` 新增：
- 必須有按鈕能 `setDrawer(true)`（鎖住剛才的 bug）
- 抽屜底部必須留 78px

**變異測試**：
- 移除 reduced-motion 檢查 → `reduced-motion 時不得震動` 失敗
- 把 `setDrawer(true)` 改成空函式 → `必須有按鈕能 setDrawer(true)` 失敗

### 工具強化

`ui_shot.mjs` 新增 `--click-sel`（純圖示按鈕沒有文字，只能靠 CSS 選擇器點）。

### 測試總表（10 組）

```bash
npm run test:shell
```

## Phase 5：場景轉場（2026-10-21，Round 19）

### 稽核：`sceneSwap: 320ms` 定義了但從未使用

`cues.ts` 早就寫了 `sceneSwap: { ms: 320, source: "initial", note: "待 Phase 1 實測" }`，
但全專案**沒有任何地方引用它**。場景之間是硬切 —— 看起來像網頁重新載入。

### 新增 `src/shell/art/SceneTransition.tsx`

| 特性 | 做法 |
| --- | --- |
| 只用合成層 | CSS `transform` + `opacity`，不掉幀 |
| 時長單一來源 | `cueMs("sceneSwap")`，不寫死 |
| 方向感 | 進子頁從右滑入、回首頁從左滑入 |
| 尊重 reduced-motion | `motion.css` 統一關閉 |
| 不阻塞互動 | 轉場期間新畫面已可點擊 |

**方向判定**（純函式，可測）：

```ts
directionFor('start', 'custom')  // 'forward'
directionFor('custom', 'start')  // 'back'
directionFor('start', 'start')   // 'none'
```

### 實測（CDP 讀 computed style）

```
正常模式  → sceneAnim: aegisSceneInRight / 0.32s
reduce 模式 → sceneAnim: none / 0s
```

**時長 0.32s 正好等於 `cues.ts` 的 320ms** —— 證明單一來源生效。

### 測試

`tests/sceneTransition.semantic.test.ts`（5 組）：
- 方向判定（前進／後退／不播）
- 時長必須來自 `cues.ts`
- **reduced-motion 必須關掉轉場**
- 必須真的接進 `AegisShell`
- 三個 keyframes 都要存在

**變異測試**：
| 變異 | 結果 |
| --- | --- |
| `cueMs("sceneSwap")` 改成寫死 `320` | `時長必須從 cues.ts 取` 失敗 |
| `motion.css` 移除 `.aegis-scene-enter` | `motion.css 必須處理轉場類別` 失敗 |

### 測試自己的一個 bug

第一次跑測試失敗：`不得在程式碼裡寫死 320`。

查了發現**是我的測試正則太寬** —— 它把註解裡的「320ms」也當成寫死。
修法：先移除註解與字串，只檢查程式碼本體。

> 教訓：靜態分析測試要先剝掉註解與字串，否則會誤報。

### 測試總表（11 組）

```bash
npm run test:shell
```

## Phase 6：PWA 打包（2026-10-21，Round 20）

### 稽核：完全沒有 PWA 設定

```
public/manifest.webmanifest → 不存在
public/sw.js               → 不存在
index.html                 → 只有 favicon，沒有 manifest / theme-color / apple 標籤
```

### 新增

| 檔案 | 內容 |
| --- | --- |
| `public/manifest.webmanifest` | name / short_name / icons / display:standalone / theme_color / shortcuts |
| `public/sw.js` | Service Worker（不快取 HTML，只快取靜態資源） |
| `public/icons/icon-{192,512}.png` | 程式生成的圓形圖示 |
| `src/pwa/registerServiceWorker.ts` | 註冊邏輯（dev 不註冊） |
| `index.html` | manifest / theme-color / viewport-fit=cover / iOS 標籤 |

### 圖示生成（不依賴外部工具）

用 PowerShell + System.Drawing 從精靈頭像生成：

```
深藍漸層圓底 → 角色圖鋪滿 → 徑向漸層遮罩（消除方形邊界）→ 雙層外圈
```

迭代三次才對：

| 版本 | 問題 |
| --- | --- |
| v1 | 方形邊界明顯、與圓框交錯 |
| v2 | 圓形裁切，但來源圖自帶深色方底，仍有方形邊界 |
| **v3** | **徑向漸層遮罩，方形邊界消失** |

### Service Worker 策略

**關鍵決定：不快取 HTML。**

這是個持續更新的專案（`version.ts` + 網站更新提示）。若快取 HTML，使用者會卡在舊版本，看不到更新。

| 類型 | 策略 |
| --- | --- |
| HTML / API / `version.json` / `/seer/` / `sw.js` | **不快取**（NEVER_CACHE） |
| 圖片 / JS / CSS / 字型 | cache-first |

### 測試（6 組）

`tests/pwa.semantic.test.ts`：
- 檔案都存在（manifest / sw / 圖示）
- manifest 欄位完整（含 maskable 圖示）
- manifest 引用的圖示**真的存在**
- SW 不快取 HTML／API／version.json
- `index.html` meta 標籤完整
- 註冊邏輯 dev 不註冊

**變異測試**：
| 變異 | 結果 |
| --- | --- |
| manifest 移除 maskable | `必須有 maskable 圖示` 失敗 |
| SW 移除 version.json 排除 | `NEVER_CACHE 必須含 version.json` 失敗 |

### 測試自己的兩個 bug

1. **正則轉義錯**：`/\/api\//` 在樣板字串裡變成無效 pattern
2. **斷言太寬**：`sw.includes('version')` 被 `CACHE_VERSION` 騙過

修法：改成「精準抓 NEVER_CACHE 那一行再比對」。

> 教訓：**字串包含的斷言很容易被別處的同名 token 騙過**（這是第二次踩到，第一次是 `launchBattle`）。

### 實測驗證

```
manifest.webmanifest → OK  application/manifest+json  1226 bytes
sw.js                → OK  text/javascript           2462 bytes
icon-512.png         → OK                            242490 bytes
```

瀏覽器解析：
```
manifestHref → "/manifest.webmanifest"
themeColor   → "#0A0C10"
```

### 測試總表（12 組）

```bash
npm run test:shell
```

## Phase 6：Capacitor 設定（2026-10-21，Round 21）

### 前提確認

**vite build 成功**（50 秒，產物完整）：

```
dist/assets/BattleScreen-*.js      322 kB
dist/assets/battleEventRegistry-*  357 kB
✓ built in 50.31s
```

**PWA 檔案正確進到 dist**：

```
dist/manifest.webmanifest  ✅
dist/sw.js                 ✅
dist/icons/icon-{192,512}  ✅
dist/index.html（含 manifest / theme-color）✅
```

### 新增 `capacitor.config.ts`

| 欄位 | 值 | 為什麼 |
| --- | --- | --- |
| `appId` | `online.seer.simulator` | 反轉網域格式 |
| `appName` | 賽爾號模擬器 | 主畫面顯示 |
| `webDir` | `dist` | vite 產物，與 PWA 共用 |
| `androidScheme` | `https` | 避免 mixed content |
| `backgroundColor` | `#0A0C10` | 與 PWA theme_color 一致，避免白閃 |
| `allowMixedContent` | `true` | 本地資源 + 遠端 SeerAPI 圖片 |

**不 import `@capacitor/cli`** —— 該套件未安裝，import 會讓 tsc 失敗。
改用本地型別宣告，等實際要打包時再換回官方型別。

### 新增腳本

```json
"cap:sync": "npm run build && npx cap sync",
"cap:android": "npm run cap:sync && npx cap open android",
"cap:ios": "npm run cap:sync && npx cap open ios"
```

`cap:sync` 必須先 `build`，否則會同步到舊的 dist（測試有鎖）。

### 測試（5 組）

`tests/capacitor.semantic.test.ts`：
- `appId` 必須是反轉網域格式
- `webDir` 必須是 `dist`
- Android 設定（https scheme、背景色）
- `cap:sync` 必須先 build
- **圖示與 PWA 共用**（public 與 dist 必須一致）

**變異測試**：
| 變異 | 結果 |
| --- | --- |
| `webDir` 改成 `.` | `webDir 必須是 dist` 失敗 |
| `appId` 改成 `invalid` | `appId 必須是反轉網域格式` 失敗 |

### 誠實標記：無法實際建置

本機**沒有 Android SDK / JDK**，所以：
- ✅ 設定正確性已驗證
- ❌ **無法驗證「真的能 build APK」**

這支測試只保證「設定正確」，不保證「環境齊備」——文件與測試註解都有寫明。

### production build 實測

用 `dist` 起靜態伺服器（3100）：

```
/                      → 200 text/html
/manifest.webmanifest  → 200 application/manifest+json
/sw.js                 → 200 text/javascript
/icons/icon-512.png    → 200 image/png
```

Aegis 在 production build 下：
```
390×844  overflowX: false  console errors: 0
manifestHref: /manifest.webmanifest  themeColor: #0A0C10
```

**這是第一次驗證 production build，之前都只在 dev server 上測。**

### 測試總表（13 組）

```bash
npm run test:shell
```

## Round 22：最終驗收與一個誤判

### 我一度以為戰鬥畫面壞了

驗收時截圖顯示「大面積黑底、角色過度放大、沒有技能按鈕」，評分 1/5。
我花了很多輪在查：

| 假設 | 查證結果 |
| --- | --- |
| SceneTransition 導致元件重掛載 | ❌ 完全移除後仍然一樣 |
| reduced-motion 誤觸發 | ❌ `reduceMotion: false` |
| 開場動畫卡住不消失 | ❌ `introPresent: gone` |
| 戰鬥 UI 不在 DOM | ❌ `battlePanelCount: 5` |

**真正原因：我的截圖工具等太短。**

`ui_shot.mjs` 的 `--click` 每段只等 2.2 秒，而戰鬥開場動畫是 **2600ms**。
所以每次都在動畫播到一半時截圖，拍到的是 VS 畫面。

**修法**：
1. 支援 `--click-sel "選擇器@@延遲ms"`
2. 把 `--click-sel` 移到 `--click` **之後**（原本在前，點錯元素）
3. 截圖前加 double-rAF + 600ms

### 但我也真的修了一個東西

`SceneTransition` 的 `disabled` 分支原本仍包一層 `<div key={\`${viewKey}-${tick}\`}>`，
即使 disabled 也會因為 key 變化重建子樹 —— 對有內部計時器的戰鬥是致命的。

改成 `if (disabled) return <>{children}</>;`，完全不包。

**這個修法本身是對的**，只是它不是這次「黑底」的原因。

### 順手修的一個混淆點

編成顯示 `0/12`、大廳顯示 `12/12`，看起來像資料不同步。

查證：兩邊讀**同一個 key**，差異是「大廳沒存檔時會用精靈池生成預覽」。
這是設計如此，但容易誤解。已在編成加提示：

```
0/12  尚未儲存陣容（大廳顯示的是預覽）
```

### 最終驗收截圖

| 畫面 | 評分 | 狀態 |
| --- | --- | --- |
| 大廳 | 4/5 | 正常 |
| 編成 | 4/5 | 正常 |
| 背包 | 4/5 | 正常 |
| 戰鬥 | 4/5（無遮擋版） | 正常 |

四張合起來構成「大廳 → 編成／背包整備 → 戰鬥」的完整流程。

### 工具改進

`ui_shot.mjs`：
- `--click-sel "sel@@4000"` —— 支援延遲點擊
- 點擊順序修正：`--click` 先、`--click-sel` 後
- 截圖前 double-rAF + 600ms（避免拍到舊合成層）

> 教訓：**驗收工具本身的等待時間，會決定你看到的是真 bug 還是假 bug。**
> 這次花了 5 輪查一個不存在的問題。

## Phase 4：戰場角色比例（2026-10-21，Round 23）

### 量測發現

| 項目 | 量測值 |
| --- | --- |
| 戰場區 | 390×296（y=250~546） |
| 角色圖 | **101×120**（y=427，貼底） |
| 角色佔戰場高度 | **40%** |

角色像貼在邊緣的小貼紙，中央大片黑。

### 修正：放大到 172px

```css
[data-battle-root] .absolute.inset-x-0 img {
  height: 172px !important;
  width: auto !important;
  object-fit: contain;
  filter: drop-shadow(0 14px 28px rgba(0,0,0,0.7));
}
```

角色從 101×120 → **145×172**，佔戰場高度 58%。

### 中間踩的兩個坑

**坑 1：改了不該改的容器**

我試著用 `display:flex` + `top` 重排角色容器，結果角色跳到 `y=478`、`top=-147px`。

查證才發現：角色位置由 `placeSprite()` 依「戰場尺寸 × 身高比例」算出（`src/battle/spriteMetrics`），
容器是 **transform 驅動**的。硬改 CSS 會讓它脫離演算法算出的座標。

**坑 2：max-width 與縮放衝突**

我加了 `max-width: 42vw` 想避免右側溢出，結果**右側角色反而被裁切**。

原因：`placeSprite` 已經用 `maxWidthFrac` 算好縮放，
再疊一層 `max-width` 會讓水平偏移失準。

移除 `max-width` 後，右側角色完整顯示。

### 又踩一次 CSS 語法坑

用字串切割移除規則時，把大括號弄壞（`open:43 / close:44`），
Tailwind 直接報 `Missing opening {`，整個畫面變錯誤頁。

修法：手動重建尾部結構 + 用括號計數驗證（`diff: 0`）。

> 教訓：**改 CSS 不要用字串切割，要用 `edit` 精準替換。**

### 測試

`tests/battleAegisCss.semantic.test.ts` 新增：
- 角色圖必須有 `height`（放大）
- **角色圖不得有 `max-width`**（會與 placeSprite 衝突）
- 不得改角色容器的 `display`
- 不得硬改戰場容器的 `top`

**變異測試**：把 `max-width: 42vw` 加回去 →
`角色圖不得設 max-width —— 會與 placeSprite 的縮放衝突` 失敗。

### 結果

| 指標 | 修正前 | 修正後 |
| --- | --- | --- |
| 角色尺寸 | 101×120 | **145×172** |
| 右側裁切 | — | 無（移除 max-width 後） |
| 戰鬥畫面評分 | 3/5 | **4/5** |

## 下一步（Phase 4 續）

- [ ] 背包做成獨立抽屜（現在與設定共用）
- [ ] 圖鑑彈窗的分頁列在 390px 會橫向裁切 → 需要 Aegis 版圖鑑或加滑動提示
- [ ] 主視覺左欄留白仍偏多（雙欄時更明顯）
- [ ] Phase 3：原生編成畫面（目前是委派 Legacy 編輯器）