import assert from 'node:assert/strict';
import { ASTRAL_AESFIA_SEED as F, ASTRAL_AESFIG_SEED as G, MOGOS_SEED as M } from '../src/data/newElves';
import { LIUJIE_SEED } from '../src/data/liujie';
import { SEER_ID_OVERRIDES } from '../src/battle/seerAssets';
import { getStatuses, getMaxPp, addStatusEffect } from '../src/utils/battleHelpers';
import { settlePpChanges, recoverPpByTimers } from '../src/battle/ppTransitions';
import { mergeRoundEnd } from '../src/battle/roundEndMerge';
import { startIllusion, endIllusion, illusionSkill, appearanceElf, bindInitialCounterparts, correspondingInitialElf } from '../src/battle/illusion';
import { checkStatusDrivenFatalResist } from '../src/utils/statusFatalResist';
import { addTimer, consumeUse, clearTurnEffects, tickTimers } from '../src/battle/timers';
import { setMark, markAppliesToElf } from '../src/battle/marks';
import { settlementReceipt } from '../src/battle/settlementReceipt';
import { EffectTiming as E } from '../src/effects/types';
import { ASTRAL_SKILLS, ASTRAL_AFTER_HIT, executeAstralMemory, handleAstralAesfiaSoulMark, handleAstralAesfigSoulMark } from '../src/effects/elves/astral-twins/registry';
import { MOGOS_SKILLS, MOGOS_ON_INVALID, MOGOS_DAMAGE_TRANSFORMS, handleMogosSoulMark, runMogosTeamEffects, drawMogosOrb } from '../src/effects/elves/mogos/registry';
import { runNewElfLifecycle } from '../src/effects/newElfLifecycle';
import { getTypeMatchup } from '../src/utils/statCalculator';
import { finalizeDamageReductions } from '../src/battle/damageReduction';
import { skillSlot } from '../src/battle/skillSlot';
import { changePp } from '../src/effects/newElfOperations';

let checks = 0;
function check(label: string, fn: () => void) { fn(); checks++; console.log(`✓ ${label}`); }
const make = (seed: any, id: string) => ({ ...structuredClone(seed), battleId: id, maxHp: 1000, currentHp: 500,
  calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }, effects: [], battleStatuses: {} });
