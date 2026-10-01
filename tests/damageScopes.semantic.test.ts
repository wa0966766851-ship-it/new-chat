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
