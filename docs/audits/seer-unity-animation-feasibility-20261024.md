# U 端精靈動畫可行性與本次 UI 完成項目

> 後續動畫接入與命中／比例修正以 `docs/guides/pet-animation-implementation.md` 為準。下文包含逐輪歷史紀錄；「未接入 action_hit」及「完整3.125秒後出傷」是修正前狀態，不能作為目前實裝說明。

查核日期：2026-10-24。此輪實裝分級、介紹導向、皮膚共用模板與靜態模式；U 端播放器僅研究，未安裝新動畫依賴、未下載大型動畫素材。

## 本次落地

- 魔化.雷伊（7070）命運之輪 B；修正內建資料與歷史配裝覆寫，707070 分級不連動。
- 新背包精靈卡及介紹按鈕、隊伍詳情的完整介紹、圖鑑詳情使用 ElfSpotlight 共用模板。一般入口標題為「精靈介紹」，只顯示目前精靈的五個主要技能，不改「新精靈介紹」記住的展示對象。戰鬥唯讀詳情保留狀態頁及完整介紹出口。
- 所有精靈的皮膚清單都有「原始外觀」一項；未配置其他皮膚時僅一項且不可切換。舊版選精靈與編輯器沿用共用選擇元件。skinId 僅選外觀。
- 頭像跟隨 skinId，優先專用 head，缺少時依該皮膚裁切參數使用本皮膚 body。普通雷伊皮膚用 /seer/head/70.png；龍形皮膚使用立繪裁切。命運之輪清單的直接 img 也改經 ElfAvatar。
- 控制中心 → 戰鬥 → 動畫播放新增「靜態模式」。保存原本個別選項，播放端套用總開關；略過登場、出招及跳字，保留結算與 HP 同步。

## 找到的實際來源

