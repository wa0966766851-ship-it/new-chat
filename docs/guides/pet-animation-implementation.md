# 精靈動畫實裝與防踩坑指南

更新：2026-10-25。適用：對戰「精靈動作」及新版首頁待機。戰鬥規則仍由引擎、註冊表及積木執行。

## 本次驗收範圍

- 以 ChatGPT 內建瀏覽器實測正式 BattleScreen，1254×930 與1920×1010；三隻自製雷伊的普通雷伊皮膚共用70.pet，咤克斯使用15010.pet原畫質。這些是實測尺寸，不能套用到尚未測過的裝置。
- 1920寬雷伊物攻：技能紅字在第22幀、action_hit已抵達時出現；前緣穿入對手近側11.4px，並非跑過對手身後。測試記錄可在驗收工具「載入與播放量測」查看。
- 雷伊曾測得解碼685ms、雙側掛載完成740／770ms；咤克斯解碼9111ms、掛載59ms。穩定頁面影格間隔P95約17ms，原生重畫約24／25次每秒。咤克斯首次GPU上傳仍有約411ms單次停頓；穩定播放結果不能掩蓋這項限制。
- 已核對解析Worker路徑、單次繪製、共用解碼與有限回收。只有已登記的兩份來源可播放；佇列41隻不代表41份動畫已完成。原廠專屬特效、登場及致命一擊特殊動畫尚未接入。

## 資料與責任

| 層 | 檔案 | 責任 |
|---|---|---|
| 外觀 | `src/data/elfSkins.ts` | skinId 明確綁定 animationAssetId；自製精靈 ID 不能當官方素材 ID |
| 資源路由 | `server/petAnimations.ts`、`server/petAnimationCache.ts` | 本機優先、官方按需下載、完整性檢查與限額快取 |
| 載入 | `src/battle/petAnimationLoader.ts`、`petClipPool.ts` | Worker解析、同來源共用解碼、32MiB小圖短暫保溫、大圖250ms後回收 |
| 時鐘 | `src/battle/petRenderLoop.ts` | 依原生影格更新、每影格只畫一次、背景暫停；不修改技能時序 |
| 播放協定 | `src/battle/petAnimationRegistry.ts` | 實際序列時長、命中標記、以側別與戰鬥個體隔離 |
| 座標 | `src/battle/petAnimationGeometry.ts` | 物理靠近、收回與接觸點，不決定是否命中 |
| 渲染 | `src/components/battle/PetActionSprite.tsx` | 原始序列、單次鏡射、命中／結束事件；特殊攻擊的通用光點是模擬器提示，非原廠特效 |
| 時間軸 | `src/battle/presentation.ts` | 已結算傷害在命中顯示，收招完成才開始下一動作 |

## 不可重犯

1. **先量本體，再放動畫**：待機mesh可見範圍作為比例基準，與靜態不透明區域共用目標高度。一般精靈與colossal資料設定分開套用共同計算；不要把攻擊特效最大邊界當本體，不可為了測試順暢自行降圖集畫質。
2. **目標不是畫面中心**：讀對手待機可見框近側，並扣除攻擊影格本身的位移及姿勢寬度。只有physicalMotion=approach才外加接近；咤克斯stationary保持原地。特殊攻擊通用飛行提示並非原廠專屬技能特效。
3. **命中與結束是兩件事**：從實際 clip 的 `action_hit` 放行傷害顯示，`complete` 收尾。不以整段 3125ms 當出傷延遲。普通雷伊本機已核對：24fps；attack 索引22、sa24、cp18；索引從0起。新增素材仍讀原始標記，禁止套用這組常數。
4. **動畫不結算**：標記只能釋放播放佇列；不能呼叫傷害公式、魂印、積木、扣PP或附加異常。屬性技能無技能傷害事件時不補假紅字。粉／綠／白字仍按既有結算與收尾分類，不能改成真傷來湊畫面。
5. **攻擊者收招與防守者受擊可重疊**：命中時紅字與播放血條一起變，攻擊者仍播原序列。下一次出手、回合完成需等待收招；不以縮短整段動畫取代命中接線。
6. **P1左朝右，P2右朝左**：依實際動畫URL登記原圖朝向，只由 Canvas 根節點鏡射一次。靜態圖的方向不代表動畫方向。
7. **不要為首領另造縮放流程**：咤克斯colossal資料目前heightRatio=1.55、scale=1.08，使用整個場域高度；可以高過畫面及超出半場，但HUD仍須可操作。不能再套普通精靈94%高度上限或舊.88縮小值。
8. **不能等不到事件就卡死**：命中／收尾有有限備援期限；卸載釋放訂閱與等待。切換皮膚、靜態模式、背景分頁必驗。新播放器載入中仍用既有簡易演出，待機邊界才接入。
9. **通過型別檢查不等於畫面通過**：必須留瀏覽器證據，確認接觸座標、紅字發生幀、受擊、收招、兩側與三個指定皮膚。不可只用「有播放、血有減少」宣告完成。
10. **來源檔不等於桌面產物**：3015即時驗收來源；3000桌面可能仍是舊產物。使用桌面更新流程同時建置前後端，不能只單跑前端。不可自行關閉使用者正在用的遊戲視窗。
11. **測試瀏覽器也要釋放**：Edge 可能重新啟動成另一 PID，只呼叫啟動程序的 `kill()` 會留下整組瀏覽器、WebGL 與持續播放的分頁。每次測試用唯一 profile，結束依該 profile 清理完整程序樹；不得以全部 msedge.exe 作為清理目標。兩支瀏覽器驗收已共用 `tests/helpers/petBrowserProcess.mjs`。

