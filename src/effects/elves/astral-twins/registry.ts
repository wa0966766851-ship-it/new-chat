import type { BattleEventContext as C, BattleSkillHandler, BattleSkillAfterHitHandler } from '../../types';
import { EffectTiming as E } from '../../types';
import type { Elf, Skill, BaseStats } from '../../../types';
import { active, alive, identity, STAR_STATUSES, boosted, weakened, hasStatus, allStages, clearStages,
  purge, timed, uses, changePp, restorePp, lostPp, nonFullPp, drain, constraint } from '../../newElfOperations';
import { getStatuses, getMaxPp } from '../../../utils/battleHelpers';
import { startIllusion, endIllusion, correspondingInitialElf } from '../../../battle/illusion';
import { queueActionDamageModifier } from '../../../battle/actionDamageModifiers';
import { skillSlot } from '../../../battle/skillSlot';

const F = '星核寰宇·艾斯菲亞', G = '星軌重構·艾斯菲格';
const memories = new Map<string, number>([
  ['星核脈衝', 0], ['星軌念刃', 0], ['星霧迷境', 1], ['心像重構', 1], ['星核幻舞', 2],
  ['幻象帷幔', 2], ['殞星衝擊', 3], ['念力傾瀉', 3], ['寰宇幻影閃', 4], ['寰宇星軌陣', 4],
]);
function reduceUsedPp(c: C): void {
  const selected = c.opponentSkill;
  const slot = skillSlot(c.target, selected);
  const result = changePp(c, c.targetSide, c.target, (s, i) => i === slot ? Math.max(0, s.pp - 2) : s.pp);
  if (result.emptied.includes(slot)) c.setOpponentState('actionPreventedRound', c.roundNumber);
}
function recoverBlock(c: C): void {
  timed(c, c.targetSide, 'astral_recovery_block', 2, { recoveryReductionPercent: 1, ppRecoveryReductionPercent: 1 });
}
function roundHeal(c: C): void { timed(c, c.actor, 'astral_round_heal', 4, { roundHealEqualPercent: true }, false, 'skill', false); }
function boostNext(c: C): void { timed(c, c.actor, 'astral_priority', 2, { block: { prio: 2 } }, true); }
function stealAdjacentPp(c: C): void {
  for (const e of c.getAdjacentElves(c.targetSide, c.target)) {
    const bySlot = e.skills.map(s => Math.min(1, s.pp));
    const result = changePp(c, c.targetSide, e, s => Math.max(0, s.pp - 1));
    changePp(c, c.actor, c.self, (s, i) => Math.min(getMaxPp(s, c.self), s.pp + (bySlot[i] || 0)), true);
    if (result.emptied.length) timed(c, c.targetSide, 'astral_switch_lock', 1, { lockSwitch: true }, true, 'soulmark');
    changePp(c, c.targetSide, c.target, (s, i) => result.emptied.includes(i) ? 0 : s.pp, false, 'clear');
  }
}
const completeCounts = (counts: Record<string, number> = {}) => ['skill', 'fixed', 'percent', 'true'].every(k => (counts[k] || 0) >= 5);
/** 先後手被確定後，任一方出手前開啟本回合被動，不等後手挨打完才生效。 */
function beginRoundActionEffect(c: C, event: E): boolean {
  if (![E.BEFORE_ACTION, E.OPPONENT_ACTION].includes(event) || c.goesFirst === undefined) return false;
  if (c.getPlayerState('astralActionEffectRound') === c.roundNumber) return false;
  c.setPlayerState('astralActionEffectRound', c.roundNumber);
  return true;
}

