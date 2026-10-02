import { BattleEventContext, BattleSkillHandler, EffectTiming } from "./types";
import { abilityKeys, abilityLevels, absorbBoosts, currentElf, clearStatuses } from './semanticOperations';
import { sameStatus } from './statusIdentity';
import { getMaxPp } from '../utils/battleHelpers';

const isType = (elf: any, type: string) => String(elf.type || '').replace(/系/g, '').split(/[.·・]/).includes(type);
export const countOpeiaTeam = (team: any[], enemy = false) => team.filter(e => !e.isVanished && (enemy ? e.currentHp <= 0 || isType(e, '蟲') : e.currentHp > 0 || isType(e, '蟲'))).length;
export const handleOpeiaSoulMark = (ctx: BattleEventContext, event: EffectTiming, data?: any) => {
  const { self, target, actor, targetSide, getPlayerState, setPlayerState } = ctx;
  if (event === EffectTiming.MODIFY_PRIORITY && data?.priorityComp && !self.isInherentInvalid) {
    if (ctx.skill?.name === '王.噬心毒蝕' && self.currentHp < 200) data.priorityComp.forcedFirst = true;
    if (ctx.skill?.name === '王·鏽腑喰心' && abilityLevels(self, false) > 0) data.priorityComp.bonus += 3;
  }
  if (event === EffectTiming.ON_ENTRANCE) {
    const n = countOpeiaTeam(ctx.getFullTeam(actor));
    setPlayerState('opeiaBonusHitsLeft', n);
    setPlayerState('opeiaEnemyPowerCount', countOpeiaTeam(ctx.getFullTeam(targetSide), true));
    const original = { ...self.calculatedStats };
    setPlayerState('opeiaOriginalStats', original);
    const next = { ...original };
    // 原文「所有能力值 n×10% 總和」的基數待確認；不擅自以單體百分比代替。
    // 混沌轉移按每隻場下精靈的實際能力值逐項結算。
    let chaos = false;
    for (const side of [actor,targetSide]) for (const e of ctx.getFullTeam(side)) {
      if (!isType(e, '混沌') || e.isVanished) continue;
      chaos = true;
      if ((e.battleId || e.id) === (self.battleId || self.id) || (e.battleId || e.id) === (target.battleId || target.id)) continue;
      const stats = { ...e.calculatedStats };
      for (const key of ['atk','def','spatk','spdef','speed'] as const) {
        const amount = Math.floor(stats[key] * 0.6); stats[key] -= amount; next[key] += amount;
      }
      ctx.updateAnyElf(side, e.battleId || e.id, { calculatedStats: stats });
    }
    ctx.updateElf(actor, { calculatedStats: next });
    setPlayerState('opeiaChaosActive', chaos);
    setPlayerState('ignoreAttackImmunityUntilSwitch', chaos);
  }
  if (event === EffectTiming.ON_SWITCH_OUT) {
    const original = getPlayerState('opeiaOriginalStats');
    if (original) ctx.updateElf(actor, { calculatedStats: original });
    setPlayerState('opeiaChaosActive', false);
    setPlayerState('ignoreAttackImmunityUntilSwitch', false);
    setPlayerState('opeiaBonusHitsLeft', 0);
  }
  if (event === EffectTiming.MODIFY_POWER && data?.isIncoming && data.skill?.category !== '屬性') {
    data.powerComp.power *= Math.max(0, 1 - (getPlayerState('opeiaEnemyPowerCount') || 0) * 0.1);
  }
  if (event === EffectTiming.BEFORE_SKILL) {
    setPlayerState('targetTypeThisAction', null);
    const insects = getPlayerState('opeiaTreatInsectAttacks') || 0;
    if (insects > 0 && ctx.skill?.category !== '屬性') {
      setPlayerState('targetTypeThisAction', '蟲');
      setPlayerState('opeiaTreatInsectAttacks', insects - 1);
    }
    if (data?.ppCostComp) data.ppCostComp.multiplier = 0;
    const left = getPlayerState('opeiaBonusHitsLeft') || 0;
    if (left > 0 && ctx.skill?.category !== '屬性') {
      setPlayerState('attackHitCountThisAction', 2); setPlayerState('opeiaBonusHitsLeft', left - 1);
    }
    const poisoned = ctx.applyStatusWithImmunityCheck(targetSide, '中毒', 3);
    if (!poisoned.success) {
      ctx.clearTurnEffectsOf(targetSide, target);
      if ((ctx.rng ?? Math.random)() < self.currentHp / self.maxHp) ctx.applyStatusWithImmunityCheck(targetSide, '害怕', 3);
    }
    const full = (ctx.skill?.pp ?? 0) >= getMaxPp(ctx.skill, self);
    setPlayerState('opeiaConvertPoison', full || ctx.skill?.category === '屬性');
    if (!full || ctx.skill?.category !== '屬性') {
      const skills = target.skills.map(s => ({ ...s, pp: Math.max(0, (s.pp || 0) - 2), currentPp: Math.max(0, (s.currentPp ?? s.pp ?? 0) - 2) }));
      ctx.updateElf(targetSide, { skills });
    }
  }
  if (event === EffectTiming.AFTER_ACTION && getPlayerState('opeiaConvertPoison')) {
    setPlayerState('opeiaConvertPoison', false);
    const e = currentElf(ctx, targetSide, target);
    if (Object.entries(ctx.getStatuses(e)).some(([name,n]) => sameStatus(name,'中毒') && n > 0)) {
      if (ctx.applyStatusWithImmunityCheck(targetSide,'感染',3).success) clearStatuses(ctx,targetSide,target,name=>sameStatus(name,'中毒'));
    }
  }
  if (event === EffectTiming.OPPONENT_ACTION && data?.skill) {
    const attack = data.skill.category !== '屬性';
    ctx.addTimerTo(targetSide, { id: 'opeia_next_additional_' + (attack ? 'status' : 'attack'), name: '后', kind: 'use_counter', source: 'soulmark', remaining: 1, tickAt: 'never', persistsOffField: true, payload: { block: { addInvalid: attack ? '屬性' : '攻擊', src: '后' } } }, false);
    ctx.applyHeal(actor, Math.floor(self.maxHp / 2));
    setPlayerState('opeiaReduceOpponentRound', ctx.roundNumber);
    setPlayerState('opeiaPpSealSkill', { name: data.skill.name, category: attack ? data.skill.category : null, targetId: target.battleId || target.id });
    if (!attack) setPlayerState('opeiaReduction99Turns', 2);
  }
  if (event === EffectTiming.BEFORE_DAMAGE && data?.isIncoming && data.damageCategory !== 'true' && getPlayerState('opeiaReduceOpponentRound') === ctx.roundNumber) {
    data.multiplier *= (getPlayerState('opeiaReduction99Turns') || 0) > 0 ? 0.01 : 0.5;
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
  "蟲群庇護": (ctx) => {
    const { self, addLog } = ctx;
    addLog(`🛡️ 使用【蟲群庇護】：5 回合內免疫並反彈所有異常狀態！`, "status");
    ctx.setPlayerState("immuneStatusTurns", 5);
  },
  "蟲后之冠": (ctx) => {
    const { addLog } = ctx;
    addLog(`👑 使用【蟲后之冠】：全屬性提升！`, "effect");
  },
  "王.噬心毒蝕": (ctx) => {
    const { target, addLog, applyPinkDamage } = ctx;
    addLog(`💔 使用【王.噬心毒蝕】：附加對手已損失體力 50% 的傷害！`, "damage");
    const bonus = Math.floor((target.maxHp - target.currentHp) * 0.5);
    applyPinkDamage(ctx.actor === "p1" ? "p2" : "p1", bonus, "噬心毒蝕", ctx.activeP1, ctx.activeP2, "百分比傷害");
  },
  "王·鏽腑喰心": (ctx) => {
    const { addLog } = ctx;
    addLog(`⚔️ 使用【王·鏽腑喰心】：忽視對手 25% 特防！`, "effect");
  }
};

export { OpeiaDeconstructedProfile } from "../data/elfProfiles/opeiaRegistry";
