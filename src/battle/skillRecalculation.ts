import type { Skill } from '../types';
import type { BattleEventContext } from '../effects/types';

export interface SkillRecalculationRequest { powerMultiplier: number }
/** 無效分支要求重跑攻擊公式；不是保底傷害、額外行動或再次使用技能。 */
export function requestSkillRecalculation(ctx: BattleEventContext, request: SkillRecalculationRequest): boolean {
  if (ctx.getPlayerState('skillRecalculationUsedThisAction') || ctx.skill?.category === '屬性'
    || !Number.isFinite(request.powerMultiplier) || request.powerMultiplier <= 0) return false;
  ctx.setPlayerState('skillRecalculationUsedThisAction', true);
  ctx.setPlayerState('skillRecalculationRequest', { ...request });
  return true;
}
export function takeSkillRecalculation(ctx: BattleEventContext): SkillRecalculationRequest | undefined {
  const request = ctx.getPlayerState('skillRecalculationRequest');
  ctx.setPlayerState('skillRecalculationRequest', undefined);
  return request;
}
export function recalculatedSkill(skill: Skill, request: SkillRecalculationRequest): Skill {
  return { ...skill, power: Math.floor(skill.power * request.powerMultiplier) };
}
