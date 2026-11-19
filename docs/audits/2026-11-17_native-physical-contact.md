# 原生物攻對位修正

問題：物攻只接觸對手外緣，且 `action_hit` 一過便往原位返回。原生素材在該標記後仍會衝刺、連續揮擊，因此後續動作落到場地中央。原先只檢查命中當幀的前緣距離，無法攔截這種問題。

修正：共用幾何準備流程依待機 UV 辨識出的本體位移，記錄各序列的接觸區間。前進幅度至少達待機寬度 20% 才啟用；以正向位移峰值 65% 的首末影格辨識攻擊段，並確保包含 `action_hit`。未知姿勢／純光效框不參與區間判斷，缺乏可靠本體位移時沿用原標記。原生物攻接觸對手固定站位的水平中線，保留原比例、原生影格、命中標記、雙側鏡射與收招完成事件。自製素材既有接觸深度、時間設定，以及原地物攻保持原有設定。

| 素材 | 命中標記 | 接觸區間 | 素材序列末幀 |
| --- | ---: | ---: | ---: |
| 雷伊原版 70 | 22 | 22–41 | 74 |
| 滅戰神決·蓋亞 4766 | 122 | 107–193 | 212 |
| 創界衣缽·奧斯卡 1400599 | 100 | 19–110 | 121 |
| 聖靈守護奧斯卡 3425 | 114 | 51–141 | 159 |

實際素材的本體框與 SHA-256 記於 `tests/fixtures/native-animation/*.contact.json`，不包含原始 bundle 或圖集。

奧斯卡的大型武器／光效使本體框最前緣仍偏離實際落點，因此 `PetAnimationAsset.physicalContact` 支援逐序列接觸點（本體框背側 0 → 前側 1）。實際畫面校準：創界衣缽 `attack: 0.7`、原版 `attack: 0.4`；其餘素材沿用 1。實際可見框仍回報完整本體，`data-pet-contact-point` 與 `data-pet-contact-gap` 則專門回報打擊點，避免再把整體前緣當成命中證據。

驗證指令：

```powershell
node --import tsx tests/petNativeContact.semantic.test.ts
node --import tsx tests/petAnimationRetarget.semantic.test.ts
node --import tsx tests/petPreparation.semantic.test.ts
npm run test:fullscreen-fx
node --import tsx tests/petAnimationImpact.semantic.test.ts
node --import tsx tests/battleSpriteFacing.semantic.test.ts
npm run lint
```

正式 BattleScreen 驗收使用 `tests/petNativeContact.browser.test.mjs`，由 `CONTACT_TEST_URL` 指向動畫驗收服務。測試在指定出招影格暫停測試用時鐘後擷取畫面，避免截圖期間動畫已收招而產生錯誤證據；測試暫停功能不包含於正式程式。證據目錄為 `.seer-cache/native-contact/`。桌面完整更新流程已加入新回歸測試。

最終瀏覽器驗收通過：4 款素材 × P1 1920×1010／P2 1024×768，共 8 組。全部於首次動作擷取到攻擊段；無載入降級、無瀏覽器例外。接觸點位於對手站位中線，依本體尺寸保留 9.1–14px 重疊。奧斯卡原版與皮膚另逐張確認實際落地／劍擊中心，而非只檢查包圍框。`evidence.json`、`last-run.json`、8 張 `*-contact.png` 與 `browser.log` 位於上述證據目錄。這是對位與演出驗收，不是硬體效能測試；其他原生素材共用修正流程，未逐款人工驗收。

上述幾何／本體邊界、準備快取、全屏層、命中事件、15 項朝向測試及型別檢查均通過。桌面自動更新狀態的 3 項測試亦通過。

`npm run desktop:update` 完整通過（型別、回歸、正式前端建置、後端啟動與來源身分驗證），已啟用桌面版本 `1794852659977`，buildId `a20b1e9f5622ad3d4ccd0bd12f26ba317f3c2063c5766e6a88d52013494f1575`；保留前版 `1794844940431`。完整日誌為 `.seer-cache/native-contact/desktop-update.log`。沿用原桌面捷徑；結束目前戰鬥並關閉舊視窗後重新開啟，才會使用新版。
