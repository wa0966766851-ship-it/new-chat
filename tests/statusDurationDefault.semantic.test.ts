import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceStatusEffect} from '../src/battle/statusLifecycle';
import {mergeRoundEnd} from '../src/battle/roundEndMerge';
import {mergeSameStatus} from '../src/battle/statusLifecycle';

// 2026-10-28 使用者回報：沒有星贖時異常回合數仍不會減少。
// 根因在回合結束的合併：只要回合結束期間有人重建 effects 陣列（新物件、內容相同），
// 扣減結果就會被丟棄、回合數回到原值。

const run = (effect: any, statuses: Record<string, number> = {}, max = 10) => {
  let e = effect; const steps: number[] = [];
  for (let i = 0; i < max; i++) {
    const r = advanceStatusEffect(e, statuses, () => 0.5);
    if (r.ended) return { steps, ended: true, transformed: (r as any).transformed };
    e = r.next; steps.push(e.duration);
  }
  return { steps, ended: false };
};

test('3 回合異常：扣減 2→1→結束', () => {
  const r = run({ id: '麻痺', name: '麻痺', duration: 3, isLateMover: false, stacks: 1 });
  assert.deepEqual(r.steps, [2, 1]);
  assert.equal(r.ended, true);
});

test('回合結束合併：重建 effects 陣列不得讓回合數復原', () => {
  const mid = { id: '麻痺', duration: 3 };
  const ticked = [{ id: '麻痺', duration: 2 }];
  const rebuilt = [{ ...mid }];
  assert.deepEqual(mergeRoundEnd([mid], ticked, rebuilt), [{ id: '麻痺', duration: 2 }]);
});

test('回合結束合併：真正被改過的回合數優先', () => {
  const mid = { id: '麻痺', duration: 3 };
  const ticked = [{ id: '麻痺', duration: 2 }];
  const changed = [{ id: '麻痺', duration: 5 }];
  assert.deepEqual(mergeRoundEnd([mid], ticked, changed), [{ id: '麻痺', duration: 5 }]);
});

test('星贖可以延長其他異常（含自己，屬正常設計）', () => {
  const r = run({ id: '星贖', name: '星贖', duration: 3, isLateMover: false, stacks: 1 }, { 星贖: 3 }, 5);
  assert.equal(r.ended, false, '星贖自我延長是設計行為');
  assert.deepEqual(r.steps, [3, 3, 3, 3, 3]);
});

test('BOSS_ONLY 不隨回合遞減', () => {
  const r = run({ id: '神話', name: '神話', duration: 3, isLateMover: false, stacks: 1 }, {}, 5);
  assert.equal(r.ended, false);
  assert.deepEqual(r.steps, [3, 3, 3, 3, 3]);
});

test('isLateMover 當回合不扣（延後一回合）', () => {
  const r = run({ id: '麻痺', name: '麻痺', duration: 3, isLateMover: true, stacks: 1 });
  assert.deepEqual(r.steps, [3, 2, 1]);
  assert.equal(r.ended, true);
});

test('轉化：冰封結束後轉為凍傷且給 3 回合', () => {
  const r = run({ id: '冰封', name: '冰封', duration: 1, isLateMover: false, stacks: 1 });
  assert.equal(r.ended, true);
  assert.equal((r.transformed as any).id, '凍傷');
  assert.equal((r.transformed as any).duration, 3);
});

console.log('異常回合數：倒數、合併不復原、星贖延長、BOSS 不扣、lateMover、轉化 全部通過');

test('同名合併：轉化帶明確回合數時以該回合數為準（不相加）', () => {
  const merged = mergeSameStatus([
    { id: '凍傷', duration: 2 },
    { id: '凍傷', duration: 3, durationFixed: true } as any,
  ]);
  assert.equal(merged.length, 1);
  assert.equal((merged[0] as any).duration, 3, '應為 3，不是 2+3=5');
});

test('同名合併：一般情況仍相加', () => {
  const merged = mergeSameStatus([{ id: '中毒', duration: 2 }, { id: '中毒', duration: 3 }]);
  assert.equal((merged[0] as any).duration, 5);
});