# 套裝／眼鏡／遺物圖片對照與製作記錄

對照表程式：`src/data/suitArt.ts`（套裝 id → 路徑；`suitPortraitUrls` 先找 `/elf-art/suit_<id>.png`、`/seer/suit/<id>.png`，再讀對照表）。
製作腳本以 Pillow 做 HSV 色相旋轉（僅旋轉飽和度 > 12/255 的像素，白/灰/黑只調明暗，透明通道原樣保留）。圖檔不入 git，放 `public/seerapi/{suiticon,equip,relic,suit_custom}/`。

## 原廠同名（直接使用 `public/seerapi/suiticon/<suit_id>.png`）
dark_angel 448、morning_star 447、sky_cloud 446、venom_armor 404、future_armor 403、corrupter 387、space_time 391、proud_peak 393、phoenix_wings 382、emperor_armor 377、silver_knight 365、destiny_armor 435、imperial_armor 429、shadow_judgment 462、holy_sanctuary 476。

## 換色專屬版（`public/seerapi/suit_custom/<id>.png`）
| id | 來源 | 換色參數（色相°／飽和／明度） | 觀感 |
|---|---|---|---|
| eternal_starlight | suiticon 452 星光海嘯 | +70 | 紫 |
| starlight_guardian | suiticon 456 星光綠光 | -30 | 金橘＋洋紅花瓣 |
| berserker | suiticon 387 腐蝕者 | +85／×1.15／×1.05 | 血紅雙角 |
| void_traveler | suiticon 442 空元戰甲 | +215／×1.1／×0.8 | 暗靛紫＋黃綠 |
| nuclear_armor | suiticon 429 皇御神臨 | +85 | 輻射綠機甲 |
| shadow_slayer | suiticon 435 勝天之命 | +200／×0.7／×0.85 | 暗黑青 |
| crystal_barrier | suiticon 437 蒼星戰甲 | -50／×1.2 | 翡翠水晶 |
| inferno_mecha | suiticon 454 星光烈焰 | -8／×1.1 | 赤紅烈焰 |
| abyssal_walker | suiticon 462 影翼裁決 | -75／明度×0.9 | 深海青綠 |
| fate_defier | suiticon 479 帝皇戰甲 | -70 | 粉紫銀甲 |
| roamer_as | equip 1300993 蒼星目鏡 | -150，裁邊縮至 224px | 琥珀橘 |
| roamer_ah | equip 1300993 | +140 | 洋紅 |
| roamer_s | equip 1300993 | -100 | 萊姆綠 |
| hanged_mask | equip 1300768 腐蝕者面具 | -90／×0.6 | 青灰雙角面具 |
| demon_wind | equip 1301017 空元胸甲 | -55／×2.0／×0.8 | 暗紅魔紋 |

## 遺物（`public/seerapi/relic/<relicId>.png`，128×128）
| relicId | 名稱 | 來源／做法 |
|---|---|---|
| mul_prism | 倍率稜鏡 | item 300066 綠寶石，色相 +95 → 青藍稜鏡 |
| mul_cluster | 增殖晶簇 | item 1200734 主簇＋色相 +90、-70 兩顆子簇（增殖） |
| substitute_doll | 替身人偶 | item 1715412 鹿像，色調映射暖金（0.75）＋外發光 |
| undying_core | 不滅星核 | item 401001 保護罩，色相 -150 → 金色 |
| twin_core | 雙生之核 | item 1712157 原色＋色相 +120 兩顆並置 |
| reverse_hourglass | 逆時沙漏 | 向量自繪：金屬蓋、青色沙、紫色逆時針箭頭（4× 超取樣） |
| black_sun_heart | 黑日之心 | 既有 `eclipse/relic/black_sun.webp` 色相 +135、飽和 ×1.4 → 金橙日冕黑洞 |
| ember_wick | 餘燼燈芯 | 向量自繪：殘燭＋餘燼火苗 |
| life_lotus | 命蓮 | 向量自繪：粉蓮＋蓮葉 |

遺物圖示載入順序：`/eclipse/relic/<id>.webp`（官方優先）→ `/seerapi/relic/<id>.png` → 單字徽記。
