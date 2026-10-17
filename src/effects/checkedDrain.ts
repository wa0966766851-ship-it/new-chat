import type {BattleEventContext} from './types';
/** 扣血與恢復均等到正式結算；任何一側實際HP未改變，整次吸取只補一次真傷。 */
export function checkedPercentDrain(ctx:BattleEventContext,p:{ratio:number;failTrue:number}):number{
 const targetId=ctx.target.battleId||ctx.target.id,selfId=ctx.self.battleId||ctx.self.id;
 const target=ctx.getFullTeam?.(ctx.targetSide).find(e=>(e.battleId||e.id)===targetId)||ctx.target;
 const amount=Math.floor(target.maxHp*p.ratio);
 if(amount<=0)return 0;
 return ctx.applyPinkDamage(ctx.targetSide,amount,'百分比吸取',undefined,undefined,'percent',{
  onSettled:damage=>{
   if(damage.targetBattleId!==targetId)return;
   const finish=(gained:number)=>{if(damage.damageType==='percent'&&(damage.hpLost<=0||gained<=0)&&p.failTrue>0)ctx.applyTrueDamage(ctx.targetSide,p.failTrue,'吸取未改變體力追加真傷');};
   if(damage.settledAmount>0)ctx.applyHeal(ctx.actor,damage.settledAmount,{onSettled:heal=>{if(heal.targetBattleId===selfId)finish(heal.hpGained);}});
   else finish(0);
  },
 });
}
