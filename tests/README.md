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
