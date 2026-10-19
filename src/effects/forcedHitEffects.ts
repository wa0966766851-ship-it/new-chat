import type {BattleEventContext} from './types';
import type {Skill} from '../types';
import {runConnectedKit} from './connectedEffects';
import {requestSkillRecalculation} from '../battle/skillRecalculation';
import {teamForcedHitPower} from '../battle/forcedHitRules';

export {hasForcedHitEffects} from '../battle/forcedHitRules';
/** 強制的只有命中附加條款；固有、攜帶、無效、擊敗與被動入口不在這裡重播。 */
export function runForcedHitEffects(ctx:BattleEventContext,skill:Skill):void {
  const forcedCtx=Object.assign(Object.create(ctx),{skill,forcedHitEffects:true,additionalEffectsEnabled:true,mainSkillHpReduced:0,damageDealt:0,killed:false});
  const definition={...skill,kit:(skill.kit||[]).filter(e=>e.source==='skill'&&(e.role||'attached')==='attached'&&['on_skill_use','on_hit'].includes(e.node))};
  runConnectedKit('on_skill_use',definition,forcedCtx);
  runConnectedKit('on_hit',definition,forcedCtx);
  // 包含其他來源早已附加的固定威力，不只比較本段執行前後的差值。
  if(Number(ctx.getPlayerState('powerAddThisAction'))>0||teamForcedHitPower(forcedCtx)>0)requestSkillRecalculation(ctx,{powerMultiplier:1});
}
