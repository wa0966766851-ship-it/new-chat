import type {BattleEventContext} from './types';
import type {RunState} from '../blocks/runtime';
import type {Stmt} from '../blocks/model';
import {checkElfDead} from '../battle/elfAlive';
type Side='p1'|'p2';
const identity=(elf:any)=>String(elf?.battleId||elf?.id||'');
export function collectionOperations(helpers:{liveElf:(ctx:BattleEventContext,side:Side)=>any;run:(ctx:BattleEventContext,body:Stmt[],state:RunState)=>void}){
  const selected=(ctx:BattleEventContext,st:RunState)=>st.selectedElf&&ctx.getFullTeam(st.selectedElf.side).find(e=>identity(e)===st.selectedElf!.id);
  return {
    select_elf:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const side=p.side==='self'?ctx.actor:ctx.targetSide,active=side==='p1'?ctx.activeP1:ctx.activeP2;
      const candidates=ctx.getFullTeam(side).filter(e=>!e.isVanished&&!e.isExtra&&(p.scope==='team'||identity(e)!==identity(active))&&(p.state==='any'||(p.state==='dead'?checkElfDead(e):!checkElfDead(e))));
      if(p.orderBy==='max_hp')candidates.sort((a,b)=>(p.direction==='asc'?1:-1)*(a.maxHp-b.maxHp));
      else if(p.direction==='desc')candidates.reverse();
      const chosen=p.all?candidates:candidates.slice(0,1);if(!chosen.length)return false;
      for(const elf of chosen)helpers.run(ctx,p.body,{last:null,lastAmount:0,sourceKind:st.sourceKind,event:st.event,selectedElf:{side,id:identity(elf)}});return true;
    },
    raise_max_hp:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const elf=selected(ctx,st);st.lastAmount=0;if(!elf)return false;
      const value=Math.floor(helpers.liveElf(ctx,p.source==='self'?ctx.actor:ctx.targetSide).maxHp*p.ratio),before=elf.maxHp;
      if(value<=before)return false;
      ctx.updateAnyElf(st.selectedElf!.side,identity(elf),{maxHp:value,calculatedStats:{...elf.calculatedStats,hp:value}});
      st.lastAmount=Math.max(0,(selected(ctx,st)?.maxHp||before)-before);return st.lastAmount>0;
    },
    heal_selected_then:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const elf=selected(ctx,st);if(!elf)return false;
      const amount=st.lastAmount;let settled=false;
      const next=()=>{if(settled)return;settled=true;helpers.run(ctx,p.body,{...st,lastAmount:amount,conditionSnapshots:undefined});};
      if(checkElfDead(elf)||amount<=0){next();return false;}
      if(!ctx.applyHealToElf)return false;
      ctx.applyHealToElf(st.selectedElf!.side,identity(elf),Math.floor(amount*p.ratio),{onSettled:r=>{if(r.operation==='heal'&&r.targetBattleId===identity(elf))next();}});return true;
    },
    stat_points:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const elf=selected(ctx,st);if(!elf?.calculatedStats||p.stats.some((key:string)=>!Number.isFinite(elf.calculatedStats[key])))return false;
      const amount=Math.min(p.cap,Math.floor(st.lastAmount*p.ratio));if(amount<=0)return false;
      const stats={...elf.calculatedStats};for(const key of p.stats)stats[key]=Math.max(p.floor,stats[key]+(p.direction==='decrease'?-amount:amount));
      ctx.updateAnyElf(st.selectedElf!.side,identity(elf),{calculatedStats:stats});return true;
    },
    vanish_selected:(ctx:BattleEventContext,_p:any,st:RunState)=>{const elf=selected(ctx,st);if(!elf)return false;ctx.vanishElf(st.selectedElf!.side,elf);return true;},
  };
}
