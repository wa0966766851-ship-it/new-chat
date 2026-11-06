# 自製動作素材：從立繪到可播放序列

> **本輪美術未通過**：使用者指出生成待機畫風偏移、角色來源解析度不足，且墜星舊去背圖缺素材。真正原稿與去背草稿在 `drafts/20261105-zhuixing-original/`。停止把第三輪當完成版；待機應保留原畫，出招才使用另行補畫。詳見第三輪報告最前段。

> **第三輪目前入口**：[待機與受擊實測](../audits/2026-11-05_自製待機與受擊_第三輪.md)。六刃、蝕言、帝辛、墜星已匯入離線補幀待機及獨立受擊姿勢，來源分別在 `drafts/20261105-*-v3/`。請勿重跑第二輪整批發佈覆蓋第三輪。程式檢查與肉眼驗收分開記錄於報告；不代表官方品質或桌面／網站更新完成。

> **第二輪狀態**：[近戰、待機與爆炸驗收](../audits/2026-11-05_自製動畫第二輪_近戰待機與爆炸.md)。近戰／爆炸／額外行動已有雙側實播；待機仍未達使用者要求，不能把一張圖的小幅變形算作官方品質。現行第二輪 spec 在 `drafts/20261105-combat-v2/`。六刃原抱胸圖朝右，匯入動作時先統一朝左，不能直接套整批方向。下方早期「角色只佔一格」及「朝右撰寫」僅為舊版歷史，不可當現行製作規格。

> **2026-11-05 新製作入口**：四隻自製精靈已改用完整關鍵姿勢圖，不再以拆分身體或整圖晃動製作出招。現行流程見 [完整姿勢動畫流程](完整姿勢動畫流程_20261105.md)。下方保留舊版歷史；`anim:build` 現在只輸出舊版草稿，不會直接覆蓋正式素材。

> 2026-11-03 建立。對應腳本：`scripts/build_custom_animation.mjs`、`scripts/anim_contact_sheet.mjs`、
> `scripts/sprite_alpha_audit.mjs`；載入層：`src/battle/customPetClip.ts`。

## 為什麼是圖集，不是 .pet

官方素材是 Unity SWF bundle（`ppets_<id>`），我們沒有工具鏈產出同格式。
但播放器（`SwfPlayer`）真正需要的只有 `SwfClipData`：一張圖集 + 每段序列的逐幀 mesh。
自製素材完全符合這個形狀，所以**播放器一行都不用改**。

## 流程

**2026-11-04 更新：**以下為初版製作流程。墜星目前改用 `build_zhuixing_skeletal.mjs` 輸出 `build/custom-animation` 草稿，再用 `publish_custom_animation.mjs --id wuxu_zhuixing --publish` 備份與發佈。對手命中特效由共用 `customBattleFx.ts` 即時定位，不再把跨場地砲擊烘焙到角色圖塊。詳細指令見 `docs/guides/自製精靈動畫製作與驗收.md`，本輪證據見 `docs/audits/2026-11-04_自製出招動畫實裝與驗收.md`。

```
立繪 PNG（已去背）
   ↓  spec.json（關鍵影格 + 程序化光效）
build_custom_animation.mjs --preview     # 先看關鍵影格對不對
build_custom_animation.mjs               # 烘焙成圖集
public/elf-anim/<id>/atlas.png + manifest.json
   ↓
customPetClip.ts 轉成 SwfClipData → SwfPlayer 直接播
```

```bash
npm run anim:preview -- --spec docs/custom-anim/wuxu_zhuixing.spec.json
npm run anim:build   -- --spec docs/custom-anim/wuxu_zhuixing.spec.json
npm run anim:sheet   -- --id wuxu_zhuixing --seq sa --scale 0.6
npm run test:custom-anim            # 格式契約（32 項）
npm run test:custom-anim:browser    # 真實播放器截圖（需先起 serve:animation-preview --dev）
```

## 關鍵設計：角色只佔圖集一格

一開始每幀都存整張角色 → 帝辛 126 幀 = **97 MB**。改成：

| 內容 | 存放方式 |
|---|---|
| 角色本體 | 圖集裡**只有一格**，所有影格共用 |
| 位移／縮放 | 每幀四邊形的**頂點座標**（mesh positions 本來就逐幀不同） |
| 透明度 | 逐頂點 `mulColor` 的 alpha |
| 光效 | 逐幀各佔一格（小塊，內容框裁切） |

