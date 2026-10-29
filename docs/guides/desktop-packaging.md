# Windows EXE 建置與驗收

## 日常建置

只在本機反覆測試EXE且不需要交付ZIP時，可用`npm run package:electron -- --no-zip`，仍保留EXE與網路安裝payload。預設正式建置繼續生成ZIP。歷史版本封存與還原見[2026-10-29執行結果](../audits/2026-10-29_第三輪封存與瘦身執行.md)。

在內層`對戰模擬器`根目錄，使用Node.js 24和鎖定依賴：

```powershell
npm ci
npm run lint
npm run package:electron
```

`dist-electron`存放安裝版、`*-portable.exe`免安裝版、`*-web-setup.exe`網路安裝版；網路安裝所需`nsis-web`資源必須保留。流程不會自動上傳GitHub Release或發布網站。

預設自動遞增修訂號（例如1.0.1→1.0.2），同步三個版本來源；加`-- --keep-version`可關閉。失敗後保留遞增版本以供重試，重試時使用keep-version可避免再加一次。每次自動產生`seer-battle-simulator-<版本>-exe.zip`，只收該版本最後生成的EXE，不收來源副本與舊版本。

`build/electron-app`與`dist-electron/win-unpacked`成功或失敗都會清理，正式成品與下載快取保留。斷電留下的鎖不能直接略過，先確認原打包程序已停止。

## 成品驗收

```powershell
npm run package:electron:inspect
npm run test:electron-artifact
node tests/electronRenderer.smoke.test.mjs
node scripts/package_electron.mjs --clean-work
```

inspect保留中間副本；最後一行只清理兩個已界定中間目錄，不重建、不刪EXE。測試會啟動真正桌面版，使用獨立暫存存檔與連接埠；這是啟動及畫面測試，不是全精靈戰鬥驗收。

版本需同步`version.ts`、`package.json`與`package-lock.json`根版本。來源提交後再建置，`dist/version.json`才記錄可追溯的提交。

## 其他流程與檔案邊界

- `tools/build_exe.ts`：使用`build/.work`隔離副本，收集版本成品後移除副本。
- `scripts/package_portable.ps1`：保留舊ZIP／IExpress相容流程，日常桌面版優先使用Electron。
- EXE、`node_modules`、打包副本與個人存檔不提交Git。結束時需檢查自動清理，不能只確認EXE存在。
- 工作集中記錄於[開發日誌](../開發日誌.md)，舊規劃從[歷史索引](../archive/README.md)查閱。
