import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASTRAL_AESFIA_SEED as F } from '../src/data/newElves';
import { HAMO_SEED } from '../src/data/hamo';
import { getMaxPp, addStatusEffect, getStatuses } from '../src/utils/battleHelpers';
import { settlePpChanges } from '../src/battle/ppTransitions';
import { addTimer, consumeUse, clearTurnEffects } from '../src/battle/timers';
import { setMark, markAppliesToElf } from '../src/battle/marks';
import { settlementReceipt } from '../src/battle/settlementReceipt';
import { EffectTiming as E } from '../src/effects/types';
import { handleHamoSoulMark, hamoRoundRecovery, HAMO_ON_INVALID, HAMO_SKILL_TRANSFORMS } from '../src/effects/elves/hamo/registry';
import { handleShiyanSoulMark, SHIYAN_SKILLS, SHIYAN_SKILL_TRANSFORMS } from '../src/effects/elves/wuxu-shiyan/registry';
import { runNewElfLifecycle } from '../src/effects/newElfLifecycle';
import { calculateDamage } from '../src/utils/damageCalculator';
import { takeSkillRecalculation, recalculatedSkill } from '../src/battle/skillRecalculation';
import { TraitsEngine } from '../src/utils/traitsEngine';
let checks = 0;
function check(label: string, fn: () => void) { fn(); checks++; console.log('✓ ' + label); }
const make = (seed: any, id: string) => ({ ...structuredClone(seed), battleId: id, maxHp: 1000, currentHp: 500,
  calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }, effects: [], battleStatuses: {} });
// 單元契約：即時 getter、作用域與結算回執；實際戰鬥另外在 integration suite 驗證。
function fixture(seed: any, side: 'p1' | 'p2' = 'p1') {
  const other = side === 'p1' ? 'p2' : 'p1';
  const own = make(seed, 'owner'), foe = make(F, 'enemy'); foe.name = '中性對手'; foe.type = '普通';
  const teams: any = { [side]: [own], [other]: [foe] }, registries: any = { p1: {}, p2: {} }, timers: any = { p1: [], p2: [] }, marks: any = { p1: [], p2: [] };
  const damage: any[] = [], heals: any[] = [], extras: any[] = [], statuses: any[] = [];
  const c: any = { actor: side, targetSide: other, roundNumber: 1, goesFirst: true, skill: own.skills[0], opponentSkill: foe.skills[0], rng: () => 0, getStatuses,
    getPlayerState: (k: string) => registries[side][k], setPlayerState: (k: string, v: any) => registries[side][k] = v,
    getOpponentState: (k: string) => registries[other][k], setOpponentState: (k: string, v: any) => registries[other][k] = v,
    getFullTeam: (s: string) => teams[s], getEligibleTeam: (s: string) => teams[s], getFirstStarter: (s: string) => teams[s][0],
    getAdjacentElves: (s: string) => teams[s].slice(1, 3), getSeparatedElves: (s: string) => teams[s].slice(3),
    updateElf: (s: string, patch: any) => Object.assign(teams[s][0], patch),
    updateAnyElf: (s: string, id: string, patch: any) => Object.assign(teams[s].find((e: any) => (e.battleId || e.id) === id), patch),
    addLog: () => {}, addTimerTo: (s: string, t: any, late: boolean) => timers[s] = addTimer(timers[s], { ...t, ownerBattleId: t.scope === 'team' ? undefined : teams[s][0].battleId }, { isLateMover: late }),
    consumeTimer: (s: string, id: string) => timers[s] = consumeUse(timers[s], id)[0],
    getMarks: (s: string) => marks[s].filter((m: any) => markAppliesToElf(m, teams[s][0])),
    setMark: (m: any, s = side) => marks[s] = setMark(marks[s], m), clearMark: (id: string, s = side) => marks[s] = marks[s].filter((m: any) => m.id !== id),
    clearTurnEffectsOf: (s: string) => { const [next, count] = clearTurnEffects(timers[s]); timers[s] = next; return count > 0; },
    hasTurnEffectOn: (s: string) => timers[s].some((t: any) => t.kind === 'turn_effect' && t.remaining > 0),
    applyStatChange: (s: string, stages: any) => { for (const [k, v] of Object.entries(stages)) teams[s][0].statStages[k] += v as number; },
    applyStatusWithImmunityCheck: (s: string, name: string, duration: number) => {
      statuses.push({ side: s, name, duration }); addStatusEffect(teams[s][0], name, duration); return { success: true, immune: false };
    }, queueExtraAction: (_s: string, action: any) => extras.push(action), expel: () => true,
  };
  for (const [key, s] of [['self', side], ['target', other], ['activeP1', 'p1'], ['activeP2', 'p2']]) Object.defineProperty(c, key, { get: () => teams[s][0] });
  for (const s of ['p1', 'p2']) Object.defineProperty(c, `${s}Timers`, { get: () => timers[s] });
  const heal = (s: string, id: string, n: number, opts?: any) => { const e = teams[s].find((e: any) => e.battleId === id), before = e.currentHp;
    e.currentHp = Math.min(e.maxHp, before + n); heals.push({ side: s, id, amount: n }); opts?.onSettled?.(settlementReceipt({ operation: 'heal', targetBattleId: id, requestedAmount: n, settledAmount: n, hpBefore: before, hpAfter: e.currentHp })); };
  const hit = (s: string, id: string, n: number, type: string, opts?: any) => { const e = teams[s].find((e: any) => e.battleId === id), before = e.currentHp;
    e.currentHp = Math.max(0, before - Math.floor(n)); damage.push({ side: s, id, amount: Math.floor(n), type, ...opts });
    opts?.onSettled?.(settlementReceipt({ operation: 'damage', targetBattleId: id, requestedAmount: n, settledAmount: Math.floor(n), hpBefore: before, hpAfter: e.currentHp })); };
  c.applyHeal = (s: string, n: number, opts?: any) => heal(s, teams[s][0].battleId, n, opts);
  c.applyHealToElf = heal; c.applyDamageToElf = hit;
  c.applyTrueDamage = (s: string, n: number, _label?: any, _a?: any, _b?: any, opts?: any) => hit(s, teams[s][0].battleId, n, 'true', opts);
  c.applyPinkDamage = (s: string, n: number, _label?: any, _a?: any, _b?: any, type = 'fixed', opts?: any) => hit(s, teams[s][0].battleId, n, type, opts);
  return { c, side, other, teams, registries, timers, marks, damage, heals, extras, statuses };
}


