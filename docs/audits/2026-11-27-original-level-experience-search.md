# 原廠精靈升級經驗查找

更新：2026-11-27。範圍為精靈等級經驗，不是擊敗獎勵、通行證或活動經驗。

## 結論

找到 1–100 級的四欄歷史逐級表，但尚未取得可直接視為現行原廠權威值、並與每隻精靈成長類型可靠對應的完整表。101–120 級未找到原廠資料。正式程式未採用近似公式或未驗證表；自由調整 1–120 級與無限經驗設定維持。

## 本機 U 端的實際證據

- 遊戲位置：`D:\影片\bilibili\新建文件夹\TWSeerLauncher\Games\NewSeer`。
- 本次只讀遊戲安裝資料，沒有登入、讀取帳號憑證、修改快取或向遊戲伺服器發送請求。
- `Seer_Data/yoo/ConfigPackage/ManifestFiles/PackageManifest_ConfigPackage_20261125174329.bytes` 列出 635 個設定資產。名稱查找未發現一般精靈累計升級經驗表；`bagTower_PlaerExp`、`aurumEndgameExpConfig_*` 是其他玩法資料，不能套用。
- `DefaultPackage` 清單版本 `20261125174236`，列出 `Assets/Game/Dll/GameLogic.dll.bytes`，bundle ID 1158、hash `cd78e74149a8216d2d420efe99c4d67d`。實際位於 `CacheRawFiles`，不是動畫使用的 `CacheBundleFiles`。
- `core.model.PetInfo` 建構流程依序從輸入封包 `ReadUnsignedInt` 讀取 `level`、`exp`、`lvExp`、`nextLvExp`；這些不是本地成長公式的計算結果。
- `CommandID` 初始化將 `PET_GET_LEVEL_UP_EXP` 設為 **9274**。
- `module.petBag.GrowUpLevelPart.updateLevelInfo` 的非同步實作以精靈 `catchTime` 呼叫該指令，回覆資料第一個整數寫入 `upLevelOneNeedExp`，第四個整數寫入 `upLevelMaxNeedExp`。因此已核對的升級介面由伺服器供應所需經驗。
- 調查用程式與中間輸出留在 `.seer-cache/training-reference/`。遊戲 DLL 不加入正式程式或資料包。

以上只能證明已檢查路徑的實作，不能據此宣稱原廠所有版本、所有檔案都不含經驗表。

## 網路找到的表

原頁：[4399：賽爾號精靈各等級經驗公式一覽](https://news.4399.com/seer/jingyanxinde/201010-23-79358.html)，日期 2010-10-23。

逐行數值保存於 `docs/data/seerapi/2026-11-27-training/historical-xp-4399-unverified.csv`，共 100 列，保留原欄名，不自行對應 GrowthType、不修正原數值。

限制：

1. 原文承認部分分段公式有誤差，並指出 90／91 級附近存在記錄疑點。逐級表也仍需獨立核實。
2. 四欄原始資料逐列相加為 1287876、1699994、1093306、1030301，原頁「總和」中的第一、第四欄各少 1；未擅自更正。
3. 表包含第 100 列，不能直接把全部 100 列加總當成升到 100 級所需經驗，需先確認每列代表的起訖等級及起始經驗基準。
4. 欄名 37876、59996、33446、30301 不是原廠 GrowthType 識別碼。尚未可靠建立現行精靈的欄位對應。
5. 僅到 100 級，不能自行延伸至 120 級並標為原廠值。

另有同表 XLS 轉載，不能視為第二份獨立驗證。SeerAPI `yielding_exp` 是擊敗獎勵，Flash `GrowthType` 只有成長類型，兩者都不是完整升級表。

## 後續可採用的證據

優先尋找公開的原廠經驗表、可核對版本的原廠伺服器計算資料，或使用者合法取得的逐級回覆樣本。驗證精靈成長類型、起始經驗與各級門檻後才接入正式累計顯示；未取得的級別保持明確缺值。
