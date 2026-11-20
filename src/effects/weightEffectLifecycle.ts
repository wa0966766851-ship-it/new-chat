import { EffectTiming, type BattleEventContext } from './types';
import { activeConstraints } from '../battle/timedConstraints';
import { changePp, timersFor } from './newElfOperations';
import { adjustWeight, battleElfId, weightOf } from '../blocks/ops/weightEffects';
import { getMaxPp, getStatuses } from '../utils/battleHelpers';
import { isSkillDamageType } from '../battle/damageSemantics';

type Context = BattleEventContext;

export function observeWeightEffect(ctx: Context, mode: 'stage' | 'heal') {
  for (const payload of activeConstraints(timersFor(ctx, ctx.actor), ctx.self)) {
    const monitor = payload.monitorWeightEffect;
    if (monitor?.mode !== mode) continue;
    if (mode === 'stage') {
      changePp(ctx, ctx.actor, ctx.self, skill => skill.category === '屬性' ? skill.pp : Math.min(1, getMaxPp(skill, ctx.self)), false, 'clear');
    } else {
      const amount = Math.floor((weightOf(ctx, ctx.actor, ctx.self) + weightOf(ctx, ctx.targetSide, ctx.target)) / 4);
      const maxHp = Math.max(1, ctx.self.maxHp - amount);
      ctx.updateElf(ctx.actor, { maxHp, currentHp: Math.min(maxHp, ctx.self.currentHp), calculatedStats: { ...ctx.self.calculatedStats, hp: maxHp } });
    }
  }
}

export function runWeightEffectLifecycle(ctx: Context, event: EffectTiming, data: any) {
  const kind = data?.skill?.category ?? ctx.skill?.category;
  if (event === EffectTiming.ACTUAL_SKILL_USE) {
    const active = activeConstraints(timersFor(ctx, ctx.actor), ctx.self);
    if (active.some(payload => payload.weightDevoutHeart) && ctx.getPlayerState('weightDevoutHealRound') !== ctx.roundNumber) {
      ctx.setPlayerState('weightDevoutHealRound', ctx.roundNumber);
      ctx.applyHeal(ctx.actor, Math.floor(ctx.self.maxHp / 3));
    }
    const pending = ctx.getPlayerState('nextWeightedAttackPriority');
    if (pending && kind !== '屬性' && pending.action !== ctx.actionId) ctx.setPlayerState('nextWeightedAttackPriority', undefined);
    return;
  }
  if (event === EffectTiming.ON_SWITCH_OUT) {
    if (data?.forced === false && ctx.getPlayerState('teamNextVoluntaryWeightPenalty')) {
      ctx.setPlayerState('teamNextVoluntaryWeightPenalty', undefined);
      ctx.setPlayerState('teamApplyVoluntaryWeightPenalty', true);
    }
    if (ctx.getPlayerState('concealedTurnEffectIds')) ctx.setPlayerState('concealedTurnEffectIds', undefined);
    if (ctx.getPlayerState('entryStatusProtection')) ctx.setPlayerState('entryStatusProtection', undefined);
    const damage = ctx.getPlayerState('weightedDamageBonus');
    if (damage) ctx.setPlayerState('weightedDamageBonus', ctx.getPlayerState('weightedBattleDamageBonus') || 0);
    return;
  }
  if (event === EffectTiming.ON_ENTRANCE && ctx.getPlayerState('teamApplyVoluntaryWeightPenalty')) {
    ctx.setPlayerState('teamApplyVoluntaryWeightPenalty', undefined);
    adjustWeight(ctx, ctx.actor, ctx.self, 150);
    ctx.updateElf(ctx.actor, { calculatedStats: { ...ctx.self.calculatedStats, speed: Math.max(1, Math.floor(ctx.self.calculatedStats.speed * .8)) } });
    return;
  }
  if (event === EffectTiming.MODIFY_PRIORITY && kind !== '屬性') {
    const pending = ctx.getPlayerState('nextWeightedAttackPriority');
    if (pending && data?.priorityComp) data.priorityComp.bonus += pending.amount;
    return;
  }
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const comp = data?.damageComp ?? data;
    if (!comp || comp.pure) return;
    if (comp.isIncoming && comp.damageCategory === 'skill_attack') {
      const guard = ctx.getPlayerState('entryStatusProtection');
      if (guard?.ownerId === battleElfId(ctx.self) && getStatuses(ctx.self)[guard.status]) comp.limit = 0;
    }
    if (!comp.isIncoming && isSkillDamageType(comp.damageCategory)) {
      const bonus = Number(ctx.getPlayerState('weightedDamageBonus')) || 0;
      if (bonus > 0) comp.increasePercent += bonus;
    }
  }
}

