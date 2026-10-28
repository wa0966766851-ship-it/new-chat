# 隱匿精靈顯示範圍盤點（2026-10-24）

使用者規則：「隱匿精靈名稱只顯示給持有方，針對對方才隱藏；PVP 改成全局隱藏。」
- PVE：持有方（p1，玩家）完整可見；AI（p2）的隱匿精靈對玩家一律遮蔽。
- PVP（同螢幕）：雙方隱匿精靈對任何人都遮蔽。
- 「待使用者確認」＝我判斷有疑問，已先依「不洩漏」處理，可由使用者放寬。

## 一、隱匿機制定義

| 項目 | 位置 |
|---|---|
| 旗標 `Elf.isConcealed`（印記狀態：立繪黑影、技能未知） | `src/types.ts:278` |
| 取得／清除來源：特質 `enterGainConceal`、戰士、無序登場、`nextElfPending`、statCalculator 複製 | `src/utils/traitsEngine.ts:59,106`、`src/effects/rules/nextElfPending.ts:26`、`src/utils/statCalculator.ts:300`、`src/effects/elves/wuxu/registry.ts:56` |
| **可見性唯一判斷** `hiddenFromViewer(elf, owner, mode, viewer=p1)` | `src/battle/viewerPerspective.ts`（PVE：owner≠viewer 才隱；PVP：一律隱） |
| 模式提供者 `BattleViewModeContext` / `useBattleViewMode()` | `src/battle/viewerMode.ts`（由 `BattleScreenUI`、`BattleScreen.tsx`、`BattleLoadingScreen`、`ElfReadOnlyProfile` 提供） |
| 文字遮蔽詞 `viewerMaskTermsForMode(p1Team,p2Team,mode)`、`maskViewerText`、`maskViewerDeep`（結構化資料） | 同上 |
| 結算用無識別替身 `maskElfIdentity` | 同上 |
| 引擎 log 文字：行動者名稱／技能名 | `src/engine/battleEngine.ts:2644`（已帶 `battleMode`） |
| AI 端（不顯示給玩家）：`knowledge.ts` 對 AI 隱匿資訊、`legalActions.ts:60` 文字 | 僅 AI 內部，無 UI；`legalActions` 的 `隱匿精靈` 字樣不進 DOM |
| 另一套「幻化」視角迷霧（`elfForViewer`） | 與隱匿獨立，未動 |

## 二、顯示點盤點（共 26 處）

欄位：修前 = 本次修改前的實際行為。「洩漏」= 隱匿資訊會出現在 DOM／HTML／title／aria。

