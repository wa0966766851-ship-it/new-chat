# 專案檔案地圖

`.local-archives/20261029/`為本機歷史封存區：`browser-profiles/`保存完整測試profile ZIP、`experiments/`保存舊實驗ZIP、`releases/<版本>/`保存歷史交付檔，`INDEX.json`記錄原位置與還原對照。排除Git與分享副本；`dist-electron/`目前只保留1.2.0與1.1.0的有版本成品，其他通用發佈資訊保留原處。

後續存放與保留政策見[六個檔案分區](guides/storage-layout.md)：原始碼、正式素材、開發證據、單次工作、正式發佈、快取／測試資料。

2026-10-29 補充：[完整紀錄索引](開發紀錄索引.md)、[截圖與空間整理](guides/project-housekeeping.md)。下列歷史模組數量保留原驗證日期，不代表本次重新驗收遊戲效果。

## 目前補充路徑

| 路徑 | 用途與維護方式 |
|---|---|
| `src/engine/`、`src/shell/` | 共用引擎與應用外殼；不是建置輸出 |
| `server/` | 啟動識別、偏好與動畫資源服務 |
| `.desktop-releases/active.json` | 桌面目前與上一版的指標；整理時同時保護兩版 |
| `.desktop-releases/<版本>/` | 完整桌面建置副本；不要手改其中的遊戲資料 |
| `.seer-cache/` | 真實遊戲素材與隔離測試快取混存，須按用途清理 |
| `shots/`、`_shots/` | 本機開發截圖；正式報告只連結需要保留的證據 |
| `.cleanup-audit/` | 本機空間盤點、壓縮與刪除回執，不加入 Git |

本次採用入口與用途整理，保留程式及舊報告路徑，避免搬移破壞匯入、打包與交接連結。

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
| `docs/guides/`、`docs/archive/2026-10/` | 現行操作指南、歷史階段報告 | 開發日誌為單一入口；歸檔不刪待驗原文 |
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
| `build/.work/exe-*/source/` | 一次打包專用的乾淨原始碼副本與node_modules；成功／失敗皆清理，`--keep-work`才保留 |
| `build/electron-app/`、`dist-electron/win-unpacked/` | Electron中繼封裝；正常打包結束清理，檢查模式保留 |
| `dist-electron/*.exe`、`dist-electron/nsis-web/` | 正式成品及網路安裝必要payload；不得當暫存刪除 |
| `dist-electron/*-exe.zip` | 本版最後生成的EXE壓縮檔；不含來源或中繼副本 |
| `dist_release/<版本>/`、`release/*.zip` | 版本工具或舊免安裝流程的正式成品，與中繼副本分開 |
| `docs/開發日誌.md` | 最新開發紀錄與歷史索引的統一入口；舊原文證據不重複複製 |

## 已完成專屬註冊表收斂（2026-10-08）

實際結構為 `src/effects/elves/<模組名>/`：多隻共用的家族模組（例如astral-twins、wuxu）不強行複製成多份ID目錄。單隻模組內含registry及專屬helper；帝辛天陣搬到dixin/formation.ts，投石者魂印搬到wuxu/stoneThrowerSoul.ts。共用newElfLifecycle/newElfOperations、傷害分類、PP、狀態引擎不搬入某一隻。

`elves/modules.json`記錄34個舊檔名到新位置；`elves/index.ts`採明確匯入。正式註冊仍按舊頂層鍵字典序合併，保留歷史同名匯出的勝出者，不偷偷變更優先序。競技場仍由自己的index合併。原文留在data／TXT，不複製第二份描述。

`tests/elfRegistryModules.semantic.test.ts`用搬移前正式Vite入口的318個技能鍵、155個魂印別名、命中後及無效分支快照驗證新入口；同時核對handler函式身分。這是路徑／註冊相容契約，不是逐句效果驗收。Node描述解耦、去重清單生成器及各SSR測試引用一起更新。

資料、美術、既有備份、打包／更新檔案不搬動。這輪一般建置與測試不能冒稱重新產出Electron安裝包。
