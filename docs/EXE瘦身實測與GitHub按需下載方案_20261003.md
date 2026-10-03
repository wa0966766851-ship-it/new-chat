# EXE 瘦身實測與 GitHub 按需下載方案

日期：2026-10-03。此輪是研究與獨立副本實驗，不是正式版本更新。
未改正式素材、封裝設定或戰鬥程式，未提交／推送／上傳 Release。原有圖標與其他 AI 的修改保持原狀。

## 一、結論

可以讓 EXE 連接 GitHub 下載檔案，但必須區分三種模式：

| 模式 | 最初下載 | 完整使用後磁碟占用 | 離線條件 |
| --- | --- | --- | --- |
| 完整離線包 | 包含 Electron、程式、全部預載素材 | 完整遊戲 | 不需首次下載素材；原有遠端功能例外 |
| 素材按需下載 | Electron、程式、必要小圖；其他圖延後下載 | 隨快取增加；全部下載後仍須容納全部素材 | 已驗證快取可離線；未下載內容需網路 |
| 網路安裝器（nsis-web） | 小型安裝入口，不包含完整遊戲 | 安裝時下載完整遊戲，最終占用不會憑空消失 | 第一次需網路或預先取得匹配安裝資料包 |

**建議順序：先完善離線封裝與啟動驗收，再加手動更新，之後提供可選素材輕量版／網路安裝版。**
單純把遊戲 JavaScript 改成遠端執行不能把 Electron 縮成幾 MB，還會增加離線與安全問題。
加密不會瘦身；ASAR 也不是加密。

## 二、獨立副本的實測

研究基準是既有 `dist-electron/win-unpacked` 與聖靈譜尼圖標 portable EXE，不是重新建置目前尚有其他 AI 修改的來源。
研究目錄：`build/exe-size-research-20261003-qVahwC`。
數值均為十進位 MB（1 MB = 1,000,000 bytes），不是 Windows 常用的 MiB。

| 項目 | 原包 | 試驗包 | 減少 |
| --- | ---: | ---: | ---: |
| 解壓後檔案總和 | 505.49 MB | 418.66 MB | 86.83 MB／17.18% |
| 單檔 portable EXE | 210.80 MB | 158.27 MB | 52.52 MB／24.92% |
| EXE 再 ZIP | 210.50 MB | 158.26 MB | 52.24 MB／24.82% |

精確 bytes：原解壓 505493536；試驗解壓 418662801；原 EXE 210795125；試驗 EXE 158274338；原分享 ZIP 210499873；試驗 ZIP 158263697。
試驗 EXE 再 ZIP 僅少 10641 bytes，約 0.0067%；雙重壓縮不是主要改善來源。
試驗 EXE SHA-256：`1A5D10AD6BB26057EF92E4F2434C7693B8A74B16C1C0364B856D9EB3BFF20B47`。

### 實際略去的副本內容

| 分類 | 檔案數 | 原始體積 |
| --- | ---: | ---: |
| 其他語言包；保留 en-US、zh-CN、zh-TW | 52 | 48.88 MB |
| dist/seer 與 public/seer 一致；專用圖片路由使用後者 | 308 | 15.78 MB |
| public 非 seer 圖檔與 dist 一致；正式靜態路由使用後者 | 131 | 21.19 MB |
| 系目錄與 public/seer/xi 一致的備用副本 | 1 | 0.98 MB |

每一項都先比對 SHA-256，確認保留副本存在。不同內容、只有一份、用途尚不確定的檔案不移除。
沒有移除 GPU／媒體 DLL、Chromium 核心、授權檔、全部 public 或全部 pet。
原始資料夾不做刪除；試驗副本以複製保留清單的方式產生。

### 驗收與尚未解決的問題

