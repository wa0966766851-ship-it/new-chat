import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import type {Timer} from '../../battle/timers';

export const REMOVED_EFFECT_FIELDS:Record<string,readonly string[]>={removed_effects_capture:['key'],removed_effects_arm:['key'],removed_effects_restore:['key']};
export function removedEffectIssue(op:string,p:any,trig:string):string|null{
  if(typeof p.key!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(p.key))return '效果恢復需明確有限快照鍵';
  if(op==='removed_effects_capture'&&!['stat_boost_cleared','turn_effects_cleared'].includes(trig))return '移除快照僅可讀實際消除事件';
  if(op==='removed_effects_arm'&&trig!=='before_skill')return '啟用本回合恢復需技能前固有入口';
  if(op==='removed_effects_restore'&&trig!=='round_end')return '效果恢復需回合末入口';
  return null;
}
type Snapshot={owner:string;round:number;armed:boolean;stages:Record<string,number>;timers:Timer[];registry:Record<string,any>};
const identity=(ctx:BattleEventContext)=>String(ctx.self.battleId||ctx.self.id);
const keyOf=(p:any)=>`removedEffectSnapshot:${p.key}`;
function read(ctx:BattleEventContext,p:any):Snapshot{
  const old=ctx.getPlayerState(keyOf(p));
  return old?.owner===identity(ctx)&&old.round===ctx.roundNumber?old:{owner:identity(ctx),round:ctx.roundNumber,armed:false,stages:{},timers:[],registry:{}};
}
export const removedEffectOperations={
  removed_effects_capture:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const data=(ctx as any).effectEventData||st.event?.data;
    if(!data?.sourceSide||data.sourceSide===ctx.actor)return false;
    const snapshot=read(ctx,p);
    const stages={...snapshot.stages};
    for(const [key,n] of Object.entries(data.removedStages||{}))if(['atk','def','spatk','spdef','speed','accuracy'].includes(key)&&typeof n==='number'&&n>0)stages[key]=Math.max(stages[key]||0,n);
    const timers=new Map(snapshot.timers.map(t=>[t.id,t]));
    for(const t of data.removed||[])if(t.kind==='turn_effect'&&t.remaining>0&&(!t.ownerBattleId||String(t.ownerBattleId)===identity(ctx))){
      if((timers.get(t.id)?.remaining||0)<t.remaining)timers.set(t.id,structuredClone(t));
    }
    ctx.setPlayerState(keyOf(p),{...snapshot,stages,timers:[...timers.values()],registry:{...snapshot.registry,...structuredClone(data.removedRegistry||{})}});
    return Object.keys(stages).length>0||timers.size>0;
  },
  removed_effects_arm:(ctx:BattleEventContext,p:any)=>{ctx.setPlayerState(keyOf(p),{...read(ctx,p),armed:true});return true;},
  removed_effects_restore:(ctx:BattleEventContext,p:any)=>{
    const snapshot=read(ctx,p);ctx.setPlayerState(keyOf(p),undefined);
    if(!snapshot.armed)return false;
    const live=ctx.getFullTeam(ctx.actor).find(e=>String(e.battleId||e.id)===identity(ctx));
    if(!live||live.currentHp<=0)return false;
    const stages={...live.statStages};
    for(const [key,n] of Object.entries(snapshot.stages))stages[key]=Math.max(stages[key]||0,Math.min(6,n));
    if(Object.keys(snapshot.stages).length)ctx.updateElf(ctx.actor,{statStages:stages});
    const existing=ctx.actor==='p1'?ctx.p1Timers:ctx.p2Timers;
    for(const timer of snapshot.timers){
      if(existing.some(t=>t.id===timer.id&&(!t.ownerBattleId||String(t.ownerBattleId)===identity(ctx))&&t.remaining>=timer.remaining))continue;
      ctx.addTimerTo(ctx.actor,{...structuredClone(timer),stackRule:'refresh'},false);
      for(const key of timer.payload?.mirrorRegistryKeys||[])if(Object.hasOwn(snapshot.registry,key))ctx.setPlayerState(key,structuredClone(snapshot.registry[key]));
    }
    return Object.keys(snapshot.stages).length>0||snapshot.timers.length>0;
  },
};
