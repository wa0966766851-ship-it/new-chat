import assert from 'node:assert/strict';
import test from 'node:test';
import {StatusRegistry} from '../src/effects/statusRegistry';
import {computeHitChance} from '../src/effects/genericSkillText';

// 2026-10-29：狀態 mechanic 參數的引擎讀取端。
// 原本 accuracyMultiplier / missChance / transformOnFire / healSource 只寫在 statusRegistry，
// 引擎完全沒有讀取端，導致失明、易燃只有圖示沒有實際效果。

const makeElf = (statuses: Record<string, number>) => ({
  id: 'test', name: '測試', skills: [], effects: [], statStages: {},
  __statuses: statuses,
});
const getStatuses = (e: any) => e.__statuses || {};

test('黯痕已完全移出 statusRegistry', () => {
  assert.equal(StatusRegistry['黯痕'], undefined, '黯痕應為印記，不是異常狀態');
});

test('失明有 missChance 參數', () => {
  const p = StatusRegistry['失明']?.mechanics?.find(m => m.type === 'SPECIAL_BUFF')?.params;
  assert.equal(p?.missChance, 0.5);
});

test('易燃有 transformOnFire 參數', () => {
  const p = StatusRegistry['易燃']?.mechanics?.find(m => m.type === 'SPECIAL_BUFF')?.params;
  assert.equal(p?.transformOnFire, '燒傷');
});

test('寄生有 healSource（吸血）', () => {
  const p = StatusRegistry['寄生']?.mechanics?.find(m => m.type === 'DAMAGE_TICK')?.params;
  assert.equal(p?.healSource, true);
});

test('失明會降低命中率（missChance 生效）', () => {
  const skill = { name: '測試攻擊', category: '攻擊', accuracy: 100 };
  const actor = makeElf({});
  const actorBlind = makeElf({ 失明: 3 });
  const target = makeElf({});
  const normal = computeHitChance(actor, target, skill, getStatuses);
  const blinded = computeHitChance(actorBlind, target, skill, getStatuses);
  assert.equal(normal, 1, '無失明時命中率 100%');
  assert.ok(blinded < normal, `失明應降低命中率（${blinded} < ${normal}）`);
});

test('易燃會降低命中率（accuracyMultiplier 生效）', () => {
  const skill = { name: '測試攻擊', category: '攻擊', accuracy: 100 };
  const actor = makeElf({});
  const actorFlammable = makeElf({ 易燃: 3 });
  const target = makeElf({});
  const normal = computeHitChance(actor, target, skill, getStatuses);
  const flam = computeHitChance(actorFlammable, target, skill, getStatuses);
  assert.ok(flam < normal, `易燃應降低命中率（${flam} < ${normal}）`);
});

console.log('狀態 mechanic 讀取端：黯痕移除、失明/易燃命中率、寄生吸血 全部通過');
