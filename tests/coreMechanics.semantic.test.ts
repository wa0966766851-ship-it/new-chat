import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { matchAct, parseSoulMark } from '../src/blocks/parse';
import { runAct, runSoulProgram } from '../src/blocks/runtime';
import { queueSkillLifesteal } from '../src/battle/lifesteal';
import { normalizeDamageType, settleDamageAbsorption } from '../src/battle/damageSemantics';
import { queueHpDrain } from '../src/battle/hpDrain';
import { damagePopupStyle, damagePopupLabel } from '../src/battle/damagePopupStyle';
import { opeiaTemporaryStats } from '../src/effects/elves/opeia/registry';
import { settlementReceipt } from '../src/battle/settlementReceipt';

let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks++; console.log(`✓ ${name}`); };
check('結算回饋分開名目值、盾罩、HP差與恢復上限，不冒稱實際扣血', () => {
  const receipt = settlementReceipt({ operation: 'damage', targetBattleId: 'a', requestedAmount: 300, settledAmount: 600,
    hpBefore: 100, hpAfter: 1, barrierAbsorbed: 200, resistedFatal: true });
  assert.equal(receipt.hpLost, 99); assert.equal(receipt.settledAmount, 600); assert.equal(receipt.barrierAbsorbed, 200);
  assert.equal(receipt.resistedFatal, true); assert.ok(Object.isFrozen(receipt));
  const heal = settlementReceipt({ operation: 'heal', targetBattleId: 'a', requestedAmount: 300, settledAmount: 300,
    hpBefore: 900, hpAfter: 1000 });
  assert.equal(heal.hpGained, 100); assert.equal(heal.requestedAmount, 300);
});
check('六維總和作為每一維加成，不平均、不逐項乘百分比', () => {
  const original = { hp: 300, atk: 100, def: 200, spatk: 100, spdef: 150, speed: 150 };
  const result = opeiaTemporaryStats(original, 2);
  assert.equal(result.bonus, 200);
  assert.deepEqual(result.stats, { hp: 500, atk: 300, def: 400, spatk: 300, spdef: 350, speed: 350 });
  assert.equal(original.hp, 300);
});
for (const side of ['p1', 'p2'] as const) {
  const targetSide = side === 'p1' ? 'p2' : 'p1';
  check(`${side}自身存活與對手手下留情分流，真正寫回1HP`, () => {
    assert.equal(matchAct('保留1點體力')?.op, 'survive');
    assert.equal(matchAct('自身保留1點體力')?.op, 'survive');
    assert.equal(matchAct('對手保留1點體力')?.op, 'mercy');
    const self: any = { id: 'self', name: 'self', currentHp: 500, maxHp: 500 };
    const state: any = {};
    const ctx: any = { actor: side, self, skill: {}, getPlayerState: (k: string) => state[k],
      setPlayerState: (k: string, v: any) => state[k] = v, addLog: () => {},
      updateElf: (s: string, p: any) => { assert.equal(s, side); Object.assign(self, p); } };
    assert.equal(runSoulProgram(ctx, parseSoulMark('存活', '自身首次受到致命傷害時：\n> 保留1點體力'), ['fatal'], {}), true);
    assert.equal(self.currentHp, 1);
    assert.equal(state.mercyThisAction, undefined);
    assert.equal(runSoulProgram(ctx, parseSoulMark('存活', '自身首次受到致命傷害時：\n> 保留1點體力'), ['fatal'], {}), false, '首次只能觸發一次');
  });
  check(`${side}攻擊等量恢復不涵蓋額外行動，也不限制為實際扣血`, () => {
    const registry: any = {}, heals: any[] = [];
    const ctx: any = { setPlayerState: (k: string, v: any) => registry[k] = v };
    runAct(ctx, { op: 'heal_equal', p: {}, label: '' }, { last: null, lastAmount: 0, prevOp: 'boost' });
    assert.equal(queueSkillLifesteal(side, 300, 'skill_attack', registry, e => heals.push(e)), 300);
    assert.equal(queueSkillLifesteal(side, 300, 'skill_extra_action', registry, e => heals.push(e)), 0);
    assert.equal(queueSkillLifesteal(side, 300, 'skill_attribute', registry, e => heals.push(e)), 0);
    assert.equal(heals[0].data.amount, 300, '沒有使用對手剩餘HP縮減');
  });
  for (const [text, type, amount] of [
    ['吸取對手300點體力', 'fixed', 300], ['吸取對手最大體力1/2', 'percent', 500],
    ['汲取對手300點體力', 'true', 300], ['汲取對手最大體力1/2', 'true', 500],
  ] as const) check(`${side}/${text}分類與等量恢復`, () => {
    const calls: any[] = [];
    const ctx: any = { actor: side, targetSide, target: { maxHp: 1000, currentHp: 10 },
      applyPinkDamage: (s: string, a: number, _l: any, _p1: any, _p2: any, t: string) => { calls.push({ s, a, t }); return a; },
      applyTrueDamage: (s: string, a: number) => { calls.push({ s, a, t: 'true' }); return a; },
      applyHeal: (s: string, a: number) => calls.push({ s, a, heal: true }) };
    const state: any = { last: null, lastAmount: 0 };
    assert.equal(runAct(ctx, matchAct(text)!, state), true);
    assert.deepEqual(calls, [{ s: targetSide, a: amount, t: type }, { s: side, a: amount, heal: true }]);
    assert.equal(state.lastAmount, amount);
    assert.equal(queueHpDrain(ctx, targetSide, NaN, type), 0);
  });
}
check('中文分類正規化；文字標籤不改類型／顏色；體力淨減少粉色', () => {
  assert.equal(normalizeDamageType({ damageType: 'percent', label: '汲取字樣不能改分類' }), 'percent');
  assert.equal(normalizeDamageType({ damageType: '百分比傷害' }), 'percent');
  assert.equal(damagePopupStyle('skill_attack').colorClass, 'text-red-500');
  assert.equal(damagePopupStyle('fixed').colorClass, 'text-pink-400');
  assert.equal(damagePopupStyle('percent').colorClass, 'text-pink-400');
  assert.equal(damagePopupStyle('adjust_down').colorClass, 'text-pink-400');
  assert.equal(damagePopupStyle('true').colorClass, 'text-white');
  assert.equal(damagePopupLabel('深潛者盛宴·吸取'), undefined);
  assert.equal(damagePopupLabel('汲取'), undefined);
  assert.equal(damagePopupLabel('6連擊'), '6連擊');
});

const vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const { buildDamageAPIs } = await vite.ssrLoadModule('/src/battle/contextBuilders.ts');
  for (const side of ['p1', 'p2'] as const) {
    const targetSide = side === 'p1' ? 'p2' : 'p1';
    const elf = (id: string): any => ({ id, battleId: id, name: id, type: '普通', maxHp: 1000, currentHp: 10 });
    const state: any = { p1: elf('a'), p2: elf('b'), p1Marks: [], p2Marks: [], p1Timers: [], p2Timers: [], p1RegistryState: {}, p2RegistryState: {} };
    const events: any[] = [];
    const api = buildDamageAPIs({ side, self: state[side], syncStateRef: { current: state }, pushEffect: (e: any) => events.push(e), getBattleEventContext: () => ({}) });
    check(`${side}真實傷害管線：吸取走護罩、汲取穿盾罩`, () => {
      for (const type of ['fixed', 'percent', 'true'] as const) {
        events.length = 0;
        queueHpDrain({ ...api, actor: side }, targetSide, 300, type);
        const damage = events.find(e => e.type === 'damage');
        assert.equal(damage.data.damageType, type);
        const result = settleDamageAbsorption(damage.data.amount, type, 100, 200);
        assert.equal(result.amount, type === 'true' ? 300 : 100);
        assert.equal(result.shield, 100);
        assert.equal(result.barrier, type === 'true' ? 200 : 0);
        assert.equal(events.find(e => e.type === 'heal').data.amount, 300);
      }
    });
  }
} finally { await vite.close(); }
console.log(`共同機制 ${checks} 項通過。`);