/** 轉化不覆寫技能欄；原技能固有記憶在獨立額外行動節點執行。 */
export function executeAstralMemory(c: C): void {
  const skill: Skill | undefined = c.getPlayerState('sourceSkillThisAction');
  const kind = skill && memories.get(skill.name);
  if (kind === undefined || c.self.isInherentInvalid) return;
  const forced = c.getPlayerState('astralForceMemoryThisAction') || (c.getPlayerState('astralMemoryUses') || 0) > 0;
  const condition = kind === 0 ? !boosted(c.target) : kind === 1 ? c.hasTurnEffectOn(c.actor)
    : kind === 2 ? c.hasTurnEffectOn(c.targetSide) : kind === 3 ? !!c.getOpponentState('fieldPpChanged') : true;
  c.setPlayerState('sourceSkillThisAction', undefined); c.setPlayerState('astralForceMemoryThisAction', false);
  if (!forced && !condition) return;
  if ((c.getPlayerState('astralMemoryUses') || 0) > 0) c.setPlayerState('astralMemoryUses', c.getPlayerState('astralMemoryUses') - 1);
  const ownerId = identity(c.self);
  c.queueExtraAction(c.actor, { label: '變思遷憶', run: ctx => {
    if (identity(ctx.self) !== ownerId || !alive(ctx.self) || identity(active(ctx, ctx.actor)) !== ownerId) return;
    const damage = (e: Elf, n: number) => ctx.applyDamageToElf?.(ctx.targetSide, identity(e), n, 'skill_extra_action', { elem: '超能' });
    if (kind === 0) damage(ctx.target, 50 + 50 * nonFullPp(ctx.target));
    if (kind === 2) for (const e of ctx.getAdjacentElves(ctx.targetSide, ctx.target)) damage(e, 50 + 50 * nonFullPp(ctx.self));
    if (kind === 1) for (const e of ctx.getSeparatedElves(ctx.targetSide, ctx.target)) {
      damage(e, 50);
      const offset = (e.globalPpMaxOffset || 0) - 1, lowered = { ...e, globalPpMaxOffset: offset };
      const overflow = e.skills.reduce((n, s) => n + Math.max(0, s.pp - getMaxPp(s, lowered)), 0);
      ctx.updateAnyElf(ctx.targetSide, identity(e), { globalPpMaxOffset: offset });
      const updated = ctx.getFullTeam(ctx.targetSide).find(x => identity(x) === identity(e)) || lowered;
      changePp(ctx, ctx.targetSide, updated, s => Math.min(s.pp, getMaxPp(s, lowered)), false, 'cap_change');
      for (let n = 0; n < overflow; n++) damage(e, 50);
    }
    if (kind === 3) {
      const first = ctx.getFirstStarter(ctx.targetSide);
      if (first) {
        damage(first, 50); ctx.updateAnyElf(ctx.targetSide, identity(first), { globalPpMaxOffset: (first.globalPpMaxOffset || 0) + 1 });
        const updated = ctx.getFullTeam(ctx.targetSide).find(e => identity(e) === identity(first)) || first;
        for (const e of ctx.getFullTeam(ctx.actor).filter(e => identity(e) !== identity(ctx.self) && alive(e))) ctx.applyHealToElf?.(ctx.actor, identity(e), lostPp(updated) * 30);
      }
    }
    if (kind === 4) {
      const last = ctx.getEligibleTeam(ctx.targetSide).filter(e => !e.isVanished).at(-1);
      if (last) damage(last, 50);
      for (const category of ['skill_extra_action', 'fixed', 'percent', 'true'] as const) ctx.applyDamageToElf?.(ctx.actor, identity(ctx.self), 1, category, { elem: '超能', onSettled: r => {
        const counts = ctx.getPlayerState('battleDamageCounts') || {};
        if (category === 'true' && last && completeCounts({ ...counts, true: (counts.true || 0) + Number(r.settledAmount > 0) })) for (let i = 0; i < 5; i++) damage(last, 50);
      } });
      if (skill?.name === '寰宇幻影閃' ? !hasStatus(ctx.self) : hasStatus(ctx.self)) {
        const history = ctx.getPlayerState('teamEntranceHistory') || {};
        ctx.setPlayerState('teamEntranceHistory', { ...history, [identity(ctx.self)]: 0 });
        if (skill?.name === '寰宇幻影閃') { ctx.setPlayerState('fieldEntryTurn', undefined); ctx.setPlayerState('fieldDamageCounts', {}); }
      }
      ctx.setPlayerState('astralMemoryUses', 5);
    }
  } });
}

