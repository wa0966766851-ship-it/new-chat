# 獨立精靈圖鑑

桌面「精靈圖鑑」開啟；「更新精靈圖鑑」重新同步目前專案資料並建置。圖鑑有自己的服務、視窗、存檔與版本，不必先啟動對戰模擬器。

桌面「空白自製精靈圖鑑」是另一個版本：初始只有一本空白圖鑑、沒有內建精靈；可新增多本自製圖鑑、精靈、圖片與屬性，亦支援AI內容匯入及匯出。使用獨立資料目錄及瀏覽器設定，與一般版可同時開啟。

- 多本命名圖鑑，新增、切換、改名及刪除；每本獨立收錄內建／自訂精靈。
- 創作自訂精靈，或複製內建精靈修改名稱、圖片、屬性、種族能力、魂印、特性及技能。
- 自訂屬性名稱、顏色與圖示。
- 此頁PNG／PDF、整本PDF；備份匯入為新圖鑑，保留原有資料。
- 圖鑑切換與精靈選取在本機即時完成，不為每次點擊重新保存整份圖鑑；內建名單與介紹元件按需要載入，載入後可重複使用。

## 資料與依賴

使用者檔案：`%LOCALAPPDATA%\SeerEncyclopedia\library.json`，上版備份為 `library.json.previous`，上傳圖片位於同目錄 `images/`。請使用介面的「備份」保留包含圖片的圖鑑資料。

程式共用主專案的精靈資料、介紹元件、圖片與快取、Node套件。請保留本專案目錄；一般版啟動時會檢查精靈來源指紋，有變更才同步內建資料；開啟中的視窗每30秒及回到前景時檢查資料版本。也可執行 `npm run atlas:sync` 更新開啟中的資料。自訂資料不會寫回戰鬥精靈。

一般版只讀取 `catalog/index.json` 的名字與屬性，選取後才讀取該隻JSON與圖片；列表以文字顯示，不預載立繪或頭像。空白版不讀取內建清單。匯出時才載入該次需要的完整內容。

空白版資料：`%LOCALAPPDATA%\SeerEncyclopediaBlank`。兩版資料都可從介面備份；外部圖片網址仍需網路，已上傳圖片會隨備份帶走。

`npm run atlas:build` 建置並驗證獨立版本，完成才切換 `.releases/active.json`；舊版保留。固定使用本機3177埠，不會將其他服務視為圖鑑。

開發模式：執行 `npm run atlas:dev`。測試資料可用 `ATLAS_DATA_DIR` 指定獨立目錄。空白版預設使用3179埠，一般版3177。

## 內容與檔案結構

- `main.tsx`、`Editor.tsx`、`Profile.tsx`：介面、編輯與延遲載入的介紹版型；共享主專案的描述階層顯示。
- `catalog/`：只保留展示欄位的內建快照，不包含戰鬥積木。一般版啟動檢查來源指紋，有變更才重新產生展示資料；`version.json` 讓已開啟視窗更新清單與目前選取的介紹。空白版不執行來源同步，服務拒絕所有 `/catalog` 要求。
- `content.ts`、`import-content.ts`、`templates/`、[CONTENT_WORKFLOW.md](CONTENT_WORKFLOW.md)：AI內容格式、驗證與匯入流程；來源隨圖鑑保存。
- `server/`、`server.ts`：獨立存檔、圖片與PNG/PDF匯出服務。
- `build.mjs`、`launcher.ps1`、`create-shortcuts.ps1`：建置驗證、版本切換與桌面入口。
- `.releases/`：本機建置版本；`shots/encyclopedia/`（倉庫根目錄下）：驗收截圖，均不提交Git。

從GitHub下載後，在倉庫根目錄執行 `npm install`、`npm run atlas:build`、`npm run atlas:shortcuts`。首次啟動也會建置；日常開啟已完成版本，不需重建。
