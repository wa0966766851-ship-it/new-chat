# 第四版異常圖標：已確認並接入

使用者於 2026-10-03 確認本版並要求放入遊戲。`confirmation-approved.png` 保留確認原圖，`actual-size-preview.png` 是實際尺寸的 64/32/24/20/14 px 縮圖，不是生成的尺寸示意。

## 接入範圍

- 新增 `public/status-icons/` 下的眩暈、神悔、腐朽、失溫、遲鈍、窒息、平靜、入魔 PNG。
- 全部 256×256 RGBA，保留各圖的彩色背景，只裁掉確認圖的文字、間距與圓角框外的展示底色。
- `src/battle/effectIcons.ts` 的共用 `statusVisual()` 增加對應，戰鬥簡介、狀態面板與百科沿用既有引用方式。
- 未修改異常規則、回合、抗性、衍化、任何其他精靈素材或既有圖標。

## 來源與重現

原確認圖由內建 imagegen 依第三版及原遊戲圖標對照圖重畫。實際接入時沒有重新生成，由 `scripts/install_status_artwork.ps1` 定位裁切、縮放並保留圓角透明區。腳本名稱使用 Unicode 碼位，避免 Windows PowerShell 5 的來源編碼造成檔名錯亂。

預設拒絕覆蓋既有圖標；`-PreviewOnly` 可只重建縮圖驗收圖。

## 驗證

`node --import tsx tests/statusArtwork.semantic.test.ts` 檢查八張 PNG 的格式/尺寸、全部已註冊名稱的圖標存在，以及 BOSS 免疫與異常抵抗、護盾與護罩未被覆蓋。`scripts/audit_status_artwork.ts --write` 更新素材盤點；此盤點只表示有圖片，不代表異常效果已通過語意驗收。

24/32 px 可以保留主輪廓；14 px 會失去人物/紋路細節，仍配合既有名稱及回合文字顯示。尚未改動原 UI 的圖標尺寸。

本輪實測：圖標測試、`tests/viewerFog.semantic.test.ts`、型別檢查、正式建置通過。建置仍有主入口約 525 kB 的大型區塊警告，未以調高警告門檻掩蓋。未宣稱完整戰鬥測試套件通過。

瀏覽器於 `http://localhost:3000/` 的異常百科驗收：八種新圖均 `complete=true`、`naturalWidth=256`，實際顯示寬度 20 px。`in-game-proof.png` 保存神悔篩選結果。狀態面板/戰鬥簡介沿用同一個 `statusVisual()`；未為展示而向真實戰隊注入異常狀態。
