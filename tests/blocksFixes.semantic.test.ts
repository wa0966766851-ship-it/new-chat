// P1 積木系統修正（G1–G11 與 5003–5011 個別項）語意測試：執行器層級＋真實戰鬥驅動
import assert from 'node:assert/strict';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { getSkillProgram, getSoulProgram, blockCondPriority, blockSkillTransform, runBlockEvent } from '../src/blocks/registry';
import { parseSkill, parseSoulMark, parseLine } from '../src/blocks/parse';
import { runSkillProgram, runSoulProgram, runStmts, runSideTimers, eventTriggers, evalCond, blockStatusGuard, statusInClass, OPS, settleNoDmgFollowUps, findBlockTimer } from '../src/blocks/runtime';
import { CUSTOM } from '../src/blocks/custom';
import { clearTurnEffects } from '../src/battle/timers';
import { EffectTiming } from '../src/effects/types';
import { resetPrd } from '../src/utils/prd';

let pass = 0, fail = 0;
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e: any) { fail++; console.log(`  ❌ ${name}\n     ${e.message}`); }
}
const stages = () => ({ atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 });
const elf = (o: Record<string, any> = {}) => ({ id: 'x', battleId: 'x', name: 'x', type: '普通', currentHp: 600, maxHp: 1000, shield: 0, barrier: 0, statStages: stages(), battleStatuses: {}, effects: [], skills: [{ name: 'a', category: '物理', pp: 5, maxPp: 5 }], calculatedStats: { atk: 200, def: 200, spatk: 200, spdef: 200, speed: 200 }, ...o });
const skillByName = (n: string) => { for (const e of DEFAULT_ELVES) { const s = e.skills?.find(x => x.name === n); if (s) return s as any; } throw new Error(n); };
const elfById = (id: string) => DEFAULT_ELVES.find(e => String(e.id) === id) as any;

/** 執行器層級模擬：狀態寫在雙方各自的登錄表，消除回合類效果走真正的 clearTurnEffects＋mirrorRegistryKeys */
function mock(selfO: Record<string, any> = {}, oppO: Record<string, any> = {}, immune: { p1?: boolean; p2?: boolean } = {}) {
  resetPrd(() => 0);
  const self: any = elf({ name: '我方', battleId: 'A', ...selfO }), target: any = elf({ name: '對手', battleId: 'B', ...oppO });
  const reg: Record<string, any> = { p1: {}, p2: {} };
  const timers: Record<string, any[]> = { p1: [], p2: [] };
  const marks: Record<string, any[]> = { p1: [], p2: [] };
  const dmg = { pink: 0, fixed: 0, true: 0, skill: 0 }; const heals: number[] = []; const logs: string[] = [];
  const at = (s: string) => (s === 'p1' ? self : target);
  const mk = (side: 'p1' | 'p2'): any => {
    const other = side === 'p1' ? 'p2' : 'p1';
    const c: any = {
      actor: side, targetSide: other, get self() { return at(side); }, get target() { return at(other); }, activeP1: self, activeP2: target,
      get p1Timers() { return timers.p1; }, get p2Timers() { return timers.p2; }, roundNumber: 1,
      skill: { name: '測試', category: '物理', type: '普通' }, rng: () => 0, addLog: (m: string) => logs.push(m),
      getStatuses: (e: any) => e.battleStatuses || {},
      applyStatusWithImmunityCheck: (s: 'p1' | 'p2', st: string, d: number) => {
        if (immune[s]) return { success: false, immune: true };
        at(s).battleStatuses = { ...at(s).battleStatuses, [st]: d }; return { success: true, immune: false };
      },
      applyHeal: (s: string, a: number) => { heals.push(a); const e = at(s); e.currentHp = Math.min(e.maxHp, e.currentHp + a); },
      applyShield: (s: string, a: number) => { at(s).shield += a; },
      applyStatChange: (s: string, ch: Record<string, number>) => { for (const [k, v] of Object.entries(ch)) at(s).statStages[k] += v; },
      updateElf: (s: string, p: any) => Object.assign(at(s), p),
      applyPinkDamage: (_s: string, a: number) => (dmg.pink += a, a), applyFixedDamage: (_s: string, a: number) => (dmg.fixed += a, a),
      applyTrueDamage: (_s: string, a: number) => (dmg.true += a, a), applySkillTypeDamage: (_s: string, a: number) => (dmg.skill += a, a),
      applyAbsorb: (_s: string, a: number) => { dmg.true += a; },
      getPlayerState: (k: string) => reg[side][k], setPlayerState: (k: string, v: any) => { reg[side][k] = v; },
      getOpponentState: (k: string) => reg[other][k], setOpponentState: (k: string, v: any) => { reg[other][k] = v; },
      addTimerTo: (s: string, tm: any) => { timers[s] = [...timers[s].filter(x => x.id !== tm.id), tm]; },
      consumeTimer: (s: string, id: string) => { timers[s] = timers[s].flatMap(x => x.id !== id ? [x] : x.remaining - 1 > 0 ? [{ ...x, remaining: x.remaining - 1 }] : []); },
      clearTurnEffectsOf: (s: string) => {
        const [next, n] = clearTurnEffects(timers[s]);
        for (const tm of timers[s].filter(x => !next.includes(x))) for (const k of tm.payload?.mirrorRegistryKeys || []) reg[s][k] = 0;
        timers[s] = next; return n > 0;
      },
      setMark: (m: any, s: string = other) => { marks[s] = [...marks[s].filter(x => x.id !== m.id), m]; }, clearMark: (id: string, s: string = other) => { marks[s] = marks[s].filter(x => x.id !== id); },
      getMarks: (s: string) => marks[s], getFullTeam: (s: string) => [at(s)],
    };
    return c;
  };
  return { p1: mk('p1'), p2: mk('p2'), self, target, reg, timers, marks, dmg, heals, logs };
}

