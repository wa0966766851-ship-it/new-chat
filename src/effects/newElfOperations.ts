import type { Elf, Skill } from '../types';
import type { BattleEventContext } from './types';
import { abilityKeys, clearStatuses } from './semanticOperations';
import { getMaxPp, getStatuses, clampSkillPp } from '../utils/battleHelpers';
import { activeConstraints } from '../battle/timedConstraints';
import { settlePpChanges, withPp } from '../battle/ppTransitions';
import { isAliveBySurvivalRule } from '../battle/survivalRules';
import type { Timer } from '../battle/timers';
import { EffectTiming } from './types';
import type { PpTransitionReason } from '../battle/ppTransitions';

export type Side = 'p1' | 'p2';
export const identity = (elf: Pick<Elf, 'id' | 'battleId'>): string => elf.battleId || elf.id;
export const alive = (elf: Elf): boolean => !elf.isVanished &&
  (isAliveBySurvivalRule(elf.currentHp, elf.survivalRule) || (elf.deathImmunity?.deathImmuneTurns || 0) > 0);
export const active = (ctx: BattleEventContext, side: Side): Elf => side === 'p1' ? ctx.activeP1 : ctx.activeP2;
export const hasStatus = (elf: Elf): boolean => Object.keys(getStatuses(elf)).length > 0;
export const boosted = (elf: Elf): boolean => abilityKeys.some(k => (elf.statStages?.[k] || 0) > 0);
export const weakened = (elf: Elf): boolean => abilityKeys.some(k => (elf.statStages?.[k] || 0) < 0);
export const allStages = (n: number): Record<string, number> => Object.fromEntries(abilityKeys.map(k => [k, n]));
export const STAR_STATUSES = ['星賜', '星哲', '星贖', '星佑', '星護'] as const;

export function clearStages(ctx: BattleEventContext, side: Side, positive: boolean): boolean {
  const elf = active(ctx, side), before = { ...elf.statStages };
  const stages = { ...before };
  for (const k of abilityKeys) if ((stages[k] || 0) * (positive ? 1 : -1) > 0) stages[k] = 0;
  ctx.updateElf(side, { statStages: stages as Elf['statStages'] });
  return abilityKeys.some(k => (before[k] || 0) !== (active(ctx, side).statStages?.[k] || 0));
}

export function purge(ctx: BattleEventContext, side: Side): boolean {
  const elf = active(ctx, side), had = hasStatus(elf);
  clearStatuses(ctx, side, elf, () => true);
  return had && !hasStatus(active(ctx, side));
}

export function timersFor(ctx: BattleEventContext, side: Side): Timer[] {
  return (side === 'p1' ? ctx.p1Timers : ctx.p2Timers) || [];
}
export function constraint(ctx: BattleEventContext, side: Side, key: string): any {
  return activeConstraints(timersFor(ctx, side), active(ctx, side)).find(p => p[key] !== undefined)?.[key];
}

export function timed(ctx: BattleEventContext, side: Side, id: string, rounds: number,
  payload: Timer['payload'], next = false, source: 'skill' | 'soulmark' = 'skill', missed = true): void {
  ctx.addTimerTo(side, { id, name: ctx.skill?.name || id, remaining: rounds, tickAt: 'round_end',
    kind: source === 'skill' ? 'turn_effect' : 'round_counter', source, scope: 'elf',
    persistsOffField: false, pendingActivation: next, payload }, ctx.goesFirst === false && missed);
}
export function uses(ctx: BattleEventContext, side: Side, id: string, count: number, payload: Timer['payload'],
  preserve = false): void {
  ctx.addTimerTo(side, { id, name: ctx.skill?.name || id, remaining: count, tickAt: 'never',
    kind: 'use_counter', source: 'skill', scope: 'elf', persistsOffField: preserve, payload }, false);
}

/** 欄位按slot改PP；同名技能不可互相覆寫。削PP也必須通過星護耗盡處理。 */
export function changePp(ctx: BattleEventContext, side: Side, elf: Elf,
  change: (skill: Skill, index: number) => number, recovery = false, reason: PpTransitionReason = recovery ? 'restore' : 'drain'): { removed: number; emptied: number[] } {
  const current = ctx.getFullTeam(side).find(e => identity(e) === identity(elf)) || elf;
  const reductions = activeConstraints(timersFor(ctx, side), current).reduce((n, p) => n + (p.ppRecoveryReductionPercent || 0), 0);
  let removed = 0;
  const skills = current.skills.map((skill, i) => {
    let pp = change(skill, i);
    if (recovery && pp > skill.pp) pp = clampSkillPp(skill, skill.pp + Math.floor((pp - skill.pp) * Math.max(0, 1 - reductions)), current);
    removed += Math.max(0, skill.pp - pp);
    return withPp(skill, pp);
  });
  const result = settlePpChanges(current, skills);
  const consumedSlots = current.skills.flatMap((s, i) => skills[i].pp < s.pp ? [i] : []);
  const changed = current.skills.some((s, i) => s.pp !== result.patch.skills?.[i]?.pp) || removed > 0;
  ctx.updateAnyElf(side, identity(current), result.patch);
  if (changed) ctx.emitElfEvent?.(side, current, EffectTiming.PP_CHANGED, { reason, emptied: result.emptied, removed, consumedSlots, changed: true, sourceSide: ctx.actor });
  const after = ctx.getFullTeam(side).find(e => identity(e) === identity(current)) || current;
  return { removed, emptied: result.emptied.filter(i => (after.skills?.[i]?.pp || 0) <= 0) };
}
export function restorePp(ctx: BattleEventContext, side: Side, elf: Elf, amount = Infinity): void {
  changePp(ctx, side, elf, skill => Math.min(getMaxPp(skill, elf), skill.pp + amount), true);
}
export const lostPp = (elf: Elf): number => elf.skills.reduce((n, skill) => n + Math.max(0, getMaxPp(skill, elf) - skill.pp), 0);
export const nonFullPp = (elf: Elf): number => elf.skills.filter(skill => skill.pp < getMaxPp(skill, elf)).length;

/** 固定／比例吸取讀傷害結算值恢復；失敗條件才讀hpLost。 */
export function drain(ctx: BattleEventContext, amount: number, type: 'fixed' | 'percent' | 'true',
  onResult?: (hpLost: number, healed: number) => void): void {
  const targetId = identity(ctx.target);
  const sourceId = identity(ctx.self);
  const finish = (receipt: import('../battle/settlementReceipt').SettlementReceipt) => {
    if (receipt.targetBattleId !== targetId) return;
    const opts = { onSettled: (heal: import('../battle/settlementReceipt').SettlementReceipt) => onResult?.(receipt.hpLost, heal.hpGained) };
    if (ctx.applyHealToElf) ctx.applyHealToElf(ctx.actor, sourceId, receipt.settledAmount, opts);
    else ctx.applyHeal(ctx.actor, receipt.settledAmount, opts);
  };
  if (type === 'true') ctx.applyTrueDamage(ctx.targetSide, Math.floor(amount), undefined, undefined, undefined, { onSettled: finish });
  else ctx.applyPinkDamage(ctx.targetSide, Math.floor(amount), undefined, undefined, undefined, type, { onSettled: finish });
}
