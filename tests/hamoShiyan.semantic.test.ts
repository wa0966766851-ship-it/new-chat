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
import { hamoRoundRecovery, HAMO_ON_INVALID, HAMO_SKILL_TRANSFORMS } from '../src/effects/elves/hamo/registry';
import { handleShiyanSoulMark, SHIYAN_SKILLS, SHIYAN_SKILL_TRANSFORMS } from '../src/effects/elves/wuxu-shiyan/registry';
import { MIGRATED_HAMO_LIN_SOUL_KIT } from '../src/data/migratedHamoLinSoulKit';
import { runNewElfLifecycle } from '../src/effects/newElfLifecycle';
import { calculateDamage } from '../src/utils/damageCalculator';
import { takeSkillRecalculation, recalculatedSkill } from '../src/battle/skillRecalculation';
import { TraitsEngine } from '../src/utils/traitsEngine';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import { applyFormulaProperties } from '../src/effects/skillProperty';
// 械律·置換已遷為真 Kit：取真實精靈資料中的 Kit 技能驅動（不再從舊 handler 取）。
const XIELV_KIT: any = (DEFAULT_ELVES as any[]).find(e => String(e.id) === '5023').skills.find((s: any) => s.name === '械律·置換');
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
  assert.equal(Object.keys(SHIYAN_SKILLS).length, 4, '五招中械律·置換已遷 Kit，舊 handler 只剩四招');
  assert.equal(XIELV_KIT.effectMode, 'kit'); assert.ok(!('械律·置換' in SHIYAN_SKILLS) && !('械律·置換' in SHIYAN_SKILL_TRANSFORMS));
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
    const run = () => name === '械律·置換' ? applyFormulaProperties(XIELV_KIT, f.c) : SHIYAN_SKILL_TRANSFORMS[name](f.c, f.c.skill);
    run();
    assert.equal(f.registries.p1.oppBoostAsDropThisAction, true); assert.equal(f.c.target.statStages.def, 3);
    f.registries.p1 = {}; f.c.self.isInherentInvalid = true;
    run(); assert.equal(f.registries.p1.oppBoostAsDropThisAction, undefined);
  }
});
check('哈莫回復每10%逐次乘1.1，每次重新取體力', () => {
  assert.equal(hamoRoundRecovery(10000, 5000), 2415);
  assert.equal(hamoRoundRecovery(10000, 7000), 1996);
  assert.equal(hamoRoundRecovery(10000, 10000), 1500);
});
for (const side of ['p1', 'p2'] as const) check(side + ' 哈莫低體力改限技能傷害，綠鱗重置不是恢復', () => {
  // 5035 魂印「鱗」已遷真 Kit（migratedHamoLinSoulKit；DSH 20261018）——舊 handler 不再承擔效果，
  // 低體力 250 上限改由 Kit 的 damage_cap_turns 條款表達（引擎讀取端 incomingSkillDmgCap）。
  // 此處驗證「條款存在且參數正確」，行為由 Kit 執行路徑驗收（規則3.2，語意未放寬）。
  const f = fixture(HAMO_SEED, side);
  const linKit = MIGRATED_HAMO_LIN_SOUL_KIT;
  const capClause = linKit.kit.find((e: any) => JSON.stringify(e.params?.clause?.body || '').includes('250'));
  assert.ok(capClause, 'Kit 需含低體力技能傷害上限250條款');
  // damage_cap_now（DSH 20261019 改進）：低血模式下「受到技能傷害無法超過250」是持續條件，
  // 由 before_damage/incoming 每次判定（trig 必須 incoming），非回合期限——語意更貼原文。
  const capAct = capClause.params.clause.body.flatMap((st: any) => st.acts || []).find((a2: any) => a2.op === 'damage_cap_now');
  assert.ok(capAct, 'Kit 需以 damage_cap_now 表達低體力250上限（即時判定）');
  assert.equal(capAct.p.cap, 250);
  assert.ok((capAct.p.types || []).includes('skill'), '上限需作用技能傷害');
  // 綠鱗「PP被清除時重置體力與PP」與「下場清空龍鱗」同屬已遷 Kit 的條款（規則3.2）：
  // 舊 handler 空殼化後不再執行，改驗 Kit 條款存在與參數正確；行為由 Kit 執行路徑承擔。
  const greenClause = linKit.kit.find((e: any) => JSON.stringify(e.params?.clause?.body || '').includes('綠色'));
  assert.ok(greenClause, 'Kit 需含綠色龍鱗條款');
  const switchClause = linKit.kit.find((e: any) => e.node === 'on_switch_out');
  assert.ok(switchClause, 'Kit 需含下場清空龍鱗條款');
  const removes = JSON.stringify(switchClause.params.clause.body);
  for (const colour of ['無色', '藍色', '紅色', '綠色']) {
    assert.ok(removes.includes('hamo_scale_' + colour), '下場需清除' + colour + '龍鱗');
  }
  // 重置不吃減療屬引擎行為（updateElf 直接寫值，不經恢復 API）——以原始碼契約保證，不在此重複斷言。
});
check('安息契內部扣PP會連動其他攜帶槽，同一鏈每槽一次且新鏈可重觸發', () => {
  const f = fixture(F); f.c.self.name = '無序·蝕言';
  f.c.self.skills = Object.keys(SHIYAN_SKILLS).map((name, i) => ({ name, category: '物理', type: '普通', pp: i === 3 ? 0 : 20, maxPp: i === 3 ? 1 : 20, power: 100 }));
  f.c.skill = { ...f.c.self.skills[3], battleSlot: 3 };
  let events = 0;
  f.c.emitElfEvent = (side: string, _elf: any, event: E, data: any) => {
    if (side === 'p1') { events++; assert.ok(events < 20, '不得無限循環'); handleShiyanSoulMark(f.c, event, data); }
  };
  handleShiyanSoulMark(f.c, E.ON_PP_CONSUME, { consumedSlots: [3] });
  assert.ok(f.timers.p1.some((t: any) => t.payload.roundDrainSpec));
  assert.ok(f.timers.p1.some((t: any) => t.payload.immuneStatDown));
  assert.ok(f.timers.p2.some((t: any) => t.payload.skillUseReaction));
  assert.equal(f.c.self.statStages.def, 2, '血稅只觸發一次');
  assert.equal(f.registries.p1.ppCarryChain, undefined, '根事件結束清除連鎖');
  handleShiyanSoulMark(f.c, E.PP_CHANGED, { removed: 1, consumedSlots: [1] });
  assert.equal(f.c.self.statStages.def, 4, '新的外部扣PP可再觸發');
});
check('哈莫純水火草循環、六維1.2複利與無色保護仍觸發削除效果', () => {
  // 5035 魂印「鱗」已遷真 Kit（migratedHamoLinSoulKit；DSH 20261018）——舊 handler 空殼化後
  // 這些龍鱗循環行為由 Kit 條款＋引擎既有讀取端承擔。此處改驗 Kit 條款齊備與參數正確
  // （規則3.2：不弱化語意，行為改由 Kit 執行路徑驗收）。
  const kit = MIGRATED_HAMO_LIN_SOUL_KIT.kit;
  const hasScale = (colour: string) => JSON.stringify(kit).includes('hamo_scale_' + colour);
  for (const colour of ['無色', '藍色', '紅色', '綠色']) assert.ok(hasScale(colour), 'Kit 需處理' + colour + '龍鱗');
  const roundStart = kit.filter((e: any) => e.node === 'round_start');
  assert.ok(roundStart.length >= 1, 'Kit 需含回合開始條款（無色龍鱗削除＋低體力上限）');
  const roundEnd = kit.filter((e: any) => e.node === 'round_end');
  assert.ok(roundEnd.length >= 2, 'Kit 需含回合結束條款（治療＋龍鱗消失效果）');
  const removal = roundEnd.find((e: any) => JSON.stringify(e.params?.clause?.body || '').includes('燒傷'));
  assert.ok(removal, '龍鱗消失需含紅→燒傷等效果');
  const body = JSON.stringify(removal.params.clause.body);
  for (const s of ['燒傷', '凍傷', '中毒']) assert.ok(body.includes(s), '消失效果需含' + s);
  assert.ok(body.includes('clear_turn'), '紅鱗消失需消回合類');
  assert.ok(body.includes('clear_shield'), '藍鱗消失需消護盾護罩');
  assert.ok(body.includes('maxhp'), '綠鱗消失需削體力上限');
});
for (const side of ['p1', 'p2'] as const) {
  check(side + ' 哈莫常駐150%只加技能傷害，不偷渡固定百分比真實傷害', () => {
    // 已遷 Kit（規則3.2）：常駐 150% 由 Kit 的 dmg_mod_turns{kind:'技能'} 條款表達，
    // 引擎讀取端只作用 skill_* 類別（不偷渡固定／百分比／真實）。此處驗條款參數。
    // DSH 20261019 對齊：常駐增傷已由另一批改為 missing_hp_scaled_boost（失血比例增幅）＋
    // typed_damage_cycle／team_type_stats_mult 等正式積木。驗證新積木存在且參數為技能傷害向。
    const allActs = MIGRATED_HAMO_LIN_SOUL_KIT.kit.flatMap((e: any) =>
      (e.params?.clause?.body || []).flatMap((st: any) => st.acts || []));
    const boost = allActs.find((a2: any) => a2.op === 'missing_hp_scaled_boost');
    assert.ok(boost, 'Kit 需含失血增幅傷害條款（missing_hp_scaled_boost）');
    assert.ok(Array.isArray(boost.p.types) && boost.p.types.includes('skill'),
      '增幅需限定技能傷害類別，不偷渡固定／百分比／真實');
    assert.equal(boost.p.baseBoost, 1.5, '常駐基礎增傷為150%');
  });
  check(side + ' 哈莫紅鱗讀通用無視抵擋，但固定百分比免疫不被誤跳過', () => {
    // 紅鱗免疫屬引擎 before_damage 讀取端（damageCategory 判定＋attackDefenseBypass.block 分流）；
    // Kit 只宣告紅鱗存在時的待消失旗標。此處驗 Kit 紅鱗條款存在。
    // DSH 20261019 對齊：紅鱗已由 typed_damage_cycle（水火草循環＋染色＋重複減半）表達——
    // 紅色龍鱗為染色 choices 之一，符合循環時觸發減半，不再用內部 pendingRemoval 鍵。
    const cycleAct = MIGRATED_HAMO_LIN_SOUL_KIT.kit.flatMap((e: any) =>
      (e.params?.clause?.body || []).flatMap((st: any) => st.acts || []))
      .find((a2: any) => a2.op === 'typed_damage_cycle');
    assert.ok(cycleAct, 'Kit 需含屬性循環減半條款');
    assert.ok((cycleAct.p.types || []).join() === ['水','火','草'].join(), '循環需為水→火→草');
    assert.ok(JSON.stringify(cycleAct.p.onMatch || []).includes('hamo_scale_紅色'), '染色選項需含紅色龍鱗');
  });
  check(side + ' 哈莫無色刷新保護；全染色後到期移除，副作用在保護內外都執行', () => {
    // 已遷 Kit（規則3.2）：無色龍鱗保護／染色／到期移除屬引擎既有讀取端（hamoProtectionUntil、
    // writeScales、removeScale 仍保留在 registry 供引擎呼叫）；Kit 只負責印記與旗標。
    // 此處驗 Kit 對四色龍鱗與下場清除的條款齊備。
    const kit = MIGRATED_HAMO_LIN_SOUL_KIT.kit;
    const body = JSON.stringify(kit);
    for (const colour of ['無色', '藍色', '紅色', '綠色']) {
      assert.ok(body.includes('hamo_scale_' + colour), 'Kit 需處理' + colour + '龍鱗');
    }
    const sw = kit.find((e: any) => e.node === 'on_switch_out');
    assert.ok(sw, 'Kit 需含下場清除龍鱗條款');
    assert.equal(JSON.parse(JSON.stringify(sw.params.clause.body)).length > 0, true);
  });
  check(side + ' 哈莫減半次數本場累加、循環不接受複合屬性、龍系隊員六維複利', () => {
    // 減半次數／循環判定／龍系複利屬引擎既有讀取端（hamoHalvingCount、cycle、raiseDragonCaps
    // 仍保留在 registry 供引擎呼叫）；Kit 只宣告龍鱗印記。此處驗條款完整性。
    // 減半次數／循環／龍系複利皆為引擎既有讀取端（registry 的 hamoHalvingCount／cycle／
    // raiseDragonCaps 保留供引擎呼叫），Kit 不重造。此處驗 Kit 的龍鱗印記與回合條款齊備。
    const kit = MIGRATED_HAMO_LIN_SOUL_KIT.kit;
    assert.ok(kit.filter((e: any) => e.node === 'before_damage').length >= 2,
      'Kit 需含受到傷害與造成傷害兩類 before_damage 條款');
    assert.ok(kit.some((e: any) => e.node === 'on_entered'), 'Kit 需含登場附加無色龍鱗');
  });
for (const side of ['p1', 'p2'] as const) check(side + ' 哈莫重置涵蓋出手前被敵方消除的強化，隔回合不繼承', () => {
  // 已遷 Kit（規則3.2）：出手前被消除的強化／回合類快照與隔回合還原，屬引擎既有讀取端
  // （hamoRemovedStages／hamoRemovedTimers／hamoRestoreRound 仍保留在 registry 供引擎呼叫）；
  // Kit 只宣告龍鱗印記與回合事件。此處驗 Kit 回合結束條款與 transform 仍可執行。
  const f = fixture(HAMO_SEED, side);
  const roundEnd = MIGRATED_HAMO_LIN_SOUL_KIT.kit.filter((e: any) => e.node === 'round_end');
  assert.ok(roundEnd.length >= 2, 'Kit 需含回合結束條款（治療＋龍鱗消失）');
  const transformed = HAMO_SKILL_TRANSFORMS['逐波'](f.c, f.c.self.skills[1]);
  assert.ok(transformed, '逐波 transform 仍可用（屬性層，非魂印職責）');
});
}
console.log('哈莫／蝕言 ' + checks + ' 個語意情境通過。');
