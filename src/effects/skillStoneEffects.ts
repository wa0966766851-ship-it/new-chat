import type { Skill } from '../types';
import type { BattleEventContext, BattleSkillAfterHitHandler } from './types';
import { isSkillStone, isStoneThrower, stoneEffect, toSSStone } from '../data/skillStones';
import { clampSkillPp } from '../utils/battleHelpers';
import { prdPercent } from '../utils/prd';
import { recoverPpByTimers, settlePpChanges } from '../battle/ppTransitions';
import { skillSlot } from '../battle/skillSlot';

type Roll = (key: string, percent: number) => boolean;
function additionalAllowed(ctx: BattleEventContext): boolean {
  const timers = (ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers) || [];
  return (ctx as any).additionalEffectsEnabled !== false && !ctx.self.isAdditionalInvalid && !(ctx.getPlayerState('allHitEffectNullTurns') > 0)
    && !timers.some(t => !t.pendingActivation && t.remaining > 0 && ['all', '攻擊'].includes(t.payload?.block?.addInvalid));
}
const key = (ctx: BattleEventContext, skill: Skill) => `${ctx.actor}:${ctx.self.battleId || ctx.self.id}:${skill.name}:stone`;
const proc = (ctx: BattleEventContext, skill: Skill, roll: Roll) => {
  const effect = stoneEffect(skill);
  return !!effect && roll(key(ctx, skill), isStoneThrower(ctx.self) ? 100 : effect.chance);
};

/** 附加效果統一走 metadata，不再讓文字解析猜測或重複執行。 */
export function stonePriorityBonus(ctx: BattleEventContext, skill: Skill, roll: Roll = prdPercent): number {
  if (stoneEffect(skill)?.detail !== 'priority_plus_1' || !additionalAllowed(ctx)) return 0;
  const cache = ctx.getPlayerState('conditionalSkillPriorityRoll');
  const id = `${ctx.roundNumber}:${skill.name}`;
  if (cache?.id === id) return cache.bonus;
  const bonus = proc(ctx, skill, roll) ? 1 : 0;
  ctx.setPlayerState('conditionalSkillPriorityRoll', { id, bonus });
  return bonus;
}

export function transformStone(ctx: BattleEventContext, skill: Skill): Skill {
  return isSkillStone(skill) && isStoneThrower(ctx.self) ? toSSStone(skill) : skill;
}

export function stoneBeforeDamage(ctx: BattleEventContext, skill: Skill, roll: Roll = prdPercent): Skill {
  if (!additionalAllowed(ctx) || stoneEffect(skill)?.detail !== 'double_power' || !proc(ctx, skill, roll)) return skill;
  // 舊專案 TXT 明寫威力；SeerAPI 原版明寫傷害。兩者不是同一公式。
  return skill.skillStoneRuleset === 'standard'
    ? { ...skill, skillStoneDamageMultiplier: 2 }
    : { ...skill, power: skill.power * 2 };
}

export function stoneAfterHit(ctx: BattleEventContext, roll: Roll = prdPercent): void {
  const skill: Skill = ctx.skill, effect = stoneEffect(skill);
  if (!additionalAllowed(ctx) || !effect || ['double_power', 'priority_plus_1'].includes(effect.detail) || ctx.isHit === false || !proc(ctx, skill, roll)) return;
  const self = ctx.actor, opp = ctx.targetSide;
  if (effect.type === 'status') {
    const [status, turns] = effect.detail.split(':');
    const duration = skill.skillStoneRuleset === 'standard' && status !== 'fatigued' ? 3 : Number(turns);
    ctx.applyStatusWithImmunityCheck(opp, status, duration);
  } else if (effect.type === 'stat_up' || effect.type === 'stat_down') {
    const changes = Object.fromEntries(effect.detail.split(',').map(x => {
      const [, stat, amount] = x.match(/^(\w+)([+-]\d+)$/)!;
      return [stat, Number(amount)];
    }));
    ctx.applyStatChange(effect.type === 'stat_up' ? self : opp, changes);
  } else switch (effect.detail) {
    case 'add_damage_200':
      if (skill.skillStoneRuleset === 'standard') ctx.applyFixedDamage(opp, 200, '固定傷害');
      else ctx.applyTrueDamage(opp, 200, '真實傷害');
      break;
    case 'restore_all_pp_1':
      ctx.updateElf(self, settlePpChanges(ctx.self,
        recoverPpByTimers(ctx.self, 1, (self === 'p1' ? ctx.p1Timers : ctx.p2Timers) || [])).patch);
      break;
    case 'reduce_opp_pp_1': {
      const skills = ctx.target.skills.map(s => ({ ...s, pp: clampSkillPp(s, s.pp - 1, ctx.target) }));
      const result = settlePpChanges(ctx.target, skills);
      ctx.updateElf(opp, result.patch);
      const selected = ctx.opponentSkill;
      const slot = skillSlot(ctx.target, selected);
      if (slot >= 0 && result.patch.skills?.[slot]?.pp === 0) ctx.setOpponentState('actionPreventedRound', ctx.roundNumber);
      break;
    }
    case 'half_damage_1turn':
      ctx.addTimerTo(self, { id: 'stone_damage_half', name: '受到傷害減半', kind: 'turn_effect', source: 'skill',
        remaining: 1, tickAt: 'round_end', payload: { applyMode: 'gate', wraps: 'damage_reduce', params: { percent: 50, damageTypes: ['non_true'] } } }, ctx.goesFirst === false);
      break;
    case 'next_crit_up':
      ctx.addTimerTo(self, { id: 'stone_crit', name: '致命機率增加1/16', kind: 'turn_effect', source: 'skill',
        remaining: 1, tickAt: 'round_end', pendingActivation: skill.skillStoneRuleset !== 'standard', payload: { block: { critChanceBonus: 1 / 16 } } }, ctx.goesFirst === false);
      break;
  }
}

export const stoneAfterHitHandler: BattleSkillAfterHitHandler = ctx => stoneAfterHit(ctx);
