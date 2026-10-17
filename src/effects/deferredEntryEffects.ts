import type {BattleEventContext} from './types';
import type {Stmt} from '../blocks/model';
import type {RunState} from '../blocks/runtime';
import {checkElfDead} from '../battle/elfAlive';

const key='nextElfBlockPrograms';
const identity=(elf:any)=>String(elf?.battleId||elf?.id||'');
type Pending={sourceSide:'p1'|'p2';sourceBattleId:string;sourceKind:'skill'|'soul'|'trait';amount:number;excludeSource:boolean;body:Stmt[];label:string};

/** 排入的是資料圖紙及施加時的資源快照，沒有專屬名稱查詢或可執行函式。 */
export function deferAllyEntry(ctx:BattleEventContext,p:any,st:RunState):boolean {
  const pending:Pending[]=ctx.getPlayerState(key)||[];
  if(pending.length>=100)return false;
  const value=p.resource==='last_amount'?st.lastAmount:p.resource==='none'?0:Number((ctx.self as any)[p.resource]??0);
  if(!Number.isFinite(value))return false;
  ctx.setPlayerState(key,[...pending,{sourceSide:ctx.actor,sourceBattleId:identity(ctx.self),
    sourceKind:st.sourceKind||'skill',amount:Math.max(0,Math.floor(value*p.ratio)),
    excludeSource:p.excludeSource,body:structuredClone(p.body),label:p.label||'下次隊友登場效果'}]);
  return true;
}

/** 先移除本次交付，再執行收受者自己的圖紙；重入登場不會重領，也不移交到敵方。 */
export function runDeferredAllyEntry(ctx:BattleEventContext,run:(ctx:BattleEventContext,body:Stmt[],st:RunState)=>void):void {
  const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
  if(identity(active)!==identity(ctx.self)||checkElfDead(ctx.self)||ctx.self.isVanished||ctx.self.isExtra)return;
  const pending:Pending[]=ctx.getPlayerState(key)||[];
  const eligible=(p:Pending)=>!p.excludeSource||p.sourceBattleId!==identity(ctx.self);
  const ready=pending.filter(eligible);if(!ready.length)return;
  ctx.setPlayerState(key,pending.filter(p=>!eligible(p)));
  for(const p of ready){
    const recipient=Object.create(ctx);
    Object.defineProperty(recipient,'effectSource',{value:{kind:p.sourceKind,sourceSide:p.sourceSide,sourceBattleId:p.sourceBattleId},configurable:true});
    run(recipient,p.body,{last:null,lastAmount:p.amount,sourceKind:p.sourceKind,event:{trig:'entrance'}});
    ctx.addLog(`🎁 ${p.label}已交付給【${ctx.self.name}】。`,'effect');
  }
}