1. [seer-pet-viewer](https://github.com/Nattsu39/seer-pet-viewer)：MIT 播放器程式碼，提供 Unity AssetBundle 解析、SWF 重建與 Spine 播放，不是直接給 img 使用的動圖 API。
2. [線上播放器](https://pet-anim-viewer.seerapi.com/)：支援 pet 參數，例如 `?pet=70`。資料索引位於 [pet-anim-index.json](https://pet-anim-viewer.seerapi.com/pet-anim-index.json)。它與一般精靈資料 API 是不同的功能。
3. [SWF renderer](https://github.com/Nattsu39/seer-pet-viewer/tree/main/packages/swf-renderer)：PixiJS 8.19.0、瀏覽器 WebGL/WebGPU；解析層 swf-bundle。可以取用底層播放器，不需要把 Vue 檢視頁嵌入 React。
4. [Spine renderer](https://github.com/Nattsu39/seer-pet-viewer/tree/main/packages/spine-renderer)：spine-webgl / spine-core 4.0。若後續正式採用，需另核對其上游 runtime 授權與素材使用條件，不能只以外層 MIT 推論全部資產授權。
5. [動作標籤原始碼](https://github.com/Nattsu39/seer-pet-viewer/blob/main/apps/viewer/src/lib/animation-labels.ts)：standby/await 待機、attack 物攻、sa 特攻、cp 屬性、hited 受擊、appear 登場、transform 變身、hidemove 第五技能。
6. [大型素材鏡像](https://github.com/SeerAPI/seer-unity-assets-pet_anim_part)：Unity 動畫資源節錄。播放器 README 說明官方 newseer.61.com 跨域限制，需要代理；小檔同源串流、大檔鏡像 CDN。不能直接把官方 bundle URL 當成已驗證可跨域載入。

動作標籤證明播放器能區分的類型，不證明每隻精靈具有全部動作。下方新增本機資料查核已確認「致命一擊」共用 Spine 與 UI 動畫；它們不在單精靈動作標籤表內，不能因標籤表沒有 critical 就推論遊戲沒有致命一擊演出。自訂 7070／707070 不等於官方動畫 ID，可明確綁定普通雷伊 70 作佔位，不能按 ID 自動冒認。皮膚也應另設 animationAssetId，不能只根據精靈名猜。

## 大小與負擔：量測及限制

查閱的遠端索引 updatedAt 為 2026-10-23T03:58:53.041Z：6231 條（SWF 6226、Spine 5），含大小版等重複精靈 ID，不是 6231 隻獨立精靈。

| 項目 | 索引中的檔案量 |
|---|---:|
| 條目 fileSize 加總 | 12,076,804,822 bytes，約 12.08 GB / 11.25 GiB |
| 中位數 | 1,111,388 bytes，約 1.06 MiB |
| 第90百分位 | 4,877,693 bytes，約 4.65 MiB |
| 第99百分位 | 12,860,054 bytes，約 12.26 MiB |
| 最大單包 | 34,538,242 bytes，約 32.94 MiB |
| 11 個共用 bundle 加總 | 41,814,653 bytes，約 39.88 MiB |
| 普通雷伊 ppets_70 | 579,315 bytes |
| 官方動畫包 ppets_5029（不代表自製異境雷伊） | 405,363 bytes |
| 官方動畫包 ppets_5036（物種仍需來源對照） | 277,845 bytes |

這是索引標示的傳輸資源大小，不包含完整相依、解壓、GPU 紋理與幀資料成本；不代表每次都要載入全部 11 個共用包。若以 10 Mbps 有效下載頻寬估算，1 MB 純傳輸約 0.8 秒、5 MB 約 4 秒，另外還有連線與解析時間。

本次改動前的桌面完成版實測 80,392,962 bytes（約 76.67 MiB）；public 為 72,222,158 bytes，編譯 assets 為 7,724,233 bytes（含 JS/CSS 等，非 gzip）。全索引檔案總量約為該完成版 150 倍。遠端載入不會增加這 12 GB 到專案，但播放器、解析器與 worker 仍會增加前端程式碼。此次沒有整合依賴，因此不能提供可信的「整合後 bundle 增加幾 MB」；需用隔離原型實際打包 gzip/brotli 與實機測量。

顯存估算例：一張 2048×2048 RGBA 解碼紋理約 16 MiB，4096×4096 約 64 MiB；mipmap 另約增加三分之一。這是格式算例，不是這些精靈的已測顯存。雙方各一隻、多圖集與解碼緩衝會疊加。

## 建議後續方案

1. 第一階段只驗證普通雷伊 70：待機、出招、受擊、登場的實際 clip，以及 P1/P2 朝向；確認 Atlas、材質與解析 worker 相依，再估算載入時間及幀率。
2. 設置 animationAssetId、clip 對照、原圖方向與可用動作的資料登記。優先對接現有 presentation 事件，播放器不執行技能、魂印、HP 或狀態判定。
3. 按需動態 import 播放器與解析器，只預載目前雙方上場對象，選角時可低優先暖載；不要預載整個背包。大檔解析放 worker，切換精靈時取消過期載入。
4. 動畫下載永遠不加入戰鬥結算等待鏈。尚未準備好、逾時、失敗、WebGL context lost 或裝置負擔過高時繼續用現有靜態圖。可先訂 300–500 ms 的演出選用期限，再按實測調整；資產未到就略過當次官方動作。
5. 遠端 CDN／自有同源代理，限制並行請求；素材僅放有上限的 RAM LRU，離開戰鬥／換人釋放紋理、幀資料與 object URL，頁面隱藏暫停。
6. 若嚴格不要本機持久素材：不寫 repo、下載資料夾、CacheStorage 或 IndexedDB，請求搭配 no-store 並檢查代理回應快取策略。仍需要 RAM／GPU；完全不持久快取意味每次冷啟動會重新下載，不能同時保證冷啟動零等待。
7. 自動化驗收：遠端失敗仍能正常出手、換人不播放上一隻、靜態模式不載入播放器、無素材動畫不改傷害、雙方正確朝向、連續多回合記憶體與顯存可回落。真實瀏覽器的低階裝置測試、CORS、CPU／GPU／耗電仍待原型驗證。

結論：已有可研究的瀏覽器 U 端資產播放實作，技術上適合拆出底層接入；當前不應整包下載，也不能只放遠端 URL 就宣稱全套動作已實裝。靜態模式本輪已落地，其餘維持研究範圍。

## 補查：使用者已下載的 U 端資料與「致命一擊」

使用者提供目錄：`D:\影片\bilibili\新建文件夹`。實際資源根目錄在其下 `TWSeerLauncher\Games\NewSeer\Seer_Data\yoo`。全程唯讀，沒有改動、重新命名或搬移遊戲素材，沒有啟動遊戲或操作帳號。

- PetAnimPackage 目前 manifest 版本 `20260507094947`，格式 `1.5.2`，6137 筆資源、6146 個 bundle；6146 個目前清單所指 bundle 全數存在，宣告大小合計 11,060,957,479 bytes，約 10.30 GiB。不能拿遠端 6231 條較新索引直接當成本機版本數量。
- DefaultPackage 目前 manifest 版本 `20261016112447`，61001 筆資源、7161 個 bundle；存在 7148 個，缺 13 個。因此不是整個客戶端資源完全齊備，但本次核對的精靈及致命一擊相關包均存在。
- 快取檔案是 `CacheBundleFiles\雜湊前兩碼\雜湊\__data`，讀取檔頭已確認 UnityFS，Unity 版本 `2022.3.51f1c1`。副檔名不是 png／gif 不代表沒下載；不可只用檔名尋找。
- 用獨立 TEMP 研究環境的 UnityPy 1.25.4 讀取以下資源成功；沒有將 UnityPy 加進專案依賴。只輸出中繼資料，不批量匯出素材。

| 本機已讀取的精靈 | 動作（幀數） | 幀率 | 內含圖集 |
|---|---|---:|---|
| 普通雷伊 70 | standby 29、attack 75、sa 75、cp 75、hited 8 | 24 fps | 2048×1024 BC7 |
| 官方動畫包 ppets_5029（物種未核定） | standby 16、attack 77、sa 58、cp 59、hited 8 | 25 fps | 2048×2048 BC7 |
| 官方動畫包 ppets_5036（物種仍需來源對照） | standby 16、attack 76、sa 55、cp 57、hited 8 | 25 fps | 1024×1024 BC7 |

三個包的 bundle hash 與宣告大小均與查閱的遠端索引相同：70=`455c66ff461d4188dd53cbd9fff4944e`（579315 bytes）、5029=`726372a4793a2746ccba4840c998774a`（405363）、5036=`ba8cd5c03eee85d3853da1fdd77a94eb`（277845）。此三包沒有 appear／hidemove，不能只因播放器支援這些標籤就替它們宣稱原生登場／第五動作。普通雷伊另有材質包 3627 bytes、shader 包 20765 bytes，已下載。瀏覽器需要移植材質呈現方式，不是載入 Unity shader 就能執行。

**識別更正：**使用者指出異境雷伊使用自製立繪。本次讀取到官方 `ppets_5029`，不代表自製「異境神霆·雷伊」有官方動畫；先前依相同數字 ID 將兩者等同的說法錯誤。本機 seerIndex 也沒有提供 5029 的物種名稱映射。目前該自製外觀沒有經驗證可用的對應動畫，須保留靜態立繪；只有使用者明確同意才可另外選普通雷伊等動畫作佔位，且必須標明佔位，不宣稱是自製立繪動起來。未來動畫素材綁定應使用明確來源與 animationAssetId，絕不以專案內 id 自動對號官方 ppets。

### 致命一擊：已確認資源及接線

1. `Assets/Game/UI/battle/Crit.prefab` 在 `game_ui_battle`，bundle `6744b2b0a9ecc870a097a2e1a9f34f4b`，5,012,742 bytes，實檔存在且可解析。其 Crit 物件上的 Spine UI 元件 `skeletonDataAsset` 指向 pathID `861739453062322768`。
2. 此 pathID 在相依 `game_spinedata_battle` 中，名稱為 **crisit2_SkeletonData**。對應 **crisit2.skel（Spine 4.0.64）／crisit2.atlas／crisit2 圖集 2048×512**。這是對實際物件引用的核對，不只比對名稱。
3. 同一個 `game_spinedata_battle` 還有 **baoji_SkeletonData／baoji.atlas／baoji 圖集 2048×512**，TextAsset `baoji` 是 JSON，標示 Spine **4.0.64**，動畫名 **baojiframe**。應逐一確認它與 Crit、蓄力／特寫演出的實際觸發關係，不能擅自把兩套效果當成同一個。
4. 戰鬥 UI 包還有 **TextMove_Crit** AnimationClip（60 fps）、BattleCritHpText、PetCrit、SkillBarBaoji 等物件。
5. `game_prefabs_year2025_gun`（33,943 bytes）存在 Gunshot_crit_A／B／B_1；`game_prefabs_year2025_hit`（49,327）存在 hit_crit_A／B，實際類型包含 Unity ParticleSystem。這些粒子不等於可直接交給單精靈 SWF 播放器的動作。
6. `game_prefabs_year2025_soundeffect`（432,220 bytes）有 critical.mp3／critical_accumulate.mp3 的資源登記，實包可讀出 11 個 AudioClip。

`game_spinedata_battle` 本包為 1,197,916 bytes，hash `3549cf04672a16286d27fcda601e8c7f`。若只為單一致命一擊演出，後續可研究僅抽取相應骨架、atlas、texture，再以相容 Spine runtime 播放，不必把整個 5 MB 戰鬥 UI 和 Unity 元件搬進網頁。但此次沒有輸出／播放 Spine 原型，不能宣稱最終視覺還原已驗收；crisit2 是二進位 skel，不能當作 JSON 硬讀。

### 如何沿用已下載資料

可沿用的是資源來源與相依，不是讓 img/video 標籤直接播放 `__data`。建議未來提供「本機已下載素材優先」來源：Node 服務依唯讀 manifest 索引和 assetId 讀取指定根目錄，再以同源 URL 提供播放器；缺檔才走遠端 CDN。設定根目錄後做能力檢查，不掃描或暴露任意磁碟，不批量複製到 public、dist 或每份桌面 release。

此方式不需要第二份完整本機素材，也不需要重新下載已存在 bundle，但仍需要瀏覽器解析、RAM／GPU 與個別格式適配。致命一擊骨架、數字 UI、粒子、聲音各走相應通道，使用引擎現有 isCrit 事件驅動展示；禁止用動畫反向判定是否致命一擊。靜態模式應完全略過相關載入與播放。

精簡讀取證據見同目錄 `seer-local-animation-evidence-20261024.json`，僅包含包位置、尺寸、動作與類型等中繼資料，不包含遊戲素材。

## 普通雷伊播放原型與設定（2026-10-24）

已接入三模式：靜態模式、簡易演出（原有前移／閃光／受擊晃動）、精靈動作。控制中心設定全域預設，外觀設定可逐種精靈覆寫、恢復跟隨全域；舊靜態模式與六項演出開關繼續遷移保存。原生播放器只掛在對戰立繪和新版首頁主立繪；首頁只播待機，離開首頁或畫面不可見即卸載，不在背包、圖鑑、介紹、編輯器播放。

### 明確來源與播放流程

- `elfSkins.ts` 以皮膚的 animationAssetId 明確綁定素材。7070／707070／5029 都只有 `rey-original`（普通雷伊）皮膚使用 rey70；三隻的原始外觀與其他皮膚不隱式啟用。原生普通雷伊 70 使用其已核對的原始動作。九青、未知替換圖片沒有對應動作；禁止按專案 ID 猜官方物種。
- 現有引擎事件 → 播放時間軸 → standby／attack（物理）／sa（特殊）／cp（屬性）／hited。動畫不觸發魂印、不決定傷害。只有同一側、同一實例和皮膚的播放器就緒才延長播放段；快速驗收不等待。
- 普通雷伊三種出招均 75 幀／24fps，原型以完整 3.125 秒出招段後銜接既有傷害展示。已確認原始 action_hit 在 attack 第22幀、sa 第24幀、cp 第18幀；**尚未改成命中標記對時的受擊／數字同步**，不可宣稱已還原 U 端整套戰鬥節奏。
- 非同步載入時保留靜態立繪和簡易演出，不因網路等待卡住回合；若載入途中正在出招，等下一個待機邊界才切入。正式版首次載入超過45秒放棄原生播放（等待期間保留靜態與簡易演出，不阻擋結算）；開發模式90秒容納首次依賴預處理。
- 本次瀏覽器實測確認雙側待機逐幀、攻擊移動、受擊播放可用。戰鬥場景已接通元件與事件，但完整桌面實戰、首頁縮放拖曳及大量換人 GPU 壓力仍需逐項視覺驗收。致命一擊 Spine、原生登場和自製立繪動畫未接入。

### 朝向規則與本次修正

P1 位於左側、必須朝螢幕右；P2 位於右側、必須朝螢幕左。素材原始朝向應按來源／皮膚登記，不能按名稱沿用。普通雷伊原生 `70.pet` **朝右**，已登記 `/api/pet-animations/bundle/rey70` 為 right，所以 P1 不翻、P2 翻一次。靜態圖沿用自己的來源登記。靜態圖由 ElfAvatar 翻轉，動作由 Canvas 根節點翻轉，兩者都呼叫同一個 `shouldMirrorBattleSprite`，外層不再翻。此前將靜態朝向沿用到動畫正是背對對手的原因。攻擊會移出待機框，因此 Canvas 覆蓋整個場地，保持原有立繪錨點，不裁成單一立繪小框。

### 資源負擔與配置

- 目前只唯讀使用使用者既有素材，私有設定 `launcher/animation-source.local.json` 的 cacheRoot 或環境變數 `SEER_PET_CACHE_ROOT` 指定快取根目錄。伺服器只允許 rey70 與 materials 兩個固定資源鍵，不提供任意檔案瀏覽。
- 一套原始素材共 582,942 bytes（約569KiB），不複製11GB素材庫到 public／dist／桌面 release。瀏覽器可能按私有 HTTP 快取保留這兩包；不是完全零本機快取。
- 同一套 clip 在場景內只解析一次，雙側播放器各有渲染器；最後一個使用者卸載才終止讀取並釋放 clip。Worker 負責主包解析。2048×1024 RGBA 圖集解碼約8MiB，兩個 WebGL context 可能各自上傳一份，另有場地大小的 Canvas framebuffer，不能只用壓縮包大小估算顯存。
- 播放器、Unity解析器、影像解碼器和 WASM 延後載入並分塊。現階段沒有做全部精靈的遠端來源、長期 LRU 或離線素材下載器；缺本機檔案直接沿用簡易演出。未來以明確 assetId／版本／hash 擴充白名單、限定預載在場兩隻和候補下一隻，設記憶體預算後淘汰；載入失敗不得阻塞回合。
- `@seer-pet-anim/swf-bundle`、`swf-renderer` 0.3.2 與 Pixi 8.19.0 為 MIT；但實際相依 `@arkntools/unity-js` 5.3.0 的套件授權標示 **AGPL-3.0**。此方案不應被描述為全 MIT；公開發佈前須處理其授權要求或評估替代解析流程。

### 可重跑的驗證

`npm run test:pet-animation` 驗證遷移、全域／逐隻覆寫、明確素材綁定、引用計數、HP展示和路由白名單。`tests/battleSpriteFacing.semantic.test.ts` 驗證雙側靜態圖朝向；原生朝向另在 petAnimationModes 測試固定。

瀏覽器原型以 `tests/fixtures/petAnimation.vite.config.ts` 建置，`tests/servePetAnimationPreview.ts` 提供唯讀素材路由，再由 `tests/petAnimation.browser.test.mjs` 啟動獨立無視窗 Edge。截圖在忽略目錄 `.seer-cache/animation-shots`，包含修正後面對彼此的待機與朝場地中央移動的攻擊；這些測試不操作使用者現有遊戲視窗。


## 正式對戰驗收補完（2026-10-24）

已用正式 BattleScreen、BattleScreenUI 與 createBattleEngine 跑三回合瀏覽器驗收。測試資料使用普通雷伊外觀、空白魂印積木與三類無附加效果技能，避免麻痺讓對手無法出招；這些測試資料不寫回遊戲圖鑑或存檔。

- 雙側實際播放 attack、sa、cp、hited，完成後回待機；兩側各扣 148 體力，技能各消耗 1 PP。
- 實際切到靜態模式卸載雙播放器，再切回精靈動作重新載入成功；已檢查可見場地與截圖，P1 朝右、P2 朝左。
- 補上播放器來源切換時重設就緒狀態、立繪尺寸／錨點變動時重新定位；受擊動作使用本次受擊事件編號，避免同招連續受擊沿用舊事件。
- 動畫仍只消費已結算的播放事件；無新增精靈專屬戰鬥分支。原生登場、致命一擊 Spine 及 action_hit 幀對時仍未接入，沿用既有入戰／傷害展示。

可重跑：先以 tests/fixtures/petAnimation.vite.config.ts 建置，啟動 tests/servePetAnimationPreview.ts，再執行 node tests/petBattle.browser.test.mjs。預設隔離驗收站為 127.0.0.1:3013；可由 PET_TEST_URL 指向別的驗收站。證據在忽略目錄 .seer-cache/animation-shots/battle-evidence.json 與 rey-real-battle.png。瀏覽器使用獨立暫存設定，不修改使用者的播放偏好。

三隻雷伊操作方式：外觀皮膚選「普通雷伊」，播放模式選「精靈動作」（或跟隨已設為該模式的全域設定）。魔化 7070、墜霆 707070、異境神霆 5029 共用這套素材，但各自的魂印／技能／數值保持原定義。後續新皮膚必須自行登記 animationAssetId；不能繼承物種名的動畫。

三款指定皮膚瀏覽器實測通過：7070、707070、5029 的 rey-original 均在 P1/P2 載入並播放攻擊及受擊，傷害正常結算。three-rey-skins.json 記錄各個精靈序號、皮膚、體力與實際播放序列。