// 單元契約：即時 getter、作用域與結算回執；實際戰鬥另外在 integration suite 驗證。
function fixture(seed: any, side: 'p1' | 'p2' = 'p1') {
  const other = side === 'p1' ? 'p2' : 'p1';
  const own = make(seed, 'owner'), foe = make(F, 'enemy'); foe.name = '中性對手'; foe.type = '普通';
  const teams: any = { [side]: [own], [other]: [foe] }, registries: any = { p1: {}, p2: {} }, timers: any = { p1: [], p2: [] }, marks: any = { p1: [], p2: [] };
  const damage: any[] = [], heals: any[] = [], extras: any[] = [], statuses: any[] = [];
  const c: any = { actor: side, targetSide: other, roundNumber: 1, goesFirst: true, skill: own.skills[0], opponentSkill: foe.skills[0], rng: () => 0,
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

check('資料與官方圖片對照／六界描述轉正', () => {
  assert.equal(Object.values(M.baseStats).reduce((n, v) => n + v, 0), 790);
  for (const [seed, id] of [[F, 79], [G, 418], [M, 3561], [LIUJIE_SEED, 3045]] as const) assert.equal(SEER_ID_OVERRIDES[seed.name], id);
  assert.equal(F.skills.length, 5); assert.equal(G.skills[4].isFifthSkill, true);
});
for (const side of ['p1', 'p2'] as const) {
  check(`${side} 空間躍遷只在真正抵擋技能傷害後清PP與回滿`, () => {
    const f = fixture(F, side); handleAstralAesfiaSoulMark(f.c, E.BEFORE_ACTION);
    runNewElfLifecycle(f.c, E.OPPONENT_ACTION);
    const d: any = { base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1, isIncoming: true, damageCategory: 'skill_attack', attackDefenseBypass: { block: true } };
    runNewElfLifecycle(f.c, E.BEFORE_DAMAGE, d);
    handleAstralAesfiaSoulMark(f.c, E.OPPONENT_AFTER_ACTION, { category: '物理', hit: true });
    assert.equal(f.c.target.skills[0].pp, 20, '無視抵擋時不應被判成躍遷成功');
    assert.equal(f.c.self.currentHp, 500);
    d.attackDefenseBypass = {}; runNewElfLifecycle(f.c, E.BEFORE_DAMAGE, d);
    handleAstralAesfiaSoulMark(f.c, E.OPPONENT_AFTER_ACTION, { category: '物理', hit: true });
    assert.equal(f.c.target.skills[0].pp, 0); assert.equal(f.c.self.currentHp, 1000);
  });
  check(`${side} 後手被動在對方出手前開啟，一回合只執行一次`, () => {
    for (const seed of [F, G]) {
      const f = fixture(seed, side); f.c.goesFirst = false;
      const handler = seed === F ? handleAstralAesfiaSoulMark : handleAstralAesfigSoulMark;
      handler(f.c, E.OPPONENT_ACTION);
      assert.ok(f.timers[side].some((t: any) => seed === F ? t.payload.halveNonTrue : t.payload.blockSkillDamage));
      const drains = f.damage.length;
      handler(f.c, E.BEFORE_ACTION);
      assert.equal(f.damage.length, drains, '不能在自己出手時重複魂印吸取');
      f.c.roundNumber++;
      handler(f.c, E.OPPONENT_ACTION);
      if (seed === G) assert.equal(f.damage.length, drains + 1);
    }
  });
  check(`${side} 幻化解除收斂PP，瞬時扣除再回復仍留下在場變動紀錄`, () => {
    const f = fixture(G, side);
    startIllusion(f.c, f.c.target, '測試', 10);
    f.c.self.skills = f.c.self.skills.map((s: any) => ({ ...s, pp: getMaxPp(s, f.c.self) }));
    endIllusion(f.c);
    assert.ok(f.c.self.skills.every((s: any) => s.pp <= getMaxPp(s, f.c.self)));
    f.c.emitElfEvent = (_side: string, _owner: any, event: E, data: any) => runNewElfLifecycle(f.c, event, data);
    const before = f.c.self.skills[0].pp;
    changePp(f.c, side, f.c.self, (s: any, i: number) => i === 0 ? s.pp - 1 : s.pp);
    changePp(f.c, side, f.c.self, (s: any, i: number) => i === 0 ? before : s.pp, true);
    assert.equal(f.registries[side].fieldPpChanged, true);
  });
  check(`${side} 摩哥斯未滿血封回復不是溢出體力`, () => {
    const f = fixture(M, side); handleMogosSoulMark(f.c, E.ON_ENTRANCE);
    f.c.self.currentHp = 200;
    f.c.applyHeal = (_s: string, n: number, opts: any) => opts?.onSettled?.(settlementReceipt({
      operation: 'heal', targetBattleId: 'owner', requestedAmount: n, settledAmount: n,
      hpBefore: 200, hpAfter: 200, blocked: true,
    }));
    handleMogosSoulMark(f.c, E.BATTLE_PHASE_END);
    assert.ok(!f.timers[side].some((t: any) => t.id === 'mogos_overflow'));
  });
}
check('場下受傷不加入本次在場傷害次數，但戰鬥累計保留', () => {
  const f = fixture(G); const bench = make(G, 'bench'); f.teams.p1.push(bench);
  const ctx: any = Object.create(f.c); Object.defineProperty(ctx, 'self', { value: bench });
  runNewElfLifecycle(ctx, E.AFTER_DAMAGE, { isIncoming: true, damageType: 'fixed', damage: 10 });
  assert.equal(f.registries.p1.battleDamageCounts.fixed, 1);
  assert.equal(f.registries.p1.fieldDamageCounts, undefined);
});
check('思維干涉反饋在後續增傷完成後取原始值，減半另行結算', () => {
  const f = fixture(G);
  f.timers[f.side] = [{ remaining: 2, payload: { halveReflectSkill: true } }];
  const d: any = { base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack', isIncoming: true };
  runNewElfLifecycle(f.c, E.BEFORE_DAMAGE, d);
  d.increasePercent = 1; d.flatReduction = 50;
  finalizeDamageReductions(d, { p1Marks: [], p2Marks: [] } as any, f.side, f.c.self);
  assert.equal(d.decreasePercent, .5);
  d.afterDamage(settlementReceipt({ operation: 'damage', targetBattleId: 'owner', requestedAmount: 200, settledAmount: 50, hpBefore: 500, hpAfter: 450 }));
  assert.equal(f.damage.at(-1).amount, 150); assert.equal(f.damage.at(-1).type, 'true');
});
check('同名技能按選擇槽扣PP與幻化，不猜第一格', () => {
  const f = fixture(F);
  f.c.self.skills[1] = { ...f.c.self.skills[0] };
  const selected = { ...f.c.self.skills[1], battleSlot: 1 };
  assert.equal(skillSlot(f.c.self, selected), 1);
  assert.equal(skillSlot(f.c.self, { ...selected, battleSlot: undefined }), -1);
  startIllusion(f.c, f.c.target, '測試');
  assert.equal(illusionSkill(f.c.self, selected).name, f.c.target.skills[1].name);
  f.registries[f.side].sourceSkillThisAction = selected;
  addStatusEffect(f.c.target, '星護', 3);
  runNewElfLifecycle(f.c, E.AFTER_ACTION, { skill: { ...selected, isSureHit: true } });
  assert.equal(f.c.self.skills[1].pp, 1); assert.equal(f.c.self.skills[0].pp, selected.pp);
  f.c.self.skills[1].pp = 0;
  runNewElfLifecycle(f.c, E.AFTER_ACTION, { skill: { ...selected, isSureHit: true } });
  assert.equal(f.c.self.skills[1].pp, 1, '歸1是設定，不是只能削減');
});
check('新精靈抵擋與轉體力遵守各自無視旗標，不消費未觸發次數', () => {
  const f = fixture(M); handleMogosSoulMark(f.c, E.ON_ENTRANCE); handleMogosSoulMark(f.c, E.FATAL_RESIST);
  runMogosTeamEffects(f.c, E.ON_ENTRANCE);
  const d: any = { base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: 'skill_attack', isIncoming: true,
    attackDefenseBypass: { block: true, conversion: true } };
  f.timers[f.side].push({ remaining: 1, payload: { blockSkillDamage: true } });
  runNewElfLifecycle(f.c, E.BEFORE_DAMAGE, d);
  runMogosTeamEffects(f.c, E.BEFORE_DAMAGE, { damageComp: d });
  assert.equal(d.multiplier, 1); assert.equal(d.afterDamage, undefined);
  assert.ok(f.timers[f.side].some((t: any) => t.payload.orbAttackConversion));
  assert.equal(f.registries[f.side].teamMogosOrb.remaining, 2);
});
check('星佑重生一次、保留控制異常', () => {
  const { c } = fixture(F); for (const n of ['星佑', '麻痺', '星哲']) addStatusEffect(c.self, n, 2);
  c.self.currentHp = 0; assert.equal(checkStatusDrivenFatalResist(c), true); assert.equal(c.self.currentHp, 1000);
  assert.equal(getStatuses(c.self)['星佑'], undefined); assert.ok(getStatuses(c.self)['麻痺']);
  c.self.currentHp = 0; assert.equal(checkStatusDrivenFatalResist(c), false);
});
check('星護耗盡槽回滿；不是所有槽回滿，非弱化解除', () => {
  const { c } = fixture(F); addStatusEffect(c.self, '星護', 3); addStatusEffect(c.self, '麻痺', 3); addStatusEffect(c.self, '中毒', 3);
  const skills = c.self.skills.map((s: any, i: number) => ({ ...s, pp: i === 0 ? 0 : 1 }));
  Object.assign(c.self, settlePpChanges(c.self, skills).patch);
  assert.equal(c.self.skills[0].pp, getMaxPp(c.self.skills[0], c.self)); assert.equal(c.self.skills[1].pp, 1);
  assert.equal(getStatuses(c.self)['麻痺'], undefined); assert.ok(getStatuses(c.self)['中毒']);
});
check('PP恢復限制與收尾同ID刷新不回溯', () => {
  const { c } = fixture(F); c.self.skills[0].pp = 1;
  assert.equal(recoverPpByTimers(c.self, 5, [{ remaining: 2, payload: { ppRecoveryReductionPercent: 1 } } as any])[0].pp, 1);
  const before = [{ id: 'same', duration: 1 }], refreshed = [{ id: 'same', duration: 3 }];
  assert.deepEqual(mergeRoundEnd(before, [], refreshed), refreshed); assert.deepEqual(mergeRoundEnd(before, [], before), []);
});
for (const side of ['p1', 'p2'] as const) {
  check(`${side} 幻化外觀／同槽轉化／解除不覆寫下一隻`, () => {
    const { c, teams, other } = fixture(F, side); const original = structuredClone(c.self.skills), target = c.target;
    target.skills[0].name = '目標同槽'; assert.equal(startIllusion(c, target, 'test', 10), true);
    assert.equal(c.self.maxHp, 2000); assert.equal(c.self.currentHp, 500); assert.equal(appearanceElf(c.self).name, target.name);
    assert.equal(illusionSkill(c.self, c.self.skills[0]).name, '目標同槽'); assert.deepEqual(c.self.skills, original);
    c.self.calculatedStats.atk += 25; endIllusion(c); assert.equal(c.self.calculatedStats.atk, 125); assert.equal(c.self.globalPpMaxOffset, 0);
    assert.deepEqual(c.self.skills, original); assert.equal(teams[other][0].skills[0].name, '目標同槽');
  });
  check(`${side} 初始背包配對快照不受後續改隊影響`, () => {
    const first = make(G, 'g'), other = make(M, 'm'); const roster = bindInitialCounterparts([first, other], 1);
    assert.equal(correspondingInitialElf(roster.slice(0, 1), roster[0])?.battleId, 'm');
    other.skills[0].name = '之後修改'; assert.notEqual(roster[0].initialCounterpart?.skills[0].name, '之後修改');
  });
  check(`${side} 幻化取目標當下能力，已幻化目標不改回原始能力`, () => {
    const f = fixture(F, side);
    f.c.target.calculatedStats.atk = 200;
    const targetCtx: any = { actor: f.other, get self() { return f.c.target; }, updateElf: f.c.updateElf, addLog() {} };
    startIllusion(targetCtx, make(M, 'third'), '目標先幻化');
    assert.equal(f.c.target.calculatedStats.atk, 300);
    startIllusion(f.c, f.c.target, '自身再幻化');
    assert.equal(f.c.self.calculatedStats.atk, 400, '自身原100＋目標當下300');
    assert.equal(f.c.self.illusion.target.calculatedStats.atk, 300, '保存當次取得值，解除不能讀後來變動');
    endIllusion(targetCtx);
    assert.equal(f.c.target.calculatedStats.atk, 200);
    endIllusion(f.c);
    assert.equal(f.c.self.calculatedStats.atk, 100, '仍扣當次300，不扣目標解除後200');
  });
  check(`${side} 五星各3回合、結束時解除幻化`, () => {
    const f = fixture(F, side); handleAstralAesfiaSoulMark(f.c, E.ON_ENTRANCE);
    assert.deepEqual(f.statuses.map(s => s.duration), [3, 3, 3, 3, 3]); assert.ok(f.c.self.illusion);
    handleAstralAesfiaSoulMark(f.c, 'ON_STATUS_ENDED' as E, { status: '星賜' });
    handleAstralAesfiaSoulMark(f.c, E.ROUND_END); assert.equal(f.c.self.illusion, undefined);
  });
  check(`${side} 空間躍遷鎖切正確且只清鄰位耗盡槽`, () => {
    const f = fixture(F, side), adjacent = make(M, 'adjacent'); adjacent.skills[0].pp = 1; adjacent.skills[1].pp = 5;
    f.teams[f.other].push(adjacent); handleAstralAesfiaSoulMark(f.c, E.BEFORE_ACTION);
    assert.equal(f.c.target.skills[0].pp, 0); assert.equal(f.c.target.skills[1].pp, 5);
    assert.ok(f.timers[f.other].find((t: any) => t.payload.lockSwitch)?.pendingActivation);
    assert.equal(f.timers[f.side].find((t: any) => t.payload.blockSkillDamage).remaining, 1);
  });
  check(`${side} 變思遷憶單額外行動／技能傷害／永久PP上限`, () => {
    const f = fixture(F, side), separated = make(M, 'separated'); f.teams[f.other].push(make(M, 'n1'), make(M, 'n2'), separated);
    f.registries[side].sourceSkillThisAction = F.skills[1]; f.timers[side].push({ id: 'enabled', remaining: 1, kind: 'turn_effect' });
    executeAstralMemory(f.c); assert.equal(f.extras.length, 1); f.extras[0].run(f.c);
    assert.ok(f.damage.every(d => d.type === 'skill_extra_action')); assert.equal(separated.globalPpMaxOffset, -1);
    assert.equal(f.damage.length, 6, '一次基础+五槽各溢出1次，邏輯不合併');
  });
  check(`${side} 艾斯菲格解除需同時滿足三條件`, () => {
    const f = fixture(G, side); f.c.self.initialCounterpart = make(M, 'initial'); handleAstralAesfigSoulMark(f.c, E.ON_ENTRANCE);
    f.registries[side].fieldDamageCounts = { skill: 5, fixed: 5, percent: 5, true: 5 }; f.registries[side].fieldStatusCount = 5;
    f.registries[side].teamEntranceHistory = { owner: 5 }; handleAstralAesfigSoulMark(f.c, E.ENFORCE); assert.ok(f.c.self.illusion);
    f.registries[side].teamEntranceHistory.owner = 6; handleAstralAesfigSoulMark(f.c, E.ENFORCE); assert.equal(f.c.self.illusion, undefined);
  });
  check(`${side} 排隊記憶不由下一隻或已陣亡者代放`, () => {
    const f = fixture(F, side);
    f.registries[side].sourceSkillThisAction = F.skills[0];
    executeAstralMemory(f.c); assert.equal(f.extras.length, 1);
    const owner = f.c.self; owner.currentHp = 0;
    f.extras[0].run(f.c); assert.equal(f.damage.length, 0);
    owner.currentHp = 500; f.teams[side].unshift(make(M, 'incoming'));
    f.extras[0].run(f.c); assert.equal(f.damage.length, 0);
  });
  check(`${side} 摩哥斯魂珠三期／混沌禁止免死／獨立計六維`, () => {
    const f = fixture(M, side); handleMogosSoulMark(f.c, E.ON_ENTRANCE);
    assert.equal(f.registries[side].teamMogosOrb.phase, '豐腴期'); assert.equal(f.statuses.at(-1)?.duration, 3);
    f.c.self.currentHp = 0; assert.equal(handleMogosSoulMark(f.c, E.FATAL_RESIST), true); assert.equal(f.c.self.currentHp, 1);
    assert.equal(f.c.self.calculatedStats.atk, 125); assert.equal(f.c.self.maxHp, 1250);
    assert.equal(f.registries[side].teamMogosOrb.phase, '竭擇期'); assert.equal(handleMogosSoulMark(f.c, E.FATAL_RESIST), false);
    f.c.target.type = '混沌'; drawMogosOrb(f.c); assert.equal(f.registries[side].teamMogosOrb.phase, '混沌期'); assert.equal(handleMogosSoulMark(f.c, E.FATAL_RESIST), false);
  });
  check(`${side} 魂珠雙方使用技能／同隻印記／PP回復場下者`, () => {
    const f = fixture(M, side), bench = make(F, 'bench'); bench.currentHp = 1; f.teams[side].push(bench);
    handleMogosSoulMark(f.c, E.ON_ENTRANCE); const pp = f.c.self.skills[0].pp;
    runMogosTeamEffects(f.c, E.BEFORE_SKILL); assert.equal(f.c.self.skills[0].pp, 0);
    assert.equal(f.marks[f.other][0].ownerBattleId, 'enemy'); assert.equal(f.registries[side].teamOrbHpBonuses.bench, pp * 20);
    for (let i = 0; i < 4; i++) runMogosTeamEffects(f.c, E.OPPONENT_ACTION, { skill: f.c.target.skills[0] });
    const enemyMark = f.marks[f.other].find((m: any) => m.id === 'mogos_residual');
    assert.equal(enemyMark.count, 3); assert.equal(enemyMark.ownerBattleId, 'enemy');
    assert.equal(f.marks[side].some((m: any) => m.id === 'mogos_residual'), false, '雙方出招都只附加到摩哥斯敵方');
  });
  check(`${side} 敵方出招扣敵方PP但恢復及臨時上限固定給摩哥斯隊伍`, () => {
    const f = fixture(M, side), ownBench = make(F, 'own-low'), enemyBench = make(G, 'enemy-low');
    ownBench.currentHp = 1; enemyBench.currentHp = 1;
    f.teams[side].push(ownBench); f.teams[f.other].push(enemyBench);
    handleMogosSoulMark(f.c, E.ON_ENTRANCE);
    const before = f.c.target.skills[0].pp;
    runMogosTeamEffects(f.c, E.OPPONENT_ACTION, { skill: f.c.target.skills[0] });
    assert.equal(f.c.target.skills[0].pp, 0);
    assert.equal(ownBench.currentHp, Math.min(ownBench.maxHp, 1 + before * 20));
    assert.equal(enemyBench.currentHp, 1);
    assert.equal(f.registries[side].teamOrbHpBonuses['own-low'], before * 20);
    assert.equal(f.registries[f.other].teamOrbHpBonuses, undefined);
  });
  check(`${side} 魂珠非真實轉真實／兩次轉化消費／來源印記反應`, () => {
    const f = fixture(M, side); handleMogosSoulMark(f.c, E.ON_ENTRANCE); handleMogosSoulMark(f.c, E.FATAL_RESIST);
    for (let i = 0; i < 2; i++) {
      runMogosTeamEffects(f.c, E.ON_ENTRANCE); const comp: any = { isIncoming: true, damageCategory: 'skill_attack', base: 100, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
      runMogosTeamEffects(f.c, E.BEFORE_DAMAGE, { damageComp: comp }); comp.beforeFinalDamage.forEach((fn: any) => fn());
      assert.equal(comp.multiplier, 0); comp.afterDamage({ settledAmount: 0 });
    }
    assert.equal(f.registries[side].teamMogosOrb, undefined);
    f.marks[side].push({ id: 'mogos_residual', count: 3, ownerBattleId: 'owner' });
    runMogosTeamEffects(f.c, E.AFTER_DAMAGE, { isIncoming: true, damageType: 'percent', damage: 100, skillPower: 20 });
    assert.equal(f.damage.length, 3); assert.ok(f.damage.every(d => d.type === 'percent' && d.reaction));
  });
  check(`${side} 百分比值取特攻速度總和40%／無效鎖至第五成功`, () => {
    const f = fixture(M, side); MOGOS_SKILLS['背隳誓盟'](f.c); runNewElfLifecycle(f.c, E.AFTER_ACTION, { skill: f.c.skill });
    assert.equal(f.damage[0].type, 'percent'); assert.equal(f.damage[0].amount, 80);
    MOGOS_ON_INVALID['王·墮落絕語'](f.c); assert.equal(f.registries[side].teamMogosForceHit, true);
    const move = MOGOS_DAMAGE_TRANSFORMS['王·潰墮妖族'](f.c, { power: 160 }); assert.equal(move.power, 210);
  });
  check(`${side} 睡眠致命一擊分支／反彈按來源HP封頂`, () => {
    const f = fixture(G, side); f.registries[side].actualCritThisAction = true; ASTRAL_AFTER_HIT['念力傾瀉'](f.c, {} as any);
    assert.equal(f.statuses[0].name, 'sleep'); assert.ok(f.timers[side].find((t: any) => t.persistsOffField));
    f.timers[side] = [{ remaining: 3, payload: { reflectSkillQuarter: true, reflectToSide: f.other, reflectToId: 'enemy' } }];
    f.c.target.maxHp = 50; runNewElfLifecycle(f.c, E.AFTER_DAMAGE, { isIncoming: true, damageType: 'skill_attack', damage: 400 });
    assert.equal(f.damage.at(-1).amount, 49);
  });
}
console.log(`新精靈單元語意：${checks} 個檢查通過`);
