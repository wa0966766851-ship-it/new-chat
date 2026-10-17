import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {OTHERWORLD_REY_TEXT} from '../src/data/otherworldReyDescriptions';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const skill=structuredClone(h.find('5029','空墟赫星'));
const part=(orders:number[])=>({...structuredClone(skill),kit:structuredClone(skill.kit.filter((e:any)=>orders.includes(e.order)))});
const check=async(n:string,f:()=>any)=>{await f();checks++;console.log('✓ '+n);};
const fixed=(c:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&d?.damageComp&&!d.damageComp.isIncoming&&d.damageComp.damageCategory==='skill_attack'){d.damageComp.floor=100;d.damageComp.outgoingLimit=100;}};
try{
 await check('完整來源、Kit單一路徑、Blockly往返與契約',()=>{
  assert.equal(skill.description,OTHERWORLD_REY_TEXT.skills['空墟赫星']);h.assertKitOnly(skill);validateKit(skill.kit);defineCustomBlocks();
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{for(const e of skill.kit){const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);w.clear();r.clear();}}finally{w.dispose();r.dispose();}
  const bad=part([4]);bad.kit[0].params.clause.body[0].acts[0].p.ratio=0;assert.throws(()=>validateKit(bad.kit));
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 附加封印、技能無效及未命中不啟動吸取/提升/威力窗口`,async()=>{
   for(const mode of ['attached','invalid','miss']){h.S.S=(c:any,e:any,d:any)=>{fixed(c,e,d);if(e===T.ON_ENTRANCE&&mode!=='miss')c.setPlayerState(mode==='attached'?'allHitEffectNullTurns':'attackSkillInvalidTurns',99);};
    try{const s=structuredClone(skill);if(mode==='miss'){s.isSureHit=false;s.accuracy=0;s.kit=s.kit.filter((e:any)=>e.order!==1);}const [r]=await h.play(side,{self:h.unit('S',1000,[s],{maxHp:10000,speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.currentHp,1000);assert.equal(r.opp.currentHp,mode==='attached'?999900:1000000);assert.equal(r.opp.statStages.atk||0,0);const opp=side==='p1'?'p2':'p1';assert.ok(!r.state[opp+'Timers'].some((t:any)=>t.payload?.block?.powerRatio));}finally{delete h.S.S;}
   }
  });
  await check(`${side} 完整技能：能力+1、本次100傷害再吸取210、兩回合攻擊無效`,async()=>{
   h.S.S=fixed;try{const r=await h.play(side,{self:h.unit('S',1000,[structuredClone(skill),h.wait()],{maxHp:10000,speed:200}),opp:h.unit('E',1000000,[{...h.wait(),category:'物理',power:100}]),turns:(_,t)=>[t===1?0:1,0]},3);
    assert.equal(r[0].self.currentHp,1210);assert.equal(r[0].opp.currentHp,999690);assert.equal(r[0].opp.statStages.atk,1);assert.equal(r[0].opp.statStages.spdef,1);assert.equal(r[1].self.currentHp,1210);assert.ok(r[2].self.currentHp<1210);
   }finally{delete h.S.S;}
  });
  await check(`${side} 有提升先後手皆三倍，無提升先手兩倍/後手原比例；不重複相加`,async()=>{
   h.S.S=fixed;try{for(const [first,selfUp,oppUp,mult] of [[true,false,false,1.4],[false,false,false,.7],[true,true,false,2.1],[false,false,true,2.1],[false,true,true,2.1]] as const){const [r]=await h.play(side,{self:h.unit('S',1000,[part([0,1,3])],{maxHp:10000,speed:200,statStages:selfUp?{atk:1}:{}}),opp:h.unit('E',1000000,[{...h.wait(),priority:first?0:6}],{statStages:oppUp?{atk:1}:{}})});assert.equal(r.self.currentHp,1000+Math.floor(100*mult));assert.equal(r.opp.currentHp,1000000-100-Math.floor(100*mult));}}finally{delete h.S.S;}
  });
  await check(`${side} 7回合真威力1/70，第8回合還原，屬性技能不受影響`,async()=>{
   const run=async(s:any,power:number)=>h.play(side,{self:h.unit('S',1000000,[s,h.wait()],{speed:200}),opp:h.unit('E',1000000,[{...h.wait(),category:'物理',power}]),turns:(_,t)=>[t===1?0:1,0]},8);
   const r=await run({...part([0,1,4]),category:'屬性',power:0},7000),small=await run(h.wait(),100),normal=await run(h.wait(),7000);
   for(let i=0;i<7;i++)assert.equal(r[i].self.currentHp,small[i].self.currentHp);
   assert.equal(r[6].self.currentHp-r[7].self.currentHp,normal[6].self.currentHp-normal[7].self.currentHp);
  });
  await check(`${side} 護盾後實際扣血30作基準，百分比免疫不借名義吸取回血`,async()=>{
   for(const immune of [false,true]){h.S.S=fixed;h.S.E=(c:any,e:any,d:any)=>{if(e===T.ON_ENTRANCE)c.applyShield(c.actor,70);if(immune&&e===T.BEFORE_DAMAGE&&d?.damageComp?.isIncoming&&d.damageComp.damageCategory==='percent')d.damageComp.multiplier=0;};
    try{const [r]=await h.play(side,{self:h.unit('S',1000,[part([0,1,3])],{maxHp:10000,speed:200,statStages:{atk:1}}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.currentHp,immune?1000:1063);assert.equal(r.opp.currentHp,immune?999970:999907);}finally{delete h.S.S;delete h.S.E;}
   }
  });
  await check(`${side} Blockly改成2回合威力一半、改名後真的執行及到期`,async()=>{
   const e=part([4]).kit[0],w=new Blockly.Workspace();let edited:any;
   try{const b=buildEntryBlock(w as any,e)!;const act=w.getAllBlocks(false).find(x=>x.type==='sequence_action')!;const p=JSON.parse(act.getFieldValue('PARAMS'));p.ratio=.5;p.turns=2;act.setFieldValue(JSON.stringify(p),'PARAMS');edited={...h.wait(),name:'改寫威力',effectMode:'kit',kit:[createKitBlockParser('skill')(b,e.node,e.order)!]};validateKit(edited.kit);}finally{w.dispose();}
   const run=async(s:any,power:number)=>h.play(side,{self:h.unit('S',1000000,[s,h.wait()],{speed:200}),opp:h.unit('E',1000000,[{...h.wait(),category:'物理',power}]),turns:(_,t)=>[t===1?0:1,0]},3);
   const r=await run(edited,7000),half=await run(h.wait(),3500),normal=await run(h.wait(),7000);
   assert.equal(r[0].self.currentHp,half[0].self.currentHp);assert.equal(r[1].self.currentHp,half[1].self.currentHp);assert.equal(r[1].self.currentHp-r[2].self.currentHp,normal[1].self.currentHp-normal[2].self.currentHp);
  });
  await check(`${side} 綁定受方：替補不借用，原持有者回場仍有比例`,async()=>{
   const run=async(s:any,power:number)=>h.play(side,{self:h.unit('S',1000000,[s,h.wait()],{speed:200}),opp:h.unit('E',1000000,[{...h.wait(),category:'物理',power}]),oppBench:[h.unit('B',1000000,[{...h.wait(),category:'物理',power:7000}])],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:t===4?{switch:0}:0]},5);
   const r=await run({...part([0,1,4]),category:'屬性',power:0},7000),base=await run(h.wait(),100);
   assert.equal(r[2].self.currentHp-r[1].self.currentHp,base[2].self.currentHp-base[1].self.currentHp);
   assert.equal(r[4].self.currentHp-r[3].self.currentHp,base[4].self.currentHp-base[3].self.currentHp);
  });
  await check(`${side} 對不同個體重複施放，各自計時不互蓋`,async()=>{
   const s={...part([0,1,4]),category:'屬性',power:0};const r=await h.play(side,{self:h.unit('S',1000000,[s,h.wait()],{speed:200}),opp:h.unit('E',1000000,[h.wait()]),oppBench:[h.unit('B',1000000,[h.wait()])],turns:(_,t)=>[t<3?0:1,t===2?{switch:1}:t===3?{switch:0}:0]},3);
   const opp=side==='p1'?'p2':'p1',timers=[...r[2].state[opp+'Timers'],...(r[2].state[opp+'ElfState']?.B?.timers||[])].filter((t:any)=>t.payload?.block?.powerRatio);
   assert.equal(timers.length,2);assert.deepEqual(timers.map((t:any)=>t.ownerBattleId).sort(),['B','E']);assert.notEqual(timers[0].id,timers[1].id);
  });
 }
 console.log(`空墟赫星 ${checks}項正式測試通過`);
}finally{await h.close();}
process.exit(0);