console.log('\n=== G1 錨定與剩餘子句 ===');
t('亂魂舞：令自身混亂後「處於混亂則攻擊、速度、命中+2」成為獨立句且即時判定', () => {
  const sk = skillByName('亂魂舞'); const p = getSkillProgram(sk);
  assert.equal(p.clauses[1].body.length, 2);
  const h = mock(); h.p1.skill = sk; runSkillProgram(h.p1, p, 'use', [1]);
  assert.ok(h.self.battleStatuses['混亂'] > 0);
  assert.deepEqual([h.self.statStages.atk, h.self.statStages.speed, h.self.statStages.accuracy], [2, 2, 2]);
  const h2 = mock({}, {}, { p1: true }); h2.p1.skill = sk; runSkillProgram(h2.p1, p, 'use', [1]);
  assert.equal(h2.self.statStages.atk, 0, '混亂未附加則不提升');
});
t('錨定後不再吞掉後半句：轉化異常＋另一句會拆開', () => {
  const p = parseSkill('x', '🎯 將對手所處的異常狀態轉化為冰封，若對手不處於異常狀態則改為100%令對手冰封');
  assert.equal(p.clauses[0].body.length, 2);
  assert.equal(parseLine('令對手麻痺並且消耗自身全部體力').body.length >= 1, true);
});

console.log('\n=== G2 分類異常免疫 ===');
t('控制類／弱化類／非附屬類分類正確', () => {
  assert.ok(statusInClass('麻痺', '控制類')); assert.ok(!statusInClass('中毒', '控制類'));
  assert.ok(statusInClass('中毒', '弱化類')); assert.ok(statusInClass('中毒', '非附屬類'));
});
t('鎖魂曲 4回合免疫控制類：只擋控制類', () => {
  const h = mock(); h.p1.skill = skillByName('鎖魂曲'); runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [3]);
  assert.equal(blockStatusGuard(h.timers.p1, h.self, '麻痺'), 'immune');
  assert.equal(blockStatusGuard(h.timers.p1, h.self, '中毒'), null);
});
t('混元護體 免疫並反彈非附屬類 → reflect', () => {
  const h = mock(); h.p1.skill = skillByName('混元護體'); runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [1]);
  assert.equal(blockStatusGuard(h.timers.p1, h.self, '燒傷'), 'reflect');
});

