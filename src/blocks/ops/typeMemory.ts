import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {combineSettlementCallbacks} from '../../battle/settlementReceipt';
import {identity} from '../../effects/newElfOperations';
import { battleTypeKey, sameBattleType } from '../../utils/typeQuery';
import {isKnownBattleType} from '../../effects/attackTypeView';

/** 屬性交換的紀錄屬於戰鬥個體，不改物種定義、皮膚或存檔。 */
export const TYPE_MEMORY_FIELDS:Record<string,readonly string[]>={
 exchange_types:['record'],history_attack_boost:['perType'],history_percent_repeat:['ratio'],
 category_damage_reaction:['category','multiplier','leaveHp','body'],
 typed_skill_constraint:['turns','forceStab','nonMatchingInvalid','zeroAfterUse'],
 zero_pp_category_seal:['turns'],
 drain_growth:['key','baseRatio','increment','maximum'],
 attack_properties_uses:['side','uses','sureHit','ignoreBlocking','type'],
 align_status_duration:['status'],status_duration_link:['status'],
 status_transform_until_attack:['name'],
 damage_to_side:['side','amount','type','holder'],shield_bypass_followup:[],
 attack_damage_percent:['ratio'],
 history_kill_entry_damage:['amount'],history_entry_damage_if_recorded:['amount'],
};
export function typeMemoryIssue(op:string,p:any,trig:string,nested:(b:any[],t:string)=>string|null):string|null{
 if(op==='damage_to_side'&&p.holder!==undefined&&(typeof p.holder!=='boolean'||p.side!=='self'))return '持有者傷害需自身與布林值';
 if(op==='damage_to_side'&&(!['self','opp','both'].includes(p.side)||!(p.amount>0)||!['固定','百分比','真實'].includes(p.type)))return '指定側傷害需目標、正點數及傷害類型';
 if(op==='attack_damage_percent'&&(trig!=='after_hit'||!(p.ratio>0)))return '攻擊傷害等量百分比需命中後與正倍率';
 if(op==='exchange_types'&&typeof p.record!=='boolean')return '屬性交換需明確是否記錄';
 if(['history_attack_boost','history_percent_repeat'].includes(op)&&!(p.perType>0||p.ratio>0))return '屬性紀錄計數需正倍率';
 if(op==='history_attack_boost'&&trig!=='outgoing_attack')return '紀錄增傷需攻擊傷害公式';
 if(op==='history_percent_repeat'&&!['self_after_attack','self_after_use','after_hit'].includes(trig))return '逐紀錄百分比需使用後';
 if(op==='category_damage_reaction'){
  if(trig!=='incoming_nontrue'||!['fixed','percent'].includes(p.category)||!(p.multiplier>0)||p.leaveHp!==undefined&&(!Number.isInteger(p.leaveHp)||p.leaveHp<0))return '分類受傷反應需固定／百分比公式及正倍率';
  return nested(p.body,'damaged_nontrue');
 }
 if(['typed_skill_constraint','zero_pp_category_seal'].includes(op)&&(!Number.isInteger(p.turns)||p.turns<1))return '技能限制需正整數期限';
 if(op==='typed_skill_constraint'&&['forceStab','nonMatchingInvalid','zeroAfterUse'].some(k=>typeof p[k]!=='boolean'))return '屬性限制需明確開關';
 if(op==='drain_growth'&&(!p.key||!(p.baseRatio>0)||!(p.increment>0)||!(p.maximum>=p.baseRatio)))return '成長吸取需鍵、初值、增量與上限';
 if(op==='attack_properties_uses'&&(!['self','opp'].includes(p.side)||!Number.isInteger(p.uses)||p.uses<1||typeof p.sureHit!=='boolean'||typeof p.ignoreBlocking!=='boolean'||p.type!==undefined&&!isKnownBattleType(p.type)))return '攻擊次數屬性需目標、次數及明確能力';
 if(['align_status_duration','status_duration_link'].includes(op)&&typeof p.status!=='string')return '異常期限對齊需來源異常';
 if(op==='status_transform_until_attack'&&p.name!=='屬性反轉')return '尚未註冊的替換技能';
 if(['history_kill_entry_damage','history_entry_damage_if_recorded'].includes(op)&&(!Number.isInteger(p.amount)||p.amount<1))return '下次擊殺登場傷害需正整數';
 return null;
}
export function typeMemoryOperations(h:{liveElf:Function;ops:()=>any;runStmts:Function;addTimer:Function}){
 const history=(ctx:BattleEventContext):string[]=>(h.liveElf(ctx,ctx.actor) as any).typeHistory||[];
 return {
  status_duration_link:(ctx:BattleEventContext,p:any)=>{ctx.updateElf(ctx.actor,{statusDurationLink:p.status} as any);return true;},
  damage_to_side:(ctx:BattleEventContext,p:any)=>{
   if(p.holder){ctx.applyDamageToElf?.(ctx.actor,identity(ctx.self),p.amount,p.type==='真實'?'true':p.type==='固定'?'fixed':'percent');return !!ctx.applyDamageToElf;}
   for(const side of p.side==='both'?[ctx.actor,ctx.targetSide]:[p.side==='self'?ctx.actor:ctx.targetSide]){
    if(p.type==='真實')ctx.applyTrueDamage(side,p.amount);else ctx.applyPinkDamage(side,p.amount,undefined,undefined,undefined,p.type==='固定'?'fixed':'percent');
   }return true;
  },
  shield_bypass_followup:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const n=h.liveElf(ctx,ctx.targetSide).shield||0;if(!(n>0))return false;
   h.ops().clear_turn(ctx,{side:'both'},st);
   for(const side of [ctx.actor,ctx.targetSide])ctx.applyPinkDamage(side,n,undefined,undefined,undefined,'fixed');return true;
  },
  attack_damage_percent:(ctx:BattleEventContext,p:any)=>{const n=Math.floor(Math.max(0,ctx.mainSkillSettledAmount??ctx.mainSkillHpReduced??0)*p.ratio);if(!n)return false;ctx.applyPinkDamage(ctx.targetSide,n,undefined,undefined,undefined,'percent');return true;},
  exchange_types:(ctx:BattleEventContext,p:any)=>{
   const self=h.liveElf(ctx,ctx.actor),opp=h.liveElf(ctx,ctx.targetSide);
   if(p.record)ctx.updateElf(ctx.actor,{typeHistory:[...new Set([...history(ctx),self.type].map(battleTypeKey))]} as any);
   if(sameBattleType(self.type, opp.type))return false;
   for(const [side,elf,type] of [[ctx.actor,self,opp.type],[ctx.targetSide,opp,self.type]] as const)
    ctx.updateElf(side,{type,originalType:elf.originalType||elf.type,typeChangedUntilSwitch:true});
   return true;
  },
  history_attack_boost:(ctx:BattleEventContext,p:any,st:RunState)=>h.ops().dmg_mod(ctx,{dir:'out',kind:'攻擊',boost:history(ctx).length*p.perType},st),
  history_percent_repeat:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const n=history(ctx).length;
   for(let i=0;i<n;i++)h.ops().dmg(ctx,{of:'self',base:'最大體力',ratio:p.ratio,type:'百分比'},st);
   return n>0;
  },
  category_damage_reaction:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const comp=st.event?.data?.damageComp||st.event?.data;
   if(!comp?.isIncoming||comp.damageCategory!==p.category)return false;
   comp.base*=p.multiplier;
   if(p.leaveHp!==undefined)comp.limit=Math.min(comp.limit??Infinity,Math.max(0,h.liveElf(ctx,ctx.actor).currentHp-p.leaveHp));
   const owner=identity(h.liveElf(ctx,ctx.actor));
   comp.afterDamage=combineSettlementCallbacks(comp.afterDamage,receipt=>{
    if(receipt.targetBattleId!==owner)return;
    const frame={...st,last:null,lastAmount:receipt.settledAmount,event:{trig:'damaged_nontrue',data:{receipt}}};
    h.runStmts(ctx,p.body,frame);
   });return true;
  },
  typed_skill_constraint:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const kind=st.sourceKind==='skill'?'turn_effect':'round_counter';
   if(p.forceStab)h.addTimer(ctx,ctx.actor,'所有技能本系加成',p.turns,'turns',{forceStab:true},false,kind,true);
   if(p.nonMatchingInvalid)h.addTimer(ctx,ctx.targetSide,'非同系技能無效',p.turns,'turns',{invalid:'all',notMatchingType:true,ppZeroAfterUse:p.zeroAfterUse},false,kind,true);
   return true;
  },
  zero_pp_category_seal:(ctx:BattleEventContext,p:any)=>{
   h.addTimer(ctx,ctx.targetSide,'零PP類型附加失效',p.turns,'turns',{addInvalid:'all',zeroPpCategory:true},false,undefined,true);return true;
  },
  drain_growth:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const n=Number(ctx.getPlayerState(p.key)||0),ratio=Math.min(p.maximum,p.baseRatio+n*p.increment);
   ctx.setPlayerState(p.key,n+1);return h.ops().drain(ctx,{ratio},st);
  },
  attack_properties_uses:(ctx:BattleEventContext,p:any)=>{
   h.addTimer(ctx,p.side==='self'?ctx.actor:ctx.targetSide,'後續攻擊性質',p.uses,'uses',{attackProperty:{...p},attackOnly:true,startAfterActionId:ctx.actionId});return true;
  },
  align_status_duration:(ctx:BattleEventContext,p:any,st:RunState)=>{
   const data=st.event?.data?.effectEventData||st.event?.data;
   const n=ctx.getStatuses(h.liveElf(ctx,ctx.actor))[p.status];
   if(!data?.status||data.status===p.status||!(n>0))return false;
   data.duration=n;return true;
  },
  status_transform_until_attack:(ctx:BattleEventContext,p:any)=>{
   h.addTimer(ctx,ctx.targetSide,'屬性轉換至攻擊無效',1,'uses',{invalid:'攻擊',statusSkillReplacement:p.name});return true;
  },
  history_entry_damage_if_recorded:(ctx:BattleEventContext,p:any)=>{
   if(!history(ctx).some(type => sameBattleType(type, h.liveElf(ctx,ctx.targetSide).type)))return false;
   ctx.setOpponentState('nextElfBothFixed',{amount:p.amount,sourceSide:ctx.actor,sourceBattleId:identity(ctx.self)});return true;
  },
  history_kill_entry_damage:(ctx:BattleEventContext,p:any,st:RunState)=>{
   return h.ops().watch(ctx,{key:'historyTypeNextKill',trig:'kill',body:[{acts:[{op:'history_entry_damage_if_recorded',p:{amount:p.amount}}]}]},st);
  },
 };
}
