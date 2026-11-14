// 跳字分類（2026-11-07）：Miss／技能無效同一外觀；附加效果失效跟著同一筆傷害顯示（不另停一段），沒有傷害時於出手結束單獨顯示。
import assert from 'node:assert/strict';
import { BattlePresentation, type PresentationEvent } from '../src/battle/presentation';
import { noticeVariant, damagePopupStyle } from '../src/battle/damagePopupStyle';

assert.equal(noticeVariant('Miss-0'), 'evade');
assert.equal(noticeVariant('Miss-120'), 'evade');
assert.equal(noticeVariant('技能無效-0'), 'evade', '技能無效與 Miss 同一種外觀');
assert.equal(noticeVariant('附加效果失效'), 'addInvalid');
assert.equal(noticeVariant('其他提示'), 'notice');
assert.equal(damagePopupStyle('fixed').variant, 'pink');
assert.equal(damagePopupStyle('adjust_down').variant, 'pink');
assert.equal(damagePopupStyle('heal').variant, 'heal');
assert.equal(damagePopupStyle('true').variant, 'true');
assert.equal(damagePopupStyle('skill_attack').variant, 'skill');

const frames: any[][] = [];
const player = new BattlePresentation(() => { if (player.popups.length) frames.push(structuredClone(player.popups)); }, () => true);
const ev = (o: Partial<PresentationEvent>): PresentationEvent => ({ side: 'p2', elfId: 'p2', type: 'skill', amount: 0, delta: 0, before: 1000, after: 1000, maxHp: 1000, alive: true, ...o });

// 一、攻擊技能：附加效果失效先記下，跟著紅字一起出現，不單獨佔一個畫面。
player.setInAction(true);
await player.record(ev({ type: 'notice', text: '附加效果失效' }));
assert.equal(frames.length, 0, '附加效果失效不先單獨播放');
await player.record(ev({ type: 'skill', amount: 300, delta: -300, after: 700 }));
assert.equal(frames.length, 1);
assert.equal(frames[0][0].type, 'skill');
assert.deepEqual(frames[0][0].tags, ['附加效果失效'], '標籤附在同一筆紅字');
player.setInAction(false);
await player.wait();
assert.equal(frames.length, 1, '已附著的標籤不重播');

// 二、屬性技能（沒有傷害）：出手結束時單獨顯示一次。
player.setInAction(true);
await player.record(ev({ type: 'notice', text: '附加效果失效' }));
player.setInAction(false);
await player.wait();
assert.equal(frames.length, 2);
assert.equal(frames[1][0].type, 'notice');
assert.equal(frames[1][0].noticeKind, 'addInvalid');

// 三、Miss／技能無效：照常即時播放，分類為 evade。
player.setInAction(true);
await player.record(ev({ type: 'notice', text: '技能無效-0' }));
await player.record(ev({ type: 'notice', text: 'Miss-0' }));
assert.deepEqual(frames.slice(2).map(f => f[0].noticeKind), ['evade', 'evade']);
player.setInAction(false);
player.dispose();
console.log('跳字分類：Miss／技能無效統一、附加效果失效附著 通過');