export function handleAstralAesfiaSoulMark(c: C, event: E, data?: any): boolean {
  if (c.self.name !== F || identity(c.self) !== identity(active(c, c.actor))) return false;
  if (event === E.ON_ENTRANCE) {
    c.setPlayerState('astralActionEffectRound', undefined);
    for (const s of STAR_STATUSES) c.applyStatusWithImmunityCheck(c.actor, s, 3);
    startIllusion(c, c.target, '寰宇星幻');
    c.setPlayerState('astralStarsAtEntrance', STAR_STATUSES.filter(s => getStatuses(c.self)[s])); return true;
  }
  if (event === ('ON_STATUS_ENDED' as E) && STAR_STATUSES.includes(data?.status)) c.setPlayerState('astralEndIllusionThisRound', true);
  if (beginRoundActionEffect(c, event)) {
    if (c.goesFirst) {
      timed(c, c.actor, 'astral_space_shift', 1, { blockSkillDamage: true, spaceShift: true }, false, 'soulmark', false);
      timed(c, c.targetSide, 'astral_space_add', 1, { block: { addInvalid: '攻擊' } }, false, 'soulmark', false);
    } else {
      timed(c, c.actor, 'astral_late_half', 1, { halveNonTrue: true }, false, 'soulmark', false);
      c.setPlayerState('astralLateDrainThisRound', true);
    }
    stealAdjacentPp(c);
  }
  if (event === E.OPPONENT_AFTER_ACTION && constraint(c, c.actor, 'spaceShift') && data?.category !== '屬性' && c.getPlayerState('blockedSkillDamageThisAction')) {
    c.setPlayerState('blockedSkillDamageThisAction', false);
    const skill = c.opponentSkill || data.skill, slot = skillSlot(c.target, skill);
    changePp(c, c.targetSide, c.target, (s, i) => i === slot ? 0 : s.pp, false, 'clear'); c.applyHeal(c.actor, c.self.maxHp);
  }
  if (event === E.ROUND_END) {
    if (c.getPlayerState('astralLateDrainThisRound')) drain(c, c.self.maxHp / 2, 'percent');
    c.setPlayerState('astralLateDrainThisRound', false);
    const stars: string[] = c.getPlayerState('astralStarsAtEntrance') || [];
    if (c.self.illusion && (c.getPlayerState('astralEndIllusionThisRound') || stars.some(s => !getStatuses(c.self)[s]))) endIllusion(c);
    c.setPlayerState('astralEndIllusionThisRound', false);
  }
  return false;
}
export function handleAstralAesfigSoulMark(c: C, event: E): boolean {
  if (c.self.name !== G || identity(c.self) !== identity(active(c, c.actor))) return false;
  if (event === E.ON_ENTRANCE) {
    c.setPlayerState('astralActionEffectRound', undefined);
    const target = correspondingInitialElf(c.getFullTeam(c.actor), c.self);
    if (target) startIllusion(c, target, '思維固化', 10);
    else c.addLog('【思維固化】：初始另一背包對應欄位為空，未假造幻化目標。', 'effect');
    return !!target;
  }
  if (beginRoundActionEffect(c, event)) {
    if (c.goesFirst) timed(c, c.actor, 'astral_interference', 1, { halveReflectSkill: true }, false, 'soulmark', false);
    else {
      timed(c, c.actor, 'astral_space_jump', 1, { blockSkillDamage: true }, false, 'soulmark', false);
      timed(c, c.targetSide, 'astral_next_priority', 1, { block: { prio: -2 } }, true, 'soulmark');
    }
    drain(c, c.target.maxHp / 3, 'percent', lost => {
      if (lost < 200) timed(c, c.targetSide, 'astral_failed_drain', 2, { block: { addInvalid: 'all' } }, false, 'soulmark', false);
    });
  }
  if (c.self.illusion && completeCounts(c.getPlayerState('fieldDamageCounts')) && (c.getPlayerState('fieldStatusCount') || 0) >= 5 && (c.getPlayerState('teamEntranceHistory')?.[identity(c.self)] || 0) > 5) endIllusion(c);
  return false;
}

