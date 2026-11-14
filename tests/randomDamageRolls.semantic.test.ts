import assert from 'node:assert/strict';
import {randomDamageOperation,damageRollIssue} from '../src/blocks/ops/damageRolls';
import {createHarness} from './helpers/migrationHarness';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const p={side:'self',source:'opp',min:200,max:400,type:'固定',perStack:true};
const rule={raw:'每道各附加一次隨機固定傷害',trig:'damaged_attack',parsed:true,body:[{acts:[{op:'random_damage',p,label:'逐道獨立固定傷害'}]}]};
const mark=(count:number)=>({op:'mark_program',p:{id:'test:damage-rolls',name:'逐道傷害',displayChar:'火',description:rule.raw,side:'self',mode:'set',count,maxCount:3,scope:'elf',persistsOffField:true,unit:'道',rules:[rule]}});
const h=await createHarness();
try{
 for(const patch of [{min:NaN},{min:1.5},{min:401},{max:Infinity},{type:'不明'},{source:'both'},{perStack:undefined}])assert.ok(damageRollIssue({...p,...patch}));
 const draws=[0,.5,1-Number.EPSILON],calls:any[]=[];
 const source:any={actor:'p2'},ctx:any={actor:'p1',targetSide:'p2',target:{id:'source'},rng:()=>draws.shift(),contextForElf:()=>source};
 const run=randomDamageOperation((c,side,n,type)=>{assert.equal(c,source);calls.push({side,n,type});return Math.min(n,30);});
 const state:any={last:null,lastAmount:0,markStacks:3};
 assert.equal(run(ctx,p,state),true);assert.deepEqual(calls,[{side:'p1',n:200,type:'固定'},{side:'p1',n:300,type:'固定'},{side:'p1',n:400,type:'固定'}]);assert.equal(state.lastAmount,90);
 const skill=h.kitSkill('逐道印記',[mark(3)]);
 assert.equal(sequenceIssue(skill.kit[0].params.clause),null);
 assert.ok(sequenceIssue({raw:'不在印記中',trig:'use',parsed:true,body:rule.body}));
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{buildEntryBlock(w as any,skill.kit[0]);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],skill.kit[0].node,0),skill.kit[0]);}finally{w.dispose();r.dispose();}
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 h.S.E=(_ctx:any,e:any,d:any)=>{const c=d?.damageComp||d;if(e===T.BEFORE_DAMAGE&&!c.isIncoming&&c.damageCategory==='skill_attack')c.base=100;};
 for(const side of ['p1','p2'] as const){
  for(const count of [1,3]){
   const prep=h.kitSkill('設置逐道印記',[mark(count),{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'固定',cap:30,turns:5}}]);
   const result=await h.play(side,{self:h.unit('S',10000,[prep,h.wait()],{speed:200}),opp:h.unit('E',10000,[h.wait(),{...h.wait(),name:'攻擊',category:'物理',power:100}]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
   assert.equal(result[1].self.currentHp,10000-100-30*count,result[1].logs.join('\n'));
   assert.equal(result[1].opp.currentHp,10000,'追加固定傷害目標是印記持有者，不是攻擊者自己');
  }
  const after=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('設印記',[mark(3)]),h.wait()],{speed:200}),opp:h.unit('E',10000,[h.wait(),h.kitSkill('非攻擊固定',[{op:'dmg',p:{flat:100,type:'固定'}}])]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  assert.equal(after[1].self.currentHp,9900,'固定傷害本身不重複觸發受到攻擊事件');
  console.log(`✓ ${side} 每道獨立隨機固定傷害，來源目標正確，不被固定傷害遞迴觸發`);
 }
}finally{delete h.S.E;await h.close();}
