import type {BattleEventContext} from './types';
import {EffectTiming} from './types';
import type {StatType} from '../types';
import {resourceMarkLocked} from './resourceMarkLocks';
const STATS:StatType[]=['atk','def','spatk','spdef','speed','accuracy'];
/** 「調整」直接改原始等級，不把調整差額當一次強化，也不借用視為提升的公式視圖。 */
export function floorStagesAtOpponent(ctx:BattleEventContext):boolean{
 const next={...ctx.self.statStages};
 for(const key of STATS)next[key]=Math.max(Number(next[key])||0,Number(ctx.target.statStages?.[key])||0);
 ctx.updateElf(ctx.actor,{statStages:next});return true;
}
/** 體型查詢只決定扣除數值；上限調整與資源扣除各自下限，不製造傷害或恢復事件。 */
export function loseBodyMaximumAndResource(ctx:BattleEventContext,p:any):number{
 const side=p.side==='self'?ctx.actor:ctx.targetSide,elf=side===ctx.actor?ctx.self:ctx.target;
 const weight=ctx.getBody?.(side)?.weight??elf.weight??0;
 const amount=Math.min(p.cap,Math.floor(Math.max(0,weight)/p.unit));
 if(!Number.isFinite(amount)||amount<=0)return 0;
 const maxHp=Math.max(1,elf.maxHp-amount);
 ctx.updateElf(side,{maxHp,currentHp:Math.min(elf.currentHp,maxHp)});
 const owner=elf.battleId||elf.id,mark=ctx.getMarks(side).find(m=>m.id===p.resourceId&&m.ownerBattleId===owner);
 if(mark&&!resourceMarkLocked(ctx,side,p.resourceId)){
  const before=mark.count,after=Math.max(0,before-amount);
  ctx.setMark({...mark,count:after,visibleWhenZero:true},side);
  if(after!==before)ctx.emitElfEvent?.(side,elf,EffectTiming.RESOURCE_CHANGED,{side,targetBattleId:owner,id:p.resourceId,before,after});
 }
 return amount;
}
