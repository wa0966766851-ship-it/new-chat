# Roguelike Phase4 修復計畫（星際探索）

日期：2026-10-02｜範圍：只動星際模式＋文件＋新測試，不碰 BattleScreen 核心結算與他人暫存
現況基線：runState 有 pendingBattle id＋revision＋saveRun 冪等，moveRun 驗 connections，recruitRun 原子扣券，battleSnapshot 保留殘血殘 PP。工作區乾淨（63d73db）。

## P0-A 滅團＝整局結算（runState.ts，加欄位不改舊簽名）
- settleBattle 保持簽名，內部加：
  - 打完若 runElves 全滅（isAliveBySurvivalRule 全 false）→ run.runOver=true、run.runResult='wiped'，lastBattleResult 照寫，pendingBattle 照清。
  - 第 6 層 Boss 贏 → run.runOver=true、run.runResult='victory'，保留原跨層邏輯給 1-5 層。
  - 其餘行為不變（beans/exp/vouchers/collectible/fuel 照舊）。
- loadRun 照常讀；舊存檔無 runOver 視為進行中。
- 驗收（新 tests/interstellarRunOver.semantic.test.ts）：全滅→runOver/wiped；第6層Boss贏→runOver/victory；1-5層Boss贏照舊跨層；exit/draw 不觸發 runOver。

## P0-B Boss 失敗懲罰＋燃料時鐘（runState.ts＋InterstellarRun.tsx 文案）
- Boss 輸：除原扣 2 燃料外，加收 10% saerBeans（下取整，不為負）作撤退費；文字寫明。
- 燃料 0 時移動：moveRun 原樣拒絕（不扣），InterstellarRun handleMoveToNode 在 fuel===0 時顯示新文案「燃料耗盡：艦船進入節流模式，下次移動前需補給」，不改移動規則（避免改經濟）。
- 驗收：Boss 輸豆子少一截；0 燃料點格子文案變且不扣資源。

## P1-A 收藏品空包二選一（只改文案＋新測試，不加戰鬥通道）
- 空包（effect 為 (s)=>s）：減傷珠、賈斯汀之臂、銀翼獵手、六翼獵手、虛空護盾發生器，文案後加註「（尚未實裝，待戰鬥通道）」。
- 文不對題：奈米修復群改成「隊伍面板體力 +50（一次性，非每回合）」；重力靴／雷神之翼後半句改成「（速度下降免疫尚未實裝）」；能量超載核心加註「（掉血懲罰尚未實裝）」；船長之徽加註「（豆子加成尚未實裝）」。
- 新 tests/interstellarCollectible.semantic.test.ts：斷言上述 id 的 effect 行為與文案標記一致（空包恆等、奈米一次性），防止以後改文案不同步。
- 不開新戰鬥通道（那是另一個大任務，Codex 額度回來再排）。

## P1-B 起始鑽石與燃料顯示一致（InterstellarHub.tsx＋InterstellarRun.tsx 小修）
- Hub 預覽燃料寫死 10，Run 初始 fuel=5：Hub 改成顯示「初始 5，上限 10，進下一層回滿」，與程式一致。
- 起始鑽石：Run 初始 diamonds 用 getSavedRunValue('diamonds', startingDiamonds)，新局以傳入值為準（現行已是），只補測試不斷言改壞；有效舊局照讀存檔。
- 驗收：新開一局鑽石＝Hub 顯示值； fuel 顯示 5/10。

## 不做（本期明確排除）
- 不改 BattleScreen 結算、不改傷害公式、不改敵人膨脹曲線、不做 meta 解鎖／天賦／種子／每日圖、不做遺物二選一／刪除／升級系統。
- 商店折扣／治療加成／銀行加成三個加成率：只驗證有無呼叫，不實作新效果（疑似死狀態，先驗再說）。
