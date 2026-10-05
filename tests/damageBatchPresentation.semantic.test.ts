import assert from 'node:assert/strict';
import { BattlePresentation, type PresentationEvent } from '../src/battle/presentation';
const frames: any[][] = [];
const player = new BattlePresentation(() => { if (player.popups.length) frames.push(structuredClone(player.popups)); }, () => true);
const e = (side: 'p1' | 'p2', type: PresentationEvent['type'], delta: number, before: number, label?: string): PresentationEvent => ({
  side, elfId: side, type, amount: Math.abs(delta), delta, before, after: before + delta, maxHp: 1000, label, alive: true,
});
await player.record(e('p1', 'percent', -300, 1000, '吸取'));
await player.record(e('p1', 'true', -100, 700, '汲取'));
await player.record(e('p2', 'heal', 300, 500));
assert.equal(frames.length, 0);
await player.flush();
assert.equal(frames.length, 1, '同收尾節點只通知一個同步動畫frame，不讓白字搶先或逐筆等待');
assert.deepEqual(frames[0].map(p => p.type), ['fixed', 'heal', 'true']);
assert.ok(frames[0].every(p => !/吸取|汲取/.test(p.label ?? '')));
assert.equal(player.hp.get('p1:p1'), 600);
assert.equal(player.hp.get('p2:p2'), 800);
const count = frames.length;
await player.flush(); assert.equal(frames.length, count, '不重播');
await player.record(e('p1', 'skill', -50, 600, '5連擊'));
assert.equal(frames.at(-1)?.[0].label, '5連擊');
assert.equal(frames.at(-1)?.length, 1, '連擊不拆多段演出');
player.beginExtra();
await player.record(e('p1', 'skill', -20, 550));
await player.endExtra();
assert.equal(frames.at(-1)?.[0].channel, 'extra', '額外行動在獨立演出節點，不冒充連擊');
assert.equal(frames.at(-1)?.[0].label, '額外行動');
player.dispose();
console.log('同節點粉／綠／白同步、分類／標籤、連擊與額外行動演出區分通過。');
