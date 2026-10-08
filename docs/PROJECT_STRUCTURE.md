# 專案檔案地圖

## 核心與資料來源

| 路徑 | 用途 | 整理邊界 |
|---|---|---|
| `src/components/` | 畫面、主戰鬥協調器 | 專屬精靈邏輯禁止繼續堆入BattleScreen |
| `src/battle/` | 傷害、回復、PP、作用域、演出、藥劑等通用契約 | 各精靈共用，不能搬進某隻精靈資料夾 |
| `src/effects/elves/<模組名>/` | 精靈專屬handler及helper | 34個一般／家族模組由elves/index顯式註冊；競技場5隻位於staged-arena並保留獨立index |
| `src/effects/*Registry.ts` | 異常、技能石、套裝、模式、傷害公式及描述資料等共同登錄 | 保留頂層glob；不遞迴掃描精靈資料夾或備份 |
| `src/effects/newElf*.ts` | 新精靈共用生命週期／操作 | 多隻共用，避免重複複製 |
| `src/data/` | 遊戲卡片、描述、分類、技能石等資料 | `defaultElves.ts`為目錄入口，不代表已逐句驗收 |
| `src/blocks/` | 積木模型、解析、執行、模式登記、編輯器 | 已解析不等於已實裝正確 |
| `src/modes/` | 命運之輪、星際探索 | 模式專用結算與庫存，避免混入普通戰 |
| `elf_source_files/elf_files/` | 使用者TXT原文 | 保留原位置；未命名檔案也須看首行，不只猜檔名 |
| `docs/audits/` | 模式統計及人工對應的部分語意證據 | 報告可重建，證據不能自動冒充驗收 |
| `tests/`、`src/tests/` | 語意、正式戰鬥入口、UI、打包回歸 | 指令分類以package.json為準 |

## 程式與產物

| 路徑 | 用途 |
|---|---|
| `server.ts`、`index.html`、`src/main.tsx` | 伺服器與前端入口 |
| `electron/`、`launcher/`、`packaging/` | 桌面啟動、更新與打包 |
| `scripts/` | 資料生成、稽核、發佈流程；`scripts/lib/`為稽核共用工具 |
| `tools/` | 開發及整理工具；日誌整理預設只預覽 |
| `public/`、`pet/`、`images/`、`assets/`、`系/`、`異常圖標/`、`印記圖標/` | 有API／打包引用的素材，這輪不搬不刪 |
| `dist/`、`build/`、`dist-electron/`、`release/`、`node_modules/`、`.seer-cache/` | 生成或快取，不是需要手改的精靈實裝檔 |
| `_修正前備份/`、`_備份_20250927_還債前/`、`_asset_backup/` | 原有備份，保留不動 |
| `logs/legacy/20261008/` | 從根目錄歸檔的舊log及可逆搬移清單 |

## 已完成專屬註冊表收斂（2026-10-08）

實際結構為 `src/effects/elves/<模組名>/`：多隻共用的家族模組（例如astral-twins、wuxu）不強行複製成多份ID目錄。單隻模組內含registry及專屬helper；帝辛天陣搬到dixin/formation.ts，投石者魂印搬到wuxu/stoneThrowerSoul.ts。共用newElfLifecycle/newElfOperations、傷害分類、PP、狀態引擎不搬入某一隻。

`elves/modules.json`記錄34個舊檔名到新位置；`elves/index.ts`採明確匯入。正式註冊仍按舊頂層鍵字典序合併，保留歷史同名匯出的勝出者，不偷偷變更優先序。競技場仍由自己的index合併。原文留在data／TXT，不複製第二份描述。

`tests/elfRegistryModules.semantic.test.ts`用搬移前正式Vite入口的318個技能鍵、155個魂印別名、命中後及無效分支快照驗證新入口；同時核對handler函式身分。這是路徑／註冊相容契約，不是逐句效果驗收。Node描述解耦、去重清單生成器及各SSR測試引用一起更新。

資料、美術、既有備份、打包／更新檔案不搬動。這輪一般建置與測試不能冒稱重新產出Electron安裝包。
