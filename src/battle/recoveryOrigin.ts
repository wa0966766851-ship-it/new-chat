import type {BattleEventContext} from '../effects/types';
export type RecoveryOrigin = {kind:'skill'|'soul'|'trait';sourceSide:'p1'|'p2';sourceBattleId:string};
/** 回復分類由執行容器決定，不從技能名字／日誌或當前選招猜測。 */
export function withRecoveryOrigin(ctx:BattleEventContext,kind:RecoveryOrigin['kind']):BattleEventContext {
  const current=(ctx as any).recoveryOrigin;
  if(!(ctx as any).effectSource&&current?.kind===kind&&current.sourceSide===ctx.actor&&current.sourceBattleId===String(ctx.self?.battleId||ctx.self?.id||''))return ctx;
  const next=Object.create(ctx);
  const origin=():RecoveryOrigin=>(ctx as any).effectSource?.kind===kind?(ctx as any).effectSource:
    {kind,sourceSide:ctx.actor,sourceBattleId:String(ctx.self?.battleId||ctx.self?.id||'')};
  Object.defineProperty(next,'recoveryOrigin',{get:origin,configurable:true});
  // 同一容器也給異常附加明確來源，避免讀目前選招來猜魂印／技能。
  next.applyStatusWithImmunityCheck=(side,status,duration,ignoreImmune,targetId,statusOrigin)=>ctx.applyStatusWithImmunityCheck(side,status,duration,ignoreImmune,targetId,
    statusOrigin??{...origin(),skillCategory:ctx.skill?.category});
  const options=(opts:any)=>{const source=opts?.recoveryOrigin??origin();return source.sourceBattleId?{...opts,recoveryOrigin:source}:opts;};
  next.applyHeal=(side:any,amount:number,opts:any)=>{const result=options(opts);return result===undefined?ctx.applyHeal(side,amount):ctx.applyHeal(side,amount,result);};
  if(ctx.applyHealToElf)next.applyHealToElf=(side:any,id:string,amount:number,opts:any)=>{const result=options(opts);return result===undefined?ctx.applyHealToElf!(side,id,amount):ctx.applyHealToElf!(side,id,amount,result);};
  if(ctx.applyAbsorb)next.applyAbsorb=(side:any,amount:number,label?:string,opts?:any)=>{const result=options(opts);return result===undefined?ctx.applyAbsorb(side,amount,label):ctx.applyAbsorb(side,amount,label,result);};
  if(ctx.setPlayerState)next.setPlayerState=(key:string,value:any,acquiredSource?:string)=>{
    ctx.setPlayerState(key,value,acquiredSource);
    if(key==='vampireRatio'&&origin().sourceBattleId)ctx.setPlayerState('vampireRecoveryOriginThisAction',value>0?origin():undefined,acquiredSource);
  };
  return next;
}
export function blocksOwnSkillRecovery(origin:RecoveryOrigin|undefined,targetSide:string,targetId:string,turns:number,isPotion=false):boolean {
  return !isPotion&&turns>0&&origin?.kind==='skill'&&!!origin.sourceBattleId&&origin.sourceSide===targetSide&&origin.sourceBattleId===String(targetId);
}
/** 下N回合的禁療只從已啟用且屬於持有者的計時器讀取，不提前寫全域禁療鍵。 */
export function blocksTimedRecovery(timers:any[]|undefined,targetSide:string,targetId:string,origin:RecoveryOrigin|undefined,isPotion=false):boolean {
  return (timers||[]).some(t=>!t.pendingActivation&&t.remaining>0&&(t.scope==='team'||!t.ownerBattleId||String(t.ownerBattleId)===String(targetId))&&
    (t.payload?.block?.healGuard==='all'||t.payload?.block?.healGuard==='own_skill'&&blocksOwnSkillRecovery(origin,targetSide,targetId,1,isPotion)));
}
