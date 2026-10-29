import type {BattleEventContext} from './types';
import type {Stmt,Trigger} from '../blocks/model';
import {isNonTrueDamageType} from '../battle/damageSemantics';
import {ownsActiveFormation,linksFormation} from './formationTimerOwnership';

type RunBody=(body:Stmt[],sourceKind:'skill'|'soul'|'trait')=>void;
const timers=(ctx:BattleEventContext,side:'p1'|'p2')=>(side==='p1'?ctx.p1Timers:ctx.p2Timers)||[];

/** 結束來源綁定的容器後才執行可編輯關閉動作，避免動作再入時重複收費。 */
export function closeFormationWindow(ctx:BattleEventContext,id:string,run:RunBody):boolean {
  const owner=ctx.self.battleId||ctx.self.id;
  const timer=timers(ctx,ctx.actor).find(t=>ownsActiveFormation(t,id,owner)&&t.payload?.formationWindow);
  if(!timer)return false;
  for(const side of ['p1','p2'] as const)for(const t of [...timers(ctx,side)]) {
    if(t===timer&&side===ctx.actor||linksFormation(t,id,ctx.actor,owner))
      for(let i=0;i<t.remaining;i++)ctx.consumeTimer(side,t.id);
  }
  run(timer.payload!.formationWindow.onClose,timer.payload!.formationWindow.sourceKind);
  ctx.addLog(`👑 ${timer.name}正常關閉。`,'effect');
  return true;
}

/** 只處理帶明確配置的通用容器；不讀精靈名稱或舊專屬狀態。 */
export function runFormationWindows(ctx:BattleEventContext,trigs:Trigger[],data:any,run:RunBody):void {
  const owner=ctx.self.battleId||ctx.self.id;
  for(const timer of [...timers(ctx,ctx.actor)]) {
    const p=timer.payload?.formationWindow;
    if(!p||!ownsActiveFormation(timer,timer.id,owner))continue;
    const comp=data?.damageComp||(data?.base!=null?data:null);
    if(trigs.includes('incoming_nontrue')&&comp?.isIncoming&&!comp.pure&&isNonTrueDamageType(comp.damageCategory)&&p.reduceLostHpRatio>0) {
      comp.flatReduction=(comp.flatReduction||0)+Math.max(0,ctx.target.maxHp-ctx.target.currentHp)
        *p.reduceLostHpRatio*(comp.reductionPolicy?.attenuation??1);
    }
    if(trigs.includes('round_end')&&timer.remaining===1&&!timer.lateMoverPending)
      closeFormationWindow(ctx,timer.id,run);
  }
}