| # | 顯示點 | 檔案:行（修後） | 隱藏的資訊項目 | 修前 PVE 對方 | 修前 PVP | 修後 |
|---|---|---|---|---|---|---|
| 1 | 頭像 fallback SVG `aria-label`、頭像圖 `alt` | `SeerImages.tsx:~100,~125` | 精靈名稱 | **洩漏**（aria-label=真名，即 uiFoundation:63） | **洩漏** | 隱匿時固定「未知精靈」 |
| 2 | 頭像／立繪圖片本身（共用鬼影） | `SeerImages.tsx:54,117` | 立繪、頭像、徽記字 | 已遮蔽 | 持有方 p1 看得到 | PVE 對方、PVP 雙方遮蔽 |
| 3 | 場上立繪：真實動作模型（PetActionSprite）與依身高／名稱決定的大小 | `ProportionalSprite.tsx:51,55,100`、`BattleScreen.ui.tsx:1056` | 真實模型、身高、精靈專屬尺寸 | **洩漏**（隱匿的動作精靈仍載入真模型，大小也暗示身分） | 洩漏 | 隱匿時不載入動作模型，用預設比例 |
| 4 | 戰鬥 HUD 名稱 | `BattleScreen.ui.tsx:~935` | 名稱 | 已遮蔽 | 持有方可見 | 同上規則 |
| 5 | 戰鬥 HUD 屬性圖示 | `BattleScreen.ui.tsx:~930` | 屬性 | 已遮蔽 | 持有方可見 | 同上 |
| 6 | HUD 魂印／特質／特性按鈕與 title | `BattleScreen.ui.tsx:~940-958` | 魂印名與描述、特質名 | 已遮蔽 | 持有方可見 | 同上 |
| 7 | HUD 體力數字與 title（`目前/上限`） | `BattleScreen.ui.tsx:~963` | 體力與上限數值 | **洩漏**（數字照常顯示） | 洩漏 | 隱匿時顯示「？/？」，**血條與 % 仍顯示**。**待使用者確認** |
| 8 | HUD 護盾／護罩 | `BattleScreen.ui.tsx:~970` | 護盾值 | 顯示 | 顯示 | 維持顯示（屬戰場狀態，非身分資訊）。**待使用者確認** |
| 9 | HUD 能力等級／異常／印記／計時 chips | `BattleScreen.ui.tsx:810` | 能力等級、異常、印記 | 已遮蔽 | 持有方可見 | 同上規則 |
| 10 | 精靈詳情彈窗（名稱、屬性、身高體重、完整介紹、魂印、能力、技能） | `ElfReadOnlyProfile.tsx:30-60` | 全部 | 已遮蔽（但頭像 aria 洩漏，見 #1） | 持有方可見 | PVE 對方、PVP 雙方遮蔽；開啟入口也停用 |
| 11 | 詳情內「戰鬥狀態」分頁（`renderElfDetails`） | `BattleScreen.ui.tsx:327` | 能力等級、異常、印記、計時 | 已遮蔽 | 持有方可見 | 同上 |
| 12 | 技能列：技能名、技能屬性圖示、轉化、第五標、徽章 | `BattleScreen.ui.tsx:1087-1141` | 技能名、屬性、說明 | 不適用（玩家只操作自己） | 持有方可見 | PVP 隱匿操作側顯示「未知技能 N」、無圖示／說明；PVE 持有方不變。**威力／PP 仍顯示（操作必需），待使用者確認** |
| 13 | 技能列 `data-skill-resources` 屬性 | `SkillResources.tsx` | 技能名 | 不適用 | **洩漏** | 隱匿時省略屬性 |
| 14 | 技能懸浮說明 | `BattleScreen.ui.tsx:1102` | 技能名、說明 | 不適用 | 持有方可見 | PVP 隱匿時為「未知技能」、無技能屬性徽章、空說明（種類與威力仍顯示，待使用者確認） |
| 15 | 隊伍分頁（換人選單）名稱／屬性／頭像／體力數字／魂印 hover | `BattleScreen.ui.tsx:693-717` | 名稱、屬性、體力、魂印 | 不適用（只列己方） | **洩漏**（頭像寫死 `p1` 視角；p2 操作時錯用 p1 判斷） | 依操作側判斷；PVP 全遮蔽，體力顯示「？/？」。**體力待使用者確認** |
| 16 | 對戰訊息（log）文字 | `BattleScreen.ui.tsx:590`（`maskedLogs`） | 名稱、技能名、魂印、特質名 | 已遮蔽（顯示時） | 只遮 p2 | PVP 雙方詞表；PVE 只遮對方。**log 中的技能名待使用者確認**（已遮） |
| 17 | log 的「精靈篩選」下拉選單、查詢、摘要、複製文字 | `BattleScreen.ui.tsx:590-640` | 名稱 | **洩漏**（選單用未遮蔽名稱，option 的 text 與 value） | 洩漏 | 全部先經遮蔽再運算 |
| 18 | 引擎行動 log／橫幅（`displayName`、`displaySkill`） | `battleEngine.ts:2644` | 名稱、技能名 | 已遮蔽 | 只遮 p2 | 帶 `battleMode`，PVP 雙方遮蔽 |
| 19 | 浮動傷害數字旁文字、技能橫幅 | `BattleScreen.ui.tsx:~311,~1075` | 技能名、效果名 | 已遮蔽 | 只遮 p2 | 同 #16 詞表 |
| 20 | 傷害來源圖表（damageDealt 名稱） | `BattleScreen.ui.tsx:166` | 名稱 | 已遮蔽 | 只遮 p2 | 同 #16 詞表 |
| 21 | 中央對戰資訊：屬性克制倍率、雙方屬性圖示、陣容點 title | `BattleScreen.ui.tsx:980-1031` | 屬性、克制倍率、名稱 | 已遮蔽（×?） | p1 屬性圖示仍顯示 | 依 `hid()`；雙方圖示都遮 |
| 22 | 入戰動畫（名稱、屬性、立繪） | `BattleIntro.tsx:14`、`BattleScreen.tsx`、`BattleLoadingScreen.tsx` | 名稱「？？？」、屬性、立繪 | 已遮蔽 | 持有方 p1 可見 | 載入畫面與正式動畫都帶模式；PVP 雙方遮蔽 |
| 23 | 狀態檢視 `StatusInspector` | `StatusInspector.tsx:45,99` | 名稱、效果列表、遮蔽詞 | 已遮蔽 | 持有方可見 | 帶模式；PVP 雙方遮蔽 |
| 24 | 道具「背包精靈挑選器」（名稱、屬性、頭像、搜尋） | `BagElfPickerModal.tsx` | 名稱、屬性、立繪、搜尋命中 | **洩漏**（頭像寫死 viewer 視角、名稱屬性明文、搜尋可命中） | 洩漏 | 不可見者先換無識別替身再進挑選器（搜尋也找不到），位置標籤仍顯示對手／我方 |
| 25 | 結算畫面：MVP、排行、技能 Top5、最大單擊 tooltip、輸出來源圖例、頭像／立繪、aria-label | `BattleScreen.ui.tsx:173-180,1212`（`BattleResult.tsx` 未動，改傳遮蔽後資料） | 名稱、技能名、來源名、頭像 | **洩漏**（全部明文） | 洩漏 | 摘要字串與隊伍替身先遮蔽。**結算要不要揭曉（戰後公開）待使用者確認**，現為「不洩漏」 |
| 26 | 魂印／特質／技能的 DOM 隱藏屬性、`title`、`aria-label`、`data-*` | 全域（整頁字串掃描測試） | 全部 | 修前有 #1、#13、#17 | 同左 | `tests/hiddenElfBattleScreen.ui.test.tsx` 掃整頁 HTML，PVE 對方／PVP 皆不含 |