console.log('\n=== G3／G4 致命時保留1點體力（首次） ===');
t('皮特薩拉羅／布萊克：致命子句解析為 survive 而非 mercy', () => {
  for (const id of ['5004', '5005']) {
    const p = getSoulProgram(elfById(id));
    const c = p.clauses.find(x => x.trig === 'fatal' && /保留1點體力/.test(x.raw))!;
    assert.equal(c.body[0].acts[0].op, 'survive', id);
  }
});
t('皮特薩拉羅：首次致命 → 體力1＋對手麻痺；第二次不再觸發（含麻痺）', () => {
  const h = mock({ currentHp: 30 }); h.p1.self; const p = getSoulProgram(elfById('5004'));
  assert.equal(runSoulProgram(h.p1, p, ['fatal'], {}), true);
  assert.equal(h.self.currentHp, 1);
  assert.ok(h.target.battleStatuses['麻痺'] > 0);
  h.target.battleStatuses = {};
  assert.equal(runSoulProgram(h.p1, p, ['fatal'], {}), false);
  assert.equal(h.target.battleStatuses['麻痺'], undefined, '首次旗標於子句執行時寫入');
});
t('強制存活計時器（survive_turns）也把體力設為1', () => {
  const h = mock({ currentHp: 30 });
  OPS.survive_turns(h.p1, { turns: 2 }, { last: null, lastAmount: 0 });
  assert.equal(runBlockEvent(h.p1, EffectTiming.FATAL_RESIST, {}, h.self), true);
  assert.equal(h.self.currentHp, 1);
});

console.log('\n=== G5 實際數值 ===');
t('滿體力恢復 → 等量傷害為 0（不用名目值）', () => {
  const h = mock({ currentHp: 1000 });
  runStmts(h.p1, parseLine('恢復自身最大體力的1/3並造成等量百分比傷害').body, { last: null, lastAmount: 0 });
  assert.equal(h.dmg.pink, 0);
  const h2 = mock({ currentHp: 900 });
  runStmts(h2.p1, parseLine('恢復自身最大體力的1/3並造成等量百分比傷害').body, { last: null, lastAmount: 0 });
  assert.equal(h2.dmg.pink, 100, '實際恢復 100');
});
t('傷害實際為 0 時回報 0（last_no_dmg 判定為真）', () => {
  const h = mock(); h.p1.applyFixedDamage = () => 0;
  const st: any = { last: null, lastAmount: 0 };
  OPS.dmg(h.p1, { flat: 400, type: '固定' }, st);
  assert.equal(st.lastAmount, 0); assert.equal(st.lastDealt, 0);
  assert.equal(evalCond(h.p1, { c: 'last_no_dmg', label: '' }, st), true);
});

console.log('\n=== G6 回合類效果可被消除 ===');
t('天河倒懸寫入的禁療／屬性無效可被對手消除且算消除成功', () => {
  const h = mock(); h.p1.skill = skillByName('淨·天河倒懸');
  h.timers.p2.push({ id: 'dummy', kind: 'turn_effect', remaining: 3, tickAt: 'round_end' });
  runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [2]);
  assert.equal(h.reg.p2.p2_noHealTurns, 3); assert.equal(h.reg.p2.utilitySkillInvalidTurns, 3);
  assert.equal(h.p2.clearTurnEffectsOf('p2'), true);
  assert.equal(h.reg.p2.p2_noHealTurns, 0); assert.equal(h.reg.p2.utilitySkillInvalidTurns, 0);
});
t('自身免疫能力下降／先制提升被消除後歸零', () => {
  const h = mock(); h.p1.skill = skillByName('星光·冥想'); runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [1, 2]);
  h.p1.skill = skillByName('混元護體'); runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [4]);
  assert.ok(h.reg.p1.immuneStatDownTurns > 0 && h.reg.p1.reflectStatusTurns > 0 && h.reg.p1.priorityBoostTurns > 0);
  assert.equal(h.p2.clearTurnEffectsOf('p1'), true);
  assert.equal(h.reg.p1.immuneStatDownTurns, 0); assert.equal(h.reg.p1.reflectStatusTurns, 0); assert.equal(h.reg.p1.priorityBoostTurns, 0);
});
t('魂印寫入的回合鍵不是回合類效果（不建立鏡像）', () => {
  const h = mock();
  runStmts(h.p1, parseLine('2回合內對手無法恢復體力').body, { last: null, lastAmount: 0, event: { trig: 'defeated' } });
  assert.equal(h.timers.p2.length, 0);
});

