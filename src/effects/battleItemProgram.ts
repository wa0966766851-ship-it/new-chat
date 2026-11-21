import type {BattleItem} from '../types';
import type {BattleEventContext} from './types';
import {sequenceIssue} from './sequenceContract';
import {prepareSequenceFrame,runEffectSequence} from './sequenceRuntime';
import {EffectTiming} from './types';
import {BATTLE_ITEMS} from '../utils/battleHelpers';
import {eventEffectNode,EFFECT_NODES} from './effectNodes';
import {syncHeldDeathFloor} from '../battle/heldItemModifiers';

/** 道具沿用正式積木契約；無效資料必須在扣庫存前拒絕。 */
export function battleItemProgramIssue(item:BattleItem):string|null {
 if(!item.useKit)return null;
 for(const name of ['normal','backlash'] as const){
  const kit=item.useKit[name];
  if(!Array.isArray(kit)||!kit.length||kit.length>30)return '道具積木需完整的正常與反噬分支';
  for(const entry of kit){
   if(entry.codeId!=='effect_sequence'||entry.node!=='on_skill_use'||entry.params?.clause?.trig!=='use')return '道具使用積木只能在使用時執行明確連鎖';
   const issue=sequenceIssue(entry.params.clause,'on_skill_use');if(issue)return issue;
  }
 }
 return null;
}
export function runBattleItemProgram(ctx:BattleEventContext,item:BattleItem,backlash:boolean):void {
 const kit=item.useKit?.[backlash?'backlash':'normal'];if(!kit)return;
 const issue=battleItemProgramIssue(item);if(issue)throw Error(issue);
 // 不沿用本回合選擇技能的條件、結果或連續使用紀錄。
 const own=Object.create(ctx);own.skill=null;own.effectNode='on_skill_use';
 const entries=[...kit].sort((a,b)=>a.order-b.order);
 own.sequenceFrame=prepareSequenceFrame(entries,'on_skill_use',own);
 for(const entry of entries)runEffectSequence(entry.params.clause,own);
}

export function heldBattleItemProgramIssue(item:BattleItem):string|null {
 const m=item.heldModifiers;
 if(m){
  const bools=['maxHpIncreaseDisabled','reductionDisabled','incomingLimitDisabled'];
  const numbers=['deathFloorRatio','incomingIncrease','incomingSpecialSkillIncrease','selectedSpecialSkillMultiplier'];
  if(Object.keys(m).some(key=>![...bools,...numbers,'recovery'].includes(key))||bools.some(key=>(m as any)[key]!==undefined&&typeof (m as any)[key]!=='boolean')||numbers.some(key=>(m as any)[key]!==undefined&&(!Number.isFinite((m as any)[key])||(m as any)[key]<0||(m as any)[key]>10)))return '持有規則含不合法的旗標或倍率';
  if(m.deathFloorRatio!==undefined&&m.deathFloorRatio>=1)return '正死亡線須低於最大體力';
  if(m.recovery&&(Object.keys(m.recovery).some(key=>!['reduction','abnormalMultiplier','opponentTrueRatio'].includes(key))||![m.recovery.reduction,m.recovery.abnormalMultiplier,m.recovery.opponentTrueRatio].every(v=>Number.isFinite(v)&&v>=0&&v<=10)))return '持有恢復規則需有限減量、異常倍率與真實傷害比例';
 }
 if(!item.heldKit)return null;
 if(!Array.isArray(item.heldKit)||!item.heldKit.length||item.heldKit.length>30)return '持有道具需有限且非空的積木';
 for(const entry of item.heldKit){
  if(entry.codeId!=='effect_sequence'||!(EFFECT_NODES[entry.node]?.event||entry.node==='passive_always'||entry.node==='any_battle_node'))return '持有道具積木需正式派發的持有者事件';
  const issue=sequenceIssue(entry.params.clause,entry.node);if(issue)return issue;
 }
 return null;
}
/** 道具定義在對戰中不變：契約檢查每個道具只做一次（原本每個事件重驗，事件量大時拖慢整場）。 */
const heldIssueCache=new WeakMap<BattleItem,string|null>();
const cachedHeldIssue=(item:BattleItem)=>{if(!heldIssueCache.has(item))heldIssueCache.set(item,heldBattleItemProgramIssue(item));return heldIssueCache.get(item)!;};
/** 由真正登場者執行一次；不從全隊魂印觀察者重播。 */
const runningHeld=new Set<string>();
export function runHeldBattleItemPrograms(ctx:BattleEventContext,event:EffectTiming,data?:any):void {
 if(!ctx.getBattleItem)return;
 if([EffectTiming.ON_ENTRANCE,EffectTiming.BEFORE_DAMAGE,EffectTiming.ON_SWITCH_OUT].includes(event))syncHeldDeathFloor(ctx,event===EffectTiming.ON_SWITCH_OUT);
 const node=eventEffectNode(event);if(!node)return;
 const field=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
 if(event===EffectTiming.ON_ENTRANCE&&(field?.battleId||field?.id)!==(ctx.self.battleId||ctx.self.id))return;
 if(event===EffectTiming.ON_DAMAGED&&(data?.targetSide!==ctx.actor||data?.receipt?.targetBattleId!==(ctx.self.battleId||ctx.self.id)))return;
 if(![EffectTiming.ON_DAMAGED,EffectTiming.BEFORE_DAMAGE].includes(event)&&(field?.battleId||field?.id)!==(ctx.self.battleId||ctx.self.id))return;
 for(const item of BATTLE_ITEMS){
  if(!item.heldKit||(ctx.getBattleItem(ctx.actor,item.id)?.left||0)<1)continue;
  const issue=cachedHeldIssue(item);if(issue)throw Error(issue);
  const token=`${ctx.actor}:${ctx.self.battleId||ctx.self.id}:${item.id}`;
  // 異常附加前可能由道具入口與魂印生命週期各派發一次：同一份事件資料只執行一次。
  if(event===EffectTiming.BEFORE_STATUS_APPLY&&data&&typeof data==='object'){const done:Set<string>=data.__heldItemsRun||(data.__heldItemsRun=new Set());if(done.has(token))continue;done.add(token);}
  if(runningHeld.has(token))continue;
  runningHeld.add(token);
  try{
  const own=Object.create(ctx);own.effectEventData=data;
  for(const key of ['skill','damageComp','priorityComp','powerComp','damageType','typedSkill','amount','receipt','reaction'])if(data?.[key]!==undefined)Object.defineProperty(own,key,{value:data[key],configurable:true});
  const nodes=[node,'any_battle_node',...(event===EffectTiming.BEFORE_DAMAGE?['passive_always']:[])];
  for(const current of nodes){
   const entries=item.heldKit.filter(e=>e.node===current).sort((a,b)=>a.order-b.order);
   if(!entries.length)continue;
   own.effectNode=current;own.sequenceFrame=prepareSequenceFrame(entries,current as any,own);
   for(const entry of entries)runEffectSequence(entry.params.clause,own);
  }
  }finally{runningHeld.delete(token);}
 }
}
