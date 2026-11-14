import type {BattleEventContext} from '../effects/types';
import {prdConstant} from '../utils/prd';
import {recipientEffectChance} from './recipientEffectChance';
import {checkElfDead} from './elfAlive';
import {markAppliesToElf} from './marks';

/** 個體、來源各自計數；隨戰鬥快照保存，成功／下場重置。免疫由正式秒殺管線處理。 */
export function instantKillChance(ctx:BattleEventContext,source:string,percent:number,targetSide=ctx.targetSide):boolean {
  if(checkElfDead(ctx.self)||ctx.getMarks(ctx.actor).some(m=>markAppliesToElf(m,ctx.self)&&m.effects?.instantKillDisabled))return false;
  const target=targetSide==='p1'?ctx.activeP1:ctx.activeP2;
  if(target&&checkElfDead(target))return false;
  const p=recipientEffectChance(ctx,targetSide,percent)/100;
  if(!(p>0)||!Number.isFinite(p))return false;
  const key='instantKillPity',counts={...(ctx.getPlayerState(key)||{})};
  const n=(Number(counts[source])||0)+1;
  const success=p>=1||n>=100||(ctx.rng||Math.random)()<Math.min(1,prdConstant(Math.max(.0001,p))*n);
  counts[source]=success?0:n;
  ctx.setPlayerState(key,counts);
  const clear=ctx.getPlayerState('clearOnSwitch')||[];
  if(!clear.includes(key))ctx.setPlayerState('clearOnSwitch',[...clear,key]);
  return success;
}
