import assert from 'node:assert/strict';
import { runSideTimers } from '../src/blocks/runtime';
import { handleCanglanSoulMark } from '../src/effects/elves/canglan/registry';
import { EffectTiming } from '../src/effects/types';
import { calculateDamage } from '../src/utils/damageCalculator';

// 克塔亞特「非真實傷害減半 n 次」：每一次傷害都乘 0.5^n，而不是只減半 n 筆。
{
  const reg: Record<string, any> = { brinkkTrueDamageTakenCount: 3 };
  const timer = { id: 'cthyaat_half_damage', remaining: 3, payload: { block: { dmgOutMult: 0.5, kind: '非真實', powRegistryKey: 'brinkkTrueDamageTakenCount' } } };
  const ctx: any = { actor: 'p1', self: { id: 'a' }, p1Timers: [timer], getPlayerState: (k: string) => reg[k], addTimerTo: () => {}, addLog: () => {} };
  for (let i = 0; i < 4; i++) {
    const comp: any = { base: 800, multiplier: 1, increasePercent: 0, decreasePercent: 0, damageCategory: 'fixed', isIncoming: false };
    runSideTimers(ctx, ['outgoing'], { damageComp: comp });
    assert.equal(comp.multiplier, 0.125, `第 ${i + 1} 筆仍減半 3 次`);
  }
  reg.brinkkTrueDamageTakenCount = 4;
  const comp: any = { base: 800, multiplier: 1, increasePercent: 0, decreasePercent: 0, damageCategory: 'percent', isIncoming: false };
  runSideTimers(ctx, ['outgoing'], { damageComp: comp });
  assert.equal(comp.multiplier, 0.0625, '真傷次數增加後即時多減半一次');
}

// 滄嵐：雙方每 100 點護盾，每次受到固定／百分比傷害額外減半一次；上限為雙方護盾總和 1/3。
{
  const reg: Record<string, any> = {};
  const self: any = { id: 'c', battleId: 'c', name: '怒濤·滄嵐', shield: 250, statStages: {} };
  const target: any = { id: 't', battleId: 't', shield: 100 };
  const ctx: any = {
    actor: 'p1', self, target, activeP1: self, activeP2: target,
    getPlayerState: (k: string) => reg[k], setPlayerState: (k: string, v: any) => { reg[k] = v; },
    addLog: () => {}, applyHeal: () => {}, getMarks: () => [], setMark: () => {}, getStatuses: () => ({}), updateElf: () => {}, applyPinkDamage: () => 0,
  };
  handleCanglanSoulMark(ctx, EffectTiming.ROUND_START);
  for (const cat of ['fixed', 'percent']) {
    const comp: any = { base: 900, multiplier: 1, damageCategory: cat, isIncoming: true };
    handleCanglanSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, comp);
    assert.equal(comp.multiplier, 0.125, `${cat}：350 點護盾 → 減半 3 次`);
    assert.equal(comp.limit, 116);
  }
  const skill: any = { base: 900, multiplier: 1, damageCategory: 'skill_attack', isIncoming: true };
  handleCanglanSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, skill);
  assert.equal(skill.multiplier, 0.5, '技能傷害只吃「受到技能傷害減半」');
  handleCanglanSoulMark(ctx, EffectTiming.ROUND_END);
  handleCanglanSoulMark(ctx, EffectTiming.ROUND_END);
  const late: any = { base: 900, multiplier: 1, damageCategory: 'fixed', isIncoming: true };
  handleCanglanSoulMark(ctx, EffectTiming.BEFORE_DAMAGE, late);
  assert.equal(late.multiplier, 1, '直到下回合結束後失效');
}

// 雷伊：雷神／電氣纏繞是傷害公式裡的能力值，不是增減傷倍率。
{
  const mk = (name: string, atk: number, def: number): any => ({ id: name, name, type: '普通', level: 100, currentHp: 500, maxHp: 1000,
    calculatedStats: { hp: 1000, atk, spatk: atk, def, spdef: def, speed: 100 }, statStages: { atk: 2, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }, skills: [] });
  const skill: any = { name: 't', type: '普通', category: '物理', power: 100, accuracy: 100 };
  const run = (p1Reg: any, p2Reg: any) => calculateDamage(mk('a', 300, 200), mk('b', 300, 200), skill, 'p1', undefined, undefined, 1, false, [], [], undefined, undefined, undefined, p1Reg, p2Reg).damage;
  const plain = run({}, {});
  const atkUp = run({ calcAtkDefMult: 1.5 }, {});
  const defUp = run({}, { calcAtkDefMult: 1.5 });
  const panel = run({}, { opponentAtkPanelRatio: 0.7 });
  assert.ok(atkUp > plain && defUp < plain, '雙攻／雙防倍率進入能力值');
  // 面板 70% 且忽略攻擊方 +2 能力等級：公式 (42*atk*power/def)/50+2
  const expectedPanel = Math.floor(((42 * 300 * 0.7 * 100 / 200) / 50 + 2) * 1.5); // 本系 1.5
  assert.ok(Math.abs(panel - expectedPanel) <= 1, `對手最終攻擊＝面板×0.7（實際 ${panel}，預期約 ${expectedPanel}）`);
}

console.log('重複減半：克塔亞特 0.5^n 每筆套用、滄嵐每 100 護盾減半與 1/3 上限通過。');
