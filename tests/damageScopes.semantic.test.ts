import assert from 'node:assert/strict';
import { matchesDamageTypes } from '../src/effects/damageChoices';
import { compMatchesKind } from '../src/blocks/runtime';
const categories = ['skill_attack', 'skill_attribute', 'skill_extra_action', 'skill', 'fixed', 'percent', 'true', 'hp_adjust', 'unknown'];
for (const [scope, kind, accepted] of [
  ['attack', '攻擊', ['skill_attack']],
  ['skill', '技能', ['skill_attack', 'skill_attribute', 'skill_extra_action', 'skill']],
  ['non_true', '非真實', ['skill_attack', 'skill_attribute', 'skill_extra_action', 'skill', 'fixed', 'percent']],
] as const) {
  for (const category of categories) {
    assert.equal(matchesDamageTypes([scope], category), accepted.includes(category as never), `${scope}/${category}`);
    assert.equal(compMatchesKind({damageCategory: category}, kind), accepted.includes(category as never), `${kind}/${category}`);
  }
}
console.log('傷害上位／子類及非真實排除矩陣通過');
import { createServer } from 'vite';
import { ATOMS } from '../src/effects/effectRunner';
import { applyActiveGateTimersToDamage } from '../src/battle/damageGates';
const elf = (id: string): any => ({id,battleId:id,name:id,type:'普通',maxHp:1000,currentHp:20,statStages:{},skills:[],effects:[]});
const comp = (category: string, incoming = false): any => ({damageCategory:category,base:100,multiplier:1,increasePercent:0,decreasePercent:0,isIncoming:incoming});
for (const side of ['p1','p2'] as const) {
  const target = side === 'p1' ? 'p2' : 'p1';
  for (const scope of ['attack','skill','non_true']) for (const category of categories) {
    const outgoing=comp(category),incoming=comp(category,true);
    ATOMS.damage_multiplier({multiplier:2,damageTypes:[scope]},'self',{damageComp:outgoing});
    ATOMS.damage_reduce({percent:50,damageTypes:[scope]},'self',{actor:side,damageComp:incoming});
    const accepted=matchesDamageTypes([scope],category);
    assert.equal(outgoing.multiplier,accepted?2:1);
    assert.equal(incoming.decreasePercent,accepted?0.5:0);
    const state: any={p1:elf('a'),p2:elf('b'),p1Timers:[],p2Timers:[]};
    const timer=(atom:string,params:any):any=>({id:'t',name:'範圍',remaining:2,ownerBattleId:state[side].battleId,payload:{applyMode:'gate',wrapItems:[{atom,params}]}});
    state[`${side}Timers`]=[timer('damage_multiplier',{multiplier:2,damageTypes:[scope]})];
    const gated=comp(category);applyActiveGateTimersToDamage(side,target,gated,()=>{},{current:state});
    assert.equal(gated.multiplier,accepted?2:1);
    state[`${side}Timers`][0].ownerBattleId='bench';
    const switched=comp(category);applyActiveGateTimersToDamage(side,target,switched,()=>{},{current:state});
    assert.equal(switched.multiplier,1);
  }
}
const vite=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
try {
  const {buildDamageAPIs}=await vite.ssrLoadModule('/src/battle/contextBuilders.ts');
  for (const side of ['p1','p2'] as const) {
    const target=side==='p1'?'p2':'p1',emitted:any[]=[];
    const state:any={p1:elf('a'),p2:elf('b'),p1Marks:[],p2Marks:[],p1Timers:[],p2Timers:[],p1RegistryState:{},p2RegistryState:{}};
    state[`${side}Marks`]=[{id:'nt',name:'非真實',count:1,ownerBattleId:state[side].battleId,effects:{nonTrueDamageDealtMultiplier:2}}];
    state[`${target}Marks`]=[{id:'atk',name:'攻擊易傷',count:1,ownerBattleId:state[target].battleId,effects:{damageTakenIncreasePercentPerStack:0.5}}];
    const api=buildDamageAPIs({side,self:state[side],opp:state[target],syncStateRef:{current:state},pushEffect:(e:any)=>emitted.push(e),getBattleEventContext:()=>({})});
    assert.equal(api.applyTrueDamage(target,100),100,'真實排除非真實與攻擊易傷');
    assert.equal(api.applyFixedDamage(target,100),200);
    assert.equal(api.applyPercentDamage(target,0.1),200);
    assert.equal(api.applySkillTypeDamage(target,100,'技能',{elem:'普通'}),200);
    assert.equal(api.applySkillTypeDamage(target,100,'額外行動',{elem:'普通',category:'skill_extra_action'}),200);
    api.adjustHp(target,-100);
    assert.equal(emitted.at(-1).type,'adjust_hp');assert.equal(emitted.at(-1).data.amount,-100);
  }
} finally {await vite.close();}
console.log('直接／持續／P1/P2／切換隔離／實際 API 數值通過');
import { matchAct } from '../src/blocks/parse';
import { OPS } from '../src/blocks/runtime';
import { applyActionDamageModifiers } from '../src/battle/actionDamageModifiers';
import { calculateDamage } from '../src/utils/damageCalculator';
import { switchBattleSide } from '../src/battle/stateScopes';
for (const [text, scope] of [['本次造成技能傷害提升50%','skill'],['本次造成攻擊傷害提升50%','attack'],['本次造成非真實傷害提升50%','non_true']]) {
  const act=matchAct(text)!;assert.ok(act,text);
  const registry:any={};const c:any={getPlayerState:(k:string)=>registry[k],setPlayerState:(k:string,v:any)=>registry[k]=v,addLog:()=>{}};
  OPS.boost(c,act.p,{last:null,lastAmount:0});
  assert.equal(registry.damageModifiersThisAction[0].scope,scope);
  for(const category of categories){const d=comp(category);applyActionDamageModifiers(registry,d);assert.equal(d.multiplier,matchesDamageTypes([scope],category)?1.5:1);}
}
const power=matchAct('本次威力提升50%')!;assert.equal(power.p.power,true);
const stats={atk:100,def:100,spatk:100,spdef:100,speed:100,hp:1000};
const a:any={...elf('power'),type:'火',calculatedStats:stats},b:any={...elf('target'),calculatedStats:stats};
const skill:any={name:'公式測試',category:'物理',power:100,type:'無屬性',pp:5};
assert.equal(calculateDamage(a,b,skill,'p1',undefined,undefined,1,false,undefined,undefined,undefined,undefined,undefined,{powerMultiplierThisAction:1.5}).damage,128,'威力乘於公式內，含+2常數不等於傷害×1.5');
assert.equal(calculateDamage(a,b,skill,'p1',undefined,undefined,1,false).damage,86);
for(const side of ['p1','p2'] as const){
 const initial:any={p1:elf('a'),p2:elf('b'),p1Team:[elf('a'),elf('bench-a')],p2Team:[elf('b'),elf('bench-b')],p1ActiveIndex:0,p2ActiveIndex:0,p1Marks:[],p2Marks:[],p1Timers:[],p2Timers:[],p1RegistryState:{},p2RegistryState:{},p1ElfState:{},p2ElfState:{}};
 initial[`${side}RegistryState`]={damageModifiersThisAction:[{scope:'skill',multiplier:2}],powerMultiplierThisAction:1.5};
 const switched=switchBattleSide(initial,side,1),returned=switchBattleSide(switched,side,0);
 assert.equal(returned[`${side}RegistryState`].damageModifiersThisAction,undefined);
 assert.equal(returned[`${side}RegistryState`].powerMultiplierThisAction,undefined);
}
console.log('文字指定範圍、本次倍率、威力公式、換回不復活通過');
import { handleOtherworldReySoulMark } from '../src/effects/otherworldReyRegistry';
import { EffectTiming } from '../src/effects/types';
for(const side of ['p1','p2'] as const){
 const self:any={...elf('rey'),currentHp:500,survivalRule:{mode:'god_descent',active:true,minHp:-70000}};
 const reg:any={};const ctx:any={actor:side,targetSide:side==='p1'?'p2':'p1',self,target:elf('opp'),activeP1:self,activeP2:self,getStatuses:()=>({麻痺:2}),getPlayerState:(k:string)=>reg[k],getOpponentState:()=>0};
 for(const category of categories){const d=comp(category);handleOtherworldReySoulMark(ctx,EffectTiming.BEFORE_DAMAGE,{damageComp:d});assert.ok(Math.abs(d.increasePercent-(isSkill(category)?1.2:['fixed','percent'].includes(category)?0.5:0))<1e-9,category);}
 self.currentHp=-100;
 for(const category of categories){const d=comp(category,true);handleOtherworldReySoulMark(ctx,EffectTiming.BEFORE_DAMAGE,{damageComp:d});assert.equal(d.multiplier,matchesDamageTypes(['non_true'],category)?0:1,`神降/${category}`);}
}
function isSkill(category:string){return matchesDamageTypes(['skill'],category);}
const engine=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
try{
 const {buildDamageAPIs}=await engine.ssrLoadModule('/src/battle/contextBuilders.ts');
 for(const side of ['p1','p2'] as const){
  const target=side==='p1'?'p2':'p1';
  const s:any={p1:elf('a'),p2:elf('b'),p1Marks:[],p2Marks:[],p1Timers:[],p2Timers:[],p1RegistryState:{},p2RegistryState:{}};
  s[side].name='異境神霆·雷伊';s[side].currentHp=500;
  const ctx:any={actor:side,targetSide:target,self:s[side],target:s[target],activeP1:s.p1,activeP2:s.p2,getMarks:()=>[],p1Timers:[],p2Timers:[],getStatuses:()=>({麻痺:2}),getPlayerState:()=>0,getOpponentState:()=>0};
  const events:any[]=[];
  const api=buildDamageAPIs({side,self:s[side],opp:s[target],syncStateRef:{current:s},pushEffect:(e:any)=>events.push(e),getBattleEventContext:()=>ctx});
  assert.equal(api.applySkillTypeDamage(target,100,'X系',{elem:'普通'}),220,'實際API通知造成方技能增傷');
  assert.equal(api.applySkillTypeDamage(target,100,'額外行動',{elem:'普通',category:'skill_extra_action'}),220);
  assert.equal(api.applyFixedDamage(target,100),150);
  assert.equal(api.applyTrueDamage(target,100),100);
  s[`${side}RegistryState`].vampireRatio=0.5;
  s[target].shield=999; s[target].currentHp=10; events.length=0;
  assert.equal(api.applySkillTypeDamage(target,100,'吸血',{elem:'普通'}),220);
  assert.equal(events.find((e:any)=>e.type==='heal').data.amount,110,'實際API吸血不按護盾或10HP限縮');
 }
}finally{await engine.close();}
console.log('雷伊技能／非真實／免疫範圍與真正造成方入口通過');
import { tickTimers, addTimer } from '../src/battle/timers';
import { OTHERWORLD_REY_SKILLS } from '../src/effects/otherworldReyRegistry';
for(const side of ['p1','p2'] as const){
 const target=side==='p1'?'p2':'p1';let timers:any[]=[];
 const c:any={actor:side,targetSide:target,self:elf('rey'),target:elf('opp'),getPlayerState:()=>0,setPlayerState:()=>{},applyStatChange:()=>{},
  applyPinkDamage:(s:string,amount:number,_l:any,_p1:any,_p2:any,type:string)=>{assert.equal(s,target);assert.equal(type,'percent');return amount;},
  applyHeal:(s:string)=>assert.equal(s,side),addTimerTo:(_s:string,t:any)=>{timers=addTimer(timers,t,{isLateMover:true});}};
 OTHERWORLD_REY_SKILLS['異境神霆'](c);
 assert.equal(timers[0].remaining,2);assert.equal(timers[0].lateMoverPending,undefined);
 const state:any={p1:elf('a'),p2:elf('b'),p1RegistryState:{},p2RegistryState:{},p1Timers:[],p2Timers:[]};
 const value=(category:string)=>{state[`${side}Timers`]=timers;const d=comp(category);applyActiveGateTimersToDamage(side,target,d,()=>{},{current:state});return (1+d.increasePercent)*d.multiplier;};
 assert.equal(value('fixed'),1,'附加當回合未啟用');
 timers=tickTimers(timers,'round_end');assert.equal(timers[0].remaining,2);
 for(const category of categories)assert.equal(value(category),matchesDamageTypes(['non_true'],category)?3.1:1);
 timers=tickTimers(timers,'round_end');assert.equal(timers[0].remaining,1);assert.equal(value('skill_attack'),3.1);
 timers=tickTimers(timers,'round_end');assert.equal(timers.length,0);assert.equal(value('skill_attribute'),1);
}
console.log('雷伊下2回合啟用／期限／後手不多算／到期與排除真傷通過');
import { queueSkillLifesteal } from '../src/battle/lifesteal';
import { resolveRecoveryEffect } from '../src/battle/recovery';
import { settleDamageAbsorption } from '../src/battle/damageSemantics';
import { resolveDamageTransition, reyGodDescentRule } from '../src/battle/survivalRules';
for(const side of ['p1','p2'] as const){
 for(const category of ['skill_attack','skill_attribute','skill_extra_action']){
  for(const [hp,shield,barrier] of [[10,0,0],[1000,600,0],[1000,0,600]]){
   const absorption=settleDamageAbsorption(400,category,shield,barrier);
   const enemy=resolveDamageTransition(hp,1000,absorption.amount,'non_true');
   const emitted:any[]=[];
   const amount=queueSkillLifesteal(side,400,category,{vampireRatio:0.5},e=>emitted.push(e));
   assert.equal(amount,200);assert.equal(emitted[0].type,'heal');assert.equal(emitted[0].data.amount,200);
   if(hp===10)assert.equal(enemy.damageApplied,10);
   if(shield===600)assert.equal(enemy.damageApplied,0);
   assert.equal(resolveRecoveryEffect(100,1000,amount,1,false).hp,300);
   assert.equal(resolveRecoveryEffect(100,1000,amount,1,true).hp,100,'禁療仍攔截');
   assert.equal(resolveRecoveryEffect(100,1000,amount,0.5,false).hp,200,'減療仍適用');
   assert.equal(resolveRecoveryEffect(-100,1000,amount,0,true,reyGodDescentRule(1000)).hp,600,'神降按原規則轉+70%最大體力');
  }
 }
 const emitted:any[]=[];assert.equal(queueSkillLifesteal(side,0,'skill_attack',{vampireRatio:0.5},e=>emitted.push(e)),0);
 assert.equal(emitted.length,0,'技能結算免疫為0時，不生成正量恢復');
 for(const category of ['fixed','percent','true','hp_adjust','unknown'])assert.equal(queueSkillLifesteal(side,400,category,{vampireRatio:0.5},()=>{}),0);
 assert.equal(queueSkillLifesteal(side,400,'skill_attribute',{vampireRatio:0.5,vampireDamageTypesThisAction:['attack']},()=>{}),0);
}
console.log('吸血過量／護盾／護罩／免疫／禁療／減療／神降及範圍矩陣通過');
