import type {BattleEventContext} from './types';
import {EffectTiming} from './types';
import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import {multiplyDamageReduction} from '../battle/damageReduction';
const identity=(e:any)=>String(e?.battleId||e?.id||'');
/** 槽印記附隨個體，不依賴原施加者存活或魂印名稱。 */
export function portableMarkLifecycle(ctx:BattleEventContext,event:string,data:any,act:(c:BattleEventContext,a:any,s:any)=>any):void {
  const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
  if(identity(active)!==identity(ctx.self))return;
  if(event===EffectTiming.BEFORE_DAMAGE&&data?.damageComp&&!data.damageComp.isIncoming){
    const ratio=portableSkillCapabilities(ctx.self).nonTrueOutputMultiplier;
    if(ratio!==undefined)multiplyDamageReduction(data.damageComp,ratio,false);
  }
  const isKill=event===EffectTiming.ON_KILL, isDead=event===EffectTiming.DEATH_NODE_1;
  if(isKill||isDead){
    const key=`portableSkillInheritance:${isKill?'kill':'defeated'}`,armed=ctx.getPlayerState(key);
    if(armed){
      const marks=(isKill?ctx.target:ctx.self).skills.map((s:any)=>s.isRuneActive&&s.portableSkillMark?structuredClone(s.portableSkillMark):null);
      (isKill?ctx.setOpponentState:ctx.setPlayerState)('nextElfPortableSkillMarks',{mode:armed.mode,marks});
      ctx.setPlayerState(key,undefined);
    }
  }
  if(event===EffectTiming.ON_ENTRANCE){
    const pending=ctx.getPlayerState('nextElfPortableSkillMarks');
    if(pending){
      ctx.setPlayerState('nextElfPortableSkillMarks',undefined);
      const slots=pending.marks.flatMap((m:any,i:number)=>m?[i]:[]);
      ctx.updateElf(ctx.actor,{id:ctx.self.id,portableInheritedActiveSlots:slots,...(pending.mode==='runes'?{skills:ctx.self.skills.map((s:any,i:number)=>pending.marks[i]?{...s,portableSkillMark:pending.marks[i],skillRune:pending.marks[i].symbol,isRuneActive:false}:s)}:{})} as any);
    }
    if(Object.values((ctx.self as any).portableBattleMarks||{}).some((m:any)=>m.duel)&&ctx.self.currentHp>0&&ctx.target.currentHp>0){
      ctx.updateElf(ctx.actor,{id:ctx.self.id,portableDuelOpponent:identity(ctx.target)} as any);
      ctx.updateElf(ctx.targetSide,{id:ctx.target.id,portableDuelOpponent:identity(ctx.self)} as any);
    }
  }
  if(event===EffectTiming.ON_SWITCH_OUT){
    // 同一持有者可能取得不同來源的槽印記，按每個印記記錄的剝離合約逐槽結算。
    const marks=ctx.self.skills.filter((s:any)=>s.portableSkillMark);
    if(marks.length){
      const policy=(marks[0] as any).portableSkillMark.strip;
      if(policy)act(ctx,{op:'skill_marks_strip',p:{side:'self',...policy}},{last:null,lastAmount:0,sourceKind:'soul'});
    }
  }
}
export function portableEventAllowed(ctx:BattleEventContext,event:string):boolean {
  if(event===EffectTiming.ON_KILL&&portableSkillCapabilities(ctx.target).opponentKillDisabled)return false;
  if(event===EffectTiming.NOT_KILLED&&portableSkillCapabilities(ctx.self).notKilledDisabled)return false;
  return true;
}