check('蝕言只有獨立註冊入口；六刃不再包含安息契或蝕言魂印', () => {
  const old = readFileSync(new URL('../src/effects/elves/wuxu/registry.ts', import.meta.url), 'utf8');
  assert.ok(!old.includes('安息契')); assert.ok(!old.includes('無序·蝕言'));
  const current = readFileSync(new URL('../src/effects/elves/wuxu-shiyan/registry.ts', import.meta.url), 'utf8');
  assert.ok(!current.includes('handleWuxuSoulMark'));
  assert.equal(Object.keys(SHIYAN_SKILLS).length, 5);
});
for (const side of ['p1', 'p2'] as const) {
  check(side + ' 安息契在PP消耗而不是技能本體執行；百分比傷害與等量恢復', () => {
    const f = fixture(F, side); f.c.self.name = '無序·蝕言';
    f.c.self.skills[0] = { ...f.c.self.skills[0], name: '安息契', category: '物理', power: 300 };
    f.c.skill = f.c.self.skills[0];
    f.c.target.currentHp = 900;
    f.c.target.skills = [{ name: '攻擊', category: '物理', pp: 20 }, { name: '屬性', category: '屬性', pp: 10 }];
    const before = f.c.self.skills.map((s: any) => s.pp);
    SHIYAN_SKILLS['安息契'](f.c); assert.equal(f.damage.length, 0);
    handleShiyanSoulMark(f.c, E.ON_PP_CONSUME);
    assert.equal(f.c.target.skills[0].pp, 0); assert.equal(f.c.target.skills[1].pp, 10);
    assert.equal(f.damage.length, 1); assert.equal(f.damage[0].type, 'percent'); assert.equal(f.damage[0].amount, 800);
    assert.equal(f.heals[0].amount, 800);
    assert.deepEqual(f.c.self.skills.map((s: any) => s.pp), before.map((n: number) => Math.max(0, n - 1)));
    assert.ok(f.timers[f.other].some((t: any) => t.payload.block?.invalid === '屬性'));
    assert.ok(f.timers[side].some((t: any) => t.payload.statusGuardSourceSide === f.other));
    handleShiyanSoulMark(f.c, E.AFTER_ACTION); assert.equal(f.damage.length, 1, '不得命中後再跑同份攜帶效果');
    runNewElfLifecycle(f.c, E.ON_KILL); assert.equal(f.registries[side].nextKillStatus, undefined);
    assert.equal(f.registries[f.other].nextElfStatus.status, '詛咒');
  });
  check(side + ' 安息契固有視為下降只改計算旗標', () => {
    const f = fixture(F, side); f.c.self.statStages.atk = -2;
    SHIYAN_SKILL_TRANSFORMS['安息契'](f.c, f.c.self.skills[0]);
    assert.equal(f.registries[side].selfDropAsOppDropThisAction, true);
    assert.equal(f.c.self.statStages.atk, -2);
    f.registries[side] = {}; f.c.self.isInherentInvalid = true;
    SHIYAN_SKILL_TRANSFORMS['安息契'](f.c, f.c.self.skills[0]);
    assert.equal(f.registries[side].selfDropAsOppDropThisAction, undefined);
  });
}
check('蝕言其他隊員僅在場下調整特防；上場及蝕言死亡後還原', () => {
  const f = fixture(F); f.c.self.name = '無序·蝕言';
  const owner = f.c.self, bench = make(F, 'teammate'); bench.calculatedStats.spdef = 170;
  f.teams.p1.push(bench); handleShiyanSoulMark(f.c, E.ENFORCE);
  assert.equal(bench.calculatedStats.spdef, 10);
  f.teams.p1.reverse();
  const benchOwnerContext: any = { ...f.c, self: owner, activeP1: bench };
  handleShiyanSoulMark(benchOwnerContext, E.ENFORCE);
  assert.equal(bench.calculatedStats.spdef, 170, '上場立即还原'); assert.equal(owner.calculatedStats.spdef, 10);
  owner.currentHp = 0; handleShiyanSoulMark(benchOwnerContext, E.DEATH_NODE_2);
  assert.equal(owner.calculatedStats.spdef, 100);
});
check('影契與械律固有能力視為下降不會直接清除實際提升', () => {
  for (const name of ['影契·噬滅', '械律·置換']) {
    const f = fixture(F); f.c.target.statStages.def = 3;
    SHIYAN_SKILL_TRANSFORMS[name](f.c, f.c.skill);
    assert.equal(f.registries.p1.oppBoostAsDropThisAction, true); assert.equal(f.c.target.statStages.def, 3);
    f.registries.p1 = {}; f.c.self.isInherentInvalid = true;
    SHIYAN_SKILL_TRANSFORMS[name](f.c, f.c.skill); assert.equal(f.registries.p1.oppBoostAsDropThisAction, undefined);
  }
});
check('哈莫回復每10%逐次乘1.1，每次重新取體力', () => {
  assert.equal(hamoRoundRecovery(10000, 5000), 2415);
  assert.equal(hamoRoundRecovery(10000, 7000), 1996);
  assert.equal(hamoRoundRecovery(10000, 10000), 1500);
});
for (const side of ['p1', 'p2'] as const) check(side + ' 哈莫低體力改限技能傷害，綠鱗重置不是恢復', () => {
  const f = fixture(HAMO_SEED, side); handleHamoSoulMark(f.c, E.ON_ENTRANCE);
  f.c.self.currentHp = 100; f.c.target.currentHp = 900;
  handleHamoSoulMark(f.c, E.ROUND_START);
  const statusGate: any = { status: '中毒' };
  handleHamoSoulMark(f.c, E.BEFORE_STATUS_APPLY, statusGate);
  assert.notEqual(statusGate.prevented, true, '低血量免異常條件失效');
  const d: any = { damageCategory: 'skill_extra_action', skillType: '水', isIncoming: true, base: 1000, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
  handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, d);
  assert.equal(d.limit, 250, '額外行動同屬技能傷害，不能漏限額');
  const t: any = { ...d, damageCategory: 'true', multiplier: 1, limit: undefined };
  handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, t);
  assert.equal(t.limit, undefined, '不能把真傷改成技能伤害');
  f.registries[side].hamoScales = ['綠色'];
  f.c.self.skills[0].pp = 0;
  f.timers[side].push({ remaining: 5, payload: { recoveryReductionPercent: 1, ppRecoveryReductionPercent: 1 } });
  handleHamoSoulMark(f.c, E.PP_CHANGED, { reason: 'clear', emptied: [0] });
  assert.equal(f.c.self.currentHp, f.c.self.maxHp);
  assert.ok(f.c.self.skills.every((s: any) => s.pp === getMaxPp(s, f.c.self)), '體力與PP重置不吃減療');
  assert.equal(f.heals.length, 0, '不以恢復API替代重置');
  handleHamoSoulMark(f.c, E.ON_SWITCH_OUT);
  assert.deepEqual(f.registries[side].hamoScales, [], '龍鱗不串給下一隻');
});
check('安息契內部扣PP會連動其他攜帶槽，同一鏈每槽一次且新鏈可重觸發', () => {
  const f = fixture(F); f.c.self.name = '無序·蝕言';
  f.c.self.skills = Object.keys(SHIYAN_SKILLS).map((name, i) => ({ name, category: '物理', type: '普通', pp: i === 4 ? 0 : 20, maxPp: i === 4 ? 1 : 20, power: 100 }));
  f.c.skill = { ...f.c.self.skills[4], battleSlot: 4 };
  let events = 0;
  f.c.emitElfEvent = (side: string, _elf: any, event: E, data: any) => {
    if (side === 'p1') { events++; assert.ok(events < 20, '不得無限循環'); handleShiyanSoulMark(f.c, event, data); }
  };
  handleShiyanSoulMark(f.c, E.ON_PP_CONSUME, { consumedSlots: [4] });
  assert.ok(f.timers.p1.some((t: any) => t.payload.roundDrainSpec));
  assert.ok(f.timers.p1.some((t: any) => t.payload.immuneStatDown));
  assert.ok(f.timers.p2.some((t: any) => t.payload.skillUseReaction));
  assert.equal(f.c.self.statStages.def, 2, '血稅只觸發一次');
  assert.equal(f.registries.p1.ppCarryChain, undefined, '根事件結束清除連鎖');
  handleShiyanSoulMark(f.c, E.PP_CHANGED, { removed: 1, consumedSlots: [2] });
  assert.equal(f.c.self.statStages.def, 4, '新的外部扣PP可再觸發');
});
check('哈莫純水火草循環、六維1.2複利與無色保護仍觸發削除效果', () => {
  const f = fixture(HAMO_SEED); handleHamoSoulMark(f.c, E.ON_ENTRANCE);
  const d: any = { damageCategory: 'skill_attack', skillType: '普通', isIncoming: true, base: 100, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
  handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, d); assert.equal(d.multiplier, 0);
  assert.deepEqual(Object.values(f.c.self.calculatedStats), [1200, 120, 120, 120, 120, 120]);
  handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, { ...d, multiplier: 1, skillType: '水' });
  assert.ok(f.registries.p1.hamoScales.includes('藍色'));
  const interception = { changes: { atk: -1, speed: 1 } };
  handleHamoSoulMark(f.c, E.BEFORE_STAT_CHANGE, interception);
  assert.deepEqual(interception.changes, { speed: 1 });
  f.c.target.shield = 10; f.c.target.barrier = 10;
  handleHamoSoulMark(f.c, E.ROUND_END);
  assert.ok(f.registries.p1.hamoScales.includes('藍色'), '保護保留鱗片');
  assert.equal(f.c.target.shield, 0); assert.equal(f.c.target.barrier, 0);
  assert.ok(f.statuses.some(s => s.name === '凍傷'), '保護不吞掉消失副作用');
});
for (const side of ['p1', 'p2'] as const) {
  check(side + ' 哈莫常駐150%只加技能傷害，不偷渡固定百分比真實傷害', () => {
    const f = fixture(HAMO_SEED, side);
    for (const category of ['skill_attack', 'skill_attribute', 'skill_extra_action', 'fixed', 'percent', 'true']) {
      const comp: any = { damageCategory: category, isIncoming: false, base: 1000, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
      handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, comp);
      assert.equal(comp.increasePercent, category.startsWith('skill_') ? 1.5 : 0, category);
    }
  });
  check(side + ' 哈莫紅鱗讀通用無視抵擋，但固定百分比免疫不被誤跳過', () => {
    const f = fixture(HAMO_SEED, side); handleHamoSoulMark(f.c, E.ON_ENTRANCE);
    f.registries[side].hamoScales = ['紅色'];
    const hit = (category: string, bypass = false) => {
      f.registries[side].hamoCycle = 0;
      const comp: any = { damageCategory: category, skillType: '水', isIncoming: true, base: 1000,
        multiplier: 1, increasePercent: 0, decreasePercent: 0, attackDefenseBypass: { block: bypass } };
      handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, comp); return comp;
    };
    assert.equal(hit('skill_attack').multiplier, 0);
    assert.equal(hit('skill_attack', true).multiplier, 1, '通用攻擊抵擋貫穿不再是死鍵');
    assert.equal(hit('fixed', true).multiplier, 0); assert.equal(hit('percent', true).multiplier, 0);
    assert.equal(hit('true', true).multiplier, 1); assert.equal(hit('skill_attribute').multiplier, 1);
  });
  check(side + ' 哈莫無色刷新保護；全染色後到期移除，副作用在保護內外都執行', () => {
    const f = fixture(HAMO_SEED, side); handleHamoSoulMark(f.c, E.ON_ENTRANCE);
    f.registries[side].hamoScales = ['無色', '藍色'];
    f.c.roundNumber = 5; handleHamoSoulMark(f.c, E.ROUND_START);
    assert.equal(f.registries[side].hamoProtectionUntil, 7);
    f.registries[side].hamoScales = ['藍色', '紅色', '綠色'];
    f.c.roundNumber = 6; handleHamoSoulMark(f.c, E.ROUND_START);
    assert.equal(f.registries[side].hamoProtectionUntil, 7, '無無色鱗時不能無限延長');
    f.c.target.shield = f.c.target.barrier = 100;
    handleHamoSoulMark(f.c, E.BEFORE_STAT_CHANGE, { changes: { atk: -1 } });
    handleHamoSoulMark(f.c, E.ROUND_END);
    assert.ok(f.registries[side].hamoScales.includes('藍色')); assert.equal(f.c.target.shield, 0);
    f.c.roundNumber = 7; f.c.target.shield = 100;
    handleHamoSoulMark(f.c, E.BEFORE_STAT_CHANGE, { changes: { def: -1 } });
    handleHamoSoulMark(f.c, E.ROUND_END);
    assert.ok(!f.registries[side].hamoScales.includes('藍色')); assert.equal(f.c.target.shield, 0);
    assert.equal(f.statuses.filter(s => s.name === '凍傷').length, 2);
  });
  check(side + ' 哈莫減半次數本場累加、循環不接受複合屬性、龍系隊員六維複利', () => {
    const f = fixture(HAMO_SEED, side); handleHamoSoulMark(f.c, E.ON_ENTRANCE);
    const dragon = make(HAMO_SEED, 'dragon-bench'), neutral = make(F, 'neutral-bench'); neutral.type = '普通';
    f.teams[side].push(dragon, neutral);
    const hit = (type: string, category = 'skill_attribute') => {
      const comp: any = { damageCategory: category, skillType: type, isIncoming: true, base: 1000, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
      handleHamoSoulMark(f.c, E.BEFORE_DAMAGE, comp); return comp;
    };
    assert.equal(hit('水·火').multiplier, 0); assert.equal(hit('普通').multiplier, 0);
    assert.equal(dragon.maxHp, 1440); assert.equal(dragon.calculatedStats.atk, 144);
    assert.equal(neutral.maxHp, 1000); assert.equal(f.registries[side].hamoCycle, 0);
    assert.equal(hit('水').decreasePercent, .875);
    assert.equal(hit('火').decreasePercent, .875); assert.equal(hit('草').decreasePercent, .875);
    assert.deepEqual(f.registries[side].hamoScales, ['藍色', '紅色', '綠色']);
    hit('水'); assert.equal(f.registries[side].hamoScales.length, 3, '不可重複染色');
    handleHamoSoulMark(f.c, E.ON_SWITCH_OUT); assert.deepEqual(f.registries[side].hamoScales, []);
    handleHamoSoulMark(f.c, E.ON_ENTRANCE); assert.equal(f.registries[side].hamoHalvingCount, 3);
    assert.equal(f.registries[side].hamoCycle, 0, '重登場循環從水重新開始');
  });
}
check('無效重算一次、沿用當前特殊公式、雙攻和也傳入特殊公式', () => {
  const f = fixture(HAMO_SEED);
  const owner = make(F, 'shiyan'); owner.name = '無序·蝕言'; owner.calculatedStats.spdef = 10;
  f.teams.p2.push(owner); f.c.skill = { ...f.c.self.skills[1], power: 100, category: '特殊' };
  HAMO_ON_INVALID['逐波'](f.c, { kind: 'invalid', reason: '測試' });
  const req = takeSkillRecalculation(f.c)!; assert.equal(req.powerMultiplier, 2);
  HAMO_ON_INVALID['逐波'](f.c, { kind: 'invalid', reason: '重入' });
  assert.equal(takeSkillRecalculation(f.c), undefined);
  const skill = recalculatedSkill(f.c.skill, req); assert.equal(skill.power, 200);
  const damage = (reg: any) => calculateDamage(f.c.self, f.c.target, skill, 'p1', undefined, undefined, 1, false, f.teams.p1, f.teams.p2, undefined, undefined, undefined, reg, {});
  assert.equal(damage({}).damage, 90, '蝕言替換公式不含威力，不能硬乘普通公式或固定補償');
  assert.equal(damage({ blkAtkSpatkSum: true }).damage, 180);
  owner.currentHp = 0; assert.notEqual(damage({}).damage, 90, '死亡立即停用替換公式');
});
for (const side of ['p1', 'p2'] as const) check(side + ' 怨靈替死後仍施法，僅蝕言須存活且在場，替死不可重複', () => {
  const f = fixture(F, side); f.c.self.name = '無序·蝕言';
  f.c.self.skills = [{ ...f.c.self.skills[0], name: '不帶攜帶效果的屬性招', category: '屬性', power: 0 }];
  f.c.skill = f.c.self.skills[0];
  f.c.addExtraElf = (s: string, e: any) => f.teams[s].push(e);
  f.c.vanishElf = (s: string, e: any) => Object.assign(f.teams[s].find((x: any) => x.battleId === e.battleId), { currentHp: 0, isVanished: true });
  handleShiyanSoulMark(f.c, E.ON_ENTRANCE);
  const wraith = f.teams[side][1];
  assert.equal(handleShiyanSoulMark(f.c, E.FATAL_RESIST), true);
  assert.equal(wraith.currentHp, 0); assert.notEqual(wraith.isVanished, true, '替死不是消逝');
  assert.equal(f.c.self.currentHp, 200);
  assert.equal(handleShiyanSoulMark(f.c, E.FATAL_RESIST), undefined);
  assert.equal(TraitsEngine.triggerFatalResist(f.c), false, '不能從舊入口再替死');
  const tick = { status: '詛咒', skipTick: false }; handleShiyanSoulMark(f.c, E.BEFORE_STATUS_TICK, tick);
  assert.equal(tick.skipTick, true, '已死但仍存在的怨靈保留詛咒期限');
  addStatusEffect(f.c.self, '詛咒', 3);
  f.teams[f.other].push(make(F, 'bench'));
  f.c.applySkillTypeDamage = (s: string, n: number, _label: any, opts: any) => {
    f.damage.push({ side: s, amount: n, ...opts }); return n;
  };
  f.c.applyTrueDamageToElf = (s: string, id: string, n: number) => f.damage.push({ side: s, id, amount: n, type: 'true' });
  TraitsEngine.triggerBeforeAction(f.c); TraitsEngine.triggerActionPhaseEnd(f.c);
  assert.equal(f.extras.length, 1); f.extras[0].run(f.c);
  assert.equal(f.damage[0].amount, 3, '屬性招威力0，不應偷塞100威力');
  assert.equal(f.damage[0].category, 'skill_extra_action');
  assert.equal(f.damage[1].amount, 3000, '替死後場下真傷比例翻倍');
  const count = f.damage.length; f.c.self.currentHp = 0; f.extras[0].run(f.c);
  assert.equal(f.damage.length, count, '蝕言真死後取消排隊行動');
  f.c.self.currentHp = 200; f.teams[side].unshift(make(F, 'incoming')); f.extras[0].run(f.c);
  assert.equal(f.damage.length, count, '換人後不得由下一隻代放');
});
for (const side of ['p1', 'p2'] as const) check(side + ' 哈莫重置涵蓋出手前被敵方消除的強化，隔回合不繼承', () => {
  const f = fixture(HAMO_SEED, side);
  f.registries[side].hamoScales = ['藍色', '紅色', '綠色'];
  handleHamoSoulMark(f.c, E.STAT_BOOST_CLEARED, { sourceSide: f.other, removedStages: { atk: 2 } });
  HAMO_SKILL_TRANSFORMS['逐波'](f.c, f.c.self.skills[1]);
  handleHamoSoulMark(f.c, E.ROUND_END);
  assert.equal(f.c.self.statStages.atk, 2);
  f.c.self.statStages.atk = 0; f.c.roundNumber++;
  handleHamoSoulMark(f.c, E.ROUND_START);
  HAMO_SKILL_TRANSFORMS['逐波'](f.c, f.c.self.skills[1]);
  handleHamoSoulMark(f.c, E.ROUND_END);
  assert.equal(f.c.self.statStages.atk, 0);
});
console.log('哈莫／蝕言 ' + checks + ' 個語意情境通過。');
