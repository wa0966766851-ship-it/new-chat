# 專案與截圖整理

第二輪新增[檔案分區與瘦身優先順序](storage-layout.md)。`node scripts/audit_workspace_storage.mjs --hash --budget-mib=64`可唯讀盤點與限量核對重複檔；結果不能直接當刪除清單。

正式工作目錄是 `D:\影片\新增資料夾\對戰模擬器`。歷史紀錄從[開發紀錄索引](../開發紀錄索引.md)查找；原報告保留原路徑，避免截圖、交接連結失效。

## 截圖

臨時截圖放 `shots/`，正式報告引用的截圖放 `docs/images/` 或 `docs/audits/screenshots/`。不要把同一批驗收圖片複製進每份報告。`shots/` 不進 Git，但不代表可直接刪除。

`python scripts/compress_development_screenshots.py` 預覽可縮小的 PNG，加 `--apply` 才寫入。只處理腳本列出的開發截圖目錄；保持檔名、解析度與每個像素，只有輸出更小才替換。正式立繪、頭像與動畫原始影格不在處理範圍。不為省空間降低驗收圖清晰度。

## 可重建檔案與保留內容

`node scripts/cleanup_development_artifacts.mjs` 預覽；加 `--apply` 才刪除。此工具限 Windows，會核對執行中的程式、Git 追蹤檔案、目錄連結、最近24小時修改時間與桌面啟用版本。

- 隔離測試瀏覽器：只清指定的瀏覽器快取，保留偏好、Cookie、擴充套件、Local Storage 與 IndexedDB。
- 舊測試輸出：只清腳本白名單中的測試與預覽產物，不整個刪 `build/`。
- 桌面歷史副本：永遠保留 `.desktop-releases/active.json` 指定的目前版本與上一版；最近24小時的副本也保留。
- 保留所有正式 EXE、ZIP、安裝器 payload、原始碼、使用者存檔與動畫素材。`.seer-cache/` 同時有測試快取和真實素材，禁止整包刪除。

詳細回執在本機 `.cleanup-audit/`，不加入 Git。正式整理摘要寫進 `docs/audits/`。

## 開發紀錄與桌面更新

新工作先寫日期明確的報告，再補進 `docs/開發日誌.md`；執行 `node scripts/index_development_records.mjs` 更新完整索引。索引不是驗收完成清單。

改遊戲程式後仍須依[桌面封裝指南](desktop-packaging.md)建置與啟用；不要手改 `dist/` 或歷史桌面副本。只整理文件、截圖和快取時，不必重建 EXE，避免再次生成大量產物。
