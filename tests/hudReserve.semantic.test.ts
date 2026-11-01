// HUD 狀態晶片再多也不縮小立繪：保留高度只由卡片底緣與固定預留決定；晶片區有最大高度並在區內捲動。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hudFieldReserve, hudTrayReserve, stageHeight, HUD_TRAY_MIN_PX, HUD_TRAY_MAX_PX } from '../src/battle/hudReserve';

// 預留值在上下限內，隨場地高度單調不減
let prev = 0;
for (const h of [0, 100, 200, 300, 430, 600, 900, 2000, NaN]) {
  const r = hudTrayReserve(h);
  assert.ok(r >= HUD_TRAY_MIN_PX && r <= HUD_TRAY_MAX_PX, `預留 ${r}@${h}`);
  if (Number.isFinite(h)) { assert.ok(r >= prev); prev = r; }
}

// 立繪舞台高度與晶片數量無關：chipCount 不是任何函式的輸入，量測值也只取卡片底緣。
for (const fieldH of [260, 430, 700]) {
  const cardBottom = 150; // 場地頂端到頭像卡片底緣
  const stage = (_chips: number) => stageHeight(fieldH, hudFieldReserve(cardBottom, fieldH));
  const heights = [0, 1, 5, 20, 80, 400].map(stage);
  assert.ok(heights.every(h => h === heights[0]), `${fieldH}：晶片 0..400 個舞台高度不變 ${heights}`);
  assert.ok(heights[0] >= 120, '舞台高度保底');
}
assert.equal(hudFieldReserve(150, 430), Math.ceil(150 + 8 + hudTrayReserve(430)));

// 畫面接線：量測只取 [data-hud] 卡片、晶片區以同一預留值當最大高度並可捲動
const ui = readFileSync('src/components/BattleScreen.ui.tsx', 'utf8');
assert.match(ui, /querySelector\('\[data-hud\]'\)\?\.getBoundingClientRect\(\)\.bottom/, '只量卡片底緣');
assert.match(ui, /hudFieldReserve\(Math\.max\(\.\.\.bottoms\) - top, el\.clientHeight\)/);
assert.match(ui, /data-status-tray=\{side\} style=\{\{ maxHeight: hudTrayReserve\(fieldSize\.h\) \}\}/, '晶片區最大高度＝預留值');
assert.match(ui, /overflow-y-auto[^`]*custom-scrollbar[^`]*`\} data-status-tray/, '晶片區內部捲動');
assert.match(ui, /stageHeight\(fieldSize\.h, fieldReserve\)/, '舞台高度只吃保留值');
console.log('HUD 保留高度：晶片數量不影響立繪舞台高度，晶片區有上限並可捲動。');
