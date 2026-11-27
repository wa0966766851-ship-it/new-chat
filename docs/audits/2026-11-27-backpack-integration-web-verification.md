# 完整背包修正整合與雲端驗收

## 驗收前先確認網站性質

目標為既有網站 `https://seer-battle-preview.worry0487.chatgpt.site`，Sites project `appgprj_6aba1c5002d48191b61947244d46a103`。已由原生Sites工具確認此站仍使用自訂分享權限，本次不更動權限、不啟用暫停中的排程。

網站有獨立的Sites來源庫，與遊戲GitHub倉庫不是同一來源庫。已透過官方來源憑證開啟來源並核對`.openai/hosting.json`、`worker/index.js`與`README.md`：

- 雲端Cloudflare Worker負責版本供應，使用R2 `BUCKET`及隨部署攜帶的瀏覽器檔案。
- `/_updates/*`供受授權的版本上傳、逐檔驗證與啟用；`/__build/<buildId>/`固定該場頁面的程式版本。
- 遊戲戰鬥引擎在瀏覽器內執行。背包、培養與配置使用該網站來源下的瀏覽器存檔。
- 這個Worker不是Express後端，沒有本機AI分析或`/api/p2p/*`信令後端。GitHub推送不會自動變更Sites部署。

首次觀察ChatGPT內建瀏覽器時，網站實際進入的舊版本為`6712f39f65e821023298b9580d2da96fdf1c98af73997204c9de45dd45f5e9b0`，來源為正式HTTPS網址，不是localhost。

## 同一台電腦測試的有效範圍

同機測試仍可以驗證遠端HTTPS供應的程式、來源提交與buildId一致性、分頁資源載入、背包完整操作、儲存與重新載入。瀏覽器所在的電腦不會讓遠端域名自動等同本機伺服器；驗收需核對實際版本及資源網址。

但它不能證明跨網雙人對戰。單機模式的雙人同屏選項不是P2P。即使兩個瀏覽器能連線，也必須檢查RTC選中的candidate pair及relay／host／srflx，才知道是否只走同機或區網；跨NAT、跨地區延遲與丟包仍需兩個獨立網路的實機驗證。

目前連線程式的資料路徑為HTTPS信令`/api/p2p/*`交換房間與ICE資訊，對戰配置／操作／校驗經WebRTC DataChannel傳輸，WebRTC提供DTLS傳輸加密；ECDSA裝置身分簽章不等同額外的資料內容加密。未部署信令與TURN時，不宣稱原Sites網址已提供遠端對戰。

## 整合原則

保留Claude恢復的`StartScreen → LegacyTeamWorkspace`完整背包流程，保留雙方12格、出戰與待命交換、首發、配裝與預設陣容。只把新版工作坊接入既有編輯路由，並將自由戰場地／火焰、全滿血功能接回完整工作區，不再用`RosterWorkspace`整頁替換。

GitHub整合提交：`876811b`，PR #9。正式桌面、網站發布與瀏覽器結果於完成後補記；不能將本段來源檢查或GitHub推送當成發布完成。
