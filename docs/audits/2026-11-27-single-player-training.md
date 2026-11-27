# 單機新版編成、培養及刻印接入

## 本輪範圍與使用者決定

- 先完成單機共用元件，雙機對戰流程不在本輪擴充。
- 全精靈均可自由設定1至120級，預設100級；經驗無限，不增加取得或消耗門檻。
- 刻印皮膚僅更換圖樣，不改原刻印數值、寶石或精靈外觀。
- 寶石一代取10級、二代取5級；機率與嵌入率100%，其他比例保留原數值。

## 已接入

新版精靈編成／背包改用原生TeamScene、BagScene與AegisTraining。可培養精靈、換技能、調刻印、換隊員與配裝，沿用原有倉庫和陣容存檔。進階自訂精靈與巔峰禁選保留既有流程，並非宣稱所有舊頁面都已重寫。

培養→能力：1至120級、百分比／指定開戰體力；編成頂部提供雙方背包全滿血。開戰體力依正式配裝後的最大體力設定，不把戰鬥受傷寫回培養資料。進階手動編輯不再強制改回100級。

培養→刻印→刻印孔：新增36款最高等級寶石，綁定選定技能；外觀選單搜尋原廠刻印圖樣，列表不預載所有圖片。更換圖樣只寫skinId／skinIcon，原stats保留。嵌入寶石不是技能石，兩者保留原有獨立資料與結算。

戰前「場地／火焰／賽制設定」可選自由戰中央場地與雙方火焰。場地規則透過modeEvents派送；命運場地的C級攔截與50回合判定生效。自由戰選星蝕場地不會載入肉鴿存檔、種子或關卡遺物。

配置碼支援120級、開戰體力、刻印寶石與純外觀；未識別的寶石／外觀只略過該項，保留相容的刻印數值。保留原有加密與回復機制。

## 驗證證據

- `tests/inscriptionGems.semantic.test.ts`：58組。P1/P2正式傷害、10種寶石異常、PP、能力提升、未綁技能不生效、屬性技能、致命一擊及實際消除防禦強化；命中與先制；前2回合被清除槽恢復2PP、不誤恢復另一槽、第三回合不觸發；秘咒消耗與倍率；雙方護盾／護罩回溯及直接消除回溯封頂。
- `tests/freeBattleTraining.semantic.test.ts`：P1/P2非preparedTeams正式初始化的120級與半血；自由戰綠火、命運攔截；純外觀不改能力；配置碼保存及未知項相容帶入。
- `tests/trainingLevel.semantic.test.ts`：一般精靈1/50/99/100/101/120級與指定HP重置。
- `tests/playerConfiguration.semantic.test.ts`：20組配置、加密、正式載入及失敗回復。
- 原有battleLaunchEngine、battleFlames、skillStonesIntegration（62場）、ppBlockOps（10項）、shellRouteParity、shellScenes、bagArchitecture通過。
- 正式新版UI與桌面打包狀態見本文件後續驗收記錄。

## 尚未完成與未覆蓋範圍

**累計升級經驗尚未實裝。** SeerAPI的yielding_exp是擊敗獎勵，不能當成升級成長曲線；new_monster_level是關卡表。已找到Flash原始精靈GrowthType，原廠H5客戶端的PetInfo接收伺服器exp、lvExp、nextLvExp，但本輪未取得完整可信的升級表。未填入網路近似公式，也不宣稱101至120級存在原廠經驗需求。

58組測試不代表36款寶石的所有交互已逐項驗收。護盾／護罩回溯改用正式RESOURCE_CHANGED前後差額，涵蓋傷害抵擋與直接消除，避免重複計入傷害回執。秘咒已接單項status、status_seq、集合、隨機與舊文本異常路徑；集合與舊文本的所有抗性／衍化交互尚未逐項驗收，不能把單項測試當成整個系統完整驗收。

## 正式桌面介面驗收

第一輪正式包`1795743197284`已通過隔離真實瀏覽器：新版編成進培養、120級／開戰半血、寶石與綁定技能、刻印純外觀且數值不變、雙方背包全滿血、自由場地／火焰及重新載入後保存。未更動私人遊戲存檔。

視覺檢查後調整等級／體力欄位排列，補上選中圖樣單張預覽；最終桌面包須再次通過首頁及此操作流程才啟用。既有桌面視窗不強制關閉。

後續已改用原生AegisInscriptionEditor，完成繁體資料產生、獨立精靈外觀分頁、進階能力、介紹匯出入口與日常功能補齊，並通過正式瀏覽器流程。完整功能對照與尚未移植項目見[新版功能對照](2026-11-27-new-ui-feature-parity.md)。最終驗證日誌：`.seer-cache/native-ui-parity-final.log`；桌面active.json指向通過驗證的產物。

## 來源與重建

- 寶石：[SeerAPI寶石資源](https://api.seerapi.com/v1/gem/)，原始245筆與來源清單位於`docs/data/seerapi/2026-11-27-training/`。
- 刻印：[SeerAPI原始mintmark設定](https://raw.githubusercontent.com/SeerAPI/config-sources/main/unity/mintmark.json)。只取圖樣作外觀，不套用該圖樣的原刻印能力。
- 圖片：原廠H5 `https://seerh5.61.com/resource/assets/countermark/icon/{id}.png`，由既有本機圖片代理快取；40001／40002已確認HTTP200及PNG檔頭。
- 重建最高等級寶石與外觀索引：`python scripts/pack_training_gems.py`；抓取來源：`python scripts/fetch_training_reference.py`。