- 試驗解壓目錄的所有保留檔案與基準逐檔 hash 相同：3825 個檔案；基準 4317 個。
- 直接啟動試驗解壓目錄內 EXE：成功，約 6498 ms 達到本機 API 就緒。這是一筆量測，不是 FPS、低階設備或穩定啟動保證。
- 首頁 HTML、版本 JSON、主 JS 與無金鑰 AI API 通過；439 個去重相關網址逐一 HTTP 200 且 bytes hash 與原圖一致。
- 單檔 portable 第一次在受限環境提前退出（2147483651）；沙盒外重試逾時 90 秒。未確認根因，**不可將試驗 portable 視為正式可交付版本**。
- 上述通過只證明已測路由與解壓版啟動，不等於全部對戰、字型、原生對話框、多語言與存檔驗收。
- 不宣稱測過新版戰鬥來源 lint／完整測試：這輪未修改那些來源，也未重新執行整套戰鬥測試。
- 正式採用前要在相同環境比較原 portable 與試驗 portable，檢查自解壓、程序退出、暫存執行限制與安全軟體事件；不得關閉防護來換取通過。

證據：研究目錄的 `manifest.json`、`smoke-result.json`（成功項為解壓版）、各 `smoke-profile-*/smoke.log`。
研究工具位於 ignored build：`build/exe-research.mjs`；重跑 prepare 會建立另一個唯一目錄。

## 三、圖片格式抽樣

以三個大圖（帝辛、pet/5070、異境雷伊）、聖靈譜尼頭像及神秘電系圖共五張，**不縮尺寸、不改正式檔**。
工具：Pillow 12.3.0；測試輸出位於 `image-benchmark-balanced/results.json`。

| 格式 | 五圖總和 | 相對原 PNG 減少 | 保真核對 |
| --- | ---: | ---: | --- |
| 原 PNG | 9.48 MB | — | 基準 |
| 重新最佳化 PNG | 9.21 MB | 2.86% | 解碼 RGBA 逐 byte 相同 |
| 無損 WebP，method 4／effort quality 75 | 6.84 MB | 27.88% | 解碼 RGBA 逐 byte 相同；透明通道相同 |
| 有損 WebP，quality 90／method 4 | 1.56 MB | 83.54% | 透明通道相同，但色彩像素不同，尚未視覺驗收 |

無損模式中的 quality 是編碼努力程度，不是有損畫質；完整輸出已用解碼像素比對確認。
五張無損 WebP 編碼合計約 22.49 秒；與另一個編碼實驗短暫重疊，時間只供取捨參考，不當成嚴格效能基準。
最高努力版本 method 6／quality 100 在帝辛單圖花約 106.68 秒，3.28 MB → 2.24 MB；平衡設定同圖約 5.89 秒，2.31 MB。
最高努力抽樣後已終止自己啟動的編碼程序，未全部跑完；保留中間輸出，不混入五圖完整統計。

這不是整體素材的平均節省率，也不是 EXE 可再減 27.88%／83.54% 的證據。
正式採用需逐圖只選更小且驗收通過的衍生檔；保留原稿，驗透明邊緣、光效、P1/P2、頭像與複製圖片。
目前 `/seer/:kind/:file` 限制 PNG 副檔名及 PNG 內容；**不能把 WebP 改名成 png**，必須配套調整映射與 Content-Type。
Electron 原生視窗圖標仍保留 PNG／ICO，不跟著全部改成 WebP。

## 四、GitHub 接檔案：目前能力與缺口

目前 `server.ts` 已有部分 Seer 圖片的「本機 → 快取 → 遠端」流程；`electron/main.cjs` 將快取放於 userData/seer-cache。
這可作為按需下載的切入點，但不包含全部自訂立繪／背景等靜態路徑，也不是完整更新器。
`fetchBuffer` 現在只接受 200、一次收集整張圖片，沒有 GitHub Release 重新導向、來源限制、大小上限、版本與完整性校驗。
不能僅替換為 GitHub URL 後直接沿用。

### 建議分工

1. **程式核心**：引擎、首頁／戰鬥 UI、狀態定義、必要屬性／異常小圖留本機；不在戰鬥當下下載可執行程式。
2. **素材服務**：自訂立繪／大型背景可按需；選隊伍／準備進場時預載，避免出手才載入。未完成下載有清楚提示與備用圖。
3. **手動檢查更新**：API 查正式 Release 資訊；只查版本時呼叫 API，不為每張圖片查一次。版本清單快取，處理限流與斷線。
4. **下載**：使用 Release 附件的下載網址，跟隨受控 HTTPS 重新導向；串流、逾時、有限重試、取消、同檔下載合併，不能把 GitHub 寫入 token 打包給玩家。
5. **安全清單**：程式／素材版本、相容 schema、大小、SHA-256、可信簽署清單、固定倉庫與來源。單純 hash 不是發布者身份保證。
6. **快取與切版**：`.part` 下載後完整驗證，再寫入版本化內容目錄；維持上個已驗證版本。全部驗證成功才更新指向，不直接覆寫正在讀取的圖或程式。
7. **存檔隔離**：快取不放 portable 解壓暫存目錄，不與玩家資料混放。更新／清理僅管理自己清單裡的檔案，舊版本與存檔先備份並確認可讀。
8. **網路失敗**：已快取內容繼續可玩；缺圖使用備用畫面，提供重試與「下載完整離線素材包」。核心更新未完成則繼續舊版。

