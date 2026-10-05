import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { reductionPolicy, addDamageReduction, multiplyDamageReduction, applyStatusDamageModifiers, applyMarkDamageReductions, applyThresholdDamageReductions, finalizeDamageReductions } from '../src/battle/damageReduction';
import { ATOMS } from '../src/effects/effectRunner';
import { applyOutgoingSkillRestriction, applyAdvancedDamageModifiers } from '../src/battle/advancedDamageModifiers';
import { recordDamageHpCeilings, capCurrentHp } from '../src/battle/hpCeiling';
import { applyActiveGateTimersToDamage } from '../src/battle/damageGates';
import { handleCanglanSoulMark } from '../src/effects/canglanRegistry';
import { handleMarsSoulMark } from '../src/effects/marsRegistry';
import { handleDimensionalSoulMark } from '../src/effects/dimensionalDragonRegistry';
import { handleKeerhodeSoulMark } from '../src/effects/keerhodeRegistry';
import { handleKeldSoulMark } from '../src/effects/keldRegistry';
import { EffectTiming } from '../src/effects/types';
import { runDixinFormation } from '../src/effects/dixinFormation';
import { runSideTimers } from '../src/blocks/runtime';
import { settlementReceipt } from '../src/battle/settlementReceipt';
import { createSkillStone, toSSStone } from '../src/data/skillStones';

let checks = 0;
const check = (label: string, fn: () => void) => { fn(); checks++; };
const kinds = ['skill_attack', 'skill_attribute', 'skill_extra_action', 'skill', 'fixed', 'percent', 'true'];
const elf = (id: string): any => ({ id, battleId: id, name: id, type: '普通', currentHp: 900, maxHp: 1000,
  skills: [], calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, statStages: {}, effects: [], battleStatuses: {} });
const state = (): any => ({ p1: elf('a'), p2: elf('b'), p1Marks: [], p2Marks: [], p1Timers: [], p2Timers: [], p1RegistryState: {}, p2RegistryState: {} });
const comp = (kind: string): any => ({ base: 1000, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: kind, isIncoming: true });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function fixture(side: 'p1' | 'p2', reg: Record<string, any> = {}) {
  let st = state();
  let round = 1;
  const other = side === 'p1' ? 'p2' : 'p1';
  const calls: any[] = [];
  const c: any = { actor: side, targetSide: other, get self() { return st[side]; }, get target() { return st[other]; },
    get activeP1() { return st.p1; }, get activeP2() { return st.p2; }, get p1Timers() { return st.p1Timers; }, get p2Timers() { return st.p2Timers; },
    get roundNumber() { return round; }, getPlayerState: (k: string) => reg[k], setPlayerState: (k: string, v: any) => reg[k] = v,
    getOpponentState: () => 0, setOpponentState: () => {}, getStatuses: (e: any) => e.battleStatuses,
    getMarks: (s: string) => st[`${s}Marks`], setMark: (m: any, s = side) => { st[`${s}Marks`] = [m]; },
    addTimerTo: (s: string, t: any) => { st[`${s}Timers`] = [...st[`${s}Timers`].filter((x: any) => x.id !== t.id), { ...t, ownerBattleId: t.ownerBattleId || st[s].id }]; },
    consumeTimer: (s: string, id: string) => { st[`${s}Timers`] = st[`${s}Timers`].flatMap((t: any) => t.id !== id ? [t] : t.remaining > 1 ? [{ ...t, remaining: t.remaining - 1 }] : []); },
    addLog: () => {}, updateElf: (s: string, patch: any) => Object.assign(st[s], patch), adjustHp: (s: string, n: number) => st[s].currentHp += n,
    applyHeal: (s: string, n: number) => calls.push(['heal', s, n]), applyPinkDamage: () => 0,
    applyTrueDamage: (s: string, n: number, _l: string, _a: any, _b: any, opts: any) => { calls.push(['true', s, n]); opts?.onSettled(settlementReceipt({ operation: 'damage', targetBattleId: st[s].id, requestedAmount: n, settledAmount: n, hpBefore: 10, hpAfter: 0 })); },
  };
  return { c, reg, calls, get st() { return st; }, set st(v) { st = v; }, set round(v: number) { round = v; }, other };
}

