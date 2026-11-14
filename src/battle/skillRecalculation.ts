import type { Skill } from '../types';
import type { BattleEventContext } from '../effects/types';
import {activeConstraints} from './timedConstraints';

/** forced：由「強制執行命中效果」發起；重算主傷害時威力／增傷類命中效果照常生效（不再重跑使用／命中動作）。 */
export interface SkillRecalculationRequest { powerMultiplier: number; forced?: boolean }
/** 原技能已失效時，強制命中仍可接手一併存在的傷害封鎖。 */
export function hasPendingSkillDamageSuppression(ctx:BattleEventContext):boolean {
  const own=ctx.actor==='p1'?ctx.p1Timers:ctx.p2Timers;
  const other=ctx.targetSide==='p1'?ctx.p1Timers:ctx.p2Timers;
  return activeConstraints(own,ctx.self).some(p=>p.preventAttackDamage)
    ||activeConstraints(other,ctx.target).some(payload=>{const p=payload.block||payload;return p.blockAttack||p.blockSkillDmg||p.recordBlockedDamage&&['攻擊','技能','非真實','全部'].includes(p.kind);});
}
/** 只重算攻擊主傷害；一般減傷、上限、護盾與傷害轉化仍由原公式處理。 */
export function shouldRecalculateSuppressedDamage(ctx:BattleEventContext,additionalInvalid:boolean,forced:boolean):boolean {
  return !!ctx.getPlayerState('skillRecalculationUsedThisAction')||(additionalInvalid&&forced);
}
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