console.log('\n=== G7 忽略防禦／無視攻擊免疫 ===');
t('ignore_def_turns 寫入引擎讀取鍵；無視攻擊免疫寫 ignoreAttackImmunityThisAction', () => {
  const h = mock();
  runStmts(h.p1, parseLine('下2回合忽略對手25%雙防').body, { last: null, lastAmount: 0 });
  assert.equal(h.reg.p1.ignoreDef25Turns, 3);
  runStmts(h.p1, parseLine('無視對手攻擊免疫').body, { last: null, lastAmount: 0 });
  assert.equal(h.reg.p1.ignoreAttackImmunityThisAction, true);
});

console.log('\n=== G8 條件 invalid／weak／標頭 ===');
t('技能無效時句：使用時不跑、無效時才跑', () => {
  const p = parseSkill('x', '🎯 下2回合攻擊傷害提升150%，技能無效時改為抵擋下次攻擊並附加500點護盾');
  const h = mock(); runSkillProgram(h.p1, p, 'use'); assert.equal(h.self.shield, 0);
  runSkillProgram(h.p1, p, 'on_invalid'); assert.equal(h.self.shield, 500);
});
t('weak：本次克制倍率低於1', () => {
  const h = mock(); h.reg.p1.blkLastTypeMult = 0.5;
  assert.equal(evalCond(h.p1, { c: 'weak', label: '' }, { last: null, lastAmount: 0 }), true);
  h.reg.p1.blkLastTypeMult = 1;
  assert.equal(evalCond(h.p1, { c: 'weak', label: '' }, { last: null, lastAmount: 0 }), false);
});
t('標頭條件：「回合開始時，若自身滿體力」可判定；無法解析者不宣稱已實裝', () => {
  const p = parseSoulMark('x', '回合開始時，若自身滿體力：\n> 令對手100%害怕');
  assert.equal(p.clauses[0].cond?.[0].c, 'hp_full'); assert.equal(p.clauses[0].parsed, true);
  const q = parseSoulMark('x', '回合結束時若自身未受到技能傷害：\n> 吸取對手最大體力1/3');
  assert.equal(q.clauses[0].cond?.[0].c, 'no_skill_dmg');
  const h = mock(); h.reg.p1.blkSkillDmgTakenRound = 1;
  assert.equal(evalCond(h.p1, q.clauses[0].cond![0], { last: null, lastAmount: 0 }), false);
  const u = parseSoulMark('x', '回合結束時若月亮是圓的：\n> 令對手害怕');
  assert.equal(u.clauses[0].parsed, false);
});

console.log('\n=== G9 條件必中 ===');
t('贖魂讚詩：自身異常時必中，否則不變', () => {
  const sk = skillByName('贖魂讚詩');
  const h = mock({ battleStatuses: { 混亂: 2 } });
  assert.equal(blockSkillTransform(h.p1, { ...sk, isSureHit: false }).isSureHit, true);
  const h2 = mock();
  assert.ok(!blockSkillTransform(h2.p1, { ...sk, isSureHit: false }).isSureHit);
});

console.log('\n=== G10 任一項未觸發／數值不跨句 ===');
t('巴弗洛登場：任一項未觸發才降低對手固定／百分比傷害', () => {
  const p = getSoulProgram(elfById('5008'));
  const h = mock({}, {}, { p2: true }); runSoulProgram(h.p1, p, ['entrance'], {});
  assert.ok(h.timers.p2.some(x => x.id.includes('baphomet_fp')), '對手免疫窒息 → 觸發');
  const h2 = mock(); runSoulProgram(h2.p1, p, ['entrance'], {});
  assert.ok(!h2.timers.p2.some(x => x.id.includes('baphomet_fp')), '兩項都成功 → 不觸發');
});
t('究極吸取：等量取實際攻擊傷害，不讀上一句的300護盾', () => {
  const sk = skillByName('星光·究極吸取'); const p = getSkillProgram(sk);
  const h = mock({}, { statStages: { ...stages(), atk: 2 }, battleStatuses: { 麻痺: 2 } }); h.p1.skill = sk;
  runSkillProgram(h.p1, p, 'use');
  assert.equal(h.self.shield, 300); assert.equal(h.dmg.pink, 240, '使用時只有「吸取240」（固定值吸取＝固定傷害），等量傷害尚未附加');
  h.reg.p1.blkLastHitDamage = 180;
  runSkillProgram(h.p1, p, 'after_hit');
  assert.equal(h.dmg.pink, 240 + 180, '傷害結算後附加等量 180');
});

