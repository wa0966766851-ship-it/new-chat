# 雲端 AI 更新指令（貼上版，一次寫完自動化）

> 用途：貼到 GPT 網站（seer-battle-preview）或 AI Studio 的 AI 對話框，
> 站內 AI 會自己判斷環境、拉新版、驗證、重建，全綠才上線。
> 本機不用動。版本對帳以 `version.ts`＋`git log` 為準。

---

## 直接複製以下整段貼上

```text
請把 GitHub 倉庫 wa0966766851-ship-it/new-chat 的 main 分支更新到最新並重建網站，
做完後讓本站以後能自己做同樣的事（見第 8 步）：

1. 環境自檢：先跑 git --version、node --version（要 20.x）、npm --version，
   缺哪個就說缺哪個並停手，不要猜。
2. 取碼：如果還沒有複製過倉庫，就 git clone https://github.com/wa0966766851-ship-it/new-chat.git；
   如果已經有了，就切到 main 然後 git pull origin main，
   再用 git log --oneline -3 確認是最新的 commit，並對一下 version.ts 的 VERSION。
3. 用 Node 20 跑 npm install（已有 node_modules 就跳過，除非 package.json 變了）。
4. 依序跑 npm run lint、npm test、npm run build。
   一步紅了就立刻停，把第一個報錯全文貼出來，不要猜、不要跳過、不要強行繼續。
5. 注意已知坑，不要誤判：
   - public/seer/ 被 gitignore，雲端本來就沒有，缺圖不算錯；
   - 系/、images/、public/elf-art/ 已跟倉庫走，不要刪、不要重傳、不要自己生成圖片；
   - 神秘.電系.png 約 4MB 是正常的，不要當成異常刪掉。
6. 不要動 .env，不要改 BattleScreen.tsx 核心流程（改精靈請走 AGENTS.md 註冊表規範）。
7. build 完確認 dist/index.html 有生出來，再重啟／重建預覽站。
   最後回報：commit hash、VERSION、lint＋test＋build 是否全綠、網站是否已是新版。
8. 自動化落點：把本次實際跑通的步驟（含你所在站點的特殊路徑、特殊指令、遇到的坑）
   寫成一份本站專用的更新筆記，存在 docs/本站更新筆記_<站名>.md，
   下次我只說「照筆記更新」，你就按那份跑，不用我再貼這段。

全部綠燈才算完成。只要有一步紅燈，就停手等我處理。
```

---

## 為什麼第 8 步是關鍵

- 每個站的 shell、路徑、重建按鈕都不一樣，本機寫死的腳本放過去一定水土不服。
- 讓站內 AI 第一次跑通後**自己把路徑和坑寫下來**，下次它讀自己的筆記就行，
  越跑越順，不用你每次都貼完整版。
- 你下次去只說一句「照筆記更新」即可；AI 讀不懂筆記時才回來找我修筆記。

## 版本對帳規則

- `version.ts` 的 VERSION 是單一來源，打包檔名與更新包都讀它。
- 每次更新完，AI 回報的 commit hash＋VERSION 必須和 GitHub main 一致，
  對不上就是沒生效，直接重跑第 2 步。
