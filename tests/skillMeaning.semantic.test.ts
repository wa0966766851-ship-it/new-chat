import assert from 'node:assert/strict';
import { BRINKK_SKILLS, BRINKK_DAMAGE_TRANSFORMS, handleBrinkkSoulMark } from '../src/effects/brinkkRegistry';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { calculateDamage } from '../src/utils/damageCalculator';
import { getTypeMatchup } from '../src/utils/statCalculator';
import { skillStageView } from '../src/battle/skillStageView';
import { computeHitChance } from '../src/effects/genericSkillText';
import { parseSkill } from '../src/blocks/parse';
import { runSkillProgram } from '../src/blocks/runtime';
import { isPpCostFree, isZeroPpExempt } from '../src/utils/battleHelpers';
import { EffectTiming } from '../src/effects/types';
import { clearTurnEffects, tickTimers } from '../src/battle/timers';

function setup(side: 'p1' | 'p2', skillName: string) {
  const self: any = structuredClone(DEFAULT_ELVES.find(e => e.id === '5007')!);
  self.battleId = 'sea'; self.currentHp = 1000; self.maxHp = 1000; self.ivs = { hp: 0 };
  const target: any = structuredClone(DEFAULT_ELVES.find(e => e.id === '5005')!);
  target.battleId = 'foe'; target.maxHp = 1200; target.currentHp = 1000; target.statStages = { atk: 2, def: 2 };
  const other = side === 'p1' ? 'p2' : 'p1';
  const state: any = { cthyaatInitialized: true }, oppState: any = {};
  const timers: any[] = [], oppTimers: any[] = [], damages: any[] = [], absorbs: any[] = [], heals: any[] = [];
  let immune = false;
  const ctx: any = { self, target, actor: side, targetSide: other, skill: self.skills.find((s: any) => s.name === skillName), moveIndex: 0,
    activeP1: side === 'p1' ? self : target, activeP2: side === 'p2' ? self : target,
    p1Timers: side === 'p1' ? timers : oppTimers, p2Timers: side === 'p2' ? timers : oppTimers,
    getPlayerState: (k: string) => state[k], setPlayerState: (k: string, v: any) => state[k] = v,
    getOpponentState: (k: string) => oppState[k], setOpponentState: (k: string, v: any) => oppState[k] = v,
    getFullTeam: (s: string) => [s === side ? self : target], addLog: () => {},
    updateAnyElf: (s: string, id: string, patch: any) => Object.assign(s === side ? self : target, patch),
    applyStatChange: (s: string, values: any) => { const e = s === side ? self : target; e.statStages ||= {}; for (const [k,v] of Object.entries(values)) e.statStages[k] = (e.statStages[k] || 0) + Number(v); },
    applyTrueDamage: (s: string, amount: number, label: string) => { damages.push({ s, amount, label }); return amount; },
    applyPinkDamage: (s: string, amount: number, label: string, _p1: any, _p2: any, kind: string) => { damages.push({ s, amount, label, kind }); return amount; },
    applyHeal: (s: string, amount: number) => heals.push({ s, amount }),
    applyAbsorb: (s: string, amount: number, label: string) => absorbs.push({ s, amount, label }),
    getStatuses: (e: any) => e.battleStatuses || {},
    applyStatusWithImmunityCheck: (s: string, name: string, turns: number) => { if (immune) return { success: false, immune: true }; const e = s === side ? self : target; e.battleStatuses ||= {}; e.battleStatuses[name] = turns; return { success: true, immune: false }; },
    addTimerTo: (s: string, t: any) => { const list = s === side ? timers : oppTimers; const i = list.findIndex(x => x.id === t.id); if (i < 0) list.push(t); else list[i] = t; },
    consumeTimer: (s: string, id: string) => { const list = s === side ? timers : oppTimers; const i = list.findIndex(x => x.id === id); if (i >= 0) list.splice(i, 1); },
    clearTurnEffectsOf: () => false,
  };
  return { ctx, self, target, state, oppState, timers, oppTimers, damages, absorbs, heals, immune: (v: boolean) => immune = v };
}
for (const side of ['p1', 'p2'] as const) {
  const h = setup(side, '溺咒之握');
  BRINKK_SKILLS['溺咒之握'](h.ctx);
  const skill = BRINKK_DAMAGE_TRANSFORMS['溺咒之握'](h.ctx, h.ctx.skill);
  assert.equal(skill.power, 500, '100+1200/3+0；0個體不能變31');
  assert.equal(h.self.statStages.atk, 2); assert.equal(h.target.statStages.def, -2);
  assert.equal(h.damages.length, 0, '威力不能換成真傷');
  const actual = calculateDamage(h.self, h.target, skill, side, undefined, undefined, 1, false);
  const base = calculateDamage(h.self, h.target, { ...skill, power: 100 }, side, undefined, undefined, 1, false);
  assert.ok(actual.damage > base.damage * 4);
  h.target.battleStatuses = { 凍傷: 3 }; h.immune(true); BRINKK_SKILLS['溺咒之握'](h.ctx);
  assert.equal(h.target.battleStatuses.凍傷, 3); assert.equal(h.damages.length, 0, '轉化失敗不能觸發成功真傷');
  h.immune(false); BRINKK_SKILLS['溺咒之握'](h.ctx);
  assert.equal(h.target.battleStatuses.凍傷, undefined); assert.equal(h.damages[0].amount, 150);

  const d = setup(side, '深海働哭'); d.self.battleStatuses = { 星賜: 3, 中毒: 3 };
  BRINKK_SKILLS['深海働哭'](d.ctx);
  assert.equal(d.self.battleStatuses.星賜, 3); assert.equal(d.self.battleStatuses.中毒, undefined);
  assert.equal(d.timers.some(t => t.id === 'brinkk_freeze_pending'), false, '首次成功附加漸凍不能誤走已有分枝');
  assert.equal(d.absorbs[0].amount, 250);
  d.self.currentHp = 100; handleBrinkkSoulMark(d.ctx, EffectTiming.BEFORE_ACTION);
    assert.equal(d.damages.at(-1).amount, 800, '自身低血吸取翻倍');
    assert.equal(d.damages.at(-1).kind, 'percent', '持續吸取是百分比傷害，不是真傷');
    assert.equal(d.heals.at(-1).amount, 800, '按百分比傷害結算值恢復');
    assert.equal(d.absorbs.length, 1, '立即汲取仍為真傷，持續吸取不走舊API');
  handleBrinkkSoulMark(d.ctx, EffectTiming.OPPONENT_DAMAGE, { hpReduced: 0, label: '深海働哭·持續吸取' });
  assert.equal(d.damages.at(-1).amount, 300);
  assert.equal(clearTurnEffects(d.timers)[0].length, 0, '持續效果可清除');

  const ch = setup(side, '癡愚之觸'); BRINKK_SKILLS['癡愚之觸'](ch.ctx);
  handleBrinkkSoulMark(ch.ctx, EffectTiming.OPPONENT_ACTION, { skill: ch.ctx.skill });
  assert.equal(ch.oppState.next2AtkInvalid, 1);
  ch.oppState.next2AtkInvalid = 0; // 主引擎成功無效後消耗首次次數。
  handleBrinkkSoulMark(ch.ctx, EffectTiming.SKILL_INVALID, { isIncoming: true, reason: '【癡愚之觸】' });
  assert.equal(ch.oppState.next2AtkInvalid, 1, '無效成功額外附加一次');
  handleBrinkkSoulMark(ch.ctx, EffectTiming.SKILL_INVALID, { isIncoming: true, reason: '【癡愚之觸】' });
  assert.equal(ch.oppState.next2AtkInvalid, 1, '不能同一成功事件重複加次數');

  const c = setup(side, '不淨者之約');
  const enemy = ['草', '聖靈', '自然', '光'].find(type => getTypeMatchup(type, c.self.type) > 1)!; c.target.type = enemy;
  const comp = { bonus: 0 }; handleBrinkkSoulMark(c.ctx, EffectTiming.MODIFY_PRIORITY, { priorityComp: comp }); assert.equal(comp.bonus, 3);
  c.self.isInherentInvalid = true; comp.bonus = 0; handleBrinkkSoulMark(c.ctx, EffectTiming.MODIFY_PRIORITY, { priorityComp: comp }); assert.equal(comp.bonus, 0);
  assert.ok(c.ctx.skill.description.includes('■ 對手為自身天敵時額外先制+3'));

  const f = setup(side, '深潛者盛宴'); f.self.statStages = { atk: -2, speed: -1, accuracy: -1 }; f.ctx.skill.isSureHit = false;
  assert.equal(skillStageView(f.self, f.ctx.skill, 'atk'), 4); assert.equal(skillStageView(f.self, f.ctx.skill, 'speed'), 4);
  assert.deepEqual(f.self.statStages, { atk: -2, speed: -1, accuracy: -1 });
  assert.equal(isZeroPpExempt(f.self, { ...f.ctx.skill, pp: 0 }), true); assert.equal(isPpCostFree(f.self, f.ctx.skill), false);
  runSkillProgram(f.ctx, parseSkill(f.ctx.skill.name, f.ctx.skill.description), 'use');
  assert.deepEqual(f.damages.map(x => [x.kind, x.amount]), [['fixed',40],['fixed',40],['fixed',40],['fixed',40],['fixed',40],['fixed',300]], '每次吸取獨立固定傷害；雙方5種變化');
  assert.deepEqual(f.heals.map(x => x.amount), [40,40,40,40,40,300], '各筆依結算值提出等量恢復');
  assert.equal(f.absorbs.length, 0, '不再使用舊的真傷吸取API');
  assert.ok(f.timers.some(t => t.id === `blk_${side}_brinkk_feast_damage`));

  const extra = setup(side, '不淨者之約');
  extra.state.cthyaatInitialized = false;
  const myTeam = [extra.self]; const enemyTeam = [extra.target];
  extra.ctx.getFullTeam = (s: string) => s === side ? myTeam : enemyTeam;
  extra.ctx.addExtraElf = (_s: string, e: any) => enemyTeam.push(e);
  extra.ctx.vanishElf = (_s: string, e: any) => { e.isVanished = true; };
  handleBrinkkSoulMark(extra.ctx, EffectTiming.ON_ENTRANCE);
  const summoned = enemyTeam[1];
  assert.equal(summoned.maxHp, 500, '複製體力的一半，不額外套800下限');
  assert.equal(summoned.calculatedStats.atk, Math.floor(extra.self.calculatedStats.atk/2), '用最終面板能力，不用種族值或沿用召喚者面板');
  extra.target.currentHp = 0; summoned.currentHp = 0;
  handleBrinkkSoulMark(extra.ctx, EffectTiming.EXTRA_ELF_NODE);
  assert.equal(extra.target.maxHp, 1138, '克塔亞特死亡扣除所有精靈上限，包含死亡者');
  assert.equal(extra.target.currentHp, 0); assert.equal(extra.state.cthyaatActive, false);
}
const branches = parseSkill('分枝', '🎯 消除對手回合類效果\n  > 消除成功則對手全屬性-1');
assert.equal(branches.clauses.length, 1); assert.equal(branches.clauses[0].marker, '🎯'); assert.equal(branches.clauses[0].body[1].chain, 'success');
console.log('文義驗收通過：P1/P2威力與先吸取反轉、轉化成功/失敗、持續吸取與清除、先制、虛擬能力與PP限制、獨立吸取、分枝分類。');
