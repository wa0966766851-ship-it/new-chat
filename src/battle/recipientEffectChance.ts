import type {BattleEventContext} from '../effects/types';
import {markCapability} from './markCapabilities';
import {prdChance} from '../utils/prd';

/** 只保證敵方施加給持有者的機率效果；不替敵方自身效果改機率，也不繞過免疫。 */
export function recipientEffectChance(ctx:BattleEventContext,side:'p1'|'p2',percent:number,recipient?:any):number {
  if(side===ctx.actor||!Number.isFinite(percent)||percent<0||percent>=100)return percent;
  const elf=recipient||(side===ctx.targetSide?ctx.target:side==='p1'?ctx.activeP1:ctx.activeP2);
  return markCapability(elf,'incomingEffectChanceGuaranteed',ctx.getMarks?.(side)||elf?.marks||[])>0?100:percent;
}

/** 舊處理器的0～1機率也在擲骰前查詢實際受方，保留原有PRD鍵及免疫處理。 */
export function recipientPrdChance(ctx:BattleEventContext,side:'p1'|'p2',key:string,probability:number,recipient?:any):boolean {
  return prdChance(key,recipientEffectChance(ctx,side,probability*100,recipient)/100);
}
