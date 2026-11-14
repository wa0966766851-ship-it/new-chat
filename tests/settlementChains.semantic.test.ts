import assert from 'node:assert/strict';
import {damageStepCount,settlementChainOperations,hasSkillInvalidEffect} from '../src/blocks/ops/settlementChains';
import {sequenceIssue} from '../src/effects/sequenceContract';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

assert.equal(damageStepCount(9,1000,.01),0);
assert.equal(damageStepCount(10,1000,.01),1);
assert.equal(damageStepCount(29,1000,.01),2);
assert.equal(damageStepCount(30,1000,.01),3);
assert.equal(damageStepCount(100,0,.01),0);
const h=await createHarness();
const entry=(trig:string,node:string,acts:any[])=>({codeId:'effect_sequence',node,source:'soulmark',role:'innate',order:0,params:{clause:{raw:'測試結算鏈',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}});
try{
  const {CORRUPTED_RIELS_SEED:seed}=await h.server.ssrLoadModule('/src/data/corruptedRiels.ts');
  for(const item of [seed.soulMark,...seed.skills])for(const e of item.kit||[]){if(e.codeId==='effect_sequence')assert.equal(sequenceIssue(e.params.clause,e.node),null,item.name+': '+e.customText);}
  const stepped=entry('opp_damaged_skill','on_opponent_damaged',[{op:'damage_steps_drain',p:{step:.01,ratio:.01,thresholdSide:'opp',belowRatio:1/6,belowBody:[{acts:[{op:'stat',p:{side:'opp',stats:['全屬性'],v:-1},label:'弱化'}]}],smallBody:[{acts:[{op:'stat',p:{side:'self',stats:['全屬性'],v:1},label:'強化'}]}]}}]);
  assert.equal(sequenceIssue(stepped.params.clause,'on_opponent_damaged'),null);
  assert.ok(sequenceIssue({...stepped.params.clause,trig:'use'},'on_skill_use'));
  defineCustomBlocks();
  for(const item of [seed.soulMark,...seed.skills])for(const e of item.kit||[]){
    const ws=new Blockly.Workspace(),restoredWs=new Blockly.Workspace();
    try{
      const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),restoredWs);
      const result=restoredWs.getTopBlocks(false).map(v=>createKitBlockParser(e.source)(v,e.node,e.order));
      assert.deepEqual(result,[e],`${item.name}積木完整保存重載`);
    }finally{ws.dispose();restoredWs.dispose();}
  }
  const invalidCtx:any={actor:'p1',targetSide:'p2',self:{id:'A'},target:{id:'B'},getPlayerState:()=>0,getOpponentState:()=>0,p1Timers:[],p2Timers:[]};
  invalidCtx.p2Timers=[{remaining:1,ownerBattleId:'bench',payload:{block:{invalid:'攻擊'}}}];
  assert.equal(hasSkillInvalidEffect(invalidCtx,'both'),false,'板凳持有的效果不能算場上');
  invalidCtx.p2Timers[0].ownerBattleId='B';invalidCtx.p2Timers[0].pendingActivation=true;
  assert.equal(hasSkillInvalidEffect(invalidCtx,'both'),false,'尚未啟用的效果不能算場上');
  invalidCtx.p2Timers[0].pendingActivation=false;
  assert.equal(hasSkillInvalidEffect(invalidCtx,'both'),true);
  const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{
    const block=buildEntryBlock(workspace as any,stepped as any);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
    const restored=reload.getTopBlocks(false).map(b=>createKitBlockParser('soulmark')(b,stepped.node as any,stepped.order));
    assert.deepEqual(restored,[stepped],'積木保存重載不得丟失結果分支或步長');
  }finally{workspace.dispose();reload.dispose();}
  // 分別結算而非合併：每份10點遇到每次上限3，三份各造成3，共9。
  for(const side of ['p1','p2'] as const){
    const opposite=side==='p1'?'p2':'p1';
    let damageCalls=0,heals=0,branches=0;
    const self:any={id:'S',battleId:'S',maxHp:1000,currentHp:800},opp:any={id:'E',battleId:'E',maxHp:1000,currentHp:1000};
    const ctx:any={actor:side,targetSide:opposite,self,target:opp,getFullTeam:(s:string)=>[s===side?self:opp],applyPinkDamage:(_s:string,n:number,_a:any,_b:any,_c:any,kind:string,opts:any)=>{assert.equal(kind,'percent');assert.equal(n,10);damageCalls++;opts.onSettled({targetBattleId:'E',settledAmount:3,hpLost:3});return 3;},applyHealToElf:(_s:string,id:string,n:number,opts:any)=>{heals+=n;opts.onSettled({targetBattleId:id,hpGained:n});}};
    const ops=settlementChainOperations({runStmts:()=>{branches++;},addTimer:()=>{}});
    ops.damage_steps_drain(ctx,stepped.params.clause.body[0].acts[0].p,{last:null,lastAmount:0,event:{trig:'opp_damaged_skill',data:{damage:30,sourceSide:side,sourceBattleId:'S'}}});
    assert.equal(damageCalls,3);assert.equal(heals,9);assert.equal(branches,1);
    ops.damage_steps_drain(ctx,stepped.params.clause.body[0].acts[0].p,{last:null,lastAmount:0,event:{trig:'opp_damaged_skill',data:{damage:30,sourceSide:side,sourceBattleId:'bench'}}});
    assert.equal(damageCalls,3,'別的精靈造成傷害不能觸發持有者魂印');

    const soul={name:'測試',description:'',effectMode:'kit',kit:[stepped]};
    const attack=h.kitSkill('直傷30',[{op:'dmg',p:{flat:30,type:'技能',elem:'普通'}}],{priority:5});
    const [result]=await h.play(side,{self:h.unit('S',500,[attack],{maxHp:1000,extra:{soulMark:soul}}),opp:h.unit('E',1000,[h.wait()])});
    assert.equal(result.opp.currentHp,940,result.logs.join('\n'));
    assert.equal(result.self.currentHp,530,result.logs.join('\n'));
    assert.equal(result.opp.statStages.atk,-1);

    const deferred=entry('opp_used_attack','on_opponent_skill_use',[{op:'heal_defer_damage',p:{ratio:1/3}}]);
    const [after,second]=await h.play(side,{self:h.unit('S',900,[h.wait()],{maxHp:1000,extra:{soulMark:{...soul,kit:[deferred]}}}),opp:h.unit('E',1000,[{...h.wait(),name:'攻擊',category:'物理',power:0}])},2);
    assert.equal(after.opp.currentHp,900,'只按實際回復100點造成階段末傷害');
    assert.equal(after.self.currentHp,1000);
    assert.equal(second.opp.currentHp,900,'滿血未恢復，且前回合待用傷害已消費，不能重播');

    const ppSkill=h.kitSkill('逐槽PP吸取',[{op:'pp_drain_slots',p:{amount:2}}]);
    const [pp]=await h.play(side,{self:h.unit('S',1000,[{...ppSkill,pp:5,maxPp:10},{...h.wait(),pp:1,maxPp:10},{...h.wait(),pp:0,maxPp:10}],{speed:200}),opp:h.unit('E',1000,[{...h.wait(),pp:0,maxPp:10},{...h.wait(),pp:1,maxPp:10},{...h.wait(),pp:7,maxPp:10}]),turns:()=>[0,2]});
    assert.equal(pp.self.skills[0].pp,4,'對手槽0沒有PP，自身不能憑空恢復');
    assert.equal(pp.self.skills[1].pp,2,'槽1只能吸取1點');
    assert.equal(pp.self.skills[2].pp,2,'槽2吸取2點');

    const reflect=h.kitSkill('反彈後轉化',[
      {op:'immune_status_turns',p:{turns:5,reflect:true}},
      {op:'timed',p:{turns:5,from:'now',trig:'status_reflected',body:[{acts:[{op:'convert_status',p:{side:'opp',status:'害怕',turns:3},label:'轉為害怕'}]}]}}
    ]);
    const poison=h.kitSkill('施毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3}}]);
    const [reflected]=await h.play(side,{self:h.unit('S',1000,[reflect],{speed:200}),opp:h.unit('E',1000,[poison])});
    assert.ok(h.statuses(reflected.opp).includes('害怕'),reflected.logs.join('\n'));
    assert.ok(!h.statuses(reflected.opp).includes('中毒'),'成功反彈後，既有異常轉為害怕');
    assert.ok(!h.statuses(reflected.self).includes('中毒'));
    console.log(`✓ ${side} 獨立吸取／實際回血延後結算／逐槽PP正式引擎驗證`);
  }
}finally{await h.close();}
