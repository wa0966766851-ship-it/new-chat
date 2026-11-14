import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {reductionPolicy,limitIncomingDamage} from '../src/battle/damageReduction';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const mark=(o:any={})=>({op:'mark_program',p:{id:'test:no-incoming-cap',name:'受傷上限失效',displayChar:'火',description:'只取消受到技能、固定、百分比傷害的上限',side:'self',mode:'set',count:1,maxCount:3,scope:'elf',persistsOffField:true,unit:'道',incomingDamageLimitDisabled:true,rules:[],...o}});
const cap={op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'非真實',cap:30,turns:5}};
try{
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 h.S.E=(_ctx:any,event:any,data:any)=>{const comp=data?.damageComp||data;if(event===T.BEFORE_DAMAGE&&!comp.isIncoming&&comp.damageCategory==='skill_attack')comp.base=1000;};
 const skill=h.kitSkill('印記',[mark()]);
 assert.equal(sequenceIssue(skill.kit[0].params.clause),null);
 assert.ok(sequenceIssue(h.kitSkill('非法旗標',[mark({incomingDamageLimitDisabled:1})]).kit[0].params.clause));
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{buildEntryBlock(w as any,skill.kit[0]);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],skill.kit[0].node,0),skill.kit[0]);}finally{w.dispose();r.dispose();}
 const elf:any={id:'H',battleId:'H'},m:any={id:'m',scope:'elf',ownerBattleId:'H',count:1,effects:{incomingDamageLimitDisabled:1}};
 for(const type of ['skill_attack','skill_attribute','skill_extra_action','fixed','percent','true']){
  const policy=reductionPolicy({p1Marks:[m],p2Marks:[],p1Timers:[],p2Timers:[]} as any,'p1',elf,type);
  assert.equal(!!policy.incomingDamageLimitDisabled,type!=='true',type);
  assert.equal(limitIncomingDamage({limit:30,reductionPolicy:policy},100),type==='true'?30:100);
 }
 assert.equal(!!reductionPolicy({p1Marks:[{...m,ownerBattleId:'B'}],p2Marks:[],p1Timers:[],p2Timers:[]} as any,'p1',elf,'fixed').incomingDamageLimitDisabled,false);

 for(const side of ['p1','p2'] as const){
  const play=async(attack:any,enabled=true,extraActs:any[]=[],attackerActs:any[]=[],extra:any={})=>{
   const prep=h.kitSkill('設置受傷上限',[cap,...(enabled?[mark()]:[]),...extraActs]);
   return h.play(side,{self:h.unit('S',10000,[prep,h.wait()],{speed:200,extra}),opp:h.unit('E',10000,[h.kitSkill('設置攻方',attackerActs),attack]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  };
  const fixed=h.kitSkill('固定100',[{op:'dmg',p:{flat:100,type:'固定'}}]);
  const baseline=await play(fixed,false);assert.equal(baseline[1].self.currentHp,9970);
  for(const type of ['固定','百分比','技能','真實']){
   const attack=h.kitSkill(type,[{op:'dmg',p:{flat:100,type,...(type==='技能'?{elem:'普通'}:{})}}]);
   const result=await play(attack);assert.equal(result[1].self.currentHp,9900,`${side}/${type}: ${result[1].logs.join('\n')}`);
  }
  for(const category of ['物理','特殊']){
   const result=await play({...h.wait(),name:category+'攻擊',category,power:100,isSureHit:true});
   assert.equal(result[1].self.currentHp,9000,`${side}/${category}: ${result[1].logs.join('\n')}`);
  }
  const reduced=await play(fixed,true,[{op:'dmg_mod_turns',p:{side:'self',dir:'in',kind:'非真實',reduce:.5,turns:5}}]);
  assert.equal(reduced[1].self.currentHp,9950,'一般減傷仍生效');
  const shielded=await play(h.kitSkill('技能100',[{op:'dmg',p:{flat:100,type:'技能',elem:'普通'}}]),true,[{op:'shield',p:{flat:200}}]);
  assert.equal(shielded[1].self.currentHp,10000);assert.equal(shielded[1].self.shield,100,'護盾仍正常承傷');
  const barrier=await play(fixed,true,[{op:'shield',p:{flat:200,kind:'barrier'}}]);
  assert.equal(barrier[1].self.currentHp,10000);assert.equal(barrier[1].self.barrier,100,'護罩仍正常承傷');
  const blocked=await play(h.kitSkill('X系100',[{op:'dmg',p:{flat:100,type:'技能',elem:'普通'}}]),true,[{op:'block_damage_uses',p:{uses:1,kind:'技能',key:'generic-test-block'}}]);
  assert.equal(blocked[1].self.currentHp,10000,'傷害抵擋不能被上限失效一併取消');
  const output=await play(fixed,true,[],[{op:'damage_cap_turns',p:{side:'self',dir:'out',kind:'非真實',cap:20,turns:5}}]);
  assert.equal(output[1].self.currentHp,9980,'攻方造成傷害上限仍為20');
  const guard=await play(fixed,true,[],[],{deathImmunity:{guardTurns:5,fixedPercentCap:10}});
  assert.equal(guard[1].self.currentHp,9900,'保命窗口中的固定傷害上限也失效');
  const expired=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('短印記',[cap,mark({turns:1})]),h.wait()],{speed:200}),opp:h.unit('E',10000,[h.wait(),fixed]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  assert.equal(expired[1].self.currentHp,9970,'印記到期後立即恢復受傷上限');
  const ownOutput=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('持有者設置',[mark(),{op:'damage_cap_turns',p:{side:'self',dir:'out',kind:'非真實',cap:20,turns:5}}]),fixed],{speed:200}),opp:h.unit('E',10000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.equal(ownOutput[1].opp.currentHp,9980,'持有印記的精靈自身輸出上限仍有效');
  console.log(`✓ ${side} 三類受傷上限失效；輸出上限、減傷、護盾護罩與抵擋保留`);
 }
}finally{delete h.S.E;await h.close();}
