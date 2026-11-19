import { BattleEventContext, EffectTiming } from './types';
import { activeConstraints } from '../battle/timedConstraints';
import { isAliveBySurvivalRule } from '../battle/survivalRules';
const finiteHp=(hp: number)=>Number.isFinite(hp)?Math.max(0,hp):0;
export function handleDestinyInterceptor(ctx: BattleEventContext, event: EffectTiming, data?: any) {
  if(ctx.specialMode!=='destiny') return;
  const timers=ctx.actor==='p1'?ctx.p1Timers:ctx.p2Timers;
  if(event===EffectTiming.MODIFY_PRIORITY) {
    for(const p of activeConstraints(timers,ctx.self)) data.priorityComp.bonus+=p.priorityDelta??0;
    return;
  }
  if(event===EffectTiming.ON_ENTRANCE) {
    ctx.setPlayerState('modeInterceptorDeathApplied',false);
    const pending=ctx.getPlayerState('nextElfModeBarrier');
    if(pending) {
      ctx.updateElf(ctx.actor,{barrier:(ctx.self.barrier??0)+pending});
      ctx.addTimerTo(ctx.actor,{id:'mode_status_immunity',name:'全異常免疫',kind:'round_counter',source:'mechanic',remaining:2,tickAt:'round_end',lateMoverPending:ctx.currentPhase?.startsWith('forced_switch'),payload:{immuneStatus:true}},false);
      ctx.setPlayerState('nextElfModeBarrier',0);
    }
  }
  const effect=ctx.self.interceptorEffect;
  if(ctx.self.destinyRank!=='C'||!effect) return;
  const timed=(side:'p1'|'p2',id:string,turns:number,payload:any,next=false)=>ctx.addTimerTo(side,{id,name:effect.name,kind:'round_counter',source:'mechanic',remaining:turns,tickAt:'round_end',pendingActivation:next,payload},false);
  if(event===EffectTiming.ON_ENTRANCE&&effect.type==='on_enter') {
    if(ctx.getPlayerState('modeInterceptorEntranceActive'))return;
    ctx.setPlayerState('modeInterceptorEntranceActive',true);
    if(effect.id==='block_attack')timed(ctx.targetSide,'mode_attack_block',1,{blockAttack:true},true);
    if(effect.id==='pp_chain') {
      if(ctx.getPlayerState('modePpChainApplied'))return;
      ctx.setPlayerState('modePpChainApplied',true);
      ctx.updateElf(ctx.targetSide,{skills:ctx.target.skills.map(s=>({...s,maxPp:s.maxPp??s.pp,ppMaxOffset:(s.ppMaxOffset??0)-2,pp:Math.max(0,s.pp-2)}))});
    }
    ctx.addLog(effect.triggerLog,'effect');
  }
  if(event!==EffectTiming.DEATH_NODE_1||effect.type!=='on_death'||ctx.getPlayerState('modeInterceptorDeathApplied'))return;
  ctx.setPlayerState('modeInterceptorDeathApplied',true);
  switch(effect.id) {
    case 'dirge_shield': ctx.setPlayerState('nextElfModeBarrier',Math.floor(finiteHp(ctx.self.maxHp)*.8)); break;
    case 'soul_reaper': {
      if(data?.killerSide!==ctx.targetSide)break;
      const killer = data?.killerId ? ctx.getFullTeam(ctx.targetSide).find(e => (e.battleId || e.id) === data.killerId) : ctx.target;
      if (!killer) break;
      const amount = Math.floor(finiteHp(killer.maxHp)*.35);
      if (ctx.applyTrueDamageToElf) ctx.applyTrueDamageToElf(ctx.targetSide,killer.battleId||killer.id,amount,'索魂同歸');
      else if ((killer.battleId||killer.id)===(ctx.target.battleId||ctx.target.id)) ctx.applyTrueDamage(ctx.targetSide,amount,'索魂同歸');
      ctx.addTimerTo(ctx.targetSide,{id:'mode_priority_penalty',name:effect.name,kind:'round_counter',source:'mechanic',remaining:3,tickAt:'round_end',pendingActivation:true,ownerBattleId:killer.battleId||killer.id,payload:{priorityDelta:-2}},false); break;
    }
    case 'hero_blessing':
      for(const elf of ctx.getFullTeam(ctx.actor).filter(e=>isAliveBySurvivalRule(e.currentHp,e.survivalRule)&&!e.isVanished)) {
        const stages={...elf.statStages}; for(const key of ['atk','def','spatk','spdef','speed','accuracy']) stages[key]=Math.min(6,(stages[key]??0)+1);
        ctx.updateAnyElf(ctx.actor,elf.battleId||elf.id,{statStages:stages});
        ctx.applyHealToElf?.(ctx.actor,elf.battleId||elf.id,Math.floor(finiteHp(elf.maxHp)*.3));
      }
      break;
  }
  ctx.addLog(effect.triggerLog,'effect');
}