export const ASTRAL_SKILLS: Record<string, BattleSkillHandler> = {
  '星核脈衝': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) changePp(c, c.targetSide, c.target, s => s.category === '屬性' ? 0 : s.pp, false, 'clear');
    if (!c.hasTurnEffectOn(c.targetSide)) drain(c, c.target.maxHp / 3, 'percent'); recoverBlock(c);
  },
  '星軌念刃': c => {
    c.setPlayerState('attackHitCountThisAction', 10 + Math.floor((c.rng?.() ?? Math.random()) * 11));
    if (clearStages(c, c.targetSide, true)) c.applyHeal(c.actor, c.self.maxHp);
    if (!boosted(c.target)) recoverBlock(c);
  },
  '星霧迷境': c => {
    timed(c, c.actor, 'astral_status_guard', 5, { immuneStatus: true, reflectStatus: true });
    const had = weakened(c.self); clearStages(c, c.actor, false);
    if (!had) c.applyStatusWithImmunityCheck(c.targetSide, '疲憊', 3);
    timed(c, c.actor, 'astral_use_drain', 3, { afterUseDrain: { amount: 300, trueIfNoLoss: true } }, false, 'skill', false);
  },
  '幻象帷幔': c => {
    timed(c, c.actor, 'astral_status_guard', 5, { immuneStatus: true, reflectStatus: true }); clearStages(c, c.actor, false);
    timed(c, c.actor, 'astral_use_drain', 3, { afterUseDrain: { amount: 300, doubleLower: true } }, false, 'skill', false); boostNext(c);
  },
  '星核幻舞': c => {
    c.applyStatChange(c.actor, allStages(c.goesFirst ? 2 : 1)); roundHeal(c);
    uses(c, c.actor, 'astral_next_attacks', 2, { nextAttackSkillBoost: 2.5 });
    timed(c, c.targetSide, 'astral_priority_down', 2, { block: { prio: -2 } }, true);
  },
  '心像重構': c => {
    c.applyStatChange(c.actor, allStages(c.goesFirst ? 2 : 1)); roundHeal(c);
    timed(c, c.actor, 'astral_attack_double', 2, { applyMode: 'gate', damageTypes: ['attack'], wrapItems: [{ atom: 'damage_multiplier', params: { value: 2, damageTypes: ['attack'] } }] }, true);
    uses(c, c.targetSide, 'astral_incoming_crits', 2, { incomingAttackCritical: true });
  },
  '殞星衝擊': c => {
    const stats = { ...c.self.calculatedStats }; let difference = 0;
    for (const k of Object.keys(stats) as (keyof BaseStats)[]) if (c.target.calculatedStats[k] > stats[k]) {
      difference += c.target.calculatedStats[k] - stats[k]; stats[k] = c.target.calculatedStats[k];
    }
    c.updateElf(c.actor, { calculatedStats: stats, maxHp: Math.max(c.self.maxHp, stats.hp) });
    if (difference) c.applyPinkDamage(c.targetSide, difference, undefined, undefined, undefined, 'fixed');
    timed(c, c.targetSide, 'astral_quarter_reflect', 3, { reflectSkillQuarter: true, reflectToSide: c.actor, reflectToId: identity(c.self) });
    timed(c, c.actor, 'astral_fixed_sleep', 3, { sleepOnFixed: true }, false, 'skill', false);
  },
  '念力傾瀉': c => {
    if (c.goesFirst) timed(c, c.targetSide, 'astral_current_invalid', 1, { block: { invalid: 'all' } }, false, 'skill', false);
    else c.applyHeal(c.actor, c.self.maxHp);
  },
  '寰宇幻影閃': c => {
    if (clearStages(c, c.targetSide, true)) restorePp(c, c.actor, c.self);
    const count = STAR_STATUSES.filter(s => getStatuses(c.self)[s]).length;
    const lost = [...c.getFullTeam(c.actor).filter(e => identity(e) !== identity(c.self)), ...c.getFullTeam(c.targetSide).filter(e => identity(e) !== identity(c.target))].reduce((n, e) => n + lostPp(e), 0);
    for (let i = 0; i < count; i++) c.applyTrueDamage(c.targetSide, lost * 10);
    purge(c, c.actor);
    if (!hasStatus(c.self)) { c.setPlayerState('astralForceMemoryThisAction', true); queueActionDamageModifier(c, 2, '非真實'); }
  },
  '寰宇星軌陣': c => {
    if (c.clearTurnEffectsOf(c.targetSide)) changePp(c, c.targetSide, c.target, s => s.category !== '屬性' ? 0 : s.pp, false, 'clear');
    for (const s of STAR_STATUSES) c.applyStatusWithImmunityCheck(c.targetSide, c.applyStatusWithImmunityCheck(c.actor, s, 3).success ? 'sleep' : '沉睡', 3);
    if (hasStatus(c.self)) { c.setPlayerState('astralForceMemoryThisAction', true); queueActionDamageModifier(c, 2, '非真實'); }
  },
};
const fifthAfter: BattleSkillAfterHitHandler = (c, info) => {
  if (!info.killed) boostNext(c);
  else c.setOpponentState('nextElfAstralPriority', c.skill.name === '寰宇幻影閃' ? 'disabled' : -2);
};
export const ASTRAL_AFTER_HIT: Record<string, BattleSkillAfterHitHandler> = {
  '星核脈衝': reduceUsedPp, '星軌念刃': reduceUsedPp,
  '寰宇幻影閃': fifthAfter, '寰宇星軌陣': fifthAfter,
  '念力傾瀉': c => {
    if (!c.getPlayerState('actualCritThisAction')) return;
    if (!c.applyStatusWithImmunityCheck(c.targetSide, 'sleep', 3).success) c.applyTrueDamage(c.targetSide, 300);
    uses(c, c.actor, 'astral_next_status', 1, { immuneStatus: true }, true);
  },
};
