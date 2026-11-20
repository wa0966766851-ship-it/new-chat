# 奧斯卡雙外觀動畫接入

來源索引：[Seer API動畫索引](https://pet-anim-viewer.seerapi.com/pet-anim-index.json)，版本 `20261113164751`。來源、完整雜湊與逐序列資料保留於 [匯入紀錄](2026-11-16_oscar-animation-import.json) 以及素材登記的 `source` 欄位。

| 外觀 | 素材鍵 | 原生片段 | 幀率 | 物攻命中幀 | 特攻命中幀 | 屬性命中幀 |
|---|---|---|---|---|---|---|
| 創界衣缽·奧斯卡（皮膚599，動畫1400599） | oscarGenesis | 1400599.pet | 24 | 100 | 77 | 49 |
| 聖靈守護奧斯卡（原版3425） | oscarOriginal | 3425.pet | 25 | 114 | 99 | 31 |

幀編號從0起。兩份都沒有獨立第五技片段，沿用既有特攻片段備援，不虛構原廠第五技動畫。

## 檔案與接線

- 原始遊戲快取只讀取，兩份 `__data` 已按hash命名複製到 `_anim_import/*.bundle`，SHA-256與來源完全一致；該目錄僅本機留存。
- `src/battle/petAnimationAssets.ts`：逐檔登記片段、圖集、幀率、原始命中標記、完整性及官方來源。
- `src/data/elfSkins.ts`：預設創界衣缽外觀與可切換原版各有明確綁定；新增可明選的創界衣缽皮膚，保留原始外觀選項。
- 使用既有後端白名單、本機遊戲快取優先、官方網址按需取得與共用播放器；沒有把快取副本硬編碼成唯一來源。
- 動畫不執行傷害／魂印／積木；沒有新增戰鬥核心的精靈名稱判斷。外觀切換不改技能、種族值或戰鬥身分。
- 正式播放器截圖確認原生動畫均朝畫面右；P1不翻、P2單次鏡射。原版動畫是右向三分之四站姿，沒有沿用其正面靜態PNG的方向。

## 驗收

```powershell
node --import tsx tests/oscarAnimation.semantic.test.ts
node --import tsx tests/battleSpriteFacing.semantic.test.ts
node --import tsx tests/petAnimationImpact.semantic.test.ts
node --import tsx tests/petAnimationCache.semantic.test.ts

# 即時來源驗收服務（使用未占用的埠）
$env:PET_PREVIEW_PORT='3027'
node --import tsx tests/servePetAnimationPreview.ts --dev
# 另一個終端執行；腳本使用獨立瀏覽器設定並在結束時釋放
$env:OSCAR_TEST_URL='http://127.0.0.1:3027'
node tests/oscarAnimation.browser.test.mjs

# 正式產物驗收：先建置fixture，再使用不帶 --dev 的服務
node node_modules/vite/bin/vite.js build --config tests/fixtures/petAnimation.vite.config.ts
npm run desktop:update
```

證據位於 `.seer-cache/oscar-animation/`：`evidence.json` 記錄雙側物攻／特攻原始命中標記、紅字發生幀、受擊／收招、實際扣血、降級紀錄與播放量測；待機截圖核對兩側朝向；另有1024×768畫面及實際HTTP素材雜湊核對。測試使用隔離的展示技能，只驗收正式引擎的動畫接線，不代表重新驗收奧斯卡所有原技能效果。

最初一次開發環境測試曾出現P1物攻逾時降級；啟用測試分頁前景後，完整雙側測試未再出現。沒有延長正式等待期限或略過降級斷言；已另以正式打包的BattleScreen驗收入口、全新瀏覽器設定再次執行完整測試，兩款外觀皆通過，無逾時降級及未處理例外。此項不等於已確定最初逾時的根因；沒有修改正式播放器期限來掩蓋該次結果。

桌面完整更新（含型別檢查、既有回歸測試、正式前後端啟動檢查）完成，作用中版本：`1794844940431`。該版本的雙素材端點已再核對位元組與SHA-256，見 `.seer-cache/oscar-animation/desktop-evidence.json`。
