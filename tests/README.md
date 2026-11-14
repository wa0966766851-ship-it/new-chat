# 測試入口

從專案根目錄執行；結果須附實際命令與驗收範圍。

| 目的 | 指令 |
|---|---|
| 型別與一般測試鏈 | `npm run lint`、`npm test` |
| 積木遷移回歸 | `npm run test:migration-release` |
| 御天陣與血雨缺口 | `npm run test:reader-gaps` |
| 打包副本生命週期 | `npm run test:build-workspace` |
| EXE內容及啟動 | `npm run test:electron-artifact`（先用inspect打包） |
| EXE實際頁面 | `node tests/electronRenderer.smoke.test.mjs` |

`helpers/migrationHarness.ts`透過正式資料與headless引擎建立P1/P2情境。局部測試不代表397份全文正確；須另列完整技能尚未驗收之處。

桌面測試使用獨立暫存存檔與連接埠；完成後依[打包指南](../docs/guides/desktop-packaging.md)清理中間副本。

## 換皮效能回歸

`npm run test:pet-preparation` 驗證分批運算取消、共用幾何、底片結果等價及逐塊上傳。`npm run test:pet-skin-switch` 使用正式BattleScreen，量測4次換皮、8次快速往返與退出後的資源釋放；輸出到 shots/skin-switch/。需先以 tests/fixtures/petAnimation.vite.config.ts 建置預覽，並以 PET_PREVIEW_PORT=3026 啟動 tests/servePetAnimationPreview.ts，或用 SKIN_TEST_URL 指定服務。使用獨立測試瀏覽器，結束依唯一profile回收，不碰玩家瀏覽器。
