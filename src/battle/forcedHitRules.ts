import {portableSkillCapabilities} from './portableSkillMarks';
import type {BattleEventContext} from '../effects/types';
import {EffectTiming} from '../effects/types';
import {queueActionPowerAdd} from './actionDamageModifiers';
import {readMarkStacks} from '../effects/markQueries';

export interface TeamForcedHitRule {
  untilSkill: string;
  powerAdd: number;
  perMarkId: string;
  perMarkAdd: number;
  ownerBattleId: string;
}
const key='teamForcedHitRule';
export function installTeamForcedHit(ctx:BattleEventContext,p:Omit<TeamForcedHitRule,'ownerBattleId'>):boolean {
  ctx.setPlayerState(key,{...p,ownerBattleId:ctx.self.battleId||ctx.self.id});
  return true;
}
export function hasForcedHitEffects(ctx:BattleEventContext):boolean {
  return !!portableSkillCapabilities(ctx.self).forceHitEffects||!!ctx.getPlayerState(key)||!!ctx.getPlayerState('forceHitEffectsThisAction');
}
/** 在公式前讀取當下印記；前置命中效果可能剛改變印記層數。 */
export function teamForcedHitPower(ctx:BattleEventContext):number {
  const rule:TeamForcedHitRule|undefined=ctx.getPlayerState(key);
  if(!rule||rule.ownerBattleId!==(ctx.self.battleId||ctx.self.id)||ctx.skill?.name!==rule.untilSkill)return 0;
  return rule.powerAdd+rule.perMarkAdd*(rule.perMarkId?readMarkStacks(ctx,{side:'opp',id:rule.perMarkId}):0);
}
export function applyTeamForcedHitPower(ctx:BattleEventContext):void {
  const bonus=teamForcedHitPower(ctx);
  if(!(bonus>0))return;
  const stamp=`${ctx.actionId}:${ctx.self.battleId||ctx.self.id}:${ctx.skill?.name}`;
  if(ctx.getPlayerState('teamForcedPowerStamp')===stamp)return;
  ctx.setPlayerState('teamForcedPowerStamp',stamp);
  queueActionPowerAdd(ctx,bonus);
}
/** 隊伍規則跨換人；只有原施加者成功使用指定技能才解除。 */
export function teamForcedHitLifecycle(ctx:BattleEventContext,event:EffectTiming,data?:any):void {
  const rule:TeamForcedHitRule|undefined=ctx.getPlayerState(key);
  if(!rule||rule.ownerBattleId!==(ctx.self.battleId||ctx.self.id)||ctx.skill?.name!==rule.untilSkill)return;
  if(event===EffectTiming.AFTER_ACTION&&data?.hit===true)ctx.setPlayerState(key,undefined);
}
