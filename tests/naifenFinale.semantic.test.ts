import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {NAIFEN_FINALE:skill}=await h.server.ssrLoadModule('/src/data/naifenSkills.ts');
 const {applyFormulaProperties}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
 const {calculateDamage}=await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
 const {authoredEntry:e,actions:act,operation:a}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 for(const side of ['p1','p2'] as const)for(const star of [false,true]){
  const own=h.unit('S',1000,[skill],{maxHp:10000,speed:200,extra:star?{battleStatuses:{星佑:3},effects:[{id:'星佑',name:'星佑',duration:3,stacks:1}]}:{}});
  const enemy=h.unit('E',10000,[h.wait()]);
  const ctx:any={actor:side,targetSide:side==='p1'?'p2':'p1',self:own,target:enemy,skill,getStatuses:(elf:any)=>elf.battleStatuses||{},getPlayerState:()=>undefined,setPlayerState:()=>{},p1Timers:[],p2Timers:[]};
  const transformed=applyFormulaProperties(skill,ctx);
  assert.equal(transformed.category,star?'特殊':'物理');assert.equal(transformed.type,star?'超能':'普通');assert.equal(transformed.power,180);assert.equal(transformed.isFifthSkill,true);
  assert.equal(skill.category,'屬性');assert.equal(skill.power,0,'本次轉化不寫穿技能原件');
  const actual=calculateDamage({...own,type:'火'},enemy,transformed,'p1',undefined,undefined,1,false).damage;
  const base=calculateDamage({...own,type:'火'},enemy,{...transformed,resolvedNeutralStab:false},'p1',undefined,undefined,1,false).damage;
  assert.ok(actual>base,'普通克制時可取得本系倍率');
  const block=e('攻擊免疫與上限','entrance',[act(a('immune_attack_turns',{turns:5}),a('damage_cap_turns',{side:'self',dir:'in',turns:5,cap:1,kind:'技能'}))],0,'soulmark');
  assert.equal(sequenceIssue(block.params.clause,block.node),null);
  const [r]=await h.play(side,{self:own,opp:{...enemy,soulMark:{name:'免疫與上限',effectMode:'kit',kit:[block]}}});
  assert.ok(r.opp.currentHp<1000,JSON.stringify({side,star,hp:r.opp.currentHp,logs:r.logs}));
  assert.equal(r.self.currentHp,10000,'出手前直接交換當前體力，不截斷或視為一般回血');
 }
 console.log('naifenFinale passed: both conditional transformations with equal attack stats, neutral STAB, immunity/limit bypass and HP exchange');
}finally{await h.close();}
