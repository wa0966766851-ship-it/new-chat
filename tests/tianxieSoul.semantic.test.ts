import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
const h=await createHarness();
try{
 const {TIANXIE_SOUL_KIT:kit}=await h.server.ssrLoadModule('/src/data/tianxieSoulKit.ts');
 const {tianxieMark,TIANXIE_MARK_ID}=await h.server.ssrLoadModule('/src/data/tianxieMark.ts');
 const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 defineCustomBlocks();
 for(const entry of kit){assert.equal(sequenceIssue(entry.params.clause,entry.node),null,entry.customText);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>createKitBlockParser(entry.source)(b,entry.node,entry.order)),[entry]);}finally{w.dispose();r.dispose();}}
 const soul=(orders:number[],transform=(entries:any[])=>entries)=>({name:'測試魂印',description:'正式魂印選定條款',effectMode:'kit',kit:transform(structuredClone(kit.filter((e:any)=>orders.includes(e.order))))});
 const attack={...h.wait(),name:'主攻擊',category:'物理',power:400,type:'普通'};
 for(const side of ['p1','p2'] as const){
  const enemy=side==='p1'?'p2':'p1';
  const [baseline]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000}),opp:h.unit('E',100000,[attack])});
  const damage=1000-baseline.self.currentHp;assert.ok(damage>150);
  const [convert]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{soulMark:soul([7],es=>[es[0]])}}),opp:h.unit('E',100000,[attack]),turns:(engine:any)=>{engine.getState()[side+'RegistryState'].conversionGuaranteedTurns=2;return [0,0];}});
  assert.equal(convert.self.currentHp,1000+damage,'完整技能傷害轉為體力');
  assert.equal(100000-convert.opp.currentHp,Math.floor(damage*1.5),'成功按轉化量150%真傷');
  assert.equal(convert.state[enemy+'Marks'].find((m:any)=>m.id===TIANXIE_MARK_ID)?.count,1);
  const failure=soul([7],es=>{const entry=es[2];entry.params.clause.body=[{acts:entry.params.clause.body[0].elseActs}];return [entry];});
  const [reduced]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,extra:{soulMark:failure}}),opp:h.unit('E',100000,[attack])});
  assert.equal(100000-reduced.opp.currentHp,Math.floor((damage-Math.floor(damage*.5))*1.5),'失敗按本次減少量吸取150%');
  assert.equal(reduced.self.currentHp,1000-Math.floor(damage*.5)+Math.floor((damage-Math.floor(damage*.5))*1.5));
  const [bench]=await h.play(side,{self:h.unit('S',10000,[h.wait()]),selfBench:[h.unit('B',1000,[h.wait()],{extra:{soulMark:soul([4])}})],opp:h.unit('E',100000,[attack])});
  assert.equal(10000-bench.self.currentHp,Math.floor(damage*.5),'場下援護減半隊友傷害');
  assert.equal(bench.state[side+'Team'][1].currentHp,900,'100真傷只扣場下持有者');
  assert.equal(bench.state[enemy+'Marks'].find((m:any)=>m.id===TIANXIE_MARK_ID)?.count,1);
  const [boost]=await h.play(side,{self:h.unit('S',100000,[attack],{extra:{soulMark:soul([0,10,11,12])}}),opp:h.unit('E',100000,[h.wait()])});
  const [plain]=await h.play(side,{self:h.unit('S',100000,[attack]),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(100000-boost.opp.currentHp,Math.floor((100000-plain.opp.currentHp)*3),'100%與額外50%依既有不同增傷來源相乘');
  assert.equal(boost.state[side+'RegistryState'].actionPriorityThisTurn,2);
  const grant=h.kitSkill('加入緝令',[tianxieMark()]);
  const rows=await h.play(side,{self:h.unit('S',10000,[grant,h.wait()],{extra:{soulMark:soul([15])}}),opp:h.unit('E',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.equal(rows[1].opp.type,'龍','持有緝令者非龍則轉龍');
  assert.equal(rows[1].state[enemy+'Marks'].find((m:any)=>m.id===TIANXIE_MARK_ID)?.count??0,0);
  for(const amount of [150,151]){
   const hit=h.kitSkill('指定技能傷害',[{op:'dmg',p:{flat:amount,type:'技能',elem:'普通'}}]);
   const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()]),selfBench:[h.unit('B',1000,[h.wait()],{extra:{soulMark:soul([4])}})],opp:h.unit('E',100000,[hit])});
   assert.equal(10000-r.self.currentHp,amount===150?150:75,'嚴格大於150才援護');
   assert.equal(r.state[side+'Team'][1].currentHp,amount===150?1000:900);
  }
  const cycle=soul([7,8],es=>{es[2].params.clause.body=[{acts:es[2].params.clause.body[0].elseActs}];return es;});
  const cycles=await h.play(side,{self:h.unit('S',10000,[h.wait()],{maxHp:100000,extra:{soulMark:cycle}}),opp:h.unit('E',100000,[attack])},4);
  assert.equal(cycles[0].state[side+'RegistryState'].conversionGuaranteedTurns,2,'未轉化的回合結束準備下兩回合');
  assert.equal(cycles[1].state[side+'RegistryState'].conversionGuaranteedTurns,1,'成功轉化不刷新期限');
  assert.equal(cycles[2].state[side+'RegistryState'].conversionGuaranteedTurns,0);
  assert.equal(cycles[3].state[side+'RegistryState'].conversionGuaranteedTurns,2,'保證期限結束後恢復機率分支');
  const [invalidAid]=await h.play(side,{self:h.unit('S',10000,[h.wait()]),selfBench:[h.unit('B',1000,[h.wait()],{extra:{soulMark:soul([5])}})],opp:h.unit('E',100000,[h.wait()]),turns:(engine:any)=>{engine.getState()[side+'RegistryState'].utilitySkillInvalidTurns=1;return [0,0];}});
  assert.equal(invalidAid.state[side+'Team'][1].currentHp,900,'隊友技能無效仍援護');
  const [roundAid]=await h.play(side,{self:h.unit('S',10000,[h.wait()]),selfBench:[h.unit('B',1000,[h.wait()],{extra:{soulMark:soul([6])}})],opp:h.unit('E',100000,[h.wait()],{type:'龍'})});
  assert.equal(roundAid.state[side+'Team'][1].currentHp,900,'場下回合開始檢查龍系');
  h.S.E=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)ctx.setPlayerState('immuneStatusTurns',99);};
  try{
   const temp=await h.play(side,{self:h.unit('S',1000,[h.wait()],{extra:{soulMark:soul([14])}}),selfBench:[h.unit('B',1000,[h.wait()])],opp:h.unit('E',100000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:{switch:1},0]},2);
   assert.equal(temp[0].self.maxHp,1200,'詛咒未觸發雙方平靜並暫時增加20%上限');
   assert.ok(h.statuses(temp[0].self).includes('平靜'));
   assert.equal(temp[1].state[side+'Team'][0].maxHp,1000,'離場撤銷臨時上限');
  }finally{delete h.S.E;}
  const noDamage=soul([0,13]);
  const [zero]=await h.play(side,{self:h.unit('S',1000,[h.wait()],{extra:{soulMark:noDamage}}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(zero.state[enemy+'Marks'].find((m:any)=>m.id===TIANXIE_MARK_ID)?.count,1);
  const extra=h.kitSkill('附加技能傷害',[{op:'dmg',p:{flat:200,type:'技能',elem:'普通'}}]);
  const [hasDamage]=await h.play(side,{self:h.unit('S',1000,[extra],{extra:{soulMark:noDamage}}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(hasDamage.state[enemy+'Marks'].some((m:any)=>m.id===TIANXIE_MARK_ID),false,'附加技能傷害也算本次已造成技能傷害');
  for(const type of ['普通','龍']){
   const start=await h.play(side,{self:h.unit('S',1000,[h.wait()],{maxHp:10000,type,extra:{soulMark:soul([1,2,3])}}),opp:h.unit('E',100000,[h.wait()],{type:'龍'})},2);
   assert.equal(start[0].self.currentHp,9900,'回合開始滿血後只扣平靜1%');
   assert.equal(start[1].self.currentHp,type==='龍'?9900:9800,'雙龍先重置在場回合再檢查；單龍第二回合不滿血');
  }
  const dragonRows=await h.play(side,{self:h.unit('S',10000,[grant,h.wait()],{extra:{soulMark:soul([15])}}),opp:h.unit('E',100000,[h.wait()],{type:'龍'}),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
  assert.ok(dragonRows[1].logs.some((l:string)=>l.includes('無效')),'已有龍系則改為下次技能無效');
  const {authoredEntry:e,operation:a,actions:act}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
  const reducer={name:'百分比減免',effectMode:'kit',kit:[e('受到技能傷害減少80%','incoming_skill',[act(a('dmg_mod',{dir:'in',kind:'技能',reduce:.8}))],0,'soulmark',true)]};
  const [ignore]=await h.play(side,{self:h.unit('S',100000,[attack],{extra:{soulMark:soul([9])}}),opp:h.unit('E',100000,[h.wait()],{extra:{soulMark:reducer}})});
  assert.equal(100000-ignore.opp.currentHp,100000-plain.opp.currentHp,'無視百分比減免保留完整技能傷害');
 }
 console.log('tianxieSoul passed: strict contracts/Blockly and P1/P2 conversion, reduced-amount drain, bench owner settlement, HP snapshot boost/priority and warrant conversion');
}finally{await h.close();}