初版結果：帝辛 97 MB → **1.76 MB**，當時四隻合計 **4.74 MB**。2026-11-04 正式素材的四張 PNG 合計 5,227,378 bytes，含 manifest 為 7,462,400 bytes；兩個數字的計算範圍不同。

## spec 格式

座標以**立繪中心為原點，x 向右、y 向下**。spec 一律以「角色朝畫面右」撰寫，
立繪實際朝左時由 `facing:'left'` 把**動作**鏡射到左側（立繪本身不動），
這樣動畫與靜態圖朝向一致，切換演出模式不會突然轉身。

### 圖層

| kind | 用途 | 主要參數 |
|---|---|---|
| `sprite` | 角色本體 | `track`（位移／縮放／旋轉／透明度） |
| `glow` | 徑向光暈 | `color` `radius` `power` |
| `ring` | 能量環 | `color` `radius` `width` |
| `spark` | 粒子 | `color` `count` `spread` `speed` `seed`（固定種子＝可重現） |
| `beam` | 錐形光束 | `color` `length` `width` `dir` |

### 緩動

`linear` `in` `out` `inOut` `charge`（蓄力：先慢後快）`snap`（出擊：瞬間衝出）`back`（受擊彈回）

### 只做必要的序列

播放路由：物理→`attack`、特殊→`sa`、屬性→`cp`、額外行動→`extra`（找不到才退 `cp`）。
先看技能組成再決定：

| 精靈 | 技能組成 | 做了哪幾段 |
|---|---|---|
| 無序.墜星 | 特殊×5 | `standby` `sa` `hited` |
| 無序.六刃 | 物理×5 | `standby` `attack` `hited` |
| 人皇·帝辛 | 物理×4、屬性×1 | `standby` `attack` `cp` `hited` |
| 無序·蝕言 | 物理×3、特殊×2 | `standby` `attack` `sa` `extra` `hited` |
| 鎮世龍魂・龍之治癒 | 特殊×3、屬性×2 | 暫緩（連立繪都沒有） |

## 動作設計

| 精靈 | 序列 | 動作 |
|---|---|---|
| 墜星 | `sa` | 浮游砲蓄能 → 能量環收束 → 砲口炸出光束 → 後座力推回 → 粒子餘波（命中第 26 幀） |
| 六刃 | `attack` | 六刃環身收束 → 前衝揮擊 → 環爆（命中第 20 幀） |
| 帝辛 | `attack` | 金光聚於劍身 → 前衝斬擊 → 命中時金光炸開（命中第 23 幀） |
| 帝辛 | `cp` | 金光自地面升起 → 人皇御宇（屬性技能） |
| 蝕言 | `attack` | 書頁翻動 → 紫光衝擊（命中第 21 幀） |
| 蝕言 | `sa` | 環繞收束 → 藍白光核爆發（命中第 24 幀） |
| 蝕言 | `extra` | 械律·置換：雙層同心環反向旋轉收束，身體被拉正再放鬆 |

## 已知限制

1. **單張立繪做不出真實肢體動作。** 變換只能做衝刺／後仰／抖動；
   要揮劍、抬腿必須拆層做 2D 骨骼。目前出招位移已放大到 2.6 倍（質心位移 18–32px）。
2. **光效是程序化的**，沒有手繪特效的細節。好處是可調參數、可重現、檔案小。
3. **朝向必須逐圖核對**（見 `seerAssets.ts` 的 `BODY_SOURCE_FACING`）。
   墜星／蝕言／帝辛朝左，六刃朝右 —— 這是看原圖判定的，不是猜的。

## 去背稽核（入庫前必跑）

```bash
npm run art:audit -- --output public/elf-art/xxx_body.png          # 只看報告
npm run art:gate  -- --output public/elf-art/xxx_body.png          # 有門檻，不及格 exit 1
```

| 檢查 | 上限 | 為什麼 |
|---|---|---|
| 非白內容誤切率 | 2% | 墜星實測 4.85% 就是不及格 |
| 貼邊像素偏白率 | 30% | 白邊未清，深底會有一圈描邊 |
| alpha=255 佔比 | 99% | 超過就是根本沒去背 |
| 碎屑佔連通塊比 | 80% | 過多小於 200px 的孤島 |