### 未涵蓋（確認過不在 UI 或不適用）
- 圖鑑連結：戰鬥中沒有指向隱匿精靈的圖鑑連結；詳情彈窗的「完整介紹」按鈕隱匿時不渲染。
- `PostMatchAnalysis.tsx`：目前沒有被任何畫面使用（只剩定義）；若日後接上需套用 `maskViewerDeep`。
- AI 規劃用文字（`legalActions.ts:60`、`knowledge.ts`）：不進 DOM，且本來就對 AI 隱藏。
- 引擎 state 內 `logs` 仍存真名（顯示時才遮蔽）。若日後有「匯出戰報／回放」功能，需在匯出時走同一組遮蔽函式。

## 三、待使用者確認項目（目前一律依「不洩漏」處理）
1. **體力數值（#7、#15）**：隱匿時顯示「？/？」，血條與百分比保留。若要連血條也不給請說一聲；若覺得數字無所謂可放寬。
2. **護盾／護罩數值（#8）**：維持顯示。
3. **PVP 技能列（#12）**：隱匿操作側的技能名／說明遮蔽，威力與 PP 仍顯示以便操作；如果同螢幕玩家需要看技能名才能玩，請告知改成「操作側可見」。
4. **結算畫面（#25）**：戰鬥結束後是否揭曉隱匿精靈（MVP、排行、技能 Top5）。目前不揭曉。
5. **log 中的技能名（#16）**：目前遮蔽為「未知技能」。
6. **屬性（#5、#21）**：已遮蔽，含克制倍率顯示「×?」。

## 四、測試
- `tests/hiddenElfVisibility.ui.test.tsx`（12 項）：判斷函式矩陣（viewer × owner × mode）、遮蔽詞（PVE 只遮對方／PVP 雙方）、詳情彈窗、頭像 aria／alt、入戰動畫、狀態檢視、結算資料、背包挑選器（含搜尋）。
- `tests/hiddenElfBattleScreen.ui.test.tsx`（8 項）：渲染整個 `BattleScreenUI`，掃整頁 `innerHTML`（含 title／aria／data-*），涵蓋 PVE 對方、PVE 持有方、PVP（p1／p2 操作階段）、單方隱匿、結算畫面。
- `tests/uiFoundation.semantic.test.ts:63`：未放寬，修頭像 aria 洩漏後通過。
