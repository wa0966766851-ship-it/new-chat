import assert from 'node:assert/strict';
import { handleDestinyInterceptor as run } from '../src/effects/destinyInterceptors';
import { EffectTiming as E } from '../src/effects/types';
import { INTERCEPTOR_EFFECTS } from '../src/utils/destinyGacha';
import { activeConstraints } from '../src/battle/timedConstraints';
import { tickTimers } from '../src/battle/timers';
import { getMaxPp, restoreSkillPp } from '../src/utils/battleHelpers';
function fixture(id:string,actor:'p1'|'p2'='p1') {
  const self:any={id:'same',battleId:actor+'_self',name:'test',destinyRank:'C',maxHp:1000,currentHp:0,interceptorEffect:INTERCEPTOR_EFFECTS[id],statStages:{},skills:[]};
  const target:any={id:'same',battleId:'target',name:'target',maxHp:2000,currentHp:1000,skills:[{name:'a',pp:1,maxPp:5},{name:'b',pp:5,maxPp:5}]};
  const reg:any={}; const timers:any[]=[];const heals:any[]=[];const damages:number[]=[];
  const team=[self,{...self,battleId:'living',currentHp:400,statStages:{atk:6}},{...self,battleId:'dead',currentHp:0}];
  const ctx:any={self,target,actor,targetSide:actor==='p1'?'p2':'p1',specialMode:'destiny',p1Timers:timers,p2Timers:timers,
    getPlayerState:(k:string)=>reg[k],setPlayerState:(k:string,v:any)=>reg[k]=v,addLog:()=>{},
    addTimerTo:(side:string,t:any)=>timers.push({...t,ownerBattleId:t.ownerBattleId??(side===actor?self.battleId:target.battleId)}),
    updateElf:(side:string,patch:any)=>Object.assign(side===actor?self:target,patch),
    getFullTeam:(side:string)=>side===actor?team:[target],updateAnyElf:(_:string,id:string,patch:any)=>Object.assign(team.find(e=>e.battleId===id),patch),
    applyHealToElf:(_:string,id:string,amount:number)=>heals.push({id,amount}),applyTrueDamage:(_:string,n:number)=>damages.push(n)};
  return {ctx,self,target,reg,timers,team,heals,damages};
}
for(const side of ['p1','p2'] as const) {
  let f=fixture('block_attack',side);run(f.ctx,E.ON_ENTRANCE);run(f.ctx,E.ON_ENTRANCE);assert.equal(f.timers.length,1);
  assert.equal(activeConstraints(f.timers,f.target).length,0);const enabled=tickTimers(f.timers,'round_end');assert.equal(activeConstraints(enabled,f.target)[0].blockAttack,true);assert.equal(tickTimers(enabled,'round_end').length,0);
  f=fixture('pp_chain',side);run(f.ctx,E.ON_ENTRANCE);assert.equal(f.target.skills[0].pp,0);assert.equal(getMaxPp(f.target.skills[0]),3);assert.equal(restoreSkillPp(f.target.skills[0],100).pp,3);f.reg.modeInterceptorEntranceActive=false;run(f.ctx,E.ON_ENTRANCE);assert.equal(f.target.skills[0].ppMaxOffset,-2);
  f=fixture('dirge_shield',side);run(f.ctx,E.DEATH_NODE_1);run(f.ctx,E.DEATH_NODE_1);assert.equal(f.reg.nextElfModeBarrier,800);f.self.currentHp=100;run(f.ctx,E.ON_ENTRANCE);assert.equal(f.self.barrier,800);assert.equal(f.reg.nextElfModeBarrier,0);assert.equal(f.timers[0].payload.immuneStatus,true);
  f=fixture('soul_reaper',side);run(f.ctx,E.DEATH_NODE_1,{killerSide:f.ctx.targetSide});run(f.ctx,E.DEATH_NODE_1,{killerSide:f.ctx.targetSide});assert.deepEqual(f.damages,[700]);const pc={bonus:0};run({...f.ctx,self:f.target},E.MODIFY_PRIORITY,{priorityComp:pc});assert.equal(pc.bonus,0);run({...f.ctx,self:f.target,p1Timers:tickTimers(f.timers,'round_end'),p2Timers:tickTimers(f.timers,'round_end')},E.MODIFY_PRIORITY,{priorityComp:pc});assert.equal(pc.bonus,-2);assert.equal(f.timers[0].remaining,3);
  f=fixture('hero_blessing',side);run(f.ctx,E.DEATH_NODE_1);assert.deepEqual(f.heals,[{id:'living',amount:300}]);assert.equal(f.team[1].statStages.atk,6);assert.equal(f.team[1].statStages.speed,1);run(f.ctx,E.DEATH_NODE_1);assert.equal(f.heals.length,1);
  f=fixture('soul_reaper',side);f.target.maxHp=NaN;run(f.ctx,E.DEATH_NODE_1,{killerSide:f.ctx.targetSide});assert.equal(f.damages[0],0);
  f=fixture('soul_reaper',side);const bench={...f.target,battleId:'killer',maxHp:1000};f.ctx.getFullTeam=()=>[f.target,bench];let victim='';f.ctx.applyTrueDamageToElf=(_:string,id:string,n:number)=>{victim=id;f.damages.push(n)};run(f.ctx,E.DEATH_NODE_1,{killerSide:f.ctx.targetSide,killerId:'killer'});assert.equal(victim,'killer');assert.deepEqual(f.damages,[350]);assert.equal(f.timers[0].ownerBattleId,'killer');
  f=fixture('pp_chain',side);f.ctx.specialMode=undefined;run(f.ctx,E.ON_ENTRANCE);assert.equal(f.target.skills[0].pp,1);
}
console.log('命運五攔截：P1/P2、數值、期限、同名實例、死亡去重與模式隔離通過');
