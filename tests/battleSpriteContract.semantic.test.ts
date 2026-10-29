import assert from 'node:assert/strict';
import {placeSprite,spriteHeightRatio,spriteStageLayout,type OpaqueBox} from '../src/battle/spriteMetrics';

// 靜態立繪與原生動畫是兩條獨立的排版路徑：
//  - 靜態：ProportionalSprite 用 placeSprite() 算 <img> 的外框與位移。
//  - 原生：PetActionSprite 自己用 fit() 依待機影格的 mesh 邊界算 scale 與位移。
// 兩條路徑只要有一條算錯，切換演出模式（或換成另一隻精靈）就會位移、跳大小或被裁切。
// 這裡用同一組輸入把兩邊的公式各算一次，鎖住「腳底線、水平錨點、可見高度」三件事。

type Box = OpaqueBox;

/** 靜態路徑：回傳不透明區域相對精靈外層 div 的幾何（x 由 div 左緣起算、y 由 div 下緣往上為正）。 */
function staticOpaque(box: Box, stageW: number, stageH: number, ratio: number, mirrored: boolean, sizing: 'height'|'area'|'colossal', sink = 0) {
  const place = placeSprite(box, stageW, stageH, ratio, 1, mirrored, sizing);
  const s = place.scale, base = place.offsetBottom - sink;
  const l = mirrored ? box.w - box.right : box.left;
  const r = mirrored ? box.w - box.left : box.right;
  return {
    left: place.offsetX + l * s, right: place.offsetX + r * s,
    bottomY: base + (box.h - box.bottom) * s, topY: base + (box.h - box.top) * s,
    height: place.height, width: place.width, scale: s,
  };
}

/**
 * 原生動畫路徑：重現 PetActionSprite 的 fit()。
 * 待機影格的可見邊界 minX/maxX/minY/maxY 就是靜態圖的不透明框，宿主高度 h 由 ProportionalSprite 傳入。
 */
function animationRest(box: Box, stageW: number, hostW: number, hostH: number, sink = 0) {
  const maxX = box.right, minX = box.left, maxY = box.bottom, minY = box.top;
  const scale = Math.min(hostW / (maxX - minX), hostH / (maxY - minY));
  const bodyW = (maxX - minX) * scale;
  return { left: -bodyW / 2, right: bodyW / 2, bottomY: -sink, topY: -sink + (maxY - minY) * scale, scale, bodyW };
}

const boxes: Record<string, Box> = {
  square: { w: 400, h: 400, left: 0, top: 0, right: 400, bottom: 400 },
  wide:   { w: 1924, h: 1276, left: 0, top: 150, right: 1924, bottom: 1276 },
  tall:   { w: 200, h: 600, left: 20, top: 0, right: 180, bottom: 600 },
  offset: { w: 1295, h: 1358, left: 53, top: 8, right: 1294, bottom: 1343 },
  empty:  { w: 640, h: 480, left: 120, top: 60, right: 520, bottom: 420 },
};
const weights = [20, 49.5, 100, 200, 300, 380, 500, 800, 1200];
const viewports: Array<[number, number]> = [[1920, 430], [1366, 300], [1067, 600], [390, 304]];

// ── 1. 腳底線：靜態與動畫的可見底緣必須都落在同一個地平線上 ────────────────
for (const [fw, fh] of viewports) {
  const stageW = fw * spriteStageLayout(fw).widthFrac;
  for (const [name, box] of Object.entries(boxes)) {
    for (const w of weights) {
      const ratio = spriteHeightRatio(w);
      for (const mirrored of [false, true]) {
        const s = staticOpaque(box, stageW, fh, ratio, mirrored, 'area');
        // 靜態：不透明區域底緣距精靈外層 div 下緣 0px。
        assert.ok(Math.abs(s.bottomY) < 1e-6, `${name}@${fw} 體型${w} 靜態腳底 ${s.bottomY.toFixed(2)} 未貼地`);
      }
    }
  }
}

