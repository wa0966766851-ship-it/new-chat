// 立繪舞台高度只取決於頭像卡片底緣；狀態晶片區是浮層（蓋在場地頂端、區內捲動），不佔立繪高度。
// 2026-11-01 回歸：前一版固定預留 48–104px 給晶片區，晶片再少立繪也被整體縮小；本測試鎖定「預留＝卡片底緣＋間距」。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hudFieldReserve, hudTrayMaxHeight, stageHeight, HUD_TRAY_MIN_PX, HUD_TRAY_MAX_PX, HUD_RESERVE_GAP_PX } from '../src/battle/hudReserve';

// 晶片區最大高度在上下限內，隨場地高度單調不減；桌面可顯示約 4 列（>=4×32px）
let prev = 0;
for (const h of [0, 100, 200, 300, 430, 600, 900, 2000, NaN]) {
  const r = hudTrayMaxHeight(h);
  assert.ok(r >= HUD_TRAY_MIN_PX && r <= HUD_TRAY_MAX_PX, `晶片區最大高度 ${r}@${h}`);
  if (Number.isFinite(h)) { assert.ok(r >= prev); prev = r; }
}
assert.ok(hudTrayMaxHeight(700) >= 4 * 32, '桌面場地至少約 4 列後才捲動');
assert.ok(hudTrayMaxHeight(300) <= 300 * 0.5, '矮場地（手機橫向）晶片區不得吞掉半個場地');

// 預留只由卡片底緣決定：不吃場地高度、不吃晶片區最大高度、不吃晶片數量。
for (const fieldH of [260, 430, 700, 1000]) {
  const cardBottom = 150;
  assert.equal(hudFieldReserve(cardBottom), cardBottom + HUD_RESERVE_GAP_PX, '預留＝卡片底緣＋間距，沒有固定的晶片區預留');
  const heights = [0, 1, 5, 20, 80, 400].map(() => stageHeight(fieldH, hudFieldReserve(cardBottom)));
  assert.ok(heights.every(h => h === heights[0]), `${fieldH}：晶片 0..400 個舞台高度不變 ${heights}`);
  assert.equal(heights[0], Math.max(120, fieldH - cardBottom - HUD_RESERVE_GAP_PX));
}
assert.equal(hudFieldReserve.length, 1, '預留函式只有「卡片底緣」一個輸入');
// 與前一版（固定預留 48–104）相比，同一場地立繪舞台至少多出 48px
for (const fieldH of [430, 700, 1000]) {
  const old = stageHeight(fieldH, Math.ceil(150 + 8 + Math.min(104, Math.max(48, Math.round(fieldH * 0.18)))));
  assert.ok(stageHeight(fieldH, hudFieldReserve(150)) - old >= 48, `${fieldH}：舞台高度回到不扣晶片區`);
}

// 畫面接線：量測只取 [data-hud] 卡片、晶片區用自己的最大高度並可捲動（浮層），舞台高度只吃保留值
const ui = readFileSync('src/components/BattleScreen.ui.tsx', 'utf8');
assert.match(ui, /querySelector\('\[data-hud\]'\)\?\.getBoundingClientRect\(\)\.bottom/, '只量卡片底緣');
assert.match(ui, /hudFieldReserve\(Math\.max\(\.\.\.bottoms\) - top\)/);
assert.match(ui, /data-status-tray=\{side\} style=\{\{ maxHeight: hudTrayMaxHeight\(fieldSize\.h\) \}\}/, '晶片區最大高度獨立於舞台');
assert.match(ui, /overflow-y-auto[^`]*custom-scrollbar[^`]*`\} data-status-tray/, '晶片區內部捲動');
assert.match(ui, /stageHeight\(fieldSize\.h, fieldReserve\)/, '舞台高度只吃保留值');
console.log('HUD 保留高度：舞台高度只吃卡片底緣；晶片區為浮層（約 4 列後捲動），不影響立繪大小。');
