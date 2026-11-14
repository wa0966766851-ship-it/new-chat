import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {sequenceIssue,skillPropertyIssue} from '../src/effects/sequenceContract';
import {authoredPpExemption} from '../src/effects/skillPpProperty';
import {ppSettlementOperations} from '../src/blocks/ops/ppSettlement';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {HERKA_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/herkaSkills.ts');
 const {HERKA_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/herkaSoulKit.ts');
 const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 defineCustomBlocks();
 for(const s of skills)h.assertKitOnly(s);
 for(const entry of [...soul,...skills.flatMap((s:any)=>s.kit)])assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,JSON.stringify(entry));
 for(const entry of [...soul,...skills.flatMap((s:any)=>s.kit)]){
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{assert.ok(buildEntryBlock(ws as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{ws.dispose();reload.dispose();}
 }
 const sk=skills[0];
 assert.equal(authoredPpExemption({skills:[{...sk,pp:0}]},sk),true);
 assert.equal(authoredPpExemption({skills:[{...sk,pp:20}]},sk),false);
 let count=0;
 const e:any={skills:[{pp:3,maxPp:10},{pp:2,maxPp:5}]};
 const ops=ppSettlementOperations({liveElf:()=>e,runStmts:()=>{count++;},ops:()=>({}),addTimer:()=>{}});
 const st:any={last:null,lastAmount:0};
 ops.pp_deficit_repeat({actor:'p1',targetSide:'p2'} as any,{side:'both',body:[{acts:[]}]},st);
 assert.equal(count,20,'雙方各欠10點，執行20次，不能合併');
 for(const side of ['p1','p2'] as const){
  const {authoredEntry,actions,operation}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
  const enemyEffect=authoredEntry('開戰取得可消除效果','battle_start',[actions(operation('prio_turns',{v:2,turns:4,next:true}))],0,'skill');
  for(const restoredSlots of [0,1,3]){
   const ownerSkills=[h.wait(),h.wait()].map((s:any,i:number)=>({...s,name:`己方${i}`,pp:restoredSlots>i?90:99}));
   const enemySkills=[h.wait(),h.wait()].map((s:any,i:number)=>({...s,name:`敵方${i}`,pp:restoredSlots===3&&i===0?90:99}));
   await h.play(side,{
    self:h.unit('S',10000,ownerSkills,{extra:{soulMark:{name:'入場PP',effectMode:'kit',kit:soul.slice(0,2)}}}),
    opp:h.unit('E',30000,enemySkills,{extra:{soulMark:{name:'開戰效果',effectMode:'kit',kit:[enemyEffect]}}}),
    turns:(engine:any)=>{
     const state=engine.getState(),other=side==='p1'?'p2':'p1';
     assert.deepEqual(state[side].skills.map((s:any)=>s.pp),[99,99]);
     assert.deepEqual(state[other].skills.map((s:any)=>s.pp),[99,99]);
     assert.equal(getStatuses(state[other])?.['繳械']??0,restoredSlots,'繳械按實際恢復的技能槽數計回合');
     assert.equal(state[other+'Timers'].some((t:any)=>t.payload?.block?.prio===2),restoredSlots===0,JSON.stringify({message:'原本全滿不算恢復成功，不應消除對手效果',timers:state[other+'Timers'],logs:state.logs}));
     return [0,0];
    },
   });
  }
  const capped=h.kitSkill('固定及百分比各200',[{op:'dmg',p:{flat:200,type:'固定'}},{op:'dmg',p:{flat:200,type:'百分比'}}]);
  const strike={...h.wait(),name:'攻擊抵擋測試',category:'物理',power:30};
  const capHistory=await h.play(side,{
   self:h.unit('S',1000,[h.wait()],{speed:200,extra:{soulMark:{name:'抵擋前PP上限',effectMode:'kit',kit:soul.slice(0,2)}}}),
   opp:h.unit('E',30000,[capped,strike]),
   turns:(_engine:any,t:number)=>[0,t===2?1:0],
  },3);
  assert.equal(capHistory[0].self.currentHp,608,'使用後剩98PP，固定／百分比每筆上限196');
  assert.equal(capHistory[1].self.currentHp,608,'攻擊被抵擋，不應再扣體力');
  assert.equal(capHistory[2].self.currentHp,208,'抵擋觸發後解除PP傷害上限');
  assert.ok(capHistory[1].state[(side==='p1'?'p2':'p1')+'Timers'].some((t:any)=>t.payload?.block?.disablePriority),'抵擋成功後建立下回合對手先制失效');
  const {HERKA_BODY}=await h.server.ssrLoadModule('/src/data/herkaSkills.ts');
  const immune=authoredEntry('繳械免疫','entrance',[actions(operation('immune_status_turns',{turns:5,cls:'弱化類',reflect:false}))],0,'soulmark');
  const [failedDisarm]=await h.play(side,{
   self:h.unit('S',1000,[h.wait()],{maxHp:30000,speed:200,extra:{soulMark:{name:'完整PP魂印',effectMode:'kit',kit:soul}}}),
   opp:h.unit('E',30000,[h.wait()],{extra:{soulMark:{name:'弱化免疫',effectMode:'kit',kit:[immune]}}}),
  });
  assert.equal(getStatuses(failedDisarm.opp)?.繳械??0,0,'繳械免疫應走失敗補償');
  assert.equal(failedDisarm.opp.skills[0].pp,0,'前面的汲取成功不能吞掉繳械失敗的最高PP歸零');
  assert.equal(failedDisarm.opp.currentHp,5910,'先汲取300，70%固定吸取20790，再按雙方欠額100PP各吸取30');
  const unacted=await h.play(side,{
   self:h.unit('S',10000,[h.wait()],{speed:200,extra:{battleStatuses:{麻痺:3},effects:[{id:'麻痺',name:'麻痺',duration:3,stacks:1}],soulMark:{name:'未行動再執行登場',effectMode:'kit',kit:soul}}}),
   opp:h.unit('E',30000,[h.wait()]),
  },2);
  assert.ok(unacted[0].logs.some((s:string)=>s.includes('因異常狀態無法行動')),'前提：第一回合確實未行動');
  assert.equal(getStatuses(unacted[1].self)?.麻痺??0,0,'下回合重播後解除自身非附屬異常');
  assert.ok((getStatuses(unacted[1].opp)?.麻痺??0)>0,JSON.stringify({message:'把自身原有異常與期限交給對手',firstStatuses:getStatuses(unacted[0].self),timers:unacted[0].state[side+'Timers'].map((t:any)=>t.name),self:getStatuses(unacted[1].self),opp:getStatuses(unacted[1].opp),logs:unacted[1].logs}));
  const [fullHeal]=await h.play(side,{self:h.unit('S',10000,[HERKA_BODY],{speed:200}),opp:h.unit('E',30000,[h.wait()])});
  assert.equal(fullHeal.opp.currentHp,20000,'自身滿血不會令天雷霸體追加真傷，失敗只查對手實際扣血');

  const lethal=h.kitSkill('連續致死',[{op:'dmg',p:{flat:4000,type:'真實'}},{op:'dmg',p:{flat:4000,type:'真實'}}]);
  const [reborn]=await h.play(side,{self:h.unit('S',1000,[skills[1],{...h.wait(),pp:0}],{maxHp:3000,speed:200}),opp:h.unit('E',100000,[lethal])});
  assert.ok(reborn.logs.some((v:string)=>v.includes('重生')),reborn.logs.join('\n'));
  assert.equal(reborn.self.currentHp,3000);assert.deepEqual(reborn.self.skills.map((s:any)=>s.pp),[5,99],'重生同步重置全部PP');
  const [passive]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:3000,speed:200,extra:{soulMark:{name:'PP魂印',description:'',effectMode:'kit',kit:soul}}}),opp:h.unit('E',30000,[h.wait()])});
  assert.ok(passive.opp.currentHp<30000,passive.logs.join('\n'));
  assert.equal(passive.opp.currentHp,29610,'汲取300真傷，再按雙方當時欠缺3PP各吸取30');
  const [hit]=await h.play(side,{self:h.unit('S',1000,[skills[1]],{maxHp:3000,speed:200}),opp:h.unit('E',30000,[h.wait()])});
  assert.equal(hit.self.currentHp,3000,hit.logs.join('\n'));
  assert.equal(hit.opp.currentHp,13000,'百分比15000加實際回血2000各自結算');
  const [miss]=await h.play(side,{self:h.unit('S',1000,[skills[3]],{maxHp:3000,speed:200}),opp:h.unit('E',30000,[h.wait()])});
  assert.ok(miss.logs.some((s:string)=>s.includes('沒有命中')),miss.logs.join('\n'));
 }
 console.log('herkaFoundation passed');
}finally{await h.close();}
