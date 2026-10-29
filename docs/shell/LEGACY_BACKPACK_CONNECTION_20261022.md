# 新介面接用原版背包（2026-10-22）

## 接線方式

新版不再由 BagScene／TeamScene 自行維護隊伍草稿與保存邏輯。Aegis 的背包、編成改以 `LegacyScenes workspace` 掛載原 `StartScreen`，指定 `presentation="aegis"`。新增 `LegacyTeamWorkspace` 只有呈現、選取與拖動狀態；隊伍、配裝、預設及開戰狀態均由原控制器持有。

舊版預設仍是 `presentation="legacy"`，保留原畫面。未刪除舊的 BagScene／TeamScene 檔案及其他 AI 修改，但它們已不在正式 Aegis 背包／編成路徑。

## 操作對應

| 新版操作 | 直接呼叫的既有功能 |
|---|---|
| 替換／空格加入 | showSelectionModal，原 ElfPicker、createInstance 與槽位回寫 |
| 點選移動／拖曳 | handleSlotSwap |
| 出戰待命個別／整組對調 | handleSlotSwap／handleSwapAllActiveStandby |
| 首發／移出 | handleSetP1Starter／handleSetP2Starter／handleRemoveP1／handleRemoveP2 |
| 隨機／複製／對調雙方／清空 | 原 handleRandomize、handleCopy、handleSwapTeams、handleClear |
| 保存／載入紀錄、雙方三組預設 | 原 handleSaveLastUsed、handleLoadLastUsed、handleSavePreset、handleLoadPreset 及 P2 對應版本 |
| 套裝／目鏡／稱號／一鍵卸下 | 原 handleSetP1*／handleSetP2*；SuitRail 只負責選取呈現 |
| 倉庫搜尋、屬性篩選、加入 P1／P2 | 原共用 ElfPicker；handleAddP1／handleAddP2 |
| 能力詳情、魂印積木、刻印、技能石、技能配置 | 原精靈詳情及編輯視窗 |
| 刪除、還原及原有進階管理 | 「進階精靈管理」在同一控制器內切回原完整管理畫面；返回不重建隊伍 |
| 房主／模式／賽制／禁選數／開始對戰 | 原戰前設定及 handleStart；BP 與技能石合法性檢查保留 |

## 保存與生命週期

沿用原版主動保存紀錄／預設的規則，並在畫面提示。配裝仍依原版立即寫入。未改成另一套自動保存流程。

bag／custom 使用相同錯誤邊界 key。打開精靈編輯器時，原 StartScreen 保持掛載並隱藏；保存或返回後回到背包，保留隊伍狀態；資料更新沿用原同步效果。離開隊伍工作頁前仍須主動保存紀錄，沒有承諾跨重新載入保留未存草稿。

## 驗證範圍

- UI 回歸新增雙方保存、複製、交換參數、待命交換、替換、三組預設、開戰按鈕委派測試。
- 內建瀏覽器實際交換 P1 前兩格，確認順序及首發跟隨後恢復；確認 P2 原版選人視窗與完整搜尋；開啟原編輯器並返回，確認 24 格仍在。
- 不把上述接線及 UI 驗證當成全精靈戰鬥語意驗收；本輪沒有進行完整對戰、推送、部署或打包 EXE。
## 追加修正

- 技能石維持在原精靈換技能視窗內，沒有新增背包／全隊配裝入口。
- App 在 battle 場景固定使用 LegacyShell；不修改新版大廳偏好，離開對戰後繼續使用新版。
- 轉場取消以 key 強制重建子樹，避免編輯返回時重置控制器。
- 全隊配裝視窗改掛到 document.body，避免上方工具列覆蓋「完成」而誤切舊版。
- 型別檢查與 test:shell 通過；瀏覽器確認 P2 配裝完成後仍在新版，24 格保留、背包技能石按鈕為 0。
 - 最終 build 通過。內建瀏覽器實際從新版對戰入口進入第 1 回合，確認 app-wrapper 存在且 aegis-shell 不存在；按首頁回到新版大廳。只驗證啟動／返回，未操作整場戰鬥。

## 本輪追加：視覺與戰前入口

- 背包與首頁共用清晰場景背景，新增原創幾何、雙方色彩及緊湊精靈卡；沿用現有 Seer 頭像與屬性圖標，沒有引入外部遊戲美術。
- 功能、按鈕順序與原控制器不變。隊伍在頁面內捲動，工具列與開戰按鈕固定保留。
- 首頁玩法啟動與側欄對戰入口先進入此背包；原版開始按鈕再檢查並開戰。探索玩法仍走原探索流程。
- 內建瀏覽器實測「首頁開始 → 新背包 → 開始對戰／選禁 → 舊版第 1 回合 → 新首頁」。不是整場實戰驗收。
- test:shell、型別檢查、正式建置通過。畫面證據：build/ui-review-20261022/styled-shared-backpack.png。
