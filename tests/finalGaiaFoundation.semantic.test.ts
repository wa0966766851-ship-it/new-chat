import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {FINAL_GAIA_SKILLS:skills}=await h.server.ssrLoadModule('/src/data/finalGaiaSkills.ts');
 const {FINAL_GAIA_SOUL_KIT:soul}=await h.server.ssrLoadModule('/src/data/finalGaiaSoulKit.ts');
 const {FINAL_GAIA_SEED:seed}=await h.server.ssrLoadModule('/src/data/finalGaia.ts');
 const {applySavedSkillCorrections}=await h.server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
 assert.match(seed.soulMark.description,/自身每次造成非真實傷害提升160%/);
 assert.doesNotMatch(seed.soulMark.description,/受到非真實傷害提升160%/);
 const legacy=structuredClone(seed);
 legacy.soulMark.description=legacy.soulMark.description.replace('造成非真實傷害提升160%','受到非真實傷害提升160%');
 legacy.soulMark.kit=legacy.soulMark.kit.filter((e:any)=>e.order!==22);
 legacy.soulMark.kit[0].params.clause.body[0].acts[0].p.increase=1.6;
 legacy.currentHp=1234;legacy.skinId='gaia-godslayer';legacy.skills[0].pp=2;
 const upgraded=applySavedSkillCorrections(legacy,[seed]);
 assert.deepEqual(upgraded.soulMark,seed.soulMark,'精確舊魂印必須升級');
 assert.equal(upgraded.currentHp,1234);assert.equal(upgraded.skinId,'gaia-godslayer');assert.equal(upgraded.skills[0].pp,2);
 assert.deepEqual(applySavedSkillCorrections(upgraded,[seed]),upgraded,'升級冪等');
 const withTop={...structuredClone(legacy),kit:structuredClone(legacy.soulMark.kit)};
 assert.deepEqual(applySavedSkillCorrections(withTop,[seed]).kit,seed.soulMark.kit,'同步已知舊版頂層魂印積木');
 const custom=structuredClone(legacy);custom.soulMark.description+='自訂';
 assert.deepEqual(applySavedSkillCorrections(custom,[seed]).soulMark,custom.soulMark,'自訂全文不覆蓋');
 const customKit=structuredClone(legacy);customKit.soulMark.kit[0].params.clause.body[0].acts[0].p.remaining=.5;
 assert.deepEqual(applySavedSkillCorrections(customKit,[seed]).soulMark,customKit.soulMark,'自訂積木不覆蓋');
 defineCustomBlocks();
 for(const skill of skills)h.assertKitOnly(skill);
 for(const entry of [...soul,...skills.flatMap((s:any)=>s.kit)]){
  assert.equal(entry.codeId==='effect_sequence'?sequenceIssue(entry.params.clause,entry.node):skillPropertyIssue(entry),null,JSON.stringify(entry));
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();try{assert.ok(buildEntryBlock(ws as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);assert.deepEqual(reload.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{ws.dispose();reload.dispose();}
 }
 const reductionOnly=structuredClone(soul[0]);reductionOnly.params.clause.body[0].acts.splice(1);
 const {combatReceiptOperations}=await h.server.ssrLoadModule('/src/blocks/ops/combatReceipts.ts');
 const reductionOps=combatReceiptOperations({liveElf:(ctx:any,side:string)=>ctx[side],ops:()=>({}),addTimer:()=>{}});
 // 獨立檢查減傷乘區，不能讓同時存在的增傷或汲取掩蓋底數錯誤。
 for(const [ownTurns,oppTurns,remaining] of [[0,0,.6],[1,0,.36],[0,2,.216],[1,2,.1296]]){
  for(const damageCategory of ['fixed','percent','skill_attack']){
   const ctx:any={actor:'p1',targetSide:'p2',p1:{battleStatuses:{'平靜':ownTurns}},p2:{battleStatuses:{'害怕':oppTurns}},getStatuses:(e:any)=>e.battleStatuses};
   const comp:any={isIncoming:true,damageCategory,multiplier:1,increasePercent:0,decreasePercent:0};
   assert.equal(reductionOps.status_duration_damage(ctx,{remaining:.6,increase:0},{event:{data:{damageComp:comp}}}),true);
   assert.ok(Math.abs(comp.multiplier-remaining)<1e-10,`${damageCategory}: ${ownTurns}+${oppTurns}回合應保留${remaining}`);
   assert.equal(comp.increasePercent,0,'受方減傷不得混入造成增傷');
   const outgoing={...comp,isIncoming:false,multiplier:1};
   assert.equal(reductionOps.status_duration_damage_boost(ctx,{increase:1.6},{event:{data:{damageComp:outgoing}}}),true);
   assert.equal(outgoing.increasePercent,1.6*2**(ownTurns+oppTurns));
   assert.equal(outgoing.multiplier,1,'造成增傷不得混入受方減傷');
  }
 }
 const trueComp:any={isIncoming:true,damageCategory:'true',multiplier:1,increasePercent:0,decreasePercent:0};
 assert.equal(reductionOps.status_duration_damage({} as any,{remaining:.6,increase:1.6},{event:{data:{damageComp:trueComp}}}),false);
 assert.equal(trueComp.multiplier,1);assert.equal(trueComp.increasePercent,0,'真實傷害不進此增減傷乘區');
 assert.equal(reductionOps.status_duration_damage_boost({} as any,{increase:1.6},{event:{data:{damageComp:{...trueComp,isIncoming:false}}}}),false);
 for(const side of ['p1','p2'] as const){
  for(const turns of [0,1,2]){
   for(const type of ['固定','百分比','真實']){
    const p=type==='百分比'?{ratio:.01,type,base:'最大體力',of:'opp'}:{flat:1000,type};
    const hit=h.kitSkill('造成方向驗證',[{op:'dmg',p}],{priority:4});
    const [out]=await h.play(side,{self:h.unit('S',100000,[hit],{extra:{soulMark:{name:'造成增傷',effectMode:'kit',kit:[soul[22]]}}}),opp:h.unit('E',100000,[h.wait()],{extra:{battleStatuses:turns?{'平靜':turns}:{}}})});
    const expected=type==='真實'?1000:1000*(1+1.6*2**turns);
    assert.equal(out.opp.currentHp,100000-expected,`${side}/${type}/${turns}: ${out.logs.join('\n')}`);
   }
  }
  const strike={...h.wait(),name:'技能傷害方向驗證',category:'物理',power:100,priority:4};
  const mk=(kit:any[])=>({self:h.unit('S',100000,[strike],{extra:{soulMark:{name:'造成增傷',effectMode:'kit',kit}}}),opp:h.unit('E',100000,[h.wait()])});
  const [baseline]=await h.play(side,mk([]));const [boosted]=await h.play(side,mk([soul[22]]));
  assert.equal(100000-boosted.opp.currentHp,Math.floor((100000-baseline.opp.currentHp)*2.6),'技能傷害也必須增傷');
  const bothHit=h.kitSkill('雙方增減傷',[{op:'dmg',p:{flat:1000,type:'固定'}}],{priority:4});
  const [both]=await h.play(side,{self:h.unit('S',100000,[bothHit],{extra:{soulMark:{name:'出傷',effectMode:'kit',kit:[soul[22]]}}}),opp:h.unit('E',100000,[h.wait()],{extra:{soulMark:{name:'受傷',effectMode:'kit',kit:[reductionOnly]}}})});
  assert.equal(both.opp.currentHp,98440,'造成×2.6與受到×0.6各自生效且只執行一次');
  const {skillSelectable}=await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const damage=h.kitSkill('減免量測試',[{op:'dmg',p:{flat:1000,type:'固定'}}],{priority:3});
  const [receipt]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{maxHp:20000,speed:50,extra:{soulMark:{name:'減免量',effectMode:'kit',kit:[soul[0]]}}}),opp:h.unit('E',100000,[damage])});
  assert.equal(receipt.self.currentHp,10200,'只受600傷害後，減免400×2真實汲取');assert.equal(receipt.opp.currentHp,99200);
  const attack=h.kitSkill('雙筆固傷',[{op:'dmg',p:{flat:1000,type:'固定'}},{op:'dmg',p:{flat:2000,type:'固定'}}],{category:'物理',power:0,priority:4});
  const [records]=await h.play(side,{self:h.unit('S',10000,[attack],{maxHp:20000,extra:{soulMark:{name:'逐筆',effectMode:'kit',kit:soul.slice(20,22)}}}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(records.opp.currentHp,94000,records.logs.join('\n'));assert.equal(records.self.currentHp,13000);
  const selected=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:{name:'選招限制',effectMode:'kit',kit:[soul[12]]}}}),opp:h.unit('E',100000,[h.wait(),{...h.wait(),name:'攻擊',category:'物理',power:20}]),turns:(engine:any,t:number)=>{if(t===2){const st=engine.getState(),other=side==='p1'?'p2':'p1';assert.equal(skillSelectable(st,other,st[other],1),false);assert.equal(skillSelectable(st,other,st[other],0),true);}return [0,0];}},2);
  const selectionSide=side==='p1'?'p2':'p1';assert.equal(selected[1].state[selectionSide+'Timers'].filter((t:any)=>t.payload?.consumeOnSelection).length,1,'第二次屬性使用重新建立下一次限制');
  const transfer=h.kitSkill('轉交測試',[{op:'transfer_next_departure',p:{}}]);
  const handed=await h.play(side,{self:h.unit('S',10000,[transfer]),opp:h.unit('E',100000,[h.kitSkill('進入平靜',[{op:'status',p:{side:'self',status:'平靜',turns:4,chance:100}}])],{statStages:{atk:2,def:-1}}),oppBench:[h.unit('B',100000,[h.wait()])],turns:(_e:any,t:number)=>t===2?[0,{switch:1}]:[0,0]},2);
  assert.equal(handed[1].opp.statStages.atk,2,handed[1].logs.join('\n'));assert.equal(handed[1].opp.statStages.def,-1);assert.ok(h.statuses(handed[1].opp).includes('平靜'),JSON.stringify({before:handed[0].opp,after:handed[1].opp,logs:handed[1].logs}));
  const selfStatus=h.kitSkill('附加砥礪',[{op:'status',p:{side:'self',status:'砥礪',turns:3,chance:100}}],{priority:4});
  const fatal=h.kitSkill('三次致死',[{op:'dmg',p:{flat:1000,type:'真實'}},{op:'dmg',p:{flat:1000,type:'真實'}},{op:'dmg',p:{flat:1000,type:'真實'}}]);
  const [survived]=await h.play(side,{self:h.unit('S',100,[selfStatus],{extra:{soulMark:{name:'多次存活',effectMode:'kit',kit:[soul[9]]}}}),opp:h.unit('E',100000,[fatal])});
  assert.equal(survived.self.currentHp,1,survived.logs.join('\n'));
  const drainLine=skills[1].kit.find((e:any)=>e.params?.clause?.raw.startsWith('5回合內吸取對手'));
  const timedSkill={...skills[1],kit:[drainLine]};
  const healFirst={...h.healSkill(30000),priority:4};
  const five=await h.play(side,{self:h.unit('S',100000,[timedSkill,h.wait()]),opp:h.unit('E',30000,[healFirst]),turns:(_e:any,t:number)=>[t===1?0:1,0]},6);
  assert.deepEqual(five.map((r:any)=>r.opp.currentHp),[15000,15000,15000,15000,15000,30000],'首次命中取得，連續五回合使用觸發，第六回合到期');
  const missSkill={...timedSkill,isSureHit:false,accuracy:0};
  const missed=await h.play(side,{self:h.unit('S',100000,[missSkill,h.wait()]),opp:h.unit('E',30000,[healFirst]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.deepEqual(missed.map((r:any)=>r.opp.currentHp),[30000,30000],'第一次未命中不能取得五回合吸取');
  const [phase]=await h.play(side,{self:h.unit('S',10000,[h.wait(),{...h.wait(),name:'欠PP',pp:3,maxPp:10}],{maxHp:20000,extra:{soulMark:{name:'階段末',effectMode:'kit',kit:[soul[10]]}}}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(phase.self.currentHp,16000);assert.equal(phase.opp.currentHp,94000);assert.equal(phase.self.skills[1].pp,4,'階段末只加1PP，不能回滿');
  const {getMaxPp}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const zero=h.kitSkill('零上限',[{op:'zero_pp_max_zero',p:{}}]);
  const [zeroed]=await h.play(side,{self:h.unit('S',10000,[zero],{speed:200}),opp:h.unit('E',100000,[h.wait(),{...h.wait(),name:'空槽',pp:0,maxPp:10,ppMaxOffset:2}],{extra:{globalPpMaxOffset:3}})});
  assert.equal(getMaxPp(zeroed.opp.skills[1],zeroed.opp),0);
  const attack0={...h.wait(),name:'零PP攻擊',category:'物理',power:0,pp:0,maxPp:5};
  const [unlimited]=await h.play(side,{self:h.unit('S',10000,[attack0],{extra:{effects:[{id:'砥礪',name:'砥礪',duration:3},{id:'麻痺',name:'麻痺',duration:3}],soulMark:{name:'完整魂印',effectMode:'kit',kit:soul}}}),opp:h.unit('E',100000,[h.wait()])});
  assert.ok(unlimited.logs.some((s:string)=>s.includes('使用了【零PP攻擊】')),unlimited.logs.join('\n'));
  assert.ok(h.statuses(unlimited.self).includes('麻痺'),'取消的是附加效果，狀態本身仍保留');
  const killSetup=skills[4].kit.at(-1),kill={...h.kitSkill('擊殺設置',[{op:'dmg',p:{flat:2000,type:'真實'}}],{priority:4}),kit:[killSetup,...h.kitSkill('擊殺設置',[{op:'dmg',p:{flat:2000,type:'真實'}}]).kit]};
  const next=await h.play(side,{self:h.unit('S',10000,[kill],{maxHp:20000}),opp:h.unit('E',1000,[h.wait()]),oppBench:[h.unit('B',10000,[h.wait()])],turns:(_e:any,t:number)=>t===2?[0,{switch:1}]:[0,0]},2);
  assert.ok(h.statuses(next[1].opp).includes('害怕'),next[1].logs.join('\n'));assert.ok(h.statuses(next[1].opp).includes('砥礪'));assert.ok(next[1].opp.currentHp<=5000,'下一隻登場吸取其最大體力一半');
  for(const turns of [0,1,2]){
   const damage=h.kitSkill('固定測試',[{op:'dmg',p:{flat:1000,type:'固定'}}],{priority:3});
   const [r]=await h.play(side,{self:h.unit('S',100000,[h.wait()],{speed:50,extra:{battleStatuses:turns?{'平靜':turns}:{},soulMark:{name:'減傷次數',effectMode:'kit',kit:[reductionOnly]}}}),opp:h.unit('E',100000,[damage],{speed:200})});
   const expected=Math.floor(1000*.6**(1+turns)+1e-9);
   assert.equal(r.self.currentHp,100000-expected,JSON.stringify({side,turns,expected,logs:r.logs}));
  }
 }
 console.log('finalGaiaFoundation passed');
}finally{await h.close();}
