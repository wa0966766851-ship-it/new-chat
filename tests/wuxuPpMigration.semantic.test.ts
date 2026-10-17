import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_WUXU_SKILL_KITS as defs} from '../src/data/migratedWuxuSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {handleWuxuSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/wuxu/registry.ts');
const reg=getBattleSkillRegistry(),old=reg['靜刃止水'];reg['靜刃止水']=()=>{calls++;throw Error('舊技能重播');};
const sk=()=>structuredClone(h.find('5022','靜刃止水'));
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const slice=(s:any,orders:number[])=>({...s,kit:s.kit.filter((e:any)=>orders.includes(e.order))});
let edited:any;
try{
 await check('完整原文與Blockly往返，PP倍率1→2、固定666→333保存改名',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5022'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);defineCustomBlocks();
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{edited={...s,name:'自訂靜刃',kit:s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const p=JSON.parse(x.getFieldValue('PARAMS')),op=x.getFieldValue('OP');if(op==='pp_priority'||op==='pp_combo_hits')p.perPp=2;if(op==='dmg')p.flat=333;x.setFieldValue(JSON.stringify(p),'PARAMS');}
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} PP6→7擊、再用PP5→6擊；附加封印仍有固有連擊，固有封印才停`,async()=>{
   for(const [s,seal,expected] of [[sk(),{},[7,6]],[sk(),{isAdditionalInvalid:true},[7,6]],[sk(),{isInherentInvalid:true},[1,1]],[edited,{},[13,11]]] as any){
    const events:any[]=[];h.S.S=(_:any,e:any,d:any)=>{if(e===T.AFTER_ATTACK_HIT)events.push(d);};
    try{const r=await h.play(side,{self:h.unit('S',10000,[s],{speed:200,extra:seal}),opp:h.unit('E',1000000,[h.wait()])},2);assert.equal(r[0].self.skills[0].pp,5);assert.equal(r[1].self.skills[0].pp,4);assert.equal(events.length,expected[0]+expected[1],JSON.stringify({seal,logs:r[1].logs}));let start=0;for(const n of expected){assert.deepEqual(events.slice(start,start+n).map(d=>d.hitIndex),Array.from({length:n},(_,i)=>i));assert.ok(events.slice(start,start+n).every(d=>d.hitCount===n));start+=n;}}
    finally{delete h.S.S;}
   }
  });
  for(const op of ['pp_priority','pp_combo_hits'])for(const v of [0,-1,1.5,'1',101])assert.throws(()=>validateKit([{...defs[0].kit[op==='pp_priority'?1:2],params:{clause:{raw:'壞參數',trig:op==='pp_priority'?'modify_priority':'before_skill',parsed:true,body:[{acts:[{op,p:{perPp:v},label:op}]}]}}}]));
  await check(`${side} 真實六刃魂印先制分支不重播Kit；PP6先制6低於敵方7，改倍率2才先手`,async()=>{
   h.S['無序·六刃']=(c:any,e:any,d:any)=>{if(e===T.MODIFY_PRIORITY)handleWuxuSoulMark(c,e,d);};
   try{for(const [s,first] of [[sk(),false],[edited,true]] as any){const [r]=await h.play(side,{self:h.unit('S',10000,[s],{speed:200,extra:{name:'無序·六刃'}}),opp:h.unit('E',1000000,[{...h.wait(),priority:7}])});const own=r.logs.findIndex((l:string)=>l.includes('【無序·六刃】使用了')),opp=r.logs.findIndex((l:string)=>l.includes('【E】使用了'));assert.ok(own>=0&&opp>=0);assert.equal(own<opp,first);assert.equal(r.state[`${side}RegistryState`]['wuxuComboPp:靜刃止水']??0,0);}}
   finally{delete h.S['無序·六刃'];}
  });
  await check(`${side} 固定傷害僅結算一次，改值與附加封印實際有效`,async()=>{
   const run=async(s:any,sealed=false)=>(await h.play(side,{self:h.unit('S',10000,[s],{speed:200,extra:{isAdditionalInvalid:sealed}}),opp:h.unit('E',1000000,[h.wait()])}))[0];
   const b=await run(slice(sk(),[0,1,2])),r=await run(sk());assert.equal(b.opp.currentHp-r.opp.currentHp,666);
   const eb=await run(slice(edited,[0,1,2])),er=await run(edited);assert.equal(eb.opp.currentHp-er.opp.currentHp,333);
   const sealed=await run(sk(),true);assert.equal(b.opp.currentHp,sealed.opp.currentHp);
  });
  await check(`${side} 同名技能按選擇槽PP2而非第一槽PP6，重排不寫持久快照`,async()=>{
   const s=sk(),second={...sk(),pp:2};const events:any[]=[];h.S.S=(_:any,e:any,d:any)=>{if(e===T.AFTER_ATTACK_HIT)events.push(d);};
   try{const [r]=await h.play(side,{self:h.unit('S',10000,[s,second],{speed:200}),opp:h.unit('E',1000000,[{...h.wait(),priority:3}]),turns:()=>[1,0]});assert.equal(events.length,3);assert.equal(r.self.skills[0].pp,6);assert.equal(r.self.skills[1].pp,1);assert.ok(r.logs.findIndex((l:string)=>l.includes('【E】使用了'))<r.logs.findIndex((l:string)=>l.includes('【S】使用了')));assert.ok(!Object.keys(r.state[`${side}RegistryState`]).some(k=>k.startsWith('ppSnapshot:')));}
   finally{delete h.S.S;}
  });
  await check(`${side} 解除成功才封印附加及雙方異常三回合；失敗不授予，到期恢復`,async()=>{
   for(const seeded of [false,true]){
    h.S.S=(c:any,e:any)=>{if(seeded&&e===T.ON_ENTRANCE)c.applyStatusWithImmunityCheck(c.actor,'流血',3);};
    try{const enemy=h.kitSkill('施加流血',[{op:'status',p:{side:'opp',status:'流血',turns:3,chance:100}}]);const r=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200}),opp:h.unit('E',1000000,[enemy]),turns:(_,t)=>[t===1?0:1,0]},4);
     assert.ok(!h.statuses(r[0].self).includes('流血'));
     for(let t=0;t<3;t++)assert.equal(h.statuses(r[t].opp).includes('流血'),!seeded,`解除${seeded}，回合${t+1}`);
     assert.ok(h.statuses(r[3].opp).includes('流血'),'三回合過後異常可附加，由仍有效反彈返還');
    }finally{delete h.S.S;}
   }
  });
  await check(`${side} 六回合反彈到期；下場不借替補且回場不復活`,async()=>{
   const enemy=h.kitSkill('施加流血',[{op:'status',p:{side:'opp',status:'流血',turns:3,chance:100}}]);
   const r=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,3]),h.wait()],{speed:200}),opp:h.unit('E',1000000,[enemy]),turns:(_,t)=>[t===1?0:1,0]},7);
   for(let i=0;i<6;i++)assert.ok(!h.statuses(r[i].self).includes('流血'),`第${i+1}回合`);assert.ok(h.statuses(r[6].self).includes('流血'));
   const sw=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,3]),h.wait()],{speed:200}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',1000000,[enemy]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:{switch:0},0]},3);
   assert.equal(sw[1].self.name,'B',sw[1].logs.join('\n'));assert.ok(h.statuses(sw[1].self).includes('流血'));assert.equal(sw[2].self.name,'S');assert.ok(h.statuses(sw[2].self).includes('流血'));
  });
 }
 assert.equal(calls,0);console.log(`靜刃止水整合 ${checks} 項通過，舊技能handler 0次`);
}finally{if(old)reg['靜刃止水']=old;else delete reg['靜刃止水'];await h.close();}
process.exit(0);