for (const side of ['p1', 'p2'] as const) for (const kind of kinds) {
  const st = state(), e = st[side];
  st[`${side}Timers`] = [{ id: '99', remaining: 2, ownerBattleId: e.id, payload: { damageReductionOverridePercent: 99 } }];
  check(`${side}/${kind}/99只改受到減傷`, () => {
    const d = comp(kind); d.reductionPolicy = reductionPolicy(st, side, e, kind);
    addDamageReduction(d, 0); near(d.decreasePercent, 0);
    addDamageReduction(d, .2); near(d.decreasePercent, kind === 'true' ? 0 : .99);
    multiplyDamageReduction(d, .5, false); near(d.multiplier, kind === 'true' ? 1 : .5);
    multiplyDamageReduction(d, .5); near(d.multiplier, kind === 'true' ? 1 : .005);
    d.pure = true; const before = d.multiplier; multiplyDamageReduction(d, .5); near(d.multiplier, before);
  });
  check(`${side}/${kind}/千秋比例按持有者與技能分支`, () => {
    for (const count of [0, 1, 2, 4]) {
      st[`${side}Marks`] = [{ id: 'blk_千秋一淚', ownerBattleId: e.id, count }];
      const d = comp(kind); d.reductionPolicy = reductionPolicy(st, side, e, kind); multiplyDamageReduction(d, .5);
      const skill = kind.startsWith('skill');
      near(d.multiplier, kind === 'true' ? 1 : 1 - .99 * (skill ? .5 ** Math.floor(count / 2) : 1));
      st[`${side}Marks`][0].ownerBattleId = 'same-name-other-instance';
      near(reductionPolicy(st, side, e, kind).attenuation, 1);
    }
  });
  check(`${side}/${kind}/腐朽不抹攻擊者自己的降傷`, () => {
    e.battleStatuses = { 腐朽: 2 };
    const d = comp(kind); d.reductionPolicy = reductionPolicy(st, side, e, kind);
    multiplyDamageReduction(d, .5); near(d.multiplier, kind === 'true' || kind === 'skill_attack' ? 1 : .01);
    multiplyDamageReduction(d, .5, false); near(d.multiplier, kind === 'true' ? 1 : kind === 'skill_attack' ? .5 : .005);
  });
  check(`${side}/${kind}/魂印減傷分類`, () => {
    const f = fixture(side, { dimensionalDragonStacks: 5, dimensionalDmgReduction: .4 });
    const d = comp(kind);
    f.st[`${side}Marks`] = [{ id: 'poem_chapter', count: 5, ownerBattleId: f.c.self.id, effects: { poemHpSnapshots: [1000, 1000, 1000, 1000, 1000] } }];
    handleDimensionalSoulMark(f.c, 'BEFORE_DAMAGE', d);
    const skill = kind.startsWith('skill');
    near(d.multiplier, skill ? .3 : 1);
    assert.equal(f.reg.dimensionalDmgReduction, skill ? 0 : .4);
    const water = fixture(side);
    const wd = comp(kind); handleCanglanSoulMark(water.c, 'BEFORE_DAMAGE', wd);
    near(wd.multiplier, skill ? .5 : 1);
  });
}
for (const side of ['p1', 'p2'] as const) {
  check(`${side}/gate真減傷99而不是對手造成半傷99`, () => {
    const st = state(); const other = side === 'p1' ? 'p2' : 'p1';
    st[`${side}Timers`] = [{ remaining: 2, payload: { damageReductionOverridePercent: 99 } },
      { id: 'incoming', remaining: 2, payload: { applyMode: 'gate', wraps: 'damage_reduce', params: { percent: 50, damageTypes: ['non_true'] } } }];
    const d = comp('fixed'); applyActiveGateTimersToDamage(other, side, d, () => {}, { current: st }); near(d.decreasePercent, .99);
    st[`${side}Timers`][0].ownerBattleId = 'other'; const otherComp = comp('fixed');
    applyActiveGateTimersToDamage(other, side, otherComp, () => {}, { current: st }); near(otherComp.decreasePercent, .5);
  });
  check(`${side}/技能傷害附屬類狀態範圍`, () => {
    const a = elf('a'), b = elf('b'); b.battleStatuses = { 星佑: 2 };
    for (const kind of kinds) {
      const d = comp(kind); applyStatusDamageModifiers(d, a, b); near(d.multiplier, kind.startsWith('skill') ? .7 : 1);
    }
  });
  check(`${side}/咒怨僅攻擊；霜光不串位`, () => {
    const st = state(); st[`${side}Marks`] = [{ id: 'demon_grudge', count: 3, scope: 'team' },
      { id: 'frost_glow', count: 1000, ownerBattleId: st[side].id, effects: { thresholdDamageReduction: { thresholdRatio: .1, multiplier: .5, damageTypes: ['fixed', 'percent'] } } }];
    for (const kind of kinds) {
      const d = comp(kind); applyMarkDamageReductions(d, st, side, st[side]); applyThresholdDamageReductions(d, st, side, st[side]);
      near(d.decreasePercent, kind === 'skill_attack' ? .15 : 0);
      near(d.multiplier, ['fixed', 'percent'].includes(kind) ? .5 : 1);
    }
    const d = comp('fixed'); d.base = 100; applyThresholdDamageReductions(d, st, side, st[side]); near(d.multiplier, 1);
    d.base = 150; d.flatReduction = 50; applyThresholdDamageReductions(d, st, side, st[side]); near(d.multiplier, 1);
    st[side] = elf('another'); const next = comp('fixed'); applyThresholdDamageReductions(next, st, side, st[side]); near(next.multiplier, 1);
  });
  check(`${side}/馬爾修斯盾罩都需存在、只一次非真傷`, () => {
    for (const [shield, barrier, expected] of [[1, 0, 1], [0, 1, 1], [1, 1, .5]]) {
      const f = fixture(side); Object.assign(f.c.self, { shield, barrier });
      const d = comp('fixed'); handleMarsSoulMark(f.c, 'BEFORE_DAMAGE', d); near(d.multiplier, expected);
      const second = comp('fixed'); handleMarsSoulMark(f.c, 'BEFORE_DAMAGE', second); near(second.multiplier, 1);
    }
    const f = fixture(side); Object.assign(f.c.self, { shield: 1, barrier: 1 });
    const d = comp('true'); handleMarsSoulMark(f.c, 'BEFORE_DAMAGE', d); near(d.multiplier, 1); assert.ok(!f.reg.marsShieldDamageHalvedUsed);
  });
  check(`${side}/柯爾霍德兩分支與60%汲取`, () => {
    const f = fixture(side); f.c.self.currentHp = 900;
    const high = comp('fixed'); high.base = 300; handleKeerhodeSoulMark(f.c, 'BEFORE_DAMAGE', high); finalizeDamageReductions(high, f.st, side, f.c.self); near(high.multiplier, .4);
    assert.equal(f.st[`${f.other}Marks`][0].count, 180);
    const low = comp('skill_attribute'); low.base = 299; handleKeerhodeSoulMark(f.c, 'BEFORE_DAMAGE', low); finalizeDamageReductions(low, f.st, side, f.c.self); near(low.multiplier, 1);
    low.afterDamage(settlementReceipt({ operation: 'damage', targetBattleId: f.c.self.id, requestedAmount: 299, settledAmount: 299, hpBefore: 900, hpAfter: 601 }));
    assert.deepEqual(f.calls, [['true', f.other, 179], ['heal', side, 179]]);
    const boosted = comp('fixed'); boosted.base = 200; handleKeerhodeSoulMark(f.c, 'BEFORE_DAMAGE', boosted);
    boosted.increasePercent = 1; finalizeDamageReductions(boosted, f.st, side, f.c.self); near(boosted.multiplier, .4);
    assert.equal(boosted.afterDamage, undefined, '後續增傷超過門檻才選高傷分支');
    const flat = comp('fixed'); flat.base = 400; flat.flatReduction = 150;
    handleKeerhodeSoulMark(f.c, 'BEFORE_DAMAGE', flat); finalizeDamageReductions(flat, f.st, side, f.c.self);
    near(flat.multiplier, 1); assert.equal(typeof flat.afterDamage, 'function', '固定點數減免後不足門檻，採低傷汲取');
    const trueComp = comp('true'); handleKeerhodeSoulMark(f.c, 'BEFORE_DAMAGE', trueComp); assert.equal(trueComp.afterDamage, undefined);
  });
  check(`${side}/帝辛天陣9回合、源綁體力限制及關閉代價`, () => {
    const f = fixture(side, { dixinBahuangStacks: 9 });
    runDixinFormation(f.c, 'CHECK_FORMATION'); assert.equal(f.reg.dixinFormationRounds, 9);
    f.c.self.skills = [{ name: 'a', pp: 5, currentPp: 5 }];
    f.c.target.currentHp = 600;
    const d = comp('fixed'); runDixinFormation(f.c, 'BEFORE_DAMAGE', d); assert.equal(d.flatReduction, 400);
    f.st = recordDamageHpCeilings(f.st, f.other, f.c.target, 600);
    near(capCurrentHp(f.st, f.other, f.c.target, 1000), 600); assert.equal(f.c.target.maxHp, 1000);
    f.st = recordDamageHpCeilings(f.st, f.other, f.c.target, 500);
    near(capCurrentHp(f.st, f.other, f.c.target, 900), 500);
    near(capCurrentHp(f.st, f.other, elf('next'), 900), 900);
    const old = f.st[side]; f.st[side] = elf('other-source'); near(capCurrentHp(f.st, f.other, f.c.target, 900), 900); f.st[side] = old;
    for (let r = 2; r <= 10; r++) { f.round = r; runDixinFormation(f.c, 'ROUND_END'); runDixinFormation(f.c, 'ROUND_END'); }
    assert.equal(f.reg.dixinFormationRounds, 0); assert.equal(f.c.self.currentHp, 1); assert.equal(f.c.self.skills[0].currentPp, 0);
    assert.ok(!f.st[`${side}Timers`].some((t: any) => t.id === 'dixin_formation'));
    near(capCurrentHp(f.st, f.other, f.c.target, 900), 900);
    assert.ok(f.st[`${side}Timers`].some((t: any) => t.pendingActivation && t.payload.lockSwitch));
  });
  check(`${side}/柯爾德減免值含後續增傷；戰鬥階段後反噬；無視不反噬`, () => {
    const f = fixture(side, { keldSoulStacks: 1 }); const reactions: string[] = [];
    f.c.applyStatusWithImmunityCheck = () => { reactions.push('frostbite'); return { success: false, immune: true }; };
    f.c.clearTurnEffectsOf = () => reactions.push('clear');
    f.c.setNextTurns = () => reactions.push('next2');
    const d = comp('fixed'); d.base = 100; handleKeldSoulMark(f.c, EffectTiming.BEFORE_DAMAGE, d);
    d.increasePercent = 9; finalizeDamageReductions(d, f.st, side, f.c.self); near(d.multiplier, .4);
    d.afterDamage(settlementReceipt({ operation: 'damage', targetBattleId: f.c.self.id, requestedAmount: 1000, settledAmount: 400, hpBefore: 900, hpAfter: 500 }));
    assert.deepEqual(reactions, ['frostbite', 'clear', 'next2']); assert.ok(!f.reg.keldBacklashCount);
    const low = comp('fixed'); low.base = 100; handleKeldSoulMark(f.c, EffectTiming.BEFORE_DAMAGE, low); finalizeDamageReductions(low, f.st, side, f.c.self);
    low.afterDamage(settlementReceipt({ operation: 'damage', targetBattleId: f.c.self.id, requestedAmount: 100, settledAmount: 40, hpBefore: 900, hpAfter: 860 }));
    assert.equal(f.reg.keldBacklashCount, 1); handleKeldSoulMark(f.c, EffectTiming.ROUND_END); assert.equal(f.calls.length, 0);
    handleKeldSoulMark(f.c, EffectTiming.BATTLE_PHASE_END); assert.deepEqual(f.calls, [['true', side, 250]]); assert.equal(f.reg.keldBacklashCount, 0);
    const ignored = comp('fixed'); ignored.reductionPolicy = { attenuation: 0 }; handleKeldSoulMark(f.c, EffectTiming.BEFORE_DAMAGE, ignored);
    finalizeDamageReductions(ignored, f.st, side, f.c.self); assert.equal(ignored.afterDamage, undefined);
  });
  check(`${side}/次數減傷僅觸發消耗且不跨種類`, () => {
    const f = fixture(side); f.c.addTimerTo(side, { id: 'once', remaining: 1, kind: 'use_counter', payload: { block: { dmgIn: -.5, kind: '技能' } } });
    runSideTimers(f.c, ['incoming'], { damageComp: comp('fixed') }); assert.equal(f.st[`${side}Timers`].length, 1);
    const d = comp('skill_extra_action'); runSideTimers(f.c, ['incoming'], { damageComp: d }); near(d.decreasePercent, .5);
    assert.equal(f.st[`${side}Timers`].length, 0);
  });
}
check('投石者四技能石攻擊增減傷讀取實際特質，含SS名稱', () => {
  const a = elf('a'), b = elf('b');
  for (const e of [a, b]) { e.alienTraits = { gen2Trait: { name: '投石者' } }; e.skills = ['火', '水', '草', '電'].map(t => ({ name: `${t}石之力-SS`, type: t })); }
  for (const kind of kinds) {
    const d = comp(kind); d.reductionPolicy = { override: .99, attenuation: 1 }; applyAdvancedDamageModifiers(d, a, b);
    near(d.increasePercent, kind === 'skill_attack' ? .5 : 0); near(d.multiplier, kind === 'skill_attack' ? .01 : 1);
  }
  a.skills[3] = { name: '火石之力-SS', type: '火' };
  const repeated = comp('skill_attack'); applyAdvancedDamageModifiers(repeated, a, b);
  near(repeated.increasePercent, 0);
});
check('原子以實際造成／受到方向區分99%，不是以self/opponent字面猜', () => {
  const f = fixture('p1');
  const received = comp('fixed'); received.isIncoming = false; received.reductionPolicy = { override: .99, attenuation: 1 };
  ATOMS.damage_reduce({ percent: 50 }, 'opponent', { ...f.c, damageComp: received }); near(received.decreasePercent, .99);
  const outgoing = comp('fixed'); outgoing.reductionPolicy = { override: .99, attenuation: 0 };
  ATOMS.damage_multiplier({ multiplier: .5 }, 'opponent', { ...f.c, damageComp: outgoing }); near(outgoing.multiplier, .5);
});
check('不同來源相乘、同來源加算且最高100%，多個99%不假免疫', () => {
  const d = comp('fixed'); addDamageReduction(d, .2); addDamageReduction(d, .3); near(d.decreasePercent, .44);
  const grouped = comp('fixed'); addDamageReduction(grouped, .2, true, 'same'); addDamageReduction(grouped, .3, true, 'same'); near(grouped.decreasePercent, .5);
  addDamageReduction(grouped, .2, true, 'other'); near(grouped.decreasePercent, .6);
  const override = comp('fixed'); override.reductionPolicy = { override: .99, attenuation: 1 };
  addDamageReduction(override, .2); addDamageReduction(override, .3); near(override.decreasePercent, .9999);
  const group99 = comp('fixed'); group99.reductionPolicy = { override: .99, attenuation: 1 };
  addDamageReduction(group99, .2, true, 'same'); addDamageReduction(group99, .3, true, 'same'); near(group99.decreasePercent, .99);
});
check('黯痕限制涵蓋X系/額外行動；無視限制改輸出減半，不吃受擊99%', () => {
  for (const kind of kinds) for (const ignore of [false, true]) {
    const d = comp(kind); d.reductionPolicy = { override: .99, attenuation: 0 };
    applyOutgoingSkillRestriction(d, { DarkScarTurns: 3, ignoreDamageLimitThisAction: ignore });
    near(d.multiplier, ignore && kind.startsWith('skill') ? .5 : 1);
    assert.equal(d.outgoingLimit, !ignore && kind.startsWith('skill') ? 1 : undefined);
  }
});
const vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const { buildDamageAPIs } = await vite.ssrLoadModule('/src/battle/contextBuilders.ts');
  const { getBattleSkillAfterHitRegistry } = await vite.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    check(`${side}/真正API狀態減傷99包含X系、額外行動`, () => {
      const st = state(), effects: any[] = []; st[other].battleStatuses = { 星佑: 2 };
      st[`${other}Timers`] = [{ id: '99', remaining: 2, payload: { damageReductionOverridePercent: 99 } }];
      const api = buildDamageAPIs({ side, self: st[side], syncStateRef: { current: st }, pushEffect: (e: any) => effects.push(e), getBattleEventContext: () => ({}) });
      for (const kind of ['skill_attribute', 'skill_extra_action']) {
        effects.length = 0; api.applySkillTypeDamage(other, 1000, 'API驗收', { elem: '普通', category: kind });
        const e = effects.find(e => e.type === 'damage'); assert.equal(e.data.damageType, kind); assert.equal(e.data.amount, 10);
        assert.equal(e.data.reductionPolicy.override, .99);
      }
      effects.length = 0; api.applyFixedDamage(other, 1000); assert.equal(effects.find(e => e.type === 'damage').data.amount, 1000);
    });
    check(`${side}/技能石100%減半有真正runner而非special日誌`, () => {
      const f = fixture(side);
      f.c.self.alienTraits = { gen2Trait: { name: '投石者' } };
      f.c.skill = toSSStone(createSkillStone('聖靈', 'S', '物理', true, 'attr_holy_half'));
      getBattleSkillAfterHitRegistry()[f.c.skill.name](f.c, { hit: true });
      assert.ok(f.st[`${side}Timers`].some((t: any) => t.payload?.wraps === 'damage_reduce'));
      for (const kind of kinds) {
        const d = comp(kind); applyActiveGateTimersToDamage(f.other, side, d, () => {}, { current: f.st });
        near(d.decreasePercent, kind === 'true' ? 0 : .5);
      }
    });
  }
} finally { await vite.close(); }
console.log(`減傷语意 ${checks} 組通過。`);
