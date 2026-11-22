# 異境神霆·雷伊 預設立繪草稿

- `body_palette_v1.png`（2026-11-22，目前方向）：不刪除任何元素、透明度不變，只依指定配色重整。
  - 黃：本體、翅膀；淡藍：雷伊的倒影、劍、白霧；白：翅膀與身體連接處；暗部（原圖擅自加入的黑灰）改為琥珀／深藍輔色。
  - 產生：`python3 scripts/art/recolor_palette.py public/elf-art/otherworld_thunder_rey_body.png <輸出> 690 560 230`（後三個數字＝連接處中心與半徑）。
- `body_clean.png`、`part_*.png`（第一版）：刪白霧＋描線，使用者評估「過度刪白、很詭異」，已棄用，可刪除。
- `rey_flux_v1.jpg`、`rey_flux_v2.jpg`（2026-11-22，本地Pollinations直連試驗，只用文生圖、不保留原圖）：
  - 本機 dsh-imagegen 的 8791 代理沒有啟動；但可直接 GET `https://image.pollinations.ai/prompt/<urlencoded>?width=...&height=...&model=flux&seed=...&nologo=true`，回傳其實是 JPEG（就算副檔名寫 png 也一樣）。
  - v1（種子42）：人形可辨、無水晶碎片爆量，最接近設定；但仍有3D感、臉小、淡藍雷刃未落實。
  - v2（種子1337）：太寫實、灰色太多，離雷伊更遠，方向失敗。
  - 結論：flux 對 prompt 的構圖／配色服從度有限，不適合直接當正式立繪；最多當發想草稿。若要保留原圖元素重繪，仍需具備圖生圖能力的渠道（nanobanana / gpt-image / seedream 等）。

正式圖 `public/elf-art/otherworld_thunder_rey_body.png` 尚未替換。
