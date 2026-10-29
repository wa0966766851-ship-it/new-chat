import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
import {MIGRATED_STAGE_KIND_SOUL_KIT as definition} from '../src/data/migratedStageKindSoulKit';
import {validateKit} from '../src/effects/kitValidation';
const h=await createHarness();let checks=0,calls=0;
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {readStageKinds}=await h.server.ssrLoadModule('/src/effects/stageQueries.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const source=DEFAULT_ELVES.find((x:any)=>x.id==='5003').soulMark;
const soul=()=>structuredClone(source);
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const keys=['atk','def','spatk','spdef','speed','accuracy'];
let edited:any;
try{
 await check('完整原文對齊；淨整份Kit，種類不當級數，僅計六項有限數',()=>{
  assert.equal(source.description,definition.description);assert.equal(source.effectMode,'kit');assert.deepEqual(source.kit,definition.kit);validateKit(source.kit);
  assert.equal(readStageKinds({self:{statStages:{}},target:{statStages:{atk:-6,def:-1,spatk:NaN,spdef:2,hp:-1,extra:-1}}},{side:'opp',kind:'down'}),2);
  for(const q of [null,{side:'both',kind:'down',amount:1},{side:'opp',kind:'down',amount:0},{side:'opp',kind:'down',amount:Infinity},{side:'opp',kind:'down',amount:1,body:[]}]){
   const c=structuredClone(definition.kit[4].params.clause);c.body[0].acts[0].p.perStageKinds=q;assert.ok(sequenceIssue(c,'cthyaat_death'));
  }
  const c=structuredClone(definition.kit[4].params.clause);c.body[0].acts[1].p.perStageKinds.amount=.5;assert.ok(sequenceIssue(c,'cthyaat_death'));
 });
 await check('Blockly整份往返；改每種上限5%與禁療+2，保存重載並改名',()=>{
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...soul(),name:'自訂種類魂印',kit:source.kit.map((e:any)=>{
   const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
   assert.deepEqual(createKitBlockParser('soulmark')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const a of r.getAllBlocks(false))if(a.type==='sequence_action'){
    const p=JSON.parse(a.getFieldValue('PARAMS'));if(p.perStageKinds)p.perStageKinds.amount=a.getFieldValue('OP')==='maxhp'?.05:2;a.setFieldValue(JSON.stringify(p),'PARAMS');
   }
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('soulmark')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;
  })};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
 });
 for(const side of ['p1','p2'] as const){
  h.S.S=()=>{calls++;};
  await check(`${side} 嚴格半血上下界攻擊減傷，恰半血不減傷`,async()=>{
   const attack={...h.wait(),name:'受測攻擊',category:'物理',power:100};
   for(const [hp,mult] of [[8000,.75],[5000,1],[4000,.5]]){
    const run=async(mark:any)=>(await h.play(side,{self:h.unit('S',hp,[h.wait()],{maxHp:10000,extra:{soulMark:mark,...(!mark?{name:'Control'}:{})}}),opp:h.unit('E',10000,[attack],{speed:200})}))[0];
    const b=await run(undefined),r=await run(soul());assert.ok(Math.abs((hp-r.self.currentHp)-(hp-b.self.currentHp)*mult)<=2,`${hp}: ${hp-b.self.currentHp} → ${hp-r.self.currentHp}`);
   }
  });
  await check(`${side} 受攻擊只清提升保留下降，屬性固定傷害不清提升／減傷`,async()=>{
   const attack={...h.wait(),name:'攻擊清強化',category:'物理',power:20};
   const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul()}}),opp:h.unit('E',10000,[attack],{statStages:{atk:2,def:-2},speed:200})});
   assert.equal(r.opp.statStages.atk,0);assert.equal(r.opp.statStages.def,-2);
   for(const type of ['固定','百分比','真實']){
    const skill=h.kitSkill('非攻擊附傷',[{op:'dmg',p:{flat:100,type}}]);
    const [n]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul()}}),opp:h.unit('E',10000,[skill],{statStages:{atk:2},speed:200})});
    assert.equal(n.self.currentHp,9900,type);assert.equal(n.opp.statStages.atk,2,type);
   }
  });
  await check(`${side} 僅回合末低於1/4恢復1/3並降全屬性，不在行動末重播`,async()=>{
   for(const hp of [2400,2500]){
    const [r]=await h.play(side,{self:h.unit('S',hp,[h.wait()],{maxHp:10000,extra:{soulMark:soul()}}),opp:h.unit('E',10000,[h.wait()])});
    assert.equal(r.self.currentHp,hp+(hp<2500?3333:0));for(const k of keys)assert.equal(r.opp.statStages[k]||0,hp<2500?-1:0);
   }
  });
  await check(`${side} 正式死亡種類加量一次以原上限計算，0／2／4／6種；場下不受影響`,async()=>{
   h.S.E=(ctx:any,ev:any)=>{if(ev===T.AFTER_ACTION)ctx.applyTrueDamage(ctx.targetSide,20000,'測試正式死亡');};
   try{for(const count of [0,2,4,6]){
    const stages=Object.fromEntries(keys.slice(0,count).map(k=>[k,-6]));
    const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{speed:50,extra:{soulMark:soul()}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()],{statStages:stages,speed:200}),oppBench:[h.unit('EB',10000,[h.wait()])]});
    assert.equal(r.opp.maxHp,[6000,4000,2000,1][[0,2,4,6].indexOf(count)],r.logs.join('\n'));assert.equal(r.opp.currentHp,r.opp.maxHp);assert.equal(r.opp.calculatedStats.hp,r.opp.maxHp);
    const other=side==='p1'?'p2':'p1';assert.equal(r.state[`${other}Team`][1].maxHp,10000);assert.equal(r.self.currentHp,0);
   }}finally{delete h.S.E;}
  });
  await check(`${side} 未死亡不預扣；改名重載每種5%減上限、禁療+2真正讀取`,async()=>{
   const [live]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:edited}}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:-6,def:-2}})});assert.equal(live.opp.maxHp,10000);
   h.S.E=(ctx:any,ev:any)=>{if(ev===T.ROUND_END)ctx.applyTrueDamage(ctx.targetSide,20000,'測試回合末死亡');};
   try{const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:edited}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',10000,[h.wait()],{statStages:{atk:-6,def:-2}})});
    assert.equal(r.opp.maxHp,5000);const other=side==='p1'?'p2':'p1';const timers=r.state[`${other}Timers`];assert.ok(timers.some((t:any)=>t.remaining===6),JSON.stringify(timers));
   }finally{delete h.S.E;}
  });
  await check(`${side} 陣亡者下場後禁療真正阻止回血並逐回合到期，改值延長期限`,async()=>{
   for(const [mark,count,duration] of [[soul(),0,2],[soul(),2,4],[edited,2,6]] as const){
    let killed=false;h.S.E=(ctx:any,ev:any)=>{if(ev===T.AFTER_ACTION&&!killed){killed=true;ctx.applyTrueDamage(ctx.targetSide,20000,'一次正式死亡');}};
    try{const r=await h.play(side,{self:h.unit('S',10000,[h.wait()],{speed:50,extra:{soulMark:mark}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',2000,[h.healSkill(100)],{maxHp:10000,speed:200,statStages:Object.fromEntries(keys.slice(0,count).map(k=>[k,-6]))}),turns:async(engine,t)=>{
     if(t===2){engine.onSwitchElf(side,1);await engine.idle();}return [0,0];
    }},duration+1);
     assert.equal(r[0].opp.currentHp,2100);for(let t=1;t<duration;t++)assert.equal(r[t].opp.currentHp,2100,`禁療第${t+1}回合`);
     assert.equal(r[duration].opp.currentHp,2200,'到期當回合可恢復');assert.equal(r[duration].self.id,'B');
    }finally{delete h.S.E;}
   }
  });
  await check(`${side} 禁療只屬對手當前個體，替補不借用；一般對戰不觸發命運PP攔截`,async()=>{
   let killed=false;h.S.E=(ctx:any,ev:any)=>{if(ev===T.AFTER_ACTION&&!killed){killed=true;ctx.applyTrueDamage(ctx.targetSide,20000,'一次正式死亡');}};
   const other=side==='p1'?'p2':'p1';
   try{const r=await h.play(side,{self:h.unit('S',10000,[h.wait()],{speed:50,extra:{soulMark:soul()}}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',2000,[h.healSkill(100)],{maxHp:10000,speed:200,statStages:{atk:-6,def:-2}}),oppBench:[h.unit('EB',2000,[h.healSkill(100)],{maxHp:10000})],turns:async(engine,t)=>{
    if(t===2){engine.onSwitchElf(side,1);await engine.idle();return [0,{switch:1}];}return [0,0];
   }},3);assert.equal(r[2].opp.id,'EB');assert.equal(r[2].opp.currentHp,2100);assert.equal(r[2].opp.maxHp,10000);assert.ok(!r[2].state[`${other}Timers`].some((t:any)=>t.ownerBattleId==='EB'&&t.payload?.block?.healGuard));
   }finally{delete h.S.E;}
   const [normal]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:soul()}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(normal.opp.skills[0].pp,98);assert.equal(normal.opp.skills[0].maxPp,99);
  });
 }
 assert.equal(calls,0,'Kit魂印不可再執行舊同名handler');console.log(`種類魂印遷移 ${checks} 項通過`);
}finally{delete h.S.S;delete h.S.E;await h.close();}
process.exit(0);
