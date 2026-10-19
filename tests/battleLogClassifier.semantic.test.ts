// 對戰資訊欄詳略分級（DSH 20261019）：分類器純函數 + 顯示端三模式。
import assert from 'node:assert/strict';
import { classifyLog, filterByMode, mergeExtraActions, toTraditional, scribeMainAction, turnDigests, filterByElf, filterByQuery, damageTone, extractAmount, elfNamesIn } from '../src/battle/logClassifier';

// ── 純函數 ──
assert.equal(classifyLog('【皮卡丘】使用了【十萬伏特】！', 'p1'), 'main');
assert.equal(classifyLog('【A】替換精靈！', 'p1'), 'main');
assert.equal(classifyLog('⚡ 造成 250 點傷害！', 'damage'), 'damage');
assert.equal(classifyLog('✨ 附加燒傷狀態', 'effect'), 'detail');
assert.equal(scribeMainAction('【甲】使用了【乙】！'), '【甲】使用了【乙】');
assert.equal(scribeMainAction('非主行'), null);

// ── 三模式過濾 ──
const logs = [
  { text: '【甲】使用了【斬擊】！', type: 'p1', turn: 1 },
  { text: '造成 100 傷害', type: 'damage', turn: 1 },
  { text: '✨ 攻擊力提升', type: 'effect', turn: 1 },
  { text: '⚡ 【額外行動】斬擊', type: 'effect', turn: 1 },
  { text: '【乙】擊敗了【丙】', type: 'defeat', turn: 1 },
];
const brief = filterByMode(logs, 'brief');
assert.ok(brief.length >= 1 && brief.every(l => classifyLog(l.text, l.type) === 'main'), '簡潔模式只留主行動');
const dmg = filterByMode(logs, 'damage');
assert.ok(dmg.some(l => classifyLog(l.text, l.type) === 'damage'), '傷害模式含傷害行');
assert.ok(dmg.some(l => l.type === 'defeat'), '擊敗行在傷害模式保留');
assert.equal(filterByMode(logs, 'full').length, logs.length, '完整模式全顯示');

// ── 額外行動合併 ──
const merged = mergeExtraActions([
  { text: '⚡ 【額外行動】斬擊', type: 'effect', turn: 1 },
  { text: '⚡ 【額外行動】斬擊', type: 'effect', turn: 1 },
  { text: '⚡ 【額外行動】連斬', type: 'effect', turn: 1 },
], '甲');
const extraLine = merged.find(l => l.text.includes('額外行動'));
assert.ok(extraLine, '合併後仍存在額外行動行');
assert.ok(/進行了 3 次額外行動/.test(extraLine!.text), '三次連續額外行動合併為一句計數');

// ── 簡體殘字修正 ──
assert.equal(toTraditional('攻击力提升'), '攻擊力提升');
assert.equal(toTraditional('毕當护'), '畢當護');

// ── 第二批：回合摘要／精靈過濾／量級分色／查詢（DSH 20261019）──
const round = [
  { turn: 2, text: '【甲】使用了【斬】！', type: 'p1' },
  { turn: 2, text: '造成 15000 點傷害', type: 'damage' },
  { turn: 2, text: '【甲】擊敗了【丙】！', type: 'defeat' },
  { turn: 2, text: '造成 5000 點傷害', type: 'damage' },
];
const dg = turnDigests(round).get(2)!
assert.equal(dg.totalDamage, 20000, '回合摘要：傷害合計');
assert.equal(dg.defeats, 1, '回合摘要：擊敗計數');

assert.equal(extractAmount('造成 25,000 點傷害'), 25000, '千分位數字抽取');
assert.ok(damageTone(150000)!.includes('amber'), '十萬級亮金');
assert.ok(damageTone(25000)!.includes('rose-300'), '兩萬級玫瑰');
assert.equal(damageTone(50), null, '小額不上色');

assert.equal(filterByElf(round, '甲').length, 2, '精靈過濾：只留含【甲】的主行動與擊敗行');
assert.equal(filterByElf(round, '丙').length, 1, '精靈過濾：丙只在擊敗行');
assert.equal(filterByElf(round, null).length, 4, '精靈過濾：null 不過濾');

assert.equal(filterByQuery(round, '擊敗').length, 1, '文字查詢');
assert.equal(filterByQuery(round, '2 傷害').length, 2, '回合+文字複合查詢');
assert.ok(elfNamesIn('【甲】使用了【斬擊】！').includes('甲'), '精靈名抽取');

console.log('對戰資訊欄詳略分級：分類器與三模式 ' + 5 + ' 組情境通過；進階四項（摘要/精靈/量級/查詢）9 組情境通過。');
