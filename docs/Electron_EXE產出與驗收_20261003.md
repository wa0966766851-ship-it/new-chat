# Electron EXE 產出與驗收（2026-10-03）

## 本輪結果與範圍

已產出 Windows x64 免安裝 EXE 與 NSIS 安裝 EXE，版本維持 1.0.0。
先整合遠端新增的精靈資料分包設定，再分階段提交原先累積的戰鬥、星蝕回廊、按需載入及此次打包修正。
「靈光之怒」維持現行公式；此輪未重新定義其效果。

## 交付方式

- `dist-electron/賽爾對戰模擬器-1.0.0-portable.exe`：免安裝版，約 210 MB。只需交付此 EXE，不需額外附帶 `win-unpacked` 或圖片資料夾。首次啟動會解開內含執行資源，遊戲存檔仍寫入使用者資料目錄，不是完全零檔案寫入的應用程式。
- `dist-electron/賽爾對戰模擬器-1.0.0-win-x64.exe`：安裝版。
- 如要以 ZIP 分享，壓縮免安裝 EXE 與使用說明即可；EXE 本身已最大壓縮，再壓 ZIP 不保證明顯縮小。
- 本輪 GitHub 推送是原始碼、設定、測試及文件，不是 EXE Release 上傳。`build`、`dist`、`dist-electron`、`release` 都不進 Git。

## 實際修正檔案

- `package.json`／`package-lock.json`：補上 Electron 44.5.1、electron-builder 26.15.3、桌面入口及打包／驗收指令。
- `electron-builder.yml`：修正安裝選項衝突，改用最小執行套件、最大壓縮、免安裝與安裝雙輸出。
- `scripts/prepare_electron_app.mjs`：只複製桌面啟動入口與無依賴套件描述，不複製 `.env` 或開發工具。
- `electron/beforeBuild.cjs`：使用公開掛鉤告知打包器依賴已包含於正式伺服器，避免回退到專案根目錄並攜帶整套 node_modules。
- `electron/main.cjs`／`electron/serverProcess.cjs`：等待自己的子程序就緒訊息；連接埠占用時載入真正使用的埠；單例程式；快取移至可寫的使用者目錄；保留隔離／沙盒設定；提供獨立驗收存檔路徑。
- `server.ts`：桌面版限本機綁定，可指定可寫快取位置，網頁版既有預設不變。
- `.gitignore`：排除大型桌面產物。
- `vite.config.ts`：排除桌面產物、測試存檔及素材快取監看，修正 Electron 驗收同時執行前端測試時，監看到鎖定的 Cookies 資料庫造成 EBUSY 中斷的問題。
- 四份 `tests/electron*.mjs`：正式伺服器隔離、啟動協調、產物完整性、Windows 免安裝 EXE 冒煙驗收。

## 已驗證

1. TypeScript 型別檢查及完整既有測試套件通過。
2. 正式前端與桌面伺服器建置通過；主入口約 212.56 kB，最大前端分包約 491.26 kB，無超過 500 kB 的 Vite 區塊警告。首頁靜態 JavaScript 合計仍約 933.94 kB，不能因此宣稱完全不卡頓。
3. 無專案 node_modules、無 `.env`、無 AI 金鑰的隔離伺服器可啟動。
4. 連接埠衝突、拆段就緒訊息、子程序提前退出及逾時清理測試通過。
5. 產物 `app.asar` 僅含三份桌面入口與套件描述，約 5.5 kB；正式伺服器與圖片分別附帶於 resources。產物入口與來源、正式建置逐檔比對通過。
6. 免安裝 EXE 在本機實際啟動，使用獨立存檔；首頁、正式 JS、版本、無金鑰 API 通過，測試只關閉自身啟動的程序樹。
7. 解包桌面版啟動的正式伺服器，另以瀏覽器走完首頁 → 單挑 → 托管 → 第三回合勝敗視窗；未看到瀏覽器錯誤。這是正式封裝伺服器的前端流程驗收，不等於逐頁完成 Electron 原生視窗或所有效果驗收。
8. Electron 官方下載 SHA-256 與 npm 套件附帶的官方校驗表一致。

## 重現指令

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd test
npm.cmd run package:electron
node tests/electronArtifact.semantic.test.mjs
node tests/electronPortable.smoke.test.mjs
```

Electron Builder 需要能下載官方 Electron／NSIS 工具。若已有驗證過的官方解壓執行資源，可指定 `--config.electronDist=build/electron-runtime-44.5.1`，不需重複下載。

## 未完成與限制

- EXE 尚無程式碼簽章，Windows 可能提示未識別發行者；不應關閉防毒或系統保護來繞過提示。
- 安裝版已產出，但未在此電腦執行安裝／卸載，也未在全新 Windows 或低階實體設備測試。
- 部分官方圖片仍會透過 SeerAPI 補齊；不能宣稱所有遠端素材已離線備齊。分享官方素材前仍需確認使用權。
- 沒有附帶 AI API 金鑰；線上 AI 功能預設停用，本地解析與對戰保留。
- npm 正式依賴稽核仍有 3 項 moderate（Express/body-parser/qs 依賴鏈），非零風險；此輪未任意升級戰鬥服務依賴。全套含開發依賴的稽核為 11 項（3 moderate、8 high）。
- 自動更新、GitHub Release 二進位發布及 Google Drive 鏡像均未在本輪配置或上傳。
- 精靈效果語意覆蓋、逐頁 UI 與效能驗收仍按既有核對清單追蹤，不因打包成功改標「全部完成」。
