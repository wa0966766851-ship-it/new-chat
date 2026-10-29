# 接手期診斷草稿封存

從專案根目錄移入原有 46 個 `_*.ts` 診斷草稿，保留內容供追查，不作為正式建置、測試或執行入口。
原稿的相對匯入以舊根目錄為基準，不能直接在本資料夾執行。需要重現時，先在隔離副本調整匯入路徑。

正式驗證使用 `tests/corruptedRey.semantic.test.ts`、`tests/savedCorruptedRey.semantic.test.ts`、`tests/elfSkins.ui.test.tsx` 與 `tests/battleSpriteFacing.semantic.test.ts`。
