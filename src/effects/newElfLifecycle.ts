import type { BattleEventContext } from './types';
import { EffectTiming } from './types';
import { active, alive, constraint, identity, timersFor, changePp, restorePp, drain, timed } from './newElfOperations';
import { activeConstraints } from '../battle/timedConstraints';
import { getStatuses } from '../utils/battleHelpers';
import { StatusRegistry } from './statusRegistry';
import { isSkillDamageType } from '../battle/damageSemantics';
import { addDamageReduction } from '../battle/damageReduction';
import { combineSettlementCallbacks } from '../battle/settlementReceipt';
import { queueActionDamageModifier } from '../battle/actionDamageModifiers';
import { endIllusion } from '../battle/illusion';
import { skillSlot } from '../battle/skillSlot';
import { bypassesAttackDefense } from '../battle/attackDefense';
import { getMaxPp } from '../utils/battleHelpers';

/** 效果綁持有者：施加者下場後仍由受方執行，不依賴特定精靈 handler。 */
export function runNewElfLifecycle(ctx: BattleEventContext, event: EffectTiming, data?: any): void {
  const onField = identity(ctx.self) === identity(active(ctx, ctx.actor));
  if (event === EffectTiming.ON_SWITCH_OUT) {
    endIllusion(ctx); ctx.setPlayerState('fieldPpChanged', false);
    if (ctx.getPlayerState('timedInherentWasActive')) {
      ctx.updateElf(ctx.actor, { isInherentInvalid: ctx.getPlayerState('timedInherentOriginal') });
      ctx.setPlayerState('timedInherentWasActive', false);
    }
  }
  if (event === EffectTiming.ON_ENTRANCE) {
    ctx.setPlayerState('fieldPpChanged', false);
    ctx.setPlayerState('fieldPpSnapshot', ctx.self.skills.map(s => s.pp));
    ctx.setPlayerState('fieldDamageCounts', {});
    ctx.setPlayerState('fieldStatusCount', 0);
    const nextStatus = ctx.getPlayerState('nextElfStatus');
    if (nextStatus) {
      ctx.setPlayerState('nextElfStatus', undefined);
      ctx.applyStatusWithImmunityCheck(ctx.actor, nextStatus.status, nextStatus.duration);
    }
    const priority = ctx.getPlayerState('nextElfAstralPriority');
    if (priority !== undefined) {
      timed(ctx, ctx.actor, 'astral_next_entry', 2, priority === 'disabled' ? { disablePriority: true } : { block: { prio: -2 } }, false, 'skill', false);
      ctx.setPlayerState('nextElfAstralPriority', undefined);
    }
  }
  if (onField) {
    if (event === EffectTiming.ON_PP_CONSUME || event === EffectTiming.PP_CHANGED && (data?.changed || data?.removed > 0)) ctx.setPlayerState('fieldPpChanged', true);
    const before: number[] | undefined = ctx.getPlayerState('fieldPpSnapshot');
    if (before && before.some((n, i) => n !== ctx.self.skills[i]?.pp)) ctx.setPlayerState('fieldPpChanged', true);
    ctx.setPlayerState('fieldPpSnapshot', ctx.self.skills.map(s => s.pp));
  }
  const payloads = activeConstraints(timersFor(ctx, ctx.actor), ctx.self);
  if (event === EffectTiming.OPPONENT_ACTION && onField) ctx.setPlayerState('blockedSkillDamageThisAction', false);
  if (event === EffectTiming.ON_KILL) {
    const next = ctx.getPlayerState('nextKillStatus');
    if (next) {
      ctx.setPlayerState('nextKillStatus', undefined);
      ctx.setOpponentState('nextElfStatus', next);
    }
  }
  if (event === EffectTiming.SKILL_INVALID && !data?.isIncoming && data?.consumedInvalidation?.payload?.invalidFollowup) {
    const followup = data.consumedInvalidation.payload.invalidFollowup;
    timed(ctx, ctx.actor, 'invalid_same_category_followup', followup.rounds, { block: { addInvalid: followup.sameCategory ? data.skill.category : 'all' } }, true);
  }
  if ([EffectTiming.ENFORCE, EffectTiming.ROUND_START, EffectTiming.BEFORE_SKILL].includes(event) && onField) {
    const disabled = payloads.some(p => p.inherentInvalid);
    if (disabled && !ctx.getPlayerState('timedInherentWasActive')) {
      ctx.setPlayerState('timedInherentOriginal', ctx.self.isInherentInvalid);
      ctx.setPlayerState('timedInherentWasActive', true);
      ctx.updateElf(ctx.actor, { isInherentInvalid: true });
    } else if (!disabled && ctx.getPlayerState('timedInherentWasActive')) {
      ctx.updateElf(ctx.actor, { isInherentInvalid: ctx.getPlayerState('timedInherentOriginal') });
      ctx.setPlayerState('timedInherentWasActive', false);
    }
    if (payloads.some(p => p.preventAction)) ctx.setPlayerState('actionPreventedRound', ctx.roundNumber);
  }
  if (event === EffectTiming.BEFORE_SKILL && onField) {
    for (const p of payloads) if (p.skillUseReaction && ctx.skill) {
      const reaction = p.skillUseReaction;
      if (ctx.skill.category === '屬性') {
        timed(ctx, ctx.actor, 'attack_skill_restriction', reaction.utilityNextAttackInvalidRounds,
          { block: { dmgOutMult: 0, kind: '攻擊', addInvalid: '攻擊' } }, true);
      } else {
        const names = Object.keys(StatusRegistry).filter(name => StatusRegistry[name].categories?.some(category =>
          ['CONTROL', 'WEAKENING', 'RESTRICTIVE', 'EVOLUTIONARY'].includes(category)));
        for (const name of ctx.shuffleArray(names).slice(0, reaction.attackRandomStatuses)) ctx.applyStatusWithImmunityCheck(ctx.actor, name, 3);
      }
    }
    ctx.setPlayerState('soulSureHitThisAction', false);
    ctx.setPlayerState('sourceSkillThisAction', ctx.skill);
    if (ctx.skill?.category !== '屬性') for (const timer of timersFor(ctx, ctx.actor)) {
      if (timer.ownerBattleId && timer.ownerBattleId !== identity(ctx.self) || timer.pendingActivation || timer.remaining <= 0) continue;
      if (timer.payload?.nextAttackSkillBoost) {
        queueActionDamageModifier(ctx, timer.payload.nextAttackSkillBoost, '技能');
        ctx.consumeTimer(ctx.actor, timer.id);
      }
    }
  }
  if (event === ('SELF_STATUS_APPLIED' as EffectTiming)) {
    if (onField) ctx.setPlayerState('fieldStatusCount', (ctx.getPlayerState('fieldStatusCount') || 0) + 1);
    if (getStatuses(ctx.self)['平靜']) {
      const clone = { ...ctx.self, effects: (ctx.self.effects || []).filter(e => e.name !== '狂暴'),
        battleStatuses: { ...getStatuses(ctx.self) } };
      delete clone.battleStatuses['狂暴'];
      if (clone.battleStatus === '狂暴') { clone.battleStatus = 'normal'; clone.battleStatusDuration = 0; }
      ctx.updateElf(ctx.actor, clone);
    }
  }
  if (event === EffectTiming.AFTER_DAMAGE && data?.isIncoming) {
    const category = data.damageType, receipt = data.receipt;
    const settled = receipt?.settledAmount ?? data.damage ?? 0;
    if (settled > 0) {
      const key = isSkillDamageType(category) ? 'skill' : category;
      for (const name of onField ? ['battleDamageCounts', 'fieldDamageCounts'] : ['battleDamageCounts']) {
        const counts = ctx.getPlayerState(name) || {};
        ctx.setPlayerState(name, { ...counts, [key]: (counts[key] || 0) + 1 });
      }
    }
    for (const p of payloads) {
      if (p.reflectSkillQuarter && isSkillDamageType(category) && settled > 0 && !data.reaction) {
        const recipient = ctx.getFullTeam(p.reflectToSide).find(e => identity(e) === p.reflectToId);
        if (recipient) ctx.applyDamageToElf?.(p.reflectToSide, p.reflectToId, Math.max(0, Math.min(recipient.maxHp - 1, Math.floor(settled / 4))), 'fixed', { reaction: true });
      }
      if (p.sleepOnFixed && category === 'fixed' && settled > 0) {
        ctx.setPlayerState('fixedReceivedThisRound', true);
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, 'sleep', 3);
      }
      if (p.damageStatusReaction && settled > 0) {
        const status = category === 'true' ? '詛咒' : '害怕';
        if (!ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, 3).success) ctx.clearTurnEffectsOf(ctx.targetSide);
      }
    }
  }
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const comp = data?.damageComp || data;
    if (!comp) return;
    if (comp.isIncoming && comp.damageCategory === 'skill_attack' && comp.skillCategory === '物理') {
      for (const timer of timersFor(ctx, ctx.actor)) {
        if (timer.remaining <= 0 || timer.pendingActivation || (timer.ownerBattleId && timer.ownerBattleId !== identity(ctx.self))) continue;
        if (timer.payload?.incomingPhysicalSkillMultiplier) {
          comp.multiplier *= timer.payload.incomingPhysicalSkillMultiplier;
          if (timer.kind === 'use_counter') ctx.consumeTimer?.(ctx.actor, timer.id);
        }
      }
    }
    if (comp.isIncoming) for (const p of payloads) {
      if (p.blockSkillDamage && isSkillDamageType(comp.damageCategory) && !bypassesAttackDefense(comp, 'block')) {
        if (comp.multiplier > 0 && comp.base > 0) ctx.setPlayerState('blockedSkillDamageThisAction', true);
        comp.multiplier = 0;
      }
      if (p.halveNonTrue && comp.damageCategory !== 'true') addDamageReduction(comp, .5);
      if (p.halveReflectSkill && isSkillDamageType(comp.damageCategory)) {
        let raw = 0;
        // 在其他普通修正完成後、此來源減半前取值；不能快照未套增傷的基礎值。
        (comp.beforeFinalDamage ||= []).push(() => {
          raw = Math.max(0, Math.floor(comp.base * (1 + comp.increasePercent) * Math.max(0, 1 - comp.decreasePercent) * comp.multiplier - (comp.flatReduction || 0)));
          addDamageReduction(comp, .5);
        });
        comp.afterDamage = combineSettlementCallbacks(comp.afterDamage, () => ctx.applyTrueDamage(ctx.targetSide, raw));
      }
    }
    if (comp.isIncoming && comp.damageCategory === 'skill_attack') {
      const halves = constraint(ctx, ctx.actor, 'nextAttackHalves');
      if (halves) { for (let i = 0; i < halves; i++) addDamageReduction(comp, .5); ctx.consumeTimer(ctx.actor, 'mogos_next_halves'); }
    }
    if (!comp.isIncoming) {
      if (comp.damageCategory !== 'true') for (const p of payloads) if (p.nonTrueOutputLimit) comp.outgoingLimit = Math.min(comp.outgoingLimit ?? Infinity, p.nonTrueOutputLimit);
      if (comp.damageCategory === 'skill_attack' && ctx.skill?.name === '王·墮落絕語') comp.afterDamage = combineSettlementCallbacks(comp.afterDamage, r => {
        ctx.applyHeal(ctx.actor, r.settledAmount);
        if (ctx.getPlayerState('mogosPercentOnAttackThisAction')) ctx.applyPinkDamage(ctx.targetSide, r.settledAmount, undefined, undefined, undefined, 'percent');
      });
    }
  }
  if (event === EffectTiming.ON_SKILL_HIT && ctx.skill?.category !== '屬性') for (const p of payloads) if (p.attackAdditionalTruePercent) ctx.applyTrueDamage(ctx.targetSide, Math.floor(ctx.target.maxHp * p.attackAdditionalTruePercent));
  if ([EffectTiming.AFTER_ACTION, EffectTiming.ACTION_FAILED].includes(event) && onField) {
    for (const p of payloads) {
      if (p.afterUseDrainRatio) {
        const spec = p.afterUseDrainRatio;
        drain(ctx, ctx.target.maxHp * spec.ratio * (spec.doubleBelowHalf && ctx.self.currentHp < ctx.self.maxHp / 2 ? 2 : 1), 'percent');
      }
      if (p.afterUseDamage) {
        const spec = p.afterUseDamage;
        ctx.applyPinkDamage(ctx.targetSide, spec.amount, undefined, undefined, undefined, spec.type, { onSettled: r => {
          if (spec.trueIfNoLoss && r.hpLost === 0) ctx.applyTrueDamage(ctx.targetSide, spec.trueIfNoLoss);
        } });
      }
      if (p.afterUseHealEqualPercent) {
        const requested = Math.floor(ctx.self.maxHp * p.afterUseHealEqualPercent);
        ctx.applyHeal(ctx.actor, requested);
        ctx.applyPinkDamage(ctx.targetSide, requested, undefined, undefined, undefined, 'percent');
      }
      if (p.afterUseDrain) {
        const spec = p.afterUseDrain;
        drain(ctx, spec.amount * (spec.doubleLower && ctx.self.currentHp < ctx.target.currentHp ? 2 : 1), 'fixed', lost => {
          if (spec.trueIfNoLoss && lost === 0) ctx.applyTrueDamage(ctx.targetSide, spec.amount);
        });
      }
      if (p.afterUsePercent) {
        const n = Math.floor((ctx.self.calculatedStats.spatk + ctx.self.calculatedStats.speed) * .4);
        ctx.applyPinkDamage(ctx.targetSide, n, undefined, undefined, undefined, 'percent', { onSettled: r => {
          if (r.hpLost === 0) ctx.applyTrueDamage(ctx.targetSide, 300);
        } });
      }
    }
    for (const name of Object.keys(getStatuses(ctx.target))) if (StatusRegistry[name]?.mechanics?.some(m => m.params?.sureHitPPToOne)) {
      if (data?.skill?.isSureHit && !ctx.self.isInherentInvalid) {
        const source = ctx.getPlayerState('sourceSkillThisAction') || data.skill;
        const slot = skillSlot(ctx.self, source);
        changePp(ctx, ctx.actor, ctx.self, (s, i) => i === slot ? 1 : s.pp);
      }
    }
  }
  if (event === EffectTiming.ROUND_END && onField && alive(ctx.self)) {
    for (const p of payloads) {
      if (p.roundHealEqualPercent) {
        const n = Math.floor(ctx.self.maxHp / 3 * (ctx.self.currentHp < ctx.self.maxHp / 2 ? 2 : 1));
        ctx.applyHeal(ctx.actor, n);
        ctx.applyPinkDamage(ctx.targetSide, n, undefined, undefined, undefined, 'percent');
      }
      if (p.roundDrainThird) drain(ctx, ctx.target.maxHp / 3 * (ctx.self.currentHp < ctx.self.maxHp / 2 ? 2 : 1), 'percent');
      if (p.roundDrainSpec) {
        const spec = p.roundDrainSpec;
        drain(ctx, ctx.target.maxHp * spec.ratio * (spec.doubleBelowHalf && ctx.self.currentHp < ctx.self.maxHp / 2 ? 2 : 1), 'percent', lost => {
          if (lost === 0 && spec.benchHealIfNoLoss) for (const elf of ctx.getFullTeam(ctx.actor)) {
            if (identity(elf) !== identity(active(ctx, ctx.actor)) && alive(elf)) ctx.applyHealToElf?.(ctx.actor, identity(elf), spec.benchHealIfNoLoss);
          }
        });
      }
      if (p.roundPpAbsorb) {
        const own = ctx.self, spec = p.roundPpAbsorb;
        const doubled = spec.doubleWhenLostHalf && own.skills.reduce((n, s) => n + getMaxPp(s, own) - s.pp, 0) > own.skills.reduce((n, s) => n + getMaxPp(s, own), 0) / 2;
        const amount = spec.amount * (doubled ? 2 : 1);
        changePp(ctx, ctx.targetSide, ctx.target, s => Math.max(0, s.pp - amount));
        changePp(ctx, ctx.actor, own, s => Math.min(getMaxPp(s, own), s.pp + amount), true);
      }
      if (p.sleepOnFixed && !ctx.getPlayerState('fixedReceivedThisRound')) ctx.applyStatusWithImmunityCheck(ctx.targetSide, '沉睡', 3);
    }
    ctx.setPlayerState('fixedReceivedThisRound', false);
  }
  if (event === EffectTiming.MODIFY_PRIORITY) {
    for (const p of payloads) {
      if (p.disablePriority) { data.priorityComp.base = 0; data.priorityComp.bonus = 0; data.priorityComp.forcedFirst = false; }
    }
  }
}

export function innateDisabled(ctx: BattleEventContext): boolean {
  return !!constraint(ctx, ctx.actor, 'inherentInvalid');
}
