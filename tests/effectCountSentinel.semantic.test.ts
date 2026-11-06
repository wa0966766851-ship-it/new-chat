// 9999 是「不限次數」的哨兵（如卡修斯「護盾每次消失時」計時器），不可顯示成「9999次」。
import assert from 'node:assert/strict';
import { effectCountText, isUnlimitedCount, UNLIMITED_COUNT_FLOOR, describeEffectMeta } from '../src/battle/effectViewModel';
import { activeEffectViews } from '../src/battle/activeEffectViews';

assert.equal(UNLIMITED_COUNT_FLOOR, 999);
for (const n of [999, 1000, 9999, 99999, Infinity]) assert.ok(isUnlimitedCount(n), `${n} 視為不限`);
for (const n of [0, 1, 3, 5, 998, undefined, NaN, '9999']) assert.ok(!isUnlimitedCount(n as any), `${String(n)} 是真實計數`);

assert.equal(effectCountText({ value: 9999, unit: '次' }), '', '9999次 → 不顯示計數');
assert.equal(effectCountText({ value: 999, unit: '回合' }), '', '999回合 → 不顯示計數');
assert.equal(effectCountText({ turns: 999 }), '');
assert.equal(effectCountText({ value: 3, unit: '次' }), '3次', '真實次數照常顯示');
assert.equal(effectCountText({ value: 2, unit: '回合' }), '2回合');
assert.equal(effectCountText({ value: 9999, unit: '次', layers: 2, maxLayers: 5 }), '2/5層', '不限次數仍可顯示層數');
assert.equal(effectCountText({ value: 5000, unit: '點' }), '5000點', '非次數／回合的數值（如護盾量）不受哨兵影響');
assert.equal(effectCountText({ value: 1500, unit: '層' }), '1500層');

// 實際走過 activeEffectViews（與戰鬥晶片同一條路）：9999 次的計時器沒有 countText 數字，tooltip 寫「不限」。
const elf: any = { id: '1', battleId: 'b1', name: '測試', currentHp: 1, maxHp: 1 };
const timer = (remaining: number) => ({ id: 't' + remaining, name: '護盾每次消失時', kind: 'use_counter', remaining, source: 'skill', scope: 'elf', ownerBattleId: 'b1', payload: {} }) as any;
const views = activeEffectViews(elf, [], [timer(9999), timer(3)], {}, '') as any[];
const unlimited = views.find(v => v.id === 'timer:t9999'), normal = views.find(v => v.id === 'timer:t3');
assert.ok(unlimited && normal, '兩個計時器都產生晶片');
assert.ok(!/9999/.test(unlimited.countText ?? ''), `晶片計數不含 9999：${unlimited.countText}`);
assert.equal(unlimited.countText, '');
assert.equal(normal.countText, '3次');
assert.match(describeEffectMeta(unlimited), /不限/, 'tooltip 說明不限');
assert.ok(!/9999/.test(describeEffectMeta(unlimited)));
console.log('不限次數哨兵：9999／999 不顯示為計數，真實計數與非次數數值不受影響。');
