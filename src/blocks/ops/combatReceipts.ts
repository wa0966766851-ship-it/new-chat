import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {statusDurationSum} from '../../effects/statusCollection';
import {multiplyDamageReduction} from '../../battle/damageReduction';
import {damageReductionReceipt} from '../../battle/damageReductionReceipt';
import {combineSettlementCallbacks} from '../../battle/settlementReceipt';
import {queueHpDrain} from '../../battle/hpDrain';
import {uses,changePp,identity} from '../../effects/newElfOperations';
import {getMaxPp} from '../../utils/battleHelpers';
import {isNonTrueDamageType} from '../../battle/damageSemantics';

export const COMBAT_RECEIPT_FIELDS:Record<string,readonly string[]>={
 damage_extrema_record:['key'],
 status_duration_damage:['remaining','increase'],status_duration_damage_boost:['increase'],prevented_damage_drain:['ratio'],
 damage_values_record:['key'],damage_values_drain:['key','threshold','maxHpThreshold','nextPower'],
 pp_attack_absorb_to:['remaining'],zero_pp_max_zero:[],pp_reduce_stop:['amount'],
 minimum_matchup:['value'],self_down_as_up:[],next_selection_no_attack:[],transfer_next_departure:[],next_enemy_entry:['statuses','duration','drainRatio'],seal_by_status_turns:['status','side','skillInvalid'],maxhp_flat_reduce:['amount'],
};
export function combatReceiptIssue(op:string,p:any,trig:string):string|null{
 if(op==='damage_extrema_record'&&(typeof p.key!=='string'||!p.key||p.key.length>200||trig!=='team_opponent_damage_settled'))return '對手傷害極值紀錄需正式對手傷害結算觀察事件與有限識別碼';
 if(op==='status_duration_damage'&&(trig!=='incoming_nontrue'||!(p.remaining>0&&p.remaining<1)||!Number.isFinite(p.increase)||p.increase<0))return '異常回合增減傷需非真實受傷公式、每次傷害保留比例與非負增傷比例';
 if(op==='status_duration_damage_boost'&&(trig!=='outgoing'||!Number.isFinite(p.increase)||p.increase<=0))return '異常回合造成增傷需造成傷害公式與正比例';
 if(op==='prevented_damage_drain'&&(trig!=='incoming_nontrue'||!(p.ratio>0)))return '減免量汲取需非真實受傷公式與正比例';
 if(['damage_values_record','damage_values_drain'].includes(op)&&(!p.key||typeof p.key!=='string'||p.key.length>200))return '逐次傷害紀錄需有限識別碼';
 if(op==='damage_values_record'&&trig!=='opp_damage_settled')return '傷害紀錄需正式受方結算事件';
 if(op==='damage_values_drain'&&(!(p.threshold>0)||!(p.maxHpThreshold>0)||!(p.nextPower>1)||trig!=='self_after_use'))return '逐次汲取需使用後與固定／最大體力雙門檻';
 if(op==='pp_attack_absorb_to'&&(!Number.isInteger(p.remaining)||p.remaining<0))return '攻擊PP吸取需非負保留點數';
 if(op==='pp_reduce_stop'&&(!Number.isInteger(p.amount)||p.amount<1))return '削PP停止行動需正整數';
 if(op==='minimum_matchup'&&(!(p.value>0)||trig!=='before_skill'))return '最低克制需使用前與正倍率';
 if(op==='self_down_as_up'&&trig!=='before_skill')return '自身下降視為提升需公式前';
 if(op==='next_enemy_entry'&&(!Array.isArray(p.statuses)||!p.statuses.length||!Number.isInteger(p.duration)||p.duration<1||!(p.drainRatio>0&&p.drainRatio<=1)))return '後續敵方登場需異常、期限與吸取比例';
 if(op==='maxhp_flat_reduce'&&(!(p.amount>0)||!Number.isFinite(p.amount)))return '體力上限扣除需正數';
 if(op==='seal_by_status_turns'&&(typeof p.status!=='string'||!p.status||p.side!==undefined&&!['self','opp','both'].includes(p.side)||p.skillInvalid!==undefined&&typeof p.skillInvalid!=='boolean'))return '異常期限封鎖需狀態、有效目標及明確技能／附加失效規則';
 return null;
}
export function combatReceiptOperations(h:{liveElf:Function;ops:()=>any;addTimer:Function}){
 return {
  damage_extrema_record:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const data=st.event?.data?.effectEventData||st.event?.data;
   if(data?.sourceSide!==ctx.targetSide||data.sourceBattleId!==identity(h.liveElf(ctx,ctx.targetSide))||!isNonTrueDamageType(data.damageType))return false;
   const amount=data.receipt?.settledAmount??data.amount;if(!(amount>0))return false;
   const source=data.sourceBattleId,all=ctx.getPlayerState(p.key)||{},previous=all[source];
   ctx.setPlayerState(p.key,{...all,[source]:{min:Math.min(previous?.min??Infinity,amount),max:Math.max(previous?.max??0,amount)}});return true;
  },
  next_selection_no_attack:(ctx:BattleEventContext)=>{uses(ctx,ctx.targetSide,'next_selection_no_attack',1,{blockAttack:true,consumeOnSelection:true},false,'下次選擇禁止攻擊技能');return true;},
  transfer_next_departure:(ctx:BattleEventContext)=>{ctx.updateElf(ctx.targetSide,{transferOnDeparture:{sourceSide:ctx.actor,sourceBattleId:identity(ctx.self)}} as any);return true;},
  next_enemy_entry:(ctx:BattleEventContext,p:any)=>{ctx.setOpponentState('nextElfEntryProgram',{...p,sourceSide:ctx.actor,sourceBattleId:identity(ctx.self)});return true;},
  seal_by_status_turns:(ctx:BattleEventContext,p:any,st:RunState)=>{const sides=p.side===undefined||p.side==='both'?[ctx.actor,ctx.targetSide]:[p.side==='self'?ctx.actor:ctx.targetSide];const n=sides.reduce((n,s)=>n+Number(ctx.getStatuses(h.liveElf(ctx,s))[p.status]||0),0);return n>0&&h.ops()[p.skillInvalid?'invalid_turns':'add_invalid_turns'](ctx,{kind:'all',turns:n,next:false},st);},
  maxhp_flat_reduce:(ctx:BattleEventContext,p:any)=>{const e=h.liveElf(ctx,ctx.targetSide),maxHp=Math.max(1,e.maxHp-p.amount);ctx.updateElf(ctx.targetSide,{maxHp,currentHp:Math.min(e.currentHp,maxHp),calculatedStats:{...e.calculatedStats,hp:maxHp}});return maxHp<e.maxHp;},
  status_duration_damage:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const comp=st.event?.data?.damageComp||(ctx as any).damageComp;
   if(!comp?.isIncoming||!isNonTrueDamageType(comp.damageCategory))return false;
   const n=statusDurationSum(ctx,[h.liveElf(ctx,ctx.actor),h.liveElf(ctx,ctx.targetSide)]);
   // 使用者裁定：沿用減半次數模型，底數改為0.6；翻倍的只有增傷部分。
   multiplyDamageReduction(comp,Math.pow(p.remaining,1+n));
   comp.increasePercent+=p.increase*Math.pow(2,n);return true;
  },
  status_duration_damage_boost:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const comp=st.event?.data?.damageComp||(ctx as any).damageComp;
   if(!comp||comp.isIncoming!==false||!isNonTrueDamageType(comp.damageCategory))return false;
   const n=statusDurationSum(ctx,[h.liveElf(ctx,ctx.actor),h.liveElf(ctx,ctx.targetSide)]);
   comp.increasePercent+=p.increase*Math.pow(2,n);return true;
  },
  prevented_damage_drain:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const comp=st.event?.data?.damageComp||(ctx as any).damageComp;if(!comp?.isIncoming)return false;
   const owner=identity(ctx.self);let before=0;
   (comp.beforeFinalDamage||=[]).push(()=>{before=damageReductionReceipt(comp).beforeReduction;});
   comp.afterDamage=combineSettlementCallbacks(comp.afterDamage,r=>{
    if(r.targetBattleId!==owner)return;
    // 盾罩與抵擋算減免；普通殘血截斷不算。保命則採實際扣血量。
    const reachedHp=r.resistedFatal?r.hpLost:Math.max(0,r.settledAmount-r.shieldAbsorbed-r.barrierAbsorbed);
    const prevented=Math.max(0,before-reachedHp);
    if(prevented>0)queueHpDrain(ctx,ctx.targetSide,Math.floor(prevented*p.ratio),'true','減免傷害汲取');
   });return true;
  },
  damage_values_record:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const data=st.event?.data?.effectEventData||st.event?.data;
   if(data?.sourceSide!==ctx.actor||String(data.sourceBattleId)!==String(identity(ctx.self))||!isNonTrueDamageType(data.damageType))return false;
   const n=data.receipt?.settledAmount??data.amount;if(!(n>0))return false;
   const previous=ctx.getPlayerState(p.key);
   const values=previous?.actionId===ctx.actionId?previous.values:[];
   ctx.setPlayerState(p.key,{actionId:ctx.actionId,values:[...values,n]});return true;
  },
  damage_values_drain:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const saved=ctx.getPlayerState(p.key);ctx.setPlayerState(p.key,undefined);
   if(saved?.actionId!==ctx.actionId)return false;
   const values=[...saved.values];let any=false;
   for(const value of values){
    const maxHp=h.liveElf(ctx,ctx.targetSide).maxHp;
    const actual=queueHpDrain(ctx,ctx.targetSide,value,'true');any=actual>0||any;
    if(actual<p.threshold||actual<maxHp*p.maxHpThreshold)h.addTimer(ctx,ctx.actor,'下次攻擊威力',1,'uses',{nextPowerRatio:p.nextPower,startAfterActionId:ctx.actionId});
   }return any;
  },
  pp_attack_absorb_to:(ctx:BattleEventContext,p:any)=>{
   const opp=h.liveElf(ctx,ctx.targetSide),old=opp.skills.map((s:any)=>s.pp);
   changePp(ctx,ctx.targetSide,opp,s=>s.category==='屬性'?s.pp:Math.min(s.pp,p.remaining),false,'drain');
   const after=h.liveElf(ctx,ctx.targetSide),removed=old.map((n:number,i:number)=>Math.max(0,n-after.skills[i].pp));
   const self=h.liveElf(ctx,ctx.actor);
   changePp(ctx,ctx.actor,self,(s,i)=>Math.min(getMaxPp(s,self),s.pp+(removed[i]||0)),true,'restore');
   return removed.some((n:number)=>n>0);
  },
  zero_pp_max_zero:(ctx:BattleEventContext)=>{
   const opp=h.liveElf(ctx,ctx.targetSide);let changed=false;
   const skills=opp.skills.map((s:any)=>{
    if(s.pp!==0||getMaxPp(s,opp)===0)return s;changed=true;
    return {...s,maxPp:0,ppMaxOffset:(s.ppMaxOffset||0)-getMaxPp({...s,maxPp:0},opp),pp:0,currentPp:0};
   });if(changed)ctx.updateElf(ctx.targetSide,{skills});return changed;
  },
  pp_reduce_stop:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const e=h.liveElf(ctx,ctx.targetSide);
   const report=changePp(ctx,ctx.targetSide,e,s=>Math.max(0,s.pp-p.amount),false,'drain');
   if(report.emptied.length)h.ops().stop_action(ctx,{side:'opp'},st);return report.removed>0;
  },
  minimum_matchup:(ctx:BattleEventContext,p:any)=>{ctx.setPlayerState('minimumTypeMultiplierThisAction',p.value);return true;},
  self_down_as_up:(ctx:BattleEventContext)=>{ctx.setPlayerState('selfDownAsUpThisAction',true);return true;},
 };
}
