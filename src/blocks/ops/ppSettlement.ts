import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {changePp,identity} from '../../effects/newElfOperations';
import {getMaxPp} from '../../utils/battleHelpers';
import {StatusRegistry} from '../../effects/statusRegistry';

/** PP的實際槽數、欠額與逐次結算；不以原文或精靈名稱分派。 */
export const PP_SETTLEMENT_FIELDS:Record<string,readonly string[]>={
 pp_restore_slots:['side'],
 status_from_amount:['side','status'],
 pp_deficit_repeat:['side','body'],
 pp_sum_cap:['factor'],
 copy_status_durations:['side'],
 power_by_iv:['iv','maximum'],
 priority_disabled_turns:['side','turns','next'],
 sure_hit_turns:['turns','next'],
 percent_survivor_heal:['ratio'],
 settlement_flow:['body'],
};
export function ppSettlementIssue(op:string,p:any,trig:string,nested:(b:any[],t:string)=>string|null):string|null{
 if(['pp_restore_slots','pp_deficit_repeat'].includes(op)&&!['self','opp','both'].includes(p.side))return 'PP統計需明確持有者';
 if(op==='pp_deficit_repeat'){
  if(!Array.isArray(p.body)||!p.body.length)return '逐點PP流程不能為空';
  return nested(p.body,trig);
 }
 if(op==='settlement_flow'){
  if(!Array.isArray(p.body)||!p.body.length)return '獨立成敗流程不能為空';
  return nested(p.body,trig);
 }
 if(op==='status_from_amount'&&(!['self','opp'].includes(p.side)||!StatusRegistry[p.status]))return '數值期限異常需目標與正式異常';
 if(op==='pp_sum_cap'&&(trig!=='incoming_nontrue'||!Number.isFinite(p.factor)||p.factor<=0))return 'PP總和上限需非真實受傷節點與正倍率';
 if(op==='copy_status_durations'&&!['self','opp'].includes(p.side))return '異常期限複製需目標';
 if(op==='power_by_iv'&&(trig!=='outgoing_power'||!['hp','atk','def','spatk','spdef','speed'].includes(p.iv)||!Number.isInteger(p.maximum)||p.maximum<=0))return '天賦威力需公式前、六項個體值與31天賦時的正威力';
 if(['priority_disabled_turns','sure_hit_turns'].includes(op)&&(!Number.isInteger(p.turns)||p.turns<=0||typeof p.next!=='boolean'||op==='priority_disabled_turns'&&!['self','opp'].includes(p.side)))return '期間查詢需正整數期限、明確起算與目標';
 if(op==='percent_survivor_heal'&&(!Number.isFinite(p.ratio)||p.ratio<=0))return '未擊敗後等量恢復需明確百分比';
 return null;
}
export function ppSettlementOperations(h:{liveElf:Function;runStmts:Function;ops:()=>any;addTimer:Function}){
 const sides=(ctx:BattleEventContext,s:string)=>s==='both'?[ctx.actor,ctx.targetSide]:[s==='self'?ctx.actor:ctx.targetSide];
 return {
  settlement_flow:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const frame={...st,last:null};h.runStmts(ctx,p.body,frame);st.lastAmount=frame.lastAmount;return frame.last===true;
  },
  pp_restore_slots:(ctx:BattleEventContext,p:any,st:RunState)=>{
   let count=0;
   for(const side of sides(ctx,p.side)){
    const e=h.liveElf(ctx,side),before=e.skills.map((s:any)=>s.pp);
    changePp(ctx,side,e,s=>getMaxPp(s,e),true,'restore');
    const after=ctx.getFullTeam(side).find(x=>identity(x)===identity(e))||e;
    count+=before.filter((pp:number,i:number)=>after.skills[i].pp>pp).length;
   }
   st.lastAmount=count;return count>0;
  },
  status_from_amount:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const turns=Math.floor(st.lastAmount);
   if(!Number.isSafeInteger(turns)||turns<=0)return false;
   return h.ops().status(ctx,{side:p.side,status:p.status,turns,chance:100},st);
  },
  pp_deficit_repeat:(ctx:BattleEventContext,p:any,st:RunState)=>{
   // 一次取快照，後續回血、死亡或PP事件不改變原本的執行次數。
   const n=sides(ctx,p.side).reduce((sum,s)=>{const e=h.liveElf(ctx,s);return sum+e.skills.reduce((v:number,k:any)=>v+Math.max(0,getMaxPp(k,e)-k.pp),0);},0);
   if(!Number.isSafeInteger(n)||n<0)throw Error('PP欠額不是有限整數');
   for(let i=0;i<n;i++)h.runStmts(ctx,p.body,{...st,last:null,lastAmount:0});
   st.lastAmount=n;return n>0;
  },
  pp_sum_cap:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const comp=st.event?.data?.damageComp||st.event?.data;
   if(!comp?.isIncoming||!['fixed','percent'].includes(comp.damageCategory))return false;
   const sum=h.liveElf(ctx,ctx.actor).skills.reduce((n:number,s:any)=>n+Math.max(0,s.pp),0);
   comp.limit=Math.min(comp.limit??Infinity,Math.floor(sum*p.factor));return true;
  },
  copy_status_durations:(ctx:BattleEventContext,p:any)=>{
   const list=Object.entries(ctx.getStatuses(h.liveElf(ctx,ctx.actor))||{}),side=p.side==='self'?ctx.actor:ctx.targetSide;
   let success=false;
   for(const [name,t] of list)if(Number(t)>0)success=ctx.applyStatusWithImmunityCheck(side,name,Number(t)).success||success;
   return success;
  },
  power_by_iv:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const iv=(ctx.self.ivs as any)?.[p.iv]??31;
   const power=Math.floor(p.maximum*Math.max(0,Math.min(31,iv))/31);
   return h.ops().power_mod(ctx,{flat:power},st);
  },
  priority_disabled_turns:(ctx:BattleEventContext,p:any,st:RunState)=>{
   h.addTimer(ctx,p.side==='self'?ctx.actor:ctx.targetSide,'先制效果失效',p.turns,'turns',{disablePriority:true},p.next,st.sourceKind==='skill'?'turn_effect':'round_counter');return true;
  },
  sure_hit_turns:(ctx:BattleEventContext,p:any)=>{
   h.addTimer(ctx,ctx.actor,'攻擊必定命中',p.turns,'turns',{sureHit:true,kind:'攻擊'},p.next);return true;
  },
  percent_survivor_heal:(ctx:BattleEventContext,p:any)=>{
   const self=h.liveElf(ctx,ctx.actor),opp=h.liveElf(ctx,ctx.targetSide),selfId=identity(self),oppId=identity(opp);
   ctx.applyPinkDamage(ctx.targetSide,Math.floor(opp.maxHp*p.ratio),'附加百分比傷害',undefined,undefined,'percent',{onSettled:r=>{
    if(r.targetBattleId!==oppId)return;
    const target=ctx.getFullTeam(ctx.targetSide).find(e=>identity(e)===oppId);
    const owner=ctx.getFullTeam(ctx.actor).find(e=>identity(e)===selfId);
    if(!target||target.currentHp<=0||target.isVanished||!owner||owner.currentHp<=0||owner.isVanished)return;
    if(ctx.applyHealToElf)ctx.applyHealToElf(ctx.actor,selfId,r.settledAmount);
    else ctx.applyHeal(ctx.actor,r.settledAmount);
   }});return true;
  },
 };
}