console.log('\n=== G11 戰鬥開始 ===');
t('首發登場映射 battle_start（每方一次）', () => {
  const h = mock();
  assert.ok(eventTriggers(h.p1, EffectTiming.ON_ENTRANCE, {}).includes('battle_start'));
  assert.ok(!eventTriggers(h.p1, EffectTiming.ON_ENTRANCE, {}).includes('battle_start'));
});

console.log('\n=== 個別精靈 ===');
t('5003 魂印：恰好50%體力時套用「不低於1/2」側', () => {
  const p = getSoulProgram(elfById('5003'));
  const h = mock({ currentHp: 500 });
  const [hi, lo] = [p.clauses[1].cond![0], p.clauses[2].cond![0]];
  assert.equal(evalCond(h.p1, hi, { last: null, lastAmount: 0 }), true); assert.equal(evalCond(h.p1, lo, { last: null, lastAmount: 0 }), false);
});
t('5004 魂印：背包時對方登場麻痺預設3回合', () => {
  const h = mock(); OPS.bench_entrance_status(h.p1, { chance: 100, status: '麻痺' }, { last: null, lastAmount: 0 });
  assert.equal(h.self.battleStatuses['麻痺'], 3);
});
t('5006 音速火拳：對手先制-3 不覆寫對手自身先制提升', () => {
  const h = mock(); h.reg.p2.priorityBoostTurns = 3; h.reg.p2.priorityBoostValue = 2;
  h.timers.p2.push({ id: 'd', kind: 'turn_effect', remaining: 2, tickAt: 'round_end' });
  h.p1.skill = skillByName('星光·音速火拳'); runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [1]);
  assert.equal(h.reg.p2.priorityBoostValue, 2);
  const tm = h.timers.p2.find(x => x.payload?.block?.prio === -3)!;
  assert.ok(tm.pendingActivation);
  assert.equal(findBlockTimer(h.timers.p2, b => b.prio != null), undefined, '本回合未生效');
});
t('5006 不滅之火：附加後對手體力未減少以實際扣血（hpReduced）判定', () => {
  const sk = skillByName('星光·不滅之火'); const h = mock(); h.p1.skill = sk;
  runSkillProgram(h.p1, getSkillProgram(sk), 'use', [4]);
  const tm = h.timers.p1.find(x => x.payload?.block?.trig === 'self_skill')!;
  runSideTimers(h.p1, ['self_skill'], {});
  assert.equal(h.dmg.fixed, 400); assert.equal(h.dmg.true, 0, '未結算前不判定');
  settleNoDmgFollowUps(h.p1, { damageType: 'fixed', targetSide: 'p2', hpReduced: 0 });
  assert.equal(h.dmg.true, 400);
  runSideTimers(h.p1, ['self_skill'], {});
  settleNoDmgFollowUps(h.p1, { damageType: 'fixed', targetSide: 'p2', hpReduced: 400 });
  assert.equal(h.dmg.true, 400, '有扣血則不追加'); void tm;
});
t('5007 深潛者盛宴：能力下降視為2倍同級提升寫入 blkStageAsBoost；計時器 id 帶方位；技能結束清除待決', () => {
  const h = mock({ statStages: { ...stages(), def: -2 } }); h.p1.skill = skillByName('深潛者盛宴');
  CUSTOM['自身處於能力下降狀態時先制+3且使用技能不受PP值限制、將自身任意能力下降狀態視為至少2倍同等級的全屬性能力提升'].run(h.p1, { last: null, lastAmount: 0 });
  assert.equal(h.reg.p1.blkStageAsBoost, 4);
  runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [4, 5]);
  assert.ok(h.timers.p1.some(x => x.id === 'blk_p1_brinkk_feast_damage'));
  assert.equal(h.reg.p1.brinkkFeastAbsorbFallbackPending, true);
  runSideTimers(h.p1, ['self_after_skill'], {});
  assert.equal(h.reg.p1.brinkkFeastAbsorbFallbackPending, false);
});
t('5008 魂印：抵擋隨異常提前解除而結束；轉化混亂同步 battleStatuses；鎖魂曲護罩也算', () => {
  const h = mock({ battleStatuses: { 混亂: 2 } });
  CUSTOM['直到上述異常結束前自身抵擋受到的技能傷害'].run(h.p1, { last: null, lastAmount: 0, event: { trig: 'any_status', data: { side: 'p1', status: '混亂', duration: 2 } } });
  const comp: any = { base: 100, damageCategory: 'skill_attack', isIncoming: true, increasePercent: 0, decreasePercent: 0, multiplier: 1 };
  runSideTimers(h.p1, ['incoming'], { damageComp: comp }); assert.equal(comp.multiplier, 0);
  h.self.battleStatuses = {}; const comp2: any = { ...comp, multiplier: 1 };
  runSideTimers(h.p1, ['incoming'], { damageComp: comp2 }); assert.equal(comp2.multiplier, 1);
  assert.equal(h.timers.p1.length, 0);
  const h2 = mock({ battleStatuses: { 麻痺: 2 }, effects: [{ id: '麻痺', duration: 2 }] });
  CUSTOM['自身受到異常時立即轉化為混亂'].run(h2.p1, { last: null, lastAmount: 0, event: { trig: 'status_received', data: { side: 'p1', status: '麻痺', duration: 2 } } });
  assert.equal(h2.self.battleStatuses['麻痺'], undefined); assert.ok(h2.self.battleStatuses['混亂'] > 0);
  const sk = skillByName('鎖魂曲');
  assert.equal(blockCondPriority(sk, elf(), elf({ barrier: 100 }), (e: any) => e.battleStatuses || {}), 2);
});
t('5011 金光綠葉：下回合傷害轉體力使用 pendingActivation', () => {
  const h = mock(); h.timers.p2.push({ id: 'd', kind: 'turn_effect', remaining: 2, tickAt: 'round_end' });
  h.p1.skill = skillByName('星光·金光綠葉'); runSkillProgram(h.p1, getSkillProgram(h.p1.skill), 'use', [1]);
  const tm = h.timers.p1.find(x => x.payload?.block?.absorbToHeal)!;
  assert.ok(tm && tm.pendingActivation && tm.remaining === 1);
});

