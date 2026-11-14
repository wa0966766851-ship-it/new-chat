import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {sequenceIssue,skillPropertyIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {NADOLE_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/nadoleSkills.ts');
 const {NADOLE_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/nadoleSoulKit.ts');
 defineCustomBlocks();
 for(const entry of [...soul,...skills.flatMap((s:any)=>s.kit)])assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,JSON.stringify(entry));
 for(const entry of [...soul,...skills.flatMap((s:any)=>s.kit)]){
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(ws as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{ws.dispose();reload.dispose();}
 }
 for(const side of ['p1','p2'] as const){
  for(const [type,wantHp,wantMax,wantOpp] of [['固定',1400,3000,9000],['百分比',1950,3300,8900]] as const){
   const damage=h.kitSkill('受傷測試',[{op:'dmg',p:{flat:300,type}}],{type:'地面',priority:3});
   const [r]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{type:'地面',maxHp:3000,speed:50,extra:{soulMark:{name:'納',effectMode:'kit',kit:soul}}}),opp:h.unit('E',10000,[damage],{type:'火',speed:200})});
   assert.equal(r.self.currentHp,wantHp,r.logs.join('\n'));assert.equal(r.self.maxHp,wantMax);assert.equal(r.opp.currentHp,wantOpp);
  }
  const rounds=await h.play(side,{self:h.unit('S',10000,[skills[3]],{speed:200}),opp:h.unit('E',100000,[h.wait()])},4);
  const missed=(r:any)=>r.logs.filter((v:string)=>v.includes('沒有命中')).length;
  assert.deepEqual(rounds.map(missed),[1,1,1,2],'初次命中0失敗後，只保證後續兩次攻擊');

  const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{type:'地面',extra:{soulMark:{name:'納',effectMode:'kit',kit:soul}}}),opp:h.unit('E',10000,[h.wait()],{type:'火'})});
  assert.equal(r.self.type,'火');assert.equal(r.opp.type,'地面');assert.deepEqual(r.self.typeHistory,['地面']);
  assert.equal(r.opp.skills[0].pp,0,'非同系屬性技能無效並在使用後歸0');
  const [missHistory]=await h.play(side,{self:h.unit('S',10000,[skills[3]],{extra:{typeHistory:['火','地面'],soulMark:{name:'紀錄',effectMode:'kit',kit:soul.filter((e:any)=>e.params.clause.trig==='self_after_use')}}}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(missHistory.opp.currentHp,98000,'已使用但沒命中仍按兩份紀錄各結算1000百分比傷害');
  const switched=await h.play(side,{self:h.unit('S',10000,[h.wait()],{type:'地面',extra:{soulMark:{name:'納',effectMode:'kit',kit:soul}}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[{...h.wait(),type:'地面'},{...h.wait(),name:'火待命',type:'火'}],{type:'火'}),turns:(_e:any,t:number)=>t===3?[{switch:1},1]:[0,t===2?1:0]},3);
  const old=switched[2].state[`${side}Team`][0];
  assert.equal(old.type,'地面','下場恢復原屬性');assert.deepEqual(old.typeHistory,['地面','火'],'紀錄不因下場清除或重複增加');
 }
 console.log('nadoleFoundation passed');
}finally{await h.close();}
