# Blockly 官方來源模組化構建

此目錄是可直接建置的已生成 ESM，不依賴 ignored 快取。不是將壓縮單體依字數切開。

- 來源：<https://github.com/RaspberryPiFoundation/blockly>，`blockly-v13.2.1`。
- 固定提交：`168fe103ac42294b845dcd88033e30698d0320b8`。
- Apache-2.0 授權全文見 `LICENSE.txt`；各檔保留上游授權標頭。
- `build-info.json` 保存各檔 SHA-256、大小、編譯診斷與來源版本。
- `.gitattributes` 固定生成 JS 與清單為 LF，避免 Windows checkout 改換行後雜湊不符。
- 僅匯出本編輯器使用的公開 API；保留底層欄位、事件、序列化、渲染器與初始化掛鉤。
- 保留強連通依賴群組，以依賴拓樸順序合成小模組；不使用 property mangling。
- 原型的 TypeScript 目標與上游相同為 ES2020、strict、舊式 class field 語意。固定上游存在一項 `menuitem.getId` DOM nullable 型別診斷，記錄但不改執行行為，其他型別錯誤停止生成。

## 更新流程

一般 clone 後的 `npm run build` 使用本目錄，不必下載來源。
只有維護者重新生成時，先把官方固定提交 checkout 到
`node_modules/.cache/blockly-v13.2.1`；生成器會拒絕錯誤提交或髒來源。

1. `node --import tsx tools/buildBlocklyModules.ts`：先生成 `build/blockly-modular-prototype`。
2. 對照來源、授權與 SHA-256；確認依賴群組及大小沒有回歸。
3. `npm run build:blockly-modules`：更新這個目錄。
4. `npm run lint`、`npm test`、`npm run build`、`npm run audit:bundle`。
5. 正式版驗收開啟／關閉、工作區渲染、拖曳、參數變更、JSON 舊檔重載與儲存回草稿。新版本不能僅依檔案大小直接上線。

總傳輸量仍需載入多個模組；消除單體警告不代表手機絕對流暢。模組只在開啟積木編輯器後載入，不應進入首頁靜態依賴。

## Windows 舊工作樹換行修復

加入 `.gitattributes` 前已 checkout 的生成檔可能仍為 CRLF。若測試報 SHA-256 不符，執行 `npm run format:blockly`：只在「CRLF 轉 LF 後與已驗收雜湊完全相同」時修正換行；任何內容差異會在寫入前停止。新 clone 不應需要此步驟。不可重新填寫雜湊來掩蓋檔案變更。