## 開發與驗收指令（專案根目錄 PowerShell）

```powershell
$env:TEMP="$PWD\.tmp-esbuild"
$env:TMP=$env:TEMP
npm run animation:check
npm run test:animation-impact
node --import tsx tests/battleAnimation.semantic.test.ts
node --import tsx tests/petAnimationModes.semantic.test.ts
node --import tsx tests/battleSpriteFacing.semantic.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --config tests/fixtures/petAnimation.vite.config.ts
```

日常直接執行 `npm run animation:workbench`，開啟 `http://127.0.0.1:3015/tests/fixtures/petBattlePreview.html?elf=7070&opponent=707070`。這是真正BattleScreen；可收起工具而不改場地大小，並切換皮膚、兩側、原地物攻、三類技能及原始實戰。舊petAnimationPreview也導向同一入口，不維護第二個模擬舞台。

驗收Vite必須exclude `@seer-pet-anim/swf-bundle`，與正式Vite一致；預打包會把worker.js錯指向node_modules/.vite/deps。瀏覽器出現0/2先查載入錯誤及模式，不能直接判定電腦跑不動。入口HMR卸載舊React root，避免疊加播放器。

補充檢查：`node --import tsx tests/petLoadingFlow.semantic.test.ts`、`node node_modules/typescript/bin/tsc --noEmit -p tests/tsconfig.petWorkbench.json`。自動瀏覽器測試可用`npm run test:pet-browser`，驗收機設`PET_TEST_REQUIRE=1`使缺環境不冒充通過；本次現場測試使用內建瀏覽器，未重跑這組獨立瀏覽器腳本。

較窄畫面驗收可在測試終端指定 `$env:PET_TEST_WIDTH='1024'; $env:PET_TEST_HEIGHT='768'; $env:PET_TEST_OUT='.seer-cache/animation-shots-1024'`。預設1920×1010。自動測試不再強制SwiftShader；無GPU的CI才設`PET_TEST_SOFTWARE_GPU=1`，其速度不可當使用者顯卡效能。

證據輸出：`.seer-cache/animation-shots/impact-evidence.json`（命中幀、座標、紅字時點）、`battle-evidence.json`、`three-rey-skins.json` 與 `rey-real-battle.png`。Windows 瀏覽器測試使用安裝於預設路徑的 Edge。

完成後：`npm run desktop:update`。失敗即停止，不手動覆蓋目前作用中的版本；需要回復用 `npm run desktop:rollback`。

## 其他電腦如何取得資源

### 記憶體與U端差異

下載大小不能當播放用量：15010.pet壓縮包約3.56MiB，8192² RGBA解碼後256MiB；每個獨立WebGL播放器還有自己的GPU材質。本機U資源的同張圖集為BC7約64MiB，網頁目前尚未直接使用BC7。因此CPU池512MiB上限不是程序總記憶體上限，也不能保證兩隻大型精靈只占256MiB。

