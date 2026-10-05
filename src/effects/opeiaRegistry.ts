import { BattleEventContext, BattleSkillHandler, EffectTiming } from "./types";
import { abilityKeys, abilityLevels, absorbBoosts, currentElf, clearStatuses } from './semanticOperations';
import { sameStatus } from './statusIdentity';
import { getMaxPp } from '../utils/battleHelpers';
import { opeiaHasType as isType, opeiaAlive, opeiaSwarm, opeiaCrown, opeiaTimer, runOpeiaTimedEffects } from './opeiaTimedEffects';
import { benchSkip } from './fieldGuard';
import { isOpeiaToxicAttack, opeiaToxicAttack, opeiaRustAttack, finishOpeiaAttack } from './opeiaAttackSkills';

const TEMP_STATS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const;
/** 使用者確認：含體力的六維總和×n×10%，該總和同時加到每一維，不平均分配。 */
export function opeiaTemporaryStats(stats: NonNullable<BattleEventContext['self']['calculatedStats']>, n: number) {
  const bonus = Math.floor(TEMP_STATS.reduce((sum, key) => sum + stats[key], 0) * n / 10);
  const next = { ...stats };
  for (const key of TEMP_STATS) next[key] += bonus;
  return { bonus, stats: next };
}
export const countOpeiaTeam = (team: any[], enemy = false) => team.filter(e => !e.isVanished && (enemy ? !opeiaAlive(e) || isType(e, '蟲') : opeiaAlive(e) || isType(e, '蟲'))).length;
export const handleOpeiaSoulMark = (ctx: BattleEventContext, event: EffectTiming, data?: any) => {
  if (benchSkip(ctx, event)) return false;
  runOpeiaTimedEffects(ctx, event, data);
  const { self, target, actor, targetSide, getPlayerState, setPlayerState } = ctx;
  if (event === EffectTiming.MODIFY_PRIORITY && data?.priorityComp) {
    data.priorityComp.bonus += getPlayerState('opeiaRustEntranceBonus') || 0;
  }
  if (event === EffectTiming.MODIFY_PRIORITY && data?.priorityComp && !self.isInherentInvalid) {
    if (isOpeiaToxicAttack(ctx.skill?.name) && self.currentHp < 200) data.priorityComp.forcedFirst = true;
    if (ctx.skill?.name === '王·鏽腑喰心' && abilityLevels(self, false) > 0) data.priorityComp.bonus += 3;
  }
  if (event === EffectTiming.ON_ENTRANCE) {
    setPlayerState('opeiaKilledThisEntrance', false);
    if (getPlayerState('opeiaRustActive')) {
      const history = getPlayerState('teamEntranceHistory') || {};
      const count = (history[self.battleId || self.id] || 0) + 1;
      setPlayerState('opeiaRustEntranceBonus', count);
      setPlayerState('ignoreSpDefPercentUntilSwitch', Math.min(1, count * 0.25));
    }
    const n = countOpeiaTeam(ctx.getFullTeam(actor));
    setPlayerState('opeiaBonusHitsLeft', n);
    setPlayerState('opeiaEnemyPowerCount', countOpeiaTeam(ctx.getFullTeam(targetSide), true));
    const original = { ...self.calculatedStats };
    setPlayerState('opeiaOriginalStats', original);
    setPlayerState('opeiaOriginalMaxHp', self.maxHp);
    const { bonus, stats: next } = opeiaTemporaryStats({ ...original, hp: self.maxHp }, n);
    ctx.addLog(`👑 【后】：六維總和×${n}×10%＝${bonus}，含體力上限的每一維暫時增加${bonus}，直到下場。`, 'effect');
    // 混沌轉移按每隻場下精靈的實際能力值逐項結算。
    let chaos = false;
    for (const side of [actor,targetSide]) for (const e of ctx.getFullTeam(side)) {
      if (!isType(e, '混沌') || e.isVanished) continue;
      chaos = true;
      if ((e.battleId || e.id) === (self.battleId || self.id) || (e.battleId || e.id) === (target.battleId || target.id)) continue;
      const stats = { ...e.calculatedStats, hp: e.maxHp };
      for (const key of TEMP_STATS) {
        const amount = Math.floor(stats[key] * 0.6); stats[key] -= amount; next[key] += amount;
      }
      ctx.updateAnyElf(side, e.battleId || e.id, { calculatedStats: stats, maxHp: stats.hp,
        currentHp: Math.min(e.currentHp, stats.hp) });
    }
    // 獲得能力值不是恢復體力，不自行把當前HP填滿。
    ctx.updateElf(actor, { calculatedStats: next, maxHp: next.hp });
    setPlayerState('opeiaChaosActive', chaos);
    setPlayerState('ignoreAttackImmunityUntilSwitch', chaos);
    setPlayerState('attackDefenseBypassUntilSwitch', chaos ? {
      ownerBattleId: self.battleId || self.id, block: true, conversion: true, limit: true, shield: true,
    } : null);
  }
  if (event === EffectTiming.ON_SWITCH_OUT) {
    if (getPlayerState('opeiaRustActive') && !getPlayerState('opeiaKilledThisEntrance')) {
      setPlayerState('teamEntranceHistory', {});
      ctx.setOpponentState('teamEntranceHistory', {});
    }
    setPlayerState('opeiaRustEntranceBonus', 0);
    setPlayerState('ignoreSpDefPercentUntilSwitch', 0);
    const original = getPlayerState('opeiaOriginalStats');
    const originalMaxHp = getPlayerState('opeiaOriginalMaxHp');
    if (original) ctx.updateElf(actor, { calculatedStats: original,
      ...(originalMaxHp ? { maxHp: originalMaxHp, currentHp: Math.min(self.currentHp, originalMaxHp) } : {}) });
    setPlayerState('opeiaChaosActive', false);
    setPlayerState('ignoreAttackImmunityUntilSwitch', false);
    setPlayerState('attackDefenseBypassUntilSwitch', null);
    setPlayerState('opeiaBonusHitsLeft', 0);
  }
  if (event === EffectTiming.MODIFY_POWER && data?.isIncoming && data.skill?.category !== '屬性') {
    data.powerComp.power *= Math.max(0, 1 - (getPlayerState('opeiaEnemyPowerCount') || 0) * 0.1);
  }
  if (event === EffectTiming.BEFORE_SKILL) {
    setPlayerState('opeiaToxicAfterAction', null);
    setPlayerState('opeiaRustAfterAction', null);
    setPlayerState('noResistedThisAction', ctx.skill?.name === '王·鏽腑喰心' && !self.isInherentInvalid);
    setPlayerState('targetTypeThisAction', null);
    const insects = getPlayerState('opeiaTreatInsectAttacks') || 0;
    if (insects > 0 && ctx.skill?.category !== '屬性') {
      setPlayerState('targetTypeThisAction', '蟲');
      setPlayerState('opeiaTreatInsectAttacks', insects - 1);
    }
    if (data?.ppCostComp) data.ppCostComp.multiplier = 0;
    const left = getPlayerState('opeiaBonusHitsLeft') || 0;
    if (left > 0 && ctx.skill?.category !== '屬性') {
      setPlayerState('attackBonusHitCountThisAction', (getPlayerState('attackBonusHitCountThisAction') || 0) + 1);
      setPlayerState('opeiaBonusHitsLeft', left - 1);
    }
    const poisoned = ctx.applyStatusWithImmunityCheck(targetSide, '中毒', 3);
    ctx.addLog(poisoned.success ? '🦋 【后】：中毒附加成功。' : '🦋 【后】：中毒未附加成功（被免疫／攔截），改為消除回合類效果並判定害怕。', 'status');
    if (!poisoned.success) {
      ctx.clearTurnEffectsOf(targetSide, target);
      if ((ctx.rng ?? Math.random)() < self.currentHp / self.maxHp) ctx.applyStatusWithImmunityCheck(targetSide, '害怕', 3);
    }
    const full = (ctx.skill?.pp ?? 0) >= getMaxPp(ctx.skill, self);
    setPlayerState('opeiaConvertPoison', full || ctx.skill?.category === '屬性');
    if (!full || ctx.skill?.category !== '屬性') {
      const enemy = currentElf(ctx, targetSide, target);
      const skills = enemy.skills.map(s => ({ ...s, pp: Math.max(0, (s.pp || 0) - 2), currentPp: Math.max(0, (s.currentPp ?? s.pp ?? 0) - 2) }));
      ctx.updateElf(targetSide, { skills });
      // 使用者確認：自身每招各恢復2，不把全隊被扣總量集中到當前技能。
      const holder = currentElf(ctx, actor, self);
      ctx.updateElf(actor, { skills: holder.skills.map(s => {
        const pp = Math.min(getMaxPp(s, holder), (s.pp ?? s.currentPp ?? 0) + 2);
        return { ...s, pp, currentPp: pp };
      }) });
    }
  }
  if (event === EffectTiming.AFTER_ACTION && getPlayerState('opeiaConvertPoison')) {
    setPlayerState('opeiaConvertPoison', false);
    const e = currentElf(ctx, targetSide, target);
    if (Object.entries(ctx.getStatuses(e)).some(([name,n]) => sameStatus(name,'中毒') && n > 0)) {
      if (ctx.applyStatusWithImmunityCheck(targetSide,'感染',3).success) {
        clearStatuses(ctx,targetSide,target,name=>sameStatus(name,'中毒'));
        ctx.addLog('🦋 【后】：出手流程結束，中毒轉化為感染。', 'status');
      } else ctx.addLog('🦋 【后】：感染被免疫／攔截，保留原中毒狀態。', 'status');
    }
  }
  if (event === EffectTiming.AFTER_ACTION) finishOpeiaAttack(ctx);
  if (event === EffectTiming.ON_KILL) setPlayerState('opeiaKilledThisEntrance', true);
  if (event === EffectTiming.OPPONENT_ACTION && data?.skill) {
    const attack = data.skill.category !== '屬性';
    ctx.addTimerTo(targetSide, { id: 'opeia_next_additional_' + (attack ? 'status' : 'attack'), name: '后', kind: 'use_counter', source: 'soulmark', remaining: 1, tickAt: 'never', persistsOffField: true, payload: { block: { addInvalid: attack ? '屬性' : '攻擊', src: '后' } } }, false);
    ctx.applyHeal(actor, Math.floor(self.maxHp / 2));
    opeiaTimer(ctx, targetSide, 'opeia_opponent_damage_reduce', 1,
      { applyMode: 'gate', wraps: 'damage_multiplier', params: { value: 0.5, damageTypes: ['non_true'] } }, false, 'soulmark');
    setPlayerState('opeiaPpSealSkill', { name: data.skill.name, category: attack ? data.skill.category : null, targetId: target.battleId || target.id });
    if (!attack) opeiaTimer(ctx, actor, 'opeia_reduction_override', 2,
      { damageReductionOverridePercent: 99 }, false, 'soulmark');
  }
  if (event === EffectTiming.BATTLE_PHASE_END) {
    const seal = getPlayerState('opeiaPpSealSkill');
    if (seal) {
      const holder = ctx.getFullTeam(targetSide).find(e => (e.battleId || e.id) === seal.targetId);
      if (holder) ctx.updateAnyElf(targetSide, seal.targetId, { skills: holder.skills.map(s => s.name === seal.name || (seal.category && s.category === seal.category) ? { ...s, pp: 0, currentPp: 0 } : s) });
      setPlayerState('opeiaPpSealSkill', null);
    }
  }
  if (event === EffectTiming.SKILL_INVALID && !data?.isIncoming && data?.skill?.name === '毒噬魂絲') {
    ctx.applyHeal(actor, Math.floor(self.maxHp / 2));
    setPlayerState('opeiaTreatInsectAttacks', 2);
  }
  return false;
};

export const OPEIA_SKILLS: Record<string, BattleSkillHandler> = {
  "毒噬魂絲": (ctx) => {
    const hadBoosts = abilityLevels(ctx.target, true) > 0;
    const absorbed = absorbBoosts(ctx);
    if (absorbed > 0) ctx.applyStatusWithImmunityCheck(ctx.targetSide, '沉默', 3);
    if (!hadBoosts) ctx.applyStatChange(ctx.targetSide, Object.fromEntries(abilityKeys.map(k=>[k,-1])));
    const amount = Math.floor(ctx.target.maxHp / 3) * (ctx.target.currentHp > ctx.target.maxHp / 2 ? 2 : 1);
    const dealt = ctx.applyPinkDamage(ctx.targetSide, amount, '毒噬魂絲·吸取', undefined, undefined, 'percent');
    ctx.applyHeal(ctx.actor, dealt);
  },
  "蟲群庇護": opeiaSwarm,
  "蟲后之冠": opeiaCrown,
  "王.噬心毒蝕": opeiaToxicAttack,
  "王·噬心毒蝕": opeiaToxicAttack,
  "王·鏽腑喰心": opeiaRustAttack,
};

export { OpeiaDeconstructedProfile } from "../data/elfProfiles/opeiaRegistry";