// ───────── 真實戰鬥 ─────────
const { JSDOM } = await import('jsdom');
const React = (await import('react')).default; const { act } = await import('react');
const { createServer } = await import('vite');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(window as any).__BATTLE_FAST__ = true;
const oe = console.error; console.error = (...a: any[]) => { const s = String(a[0]); if (s.includes('act(') || s.includes('Warning')) return; oe(...a); };
const { createRoot } = await import('react-dom/client'); const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const wait = async (n = 25) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); }); };
try {
  console.log('\n=== 真實戰鬥 ===');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { DEFAULT_ELVES: ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { normalizeElfStats } = await server.ssrLoadModule('/src/utils/elfStats.ts');
  const { OPS: LOPS } = await server.ssrLoadModule('/src/blocks/runtime.ts');
  const R = getBattleSkillRegistry();
  R['T秒殺'] = (c: any) => { c.applyTrueDamage(c.targetSide, 99999, 'T秒殺'); };
  R['T控免'] = (c: any) => { LOPS.immune_status_turns(c, { turns: 4, cls: '控制類' }, { last: null, lastAmount: 0 }); };
  R['T麻痺術'] = (c: any) => { c.applyStatusWithImmunityCheck(c.targetSide, '麻痺', 2); };
  R['T中毒術'] = (c: any) => { c.applyStatusWithImmunityCheck(c.targetSide, '中毒', 2); };
  R['T消回合'] = (c: any) => { if (c.clearTurnEffectsOf(c.targetSide)) { c.addLog('T消回合成功'); c.applyStatusWithImmunityCheck(c.targetSide, '麻痺', 2); } };
  const sk = (name: string, category = '屬性', power = 0, priority = 0) => ({ name, category, type: '普通', power, pp: 20, maxPp: 20, priority, isSureHit: true, description: '' });
  const mkE = (id: string, hp: number, skills: any[], speed = 10): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp, baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, statStages: {}, skills });
  const real = (id: string, b: string) => { const e = normalizeElfStats(structuredClone(ELVES.find((x: any) => String(x.id) === id))); e.battleId = b; return e; };
  let d: any; let key = 0; let seen = 0;
  const start = async (p1: any[], p2: any[]) => { key++; seen = 0; await act(async () => root.render(React.createElement(Battle, { key, initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].battleId, p2StarterId: p2[0].battleId, battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (x: any) => d = x }))); await wait(10); };
  const st = () => d.getSyncState();
  const newLogs = () => { const l = st().logs.slice(seen).map((x: any) => x.text); seen = st().logs.length; return l.join('\n'); };
  const skillOf = (side: 'p1' | 'p2', name: string) => st()[side].skills.find((s: any) => s.name === name);
  const turn = async (a: string, b: string) => { await act(async () => { d.onSkillSelect('p1', skillOf('p1', a)); d.onSkillSelect('p2', skillOf('p2', b)); }); await wait(35); return newLogs(); };
  const fx = (side: 'p1' | 'p2') => Object.fromEntries(Object.entries(st()[side].battleStatuses || {}));

  // 布萊克：致命傷害 → 保留1點體力並存活、對手害怕；首次旗標寫入
  const black = real('5005', 'BK');
  await start([black], [mkE('X', 5_000_000, [sk('T秒殺')])]);
  newLogs();
  const L1 = await turn('夜魔之球', 'T秒殺');
  t('真實戰鬥：布萊克首次致命保留1點體力', () => {
    assert.equal(st().p1.currentHp, 1, L1);
    assert.ok(fx('p2')['害怕'] > 0, '對手害怕');
    assert.ok(Object.keys(st().p1RegistryState).some(k => k.startsWith('blkOnce:') && st().p1RegistryState[k]), '首次旗標');
  });

  // 分類免疫（引擎 blockStatusGuard 掛鉤）：控制類被擋、弱化類照常
  await start([mkE('A', 100000, [sk('T控免')], 200)], [mkE('Y', 100000, [sk('T麻痺術'), sk('T中毒術')])]);
  await turn('T控免', 'T麻痺術');
  t('真實戰鬥：控制類免疫擋下麻痺', () => assert.ok(!(fx('p1')['麻痺'] > 0)));
  await turn('T控免', 'T中毒術');
  t('真實戰鬥：控制類免疫不擋中毒', () => assert.ok(fx('p1')['中毒'] > 0));

  // 星光·冥想寫入的免疫能力下降／反彈異常可被對手消除（算消除成功），之後麻痺命中
  const mk6 = real('5006', 'MK'); mk6.skills = [...mk6.skills, sk('T等待')];
  R['T等待'] = () => {};
  await start([mk6], [mkE('Z', 5_000_000, [sk('T消回合')])]);
  let L3 = await turn('星光·冥想', 'T消回合');
  for (let i = 0; i < 4 && !/T消回合成功/.test(L3); i++) L3 = await turn('T等待', 'T消回合');
  t('真實戰鬥：冥想的回合類效果被消除且算成功', () => {
    assert.match(L3, /T消回合成功/);
    assert.ok(!(st().p1RegistryState.immuneStatDownTurns > 0), '免疫能力下降已歸零');
    assert.ok(!(st().p1RegistryState.reflectStatusTurns > 0), '反彈異常已歸零');
    assert.ok(fx('p1')['麻痺'] > 0, '反彈被消除後麻痺命中');
  });
} catch (e) { console.error(e); fail++; }
await server.close();
console.log(`\n積木系統修正：通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
