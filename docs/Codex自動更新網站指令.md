# Codex 自動更新網站（一鍵貼上版）

> 貼到 Codex Cloud / ChatGPT 對話框即可執行。假設倉庫 `wa0966766851-ship-it/new-chat`、分支 `main` 已授權。

---

## 指令一：同步並驗證（每次必跑）

```text
把 wa0966766851-ship-it/new-chat 的 main 拉到最新，然後依序跑：
npm install、npm run lint、npm test、npm run build。
全部綠燈才算完成，紅了就把第一個報錯全文貼出來，不要自己猜。
```

## 指令二：圖標缺失自檢（本次重點）

```text
檢查以下三類圖是否齊全，不齊就列清單：
1. 系/ 屬性圖標：對照 src/battle/seerAssets.ts 的 typeIconUrls 與 splitTypes，
   把 DEFAULT_ELVES 全部精靈的 type 拆解後列出需要的「系」檔名，
   再對 public/seer/xi/ 與 系/ 現有檔案比對，缺的列出來。
2. public/elf-art/ AI 自繪：對照 CUSTOM_ART 四組 key
  （wuxu_zhuixing、wuxu_shiyan、wuxu_liuren、otherworld_thunder_rey），
   每組 head/body 是否各有一張 png。
3. public/seer/ 官方快照：只報數量，不用補（靠 SeerAPI 遠端補）。
缺圖只列清單，不要自己生成圖片。
```

## 指令三：更新網站內容（改完程式後）

```text
先跑 npm test 全綠，再做以下任一項：
- 只是改數值/文字：直接改 src/data/defaultElves.ts 對應精靈，
  跑 npm run lint + npm test 驗證。
- 新增積木技能：照 AGENTS.md 註冊表規範，
  在 src/blocks/specs.ts 登記 SKILL_MODE，
  在 src/tests/blocks.semantic.test.ts 補狀態轉換斷言，
  禁止硬編碼 BattleScreen.tsx。
做完跑 npm run build 確認產物正常，然後總結改了哪幾個檔。
```

## 指令四：發佈前檢查（給朋友前跑一次）

```text
跑 npm run package:zip，確認 release/seer-battle-simulator-portable.zip 有生出來，
裡面要有 dist/、node.exe、launch-portable.cmd/ps1、images/、public/。
不要跑 iexpress，那條在檔案數多時會靜默失敗。
```

---

## 本次已確認狀態（2026-09-28，main @ 015f833 之後）

- 系/：本機 171 = 追蹤 171，含神秘.電系.png（4MB），status 乾淨
- images/：本機 53 = 追蹤 53，status 乾淨
- public/elf-art/：8 張全在（雷伊 2 + 無序 6），status 乾淨
- 已知斷層：typeIconUrls 只產 /seer/xi/ 路徑，後端 /seer/xi/ 只讀
  public/seer/xi/ 與 系/，但 public/seer/ 整個被 gitignore 擋掉，
  所以雲端上 /seer/xi/ 的第一順位永遠 404，只剩 系/（本機有、雲端剛補上）。
  短期靠 系/ 已全量上傳解決；長期要嘛把 public/seer/xi 縮小版也上傳，
  要嘛改後端讓 /seer/xi/ 也能 fallback 到 SeerAPI 遠端。