下載靜態素材與下載程式應分開：前者可漸進快取，後者需以完整相容版本交易更新，不對任意遠端 JS 使用 eval／require。
現有 Electron 視窗已設 nodeIntegration:false、contextIsolation:true、sandbox:true，不應為遠端下載放寬。

### 容量與發布方式

去重及語言精簡後，研究包約 336.04 MB 為 resources 外執行環境、67.13 MB 為媒體、15.49 MB 為程式與其他 resources。
即使全部媒體外移，Electron 執行環境仍是主體；上述都是原始檔大小，不能直接換算下載包降幅。
如果目標是讓起始 EXE 很小，優先用 `nsis-web` 小型安裝入口下載完整遊戲，而不是試圖讓 Electron 在尚未下載自身環境前執行。
網路安裝器完成安裝後不是 portable 單檔；應同時保留完整離線版供玩家選擇。
若未來仍要求小型免安裝啟動器，要另外建立 native bootstrap＋版本目錄／回復流程，不是只新增 API 呼叫。

使用 **GitHub Releases 附件** 存放版本包，原始碼 commit／push 不等於發布可下載包。
素材可以分組為有清單的小包，而非每張圖各一個 Release asset；GitHub 每個 Release 最多 1000 個附件、單檔須小於 2 GiB。
目前文件所述 GitHub 未認證 REST API 限額為每 IP 每小時 60 次；這不是每張 Release 下載都要扣一次 REST 查詢，也不應以 token 嵌入客戶端解決。
GitHub 可作主要下載來源，但實際可達性／重新導向／快取與失敗回退仍需驗收，不能保證任何網路都可下載。

## 五、正式實作與驗收順序（尚未完成）

1. 排除 portable 啟動失敗；比較原包、瘦身解壓版、瘦身單檔的程序／暫存／健康日誌。
2. 將 route-aware 去重移成正式 staging 腳本，加語言保留設定與逐路徑回歸測試，不刪原稿。
3. 實際驗收完整離線包的戰鬥、兩特殊模式、中文、圖片複製、存檔與啟動速度。
4. 建立帶版本且可校驗的 Release 清單；先做手動檢查／另存新版／備份，再做一鍵安全替換。
5. 建按需素材原型：先只選一組大型立繪，測 404、重新導向、斷線、錯誤 hash、取消、限流、離線重啟、快取損壞與版本不相容。
6. 五圖無損 WebP 原型通過後才逐圖擴展；有損輸出需另作原尺寸／縮圖視覺批准。
7. 新版本 bump 後才建立正式 Release；網路安裝器需使用已存在、校驗通過的資料包，不上傳未驗證研究 EXE。

## 官方參考

- [electron-builder v26 NSIS／網路安裝器](https://www.electron.build/v26/docs/nsis/)：下載安裝資料包、離線同目錄資料包與校驗。
- [GitHub Release assets API](https://docs.github.com/en/rest/releases/assets)：browser_download_url、200／302、公開附件無需登入。
- [GitHub REST API 限流](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)：未認證每 IP 每小時 60 次與退避。
- [GitHub Releases 容量規則](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)：附件數與單檔限制。
- [Electron 安全規範](https://www.electronjs.org/docs/latest/tutorial/security)：遠端內容不得開啟 Node 整合、保持隔離與沙盒。
- [WebP 官方說明](https://developers.google.com/speed/webp)：無損與透明支援；本專案節省率以本文件實測為準。
- [Electron nativeImage 支援](https://www.electronjs.org/docs/latest/api/native-image)：視窗／原生圖像留 PNG、JPEG 及平台圖標格式。
