import type {BattleEventContext} from './types';
/** 能力等級的操作保護與普通強化／弱化分開；只讀仍有效且屬於本持有者的計時器。 */
export function stageOperationBlocked(ctx:BattleEventContext,side:'p1'|'p2',value:number,operation:'clear'|'steal'|'reverse'):boolean{
  const elf=side===ctx.actor?ctx.self:ctx.target,id=String(elf.battleId||elf.id);
  return (side==='p1'?ctx.p1Timers:ctx.p2Timers||[])?.some(t=>{
    const guard=(t.payload as any)?.block?.stageGuard;
    return !t.pendingActivation&&t.remaining>0&&(!t.ownerBattleId||String(t.ownerBattleId)===id)&&
      (value>0?guard==='up'&&operation!=='reverse':value<0&&guard==='down'&&operation!=='steal');
  })||false;
}
