import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
  const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {getTypeMatchup}=await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
  const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const original=structuredClone(DEFAULT_ELVES.find((e:any)=>String(e.id)==='5035').soulMark);
  const soul={...original,kit:original.kit.filter((e:any)=>/typed_cycle_reset|typed_damage_cycle/.test(JSON.stringify(e)))};
  assert.equal(soul.kit.length,2,'驗收來源中的登場及完整循環條款，其他未完成魂印條款不混入');
  defineCustomBlocks();
  const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{
    for(const e of soul.kit){const b=buildEntryBlock(ws as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
    const restored=reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('soulmark')(b,old.node,old.order);});
    assert.deepEqual(restored,soul.kit);
  }finally{ws.dispose();reload.dispose();}
  const probe=(type:string)=>h.kitSkill('屬性傷害-'+type,[{op:'dmg',p:{flat:1000,type:'技能',elem:type}}],{priority:10});
  for(const side of ['p1','p2'] as const){
    const types=['普通','普通','水','火','草','水·火','水','火'];
    const history=await h.play(side,{self:h.unit('循環持有者',10000,[h.wait()],{type:'龍',extra:{soulMark:soul}}),selfBench:[h.unit('場下龍',100000,[h.wait()],{type:'水·龍'}),h.unit('非龍',100000,[h.wait()]),h.unit('陣亡龍',0,[h.wait()],{type:'龍',maxHp:100000})],opp:h.unit('循環攻方',100000,[...types.map(probe),h.wait()]),turns:(_e:any,t:number)=>[0,t-1]},types.length);
    const before=(i:number)=>i?history[i-1].self.currentHp:10000;
    assert.deepEqual(history.map((r:any,i:number)=>before(i)-r.self.currentHp),types.map((type,i)=>i<2||i===5?0:Math.floor(Math.floor(1000*getTypeMatchup(type,'龍'))*(i<5?0.125:0.0625))),'錯系及複合屬性擋下；錯誤兩次後三次減半，第三次錯誤後四次減半');
    const state=history.at(-1)!.state;
    const cycle=state[side+'RegistryState'].typedDamageCycles['循環持有者:scale_sequence'];
    assert.deepEqual(cycle,{index:5,reductions:4});
    const team=state[side+'Team'];
    assert.equal(team[1].maxHp,172800);assert.equal(team[1].calculatedStats.atk,518,'場下雙屬性龍六維複利、逐次取整');
    assert.equal(team[2].maxHp,100000);assert.equal(team[3].maxHp,100000,'非龍及陣亡龍不污染');
    assert.equal(history[1].self.currentHp,10000,'提升上限不偷補HP');
    const marks=state[side+'Marks'].filter((m:any)=>m.ownerBattleId==='循環持有者');
    for(const colour of ['藍色','紅色','綠色'])assert.equal(marks.find((m:any)=>m.id==='hamo_scale_'+colour)?.count,1);
    assert.equal(history[2].state[side+'RegistryState'][side+'_turnsInBattle'],0,'染色即重置本次在場回合數');
    assert.ok(!marks.some((m:any)=>m.id==='hamo_scale_無色'));
    const switched=await h.play(side,{self:h.unit('循環原持有者',10000,[h.wait()],{type:'龍',extra:{soulMark:soul}}),selfBench:[h.unit('切換替補',10000,[h.wait()])],opp:h.unit('切換攻方',100000,[probe('普通'),probe('水'),h.wait()]),turns:(_e:any,t:number)=>t===2?[{switch:1},2]:t===3?[{switch:0},1]:[0,0]},3);
    const returned=switched[2].state[side+'RegistryState'].typedDamageCycles['循環原持有者:scale_sequence'];
    assert.deepEqual(returned,{index:1,reductions:2},'再次登場重置屬性順序，保留本場減半累計');
    assert.ok(!switched[1].state[side+'Marks'].some((m:any)=>m.ownerBattleId==='循環原持有者'),'下場鱗片由個體作用域清除');
    const renamed=structuredClone(soul);renamed.name='改名循環';
    const guard=renamed.kit.find((e:any)=>e.node==='before_damage').params.clause.body[0].acts[0];
    guard.p.types=['火','水'];guard.p.ratio=0.25;guard.p.onMismatch[0].acts[0].p.type='普通';
    const [edited]=await h.play(side,{self:h.unit('改名持有者',10000,[h.wait()],{extra:{soulMark:renamed}}),opp:h.unit('改名攻方',100000,[probe('火')])});
    assert.equal(10000-edited.self.currentHp,250,'修改積木屬性順序與倍率、改名後仍照參數執行');
    const recoil=h.kitSkill('自身技能傷害測試',[{op:'dmg',p:{flat:1000,type:'技能',elem:'普通',both:true}}]);
    const [selfDamage]=await h.play(side,{self:h.unit('自身傷害持有者',10000,[recoil],{type:'龍',extra:{soulMark:soul}}),opp:h.unit('自身傷害對手',100000,[h.wait()])});
    assert.equal(selfDamage.self.currentHp,10000-Math.floor(1000*getTypeMatchup('龍','龍')),'自身造成的技能傷害按自身屬性結算，不受對手屬性循環攔截');
    assert.equal(selfDamage.self.maxHp,10000,'自身傷害不提升龍系上限');
    assert.deepEqual(selfDamage.state[side+'RegistryState'].typedDamageCycles['自身傷害持有者:scale_sequence'],{index:0,reductions:1});
    const rounds=await h.play(side,{self:h.unit('計數在場',10000,[h.wait()]),selfBench:[h.unit('計數場下甲',10000,[h.wait()]),h.unit('計數場下乙',10000,[h.wait()])],opp:h.unit('計數對手',10000,[h.wait()]),turns:(_e:any,t:number)=>t===3?[{switch:1},0]:t===4?[{switch:0},0]:[0,0]},4);
    assert.deepEqual(rounds.map((r:any)=>r.state[side+'RegistryState'][side+'_turnsInBattle']),[1,2,1,1],'每回合只增一次，不依背包數暴增；每次再登場重置');
  }
  const bad=structuredClone(soul.kit.find((e:any)=>e.node==='before_damage').params.clause);
  bad.body[0].acts[0].p.onMatch=[{acts:[{op:'unknown_handler',p:{}}]}];
  assert.ok(sequenceIssue(bad),'循環內嵌動作仍須經嚴格合約，不能包專屬處理器');
  console.log('哈莫循環積木：P1/P2原文屬性/減半/染色/六維複利/跨換人/改值與Blockly往返通過');
}finally{await h.close();}