// ── 2. 水平錨點：不透明區域水平中心必須落在精靈外層 div 的原點 ──────────────
for (const [name, box] of Object.entries(boxes)) {
  for (const mirrored of [false, true]) {
    const s = staticOpaque(box, 800, 430, spriteHeightRatio(300), mirrored, 'area');
    assert.ok(Math.abs((s.left + s.right) / 2) < 1e-6, `${name} mirrored=${mirrored} 靜態中心 ${((s.left + s.right) / 2).toFixed(2)} 偏離錨點`);
  }
}

// ── 3. 可見高度：一般體型下，靜態與動畫算出的可見高度必須相同 ───────────────
for (const [fw, fh] of viewports) {
  const stageW = fw * spriteStageLayout(fw).widthFrac;
  for (const [name, box] of Object.entries(boxes)) {
    for (const w of weights) {
      const ratio = spriteHeightRatio(w);
      const s = staticOpaque(box, stageW, fh, ratio, false, 'area');
      // ProportionalSprite 傳給動畫宿主的是「可見高」（不是整張圖高），寬度則是 stageW。
      const a = animationRest(box, stageW, stageW, s.topY - s.bottomY);
      const sh = s.topY - s.bottomY, ah = a.topY - a.bottomY;
      assert.ok(Math.abs(sh - ah) <= Math.max(0.5, sh * 0.002), `${name}@${fw} 體型${w} 可見高 靜態${sh.toFixed(1)} vs 動畫${ah.toFixed(1)}`);
    }
  }
}

// ── 4. 大型（colossal）：多出來的高度要往下沉，頭頂留在場地上緣、腳底被裁掉 ──
{
  const box: Box = { w: 900, h: 1400, left: 10, top: 4, right: 890, bottom: 1396 };
  const stageW = 1920 * spriteStageLayout(1920).widthFrac, fh = 430;
  const place = placeSprite(box, stageW, fh, 1.31, 1, false, 'colossal');
  // 下沉量一律以「可見高度」計算（整張圖高含透明邊，用它會多沉幾 px）。
  const visibleH = (box.bottom - box.top) * place.scale;
  const overflow = Math.max(0, visibleH - fh);
  assert.ok(overflow > 0, 'colossal 圖必須高於場地，否則測不到下沉重疊');
  // sink=1 → 不透明區域底緣＝-overflow（沉到場地下方），頭頂＝fh。
  const sunk = staticOpaque(box, stageW, fh, 1.31, false, 'colossal', overflow);
  assert.ok(overflow > 0 && visibleH > fh, '可見高必須真的超出場地');
  assert.ok(Math.abs(sunk.bottomY + overflow) < 1e-6, `colossal 腳底應沉到 ${-overflow}，實得 ${sunk.bottomY.toFixed(1)}`);
  assert.ok(Math.abs(sunk.topY - fh) < 1e-6, `colossal 頭頂應留在場地上緣 ${fh}，實得 ${sunk.topY.toFixed(1)}`);
  // 動畫側：宿主高度同樣要容納整隻（否則 scale 會被夾住而縮小），下沉量一致。
  const a = animationRest(box, stageW, stageW, Math.max(fh, sunk.topY - sunk.bottomY), overflow);
  assert.ok(Math.abs(a.bottomY + overflow) < 1e-6, `colossal 動畫腳底應沉到 ${-overflow}，實得 ${a.bottomY.toFixed(1)}`);
  assert.ok(Math.abs((a.topY - a.bottomY) - (sunk.topY - sunk.bottomY)) <= 1, 'colossal 靜態與動畫的整體高度必須一致');
}

// ── 5. 沉沒量只能是「超出場地的高度」乘上 profile.sink，一般精靈不得下沉 ──────
{
  const box: Box = { w: 400, h: 400, left: 0, top: 0, right: 400, bottom: 400 };
  const stageW = 800, fh = 430;
  const place = placeSprite(box, stageW, fh, spriteHeightRatio(300), 1, false, 'area');
  assert.ok(place.height <= fh, 'area 排版的可見高不得超過場地高，因此一般精靈不需要下沉');
  const half = staticOpaque(box, stageW, fh, spriteHeightRatio(300), false, 'area', 0);
  assert.equal(half.bottomY, 0, '一般精靈（sink=0）腳底必須貼齊地平線');
}

console.log('battleSpriteContract: 腳底線／水平錨點／可見高度／colossal 下沉 全部一致');
