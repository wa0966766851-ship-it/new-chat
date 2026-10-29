import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_RESTORED_PP_SKILL_KITS as defs} from '../src/data/migratedRestoredPpSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0,reduction=0,layers=3;
const a=(op:string,p:any)=>({op,p,label:op});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const sk=()=>structuredClone(h.find('arena_14','亂武天傀'));
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {isZeroPpExempt}=await h.server.ssrLoadModule('/src/battle/ppExemptions.ts');
const reg=getBattleSkillRegistry(),old=reg['亂武天傀'];reg['亂武天傀']=()=>{calls++;throw Error('不准重播舊技能');};
h.S.S=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE){
 if(reduction)ctx.addTimerTo(ctx.actor,{id:'pp-recovery-test',name:'PP恢復減少',kind:'round_counter',source:'soul',remaining:9,tickAt:'round_end',clearable:false,payload:{ppRecoveryReductionPercent:reduction}},false);
 ctx.setMark({id:'arena.heroGlory',name:'英雄之耀',count:layers,source:'測試',ownerBattleId:ctx.self.battleId,clearable:false},ctx.actor);
}};
const extra={soulMark:{name:'測試起始',description:''}};
const trait=(acts:any[])=>({name:'起始',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'起始',trig:'entrance',parsed:true,body:[{acts}]}}}]});
try{
 let edited:any;
 await check('正式全文與圖紙、Blockly保存重載；每點40改25後保存改名',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂PP吸取',kit:s.kit.map((e:any)=>{
   const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
   assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'&&x.getFieldValue('OP')==='drain_from_last'){const p=JSON.parse(x.getFieldValue('PARAMS'));p.ratio=25;x.setFieldValue(JSON.stringify(p),'PARAMS');}
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);
   const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;
  })};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  for(const p of [{side:'self',mode:'zero',captureRestored:true},{side:'self',mode:'recover',captureRestored:'yes'},{side:'self',mode:'recover',captureRestored:true,stopIfEmpty:true}])assert.throws(()=>validateKit(h.kitSkill('壞',[a('pp_op',p)]).kit));
  for(const p of [{ratio:0,type:'固定'},{ratio:1,type:'技能'},{ratio:1,type:'腳本'}])assert.throws(()=>validateKit(h.kitSkill('壞',[a('drain_from_last',p)]).kit));
 });
 for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
  await check(`${side} 全技能含同名兩槽：按真實恢復總量、減少50%逐槽取整、100%不吸取`,async()=>{
   const run=async(pct:number,s=sk())=>{reduction=pct;return (await h.play(side,{self:h.unit('S',1000,[{...s,pp:4,maxPp:10},{...h.wait(),name:'同名',pp:0,maxPp:8},{...h.wait(),name:'同名',pp:7,maxPp:9}],{maxHp:10000,speed:200,extra}),opp:h.unit('E',100000,[h.wait()])}))[0];};
   const blocked=await run(1),normal=await run(0),half=await run(.5),custom=await run(0,edited);
   assert.deepEqual(normal.self.skills.map((s:any)=>s.pp),[10,8,9]);assert.deepEqual(half.self.skills.map((s:any)=>s.pp),[6,4,8]);assert.deepEqual(blocked.self.skills.map((s:any)=>s.pp),[3,0,7]);
   assert.equal(blocked.opp.currentHp-normal.opp.currentHp,17*40);assert.equal(normal.self.currentHp,1000+17*40);
   assert.equal(blocked.opp.currentHp-half.opp.currentHp,8*40);assert.equal(half.self.currentHp,1320);
   assert.equal(blocked.opp.currentHp-custom.opp.currentHp,17*25);assert.equal(custom.self.currentHp,1425);assert.equal(blocked.self.currentHp,1000);reduction=0;
  });
  await check(`${side} 吸取遵循正式結算量：殘血不截斷結算，禁療不回血`,async()=>{
   const skill=h.kitSkill('吸取管道',[a('pp_op',{side:'self',mode:'recover',captureRestored:true}),a('drain_from_last',{ratio:40,type:'固定'})],{pp:1,maxPp:10});
   const [r]=await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:10000}),opp:h.unit('E',30,[h.wait()])});assert.equal(r.opp.currentHp,0);assert.equal(r.self.currentHp,1400);
   const [ban]=await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()],{extra:{trait:trait([a('no_heal',{turns:3})])}})});assert.equal(ban.opp.currentHp,9600);assert.equal(ban.self.currentHp,1000);
  });
  await check(`${side} 出手時低血先快照：消回合補滿血後仍抵擋一次，不誤給威怯`,async()=>{
   const attack={...h.wait(),name:'實際攻擊',category:'物理',power:100};
   const r=await h.play(side,{self:h.unit('S',1000,[sk(),h.wait()],{maxHp:20000,speed:200}),opp:h.unit('E',10000,[h.turnEffectSkill(),attack]),turns:(_,t)=>[t===2?0:1,t===1?0:1]},3);
   assert.equal(r[1].self.currentHp,20000);assert.ok(!r[1].state[`${other}Marks`].some((m:any)=>m.id==='arena.weiyue'));
   assert.ok(r[2].self.currentHp<20000);assert.ok(!r[1].state[`${side}Timers`].some((t:any)=>t.payload?.block?.recordBlockedDamage==='next_attack_guard'));
  });
  await check(`${side} 高血威怯真正降低非真實60%，真傷不減，三回合到期`,async()=>{
   const damage=h.kitSkill('固定500',[a('dmg',{flat:500,type:'固定'})]);
   const r=await h.play(side,{self:h.unit('S',15000,[sk(),h.wait()],{maxHp:20000,speed:200}),opp:h.unit('E',10000,[damage]),turns:(_,t)=>[t===1?0:1,0]},4);
   assert.deepEqual(r.map(x=>x.self.currentHp),[14840,14640,14440,13940]);
   assert.equal(r[0].state[`${other}Marks`].find((m:any)=>m.id==='arena.weiyue').ownerBattleId,'E');
   assert.ok(!r[2].state[`${other}Marks`].some((m:any)=>m.id==='arena.weiyue'));
   const [tr]=await h.play(side,{self:h.unit('S',15000,[sk()],{maxHp:20000,speed:200}),opp:h.unit('E',10000,[h.kitSkill('真傷500',[a('dmg',{flat:500,type:'真實'})])])});assert.equal(tr.self.currentHp,14540);
  });
  await check(`${side} 威怯跟隨原持有者，替補不借且場下照常到期`,async()=>{
   const hit=h.kitSkill('固定500',[a('dmg',{flat:500,type:'固定'})]);
   const r=await h.play(side,{self:h.unit('S',15000,[sk(),h.wait()],{maxHp:20000,speed:200}),opp:h.unit('E',10000,[hit]),oppBench:[h.unit('B',10000,[hit])],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:t===4?{switch:0}:0]},5);
   assert.equal(r[2].self.currentHp-r[1].self.currentHp,-500,'替補攻擊不受原持有者減傷');
   assert.equal(r[3].opp.battleId,'E');assert.equal(r[4].self.currentHp-r[3].self.currentHp,-500,'原持有者回場後不復活過期印記');
   assert.ok(!r[2].state[`${other}Marks`].some((m:any)=>m.id==='arena.weiyue'));
  });
  await check(`${side} 同血不授予抵擋或威怯；附加封印不回復PP與吸取`,async()=>{
   for(const sealed of [false,true]){
    const [r]=await h.play(side,{self:h.unit('S',10000,[{...sk(),pp:4,maxPp:10}],{extra:{isAdditionalInvalid:sealed}}),opp:h.unit('E',10000,[h.wait()])});
    assert.equal(r.self.skills[0].pp,sealed?3:10);assert.equal(r.state[`${side}Timers`].some((t:any)=>t.payload?.block?.recordBlockedDamage==='next_attack_guard'),false);assert.equal(r.state[`${other}Marks`].some((m:any)=>m.id==='arena.weiyue'),false);
   }
  });
  await check(`${side} 三層選擇即解睡眠並可PP0出手，兩層保留睡眠且無PP豁免`,async()=>{
   for(layers of [2,3]){
    const [r]=await h.play(side,{self:h.unit('S',1000,[{...sk(),pp:0},h.wait()],{extra:{...extra,trait:trait([a('status',{side:'self',status:'睡眠',turns:3,chance:100})])}}),opp:h.unit('E',10000,[h.wait()]),turns:engine=>{const st=engine.getState();assert.equal(isZeroPpExempt(st[side],st[side].skills[0],st[other]),layers===3);return [layers===3?0:1,0];}});
    assert.equal(h.statuses(r.self).includes('睡眠'),layers===2);assert.equal(r.self.skills[0].pp>0,layers===3);
   }layers=3;
  });
 }
 assert.equal(calls,0);console.log(`亂武天傀與PP實際恢復：${checks} 項通過`);
}finally{delete h.S.S;if(old)reg['亂武天傀']=old;else delete reg['亂武天傀'];await h.close();}


