import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {settlementChainOperations} from '../src/blocks/ops/settlementChains';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const rule={raw:'來源在場時，持有者受到非真實傷害恢復給來源',trig:'damaged_nontrue',parsed:true,body:[{acts:[{op:'heal_mark_source',p:{ratio:1,activeOnly:true},label:'來源回血'}]}]};
const mark=(bindSource=true)=>({op:'mark_program',p:{id:'source:test',name:'測試印記',displayChar:'火',description:rule.raw,side:'opp',mode:'add',count:1,maxCount:3,scope:'elf',persistsOffField:true,unit:'道',bindSource,rules:[rule]}});
try{
 defineCustomBlocks();
 const skill=h.kitSkill('附加來源印記',[mark()]);
 assert.equal(sequenceIssue(skill.kit[0].params.clause,skill.kit[0].node),null);
 assert.ok(sequenceIssue({raw:'錯誤外部動作',trig:'damaged_nontrue',parsed:true,body:rule.body}));
 const ws=new Blockly.Workspace(),back=new Blockly.Workspace();
 try{
  buildEntryBlock(ws as any,skill.kit[0]);
  Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),back);
  assert.deepEqual(createKitBlockParser('skill')(back.getTopBlocks(false)[0],skill.kit[0].node,0),skill.kit[0]);
 }finally{ws.dispose();back.dispose();}
 // 不以同名精靈、對手當前在場者或失效印記代替正式來源。
 const ops=settlementChainOperations({runStmts:()=>{},addTimer:()=>{}});
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  let calls:any[]=[];
  const source:any={id:'S',battleId:'source-instance',currentHp:500,maxHp:1000};
  const holder:any={id:'H',battleId:'holder-instance',currentHp:500,maxHp:1000};
  const ctx:any={actor:other,targetSide:side,self:holder,target:source,activeP1:side==='p1'?source:holder,activeP2:side==='p2'?source:holder,getMarks:()=>[{id:'m',ownerBattleId:holder.battleId,effects:{blockSource:{side,battleId:source.battleId}}}],getFullTeam:(s:string)=>s===side?[source]:[holder],applyHealToElf:(...args:any[])=>calls.push(args)};
  const state:any={last:null,lastAmount:0,holderMark:{id:'m',ownerBattleId:holder.battleId},event:{trig:'damaged_nontrue',data:{settledDamage:30,damage:999}}};
  assert.equal(ops.heal_mark_source(ctx,{ratio:1,activeOnly:true},state),true);
  assert.deepEqual(calls,[[side,'source-instance',30]]);
  source.currentHp=0;assert.equal(ops.heal_mark_source(ctx,{ratio:1,activeOnly:true},state),false);source.currentHp=500;
  ctx[side==='p1'?'activeP1':'activeP2']={id:'replacement'};
  assert.equal(ops.heal_mark_source(ctx,{ratio:1,activeOnly:true},state),false);
  assert.equal(ops.heal_mark_source(ctx,{ratio:1,activeOnly:false},state),true);
  state.holderMark.ownerBattleId='someone-else';assert.equal(ops.heal_mark_source(ctx,{ratio:1,activeOnly:false},state),false);

  const fixed=h.kitSkill('固定100',[{op:'dmg',p:{flat:100,type:'固定'}}]);
  const trueHit=h.kitSkill('真實100',[{op:'dmg',p:{flat:100,type:'真實'}}]);
  const result=await h.play(side,{self:h.unit('S',500,[skill,fixed,trueHit,h.wait()],{maxHp:1000,speed:200}),opp:h.unit('H',3000,[h.wait()]),selfBench:[h.unit('B',500,[fixed],{maxHp:1000})],turns:(_e,t)=>[t===1?0:t===2?1:t===3?2:t===4?{switch:1}:0,0]},5);
  assert.equal(result[1].self.currentHp,600,result[1].logs.join('\n'));
  assert.equal(result[2].self.currentHp,600,'真實傷害不能觸發非真實傷害印記');
  const marks=result[1].state[`${other}Marks`];assert.deepEqual(marks[0].effects.blockSource,{side,battleId:'S'});
  assert.equal(result[3].self.id,'B');assert.equal(result[3].self.currentHp,500,'換人不把來源回血送給新上場者');
  assert.equal(result[4].self.currentHp,500,'來源在板凳時，隊友造成傷害不替來源觸發回血');
  const roster=result[4].state[`${side}Team`];assert.equal(roster.find((e:any)=>e.id==='S').currentHp,600);
  const limited=await h.play(side,{self:h.unit('S',500,[skill,fixed],{maxHp:1000,speed:200}),opp:h.unit('H',3000,[h.kitSkill('每次上限30',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'非真實',cap:30,turns:4}}]),h.wait()]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  assert.equal(limited[1].opp.currentHp,2970);
  assert.equal(limited[1].self.currentHp,530,'傷害上限後只恢復實際30，不能按請求的100恢復');
  console.log(`✓ ${side} 印記來源實際受傷回血、真實傷害排除、來源隔離`);
 }
}finally{await h.close();}