目前先做不損畫質的共用解碼、串行解析、單次繪製與卸載回收。小圖最多保留15秒、閒置總額32MiB；大圖最後一人離開250ms後釋放，切回可能要重解碼。後續要再降低GPU占用，須驗證BC7擴充支援及改造材質載入／共用渲染器，不能只開啟releaseAtlasAfterUpload：第一個播放器關掉ImageBitmap會破壞另一側共用資料。

不要下載整庫來解決首場等待。其他電腦採按需下載與有限磁碟快取；大素材可在進場前準備，載入時保留靜態外觀並提示進度，等待機邊界再切入。首次GPU上傳停頓仍需另測，不能靠延長逾時宣稱解決。

**現在預設自動取得：本機 U 端來源 → 已驗證磁碟快取 → 官方 HTTPS 按需下載。** 只在啟用相應皮膚的精靈動作時請求已支援素材，不下載全索引。沒有 U 端也能使用；桌面版需包含本次更新的後端。

- 官方來源：`https://newseer.61.com/Assets/StandaloneWindows64/PetAnimPackage/{hash}`。由同源後端取得，瀏覽器不直接跨域連官方，也不依賴第三方代理。
- 遠端下載僅接受伺服器白名單，不接受客戶端任意URL。每份核對大小與SHA-256；成功後以暫存檔原子提交。
- 同素材同時請求共用一次下載；單次下載20秒上限，失敗冷卻30秒。載入元件正式版等待上限45秒，期間保留既有外觀與輸入；失敗回退簡易演出。網路恢復後重新進場或重新切換模式可再試。
- Windows預設快取：`%LOCALAPPDATA%\SeerBattleSim\pet-animation-cache`，不同專案桌面版本共用。`SEER_PET_DOWNLOAD_CACHE` 可指定其他資料夾；`SEER_PET_REMOTE=0` 關閉下載，仍可使用已有快取與U端來源。
- 快取上限512 MiB，按最近使用順序淘汰舊bundle，不代表啟動就占滿512 MiB。只管理自己的hash.bundle，不刪使用者U端資料或其他檔案。
- 雷伊動作579315 bytes、材質3627 bytes，共582942 bytes（約569 KiB）；三隻自製雷伊的普通雷伊皮膚共用同一份。

開發／維護指令（需Node.js與專案環境）：

```powershell
npm run animation:prepare   # 可選：先抓本次支援的雷伊素材，避免首場等待
npm run animation:cache     # 查看位置、已驗證素材、已用空間與上限
npm run test:animation-cache
```

這些命令不是一般玩家的必要步驟，更新後進入動作模式會自動請求。沒有公開任意精靈ID的自動載入：新增動畫仍須登記素材、相依包、完整性、朝向、皮膚與命中標記，再測過才開放。

如果已下載U端素材，仍可選擇唯讀沿用：

```powershell
npm run animation:configure -- --cache-root "E:\TWSeerLauncher\Games\NewSeer\Seer_Data\yoo\PetAnimPackage\CacheBundleFiles"
npm run animation:check  # 此指令專門檢查U端來源，不是遠端快取檢查
```

設定器驗證後寫入`launcher/animation-source.local.json`，原檔備份為.bak；服務接受優先於設定檔的`SEER_PET_CACHE_ROOT`環境變數。官方版本不同可能改變hash，應重新核對白名單，不能改名冒充。

空間盤點與來源、下載實測見`docs/audits/pet-animation-remote-20261024.md`。目前未加入雲端素材上傳或自建CDN，也未開啟整庫離線下載。

## 交給 AI 的檢查指令

> 先讀 AGENTS.md、git status 和本指南。只沿 skin binding → bundle whitelist → shared loader → player marker → presentation → 正式 BattleScreen 檢查。禁止新增精靈名稱判斷到戰鬥核心，禁止用動畫事件執行效果。新增素材先列出來源URL／版本、待機可見範圍、fps、各序列、action_hit、原始朝向；未知項如實標待驗。以真實瀏覽器記錄P1/P2接觸點、命中與紅字時序、收招與下一行動、缺素材回退、模式與皮膚切換、寬窄畫面；分清已測與未測。測試通過才執行桌面更新，並交付建置版本與證據路徑。
