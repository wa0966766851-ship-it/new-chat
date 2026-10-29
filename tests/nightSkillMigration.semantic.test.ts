import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_NIGHT_SKILL_KITS as defs} from '../src/data/migratedNightSkillKit';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const reg=getBattleSkillRegistry(),old=reg['夜·冥昭瞢闇'];reg['夜·冥昭瞢闇']=()=>{calls++;throw Error('舊技能重播');};
const sk=()=>structuredClone(h.find('5015','夜·冥昭瞢闇'));
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const slice=(s:any,orders:number[])=>({...s,kit:s.kit.filter((e:any)=>orders.includes(e.order))});
const force=(n:number,fury=false)=>(c:any,e:any,d:any)=>{if(fury&&e===T.ON_ENTRANCE)c.applyStatusWithImmunityCheck(c.actor,'狂暴',3);if(e===T.BEFORE_DAMAGE&&d.damageComp?.damageCategory==='skill_attack'&&!d.damageComp.isIncoming){d.damageComp.outgoingLimit=n;d.damageComp.floor=n;}};
let edited:any;
try{
 await check('完整原文、Blockly往返；合計兩項25%→10%保存改名，拒絕非法合計項',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5015'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂冥昭',kit:s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'&&x.getFieldValue('OP')==='dmg_sum'){const p=JSON.parse(x.getFieldValue('PARAMS'));p.terms.forEach((t:any)=>t.ratio=.1);x.setFieldValue(JSON.stringify(p),'PARAMS');}w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  for(const terms of [[],null,[{base:'腳本',of:'self',ratio:.25}],[{base:'最大體力',of:'both',ratio:.25}],[{base:'最大體力',of:'self',ratio:-1}],[{base:'最大體力',of:'self',ratio:Infinity}],[{base:'最大體力',of:'self',ratio:.25,key:'假鍵'}]])assert.throws(()=>validateKit(h.kitSkill('壞',[{op:'dmg_sum',p:{terms,type:'百分比'}}]).kit));
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 真實傷害299/300/301的嚴格分界；狂暴只替換低傷害附加類型`,async()=>{
   for(const n of [299,300,301])for(const fury of [false,true]){
    const events:any[]=[];h.S.S=force(n,fury);h.S.E=(_:any,e:any,d:any)=>{if(e===T.ON_DAMAGED)events.push(d);};
    try{const run=async(s:any)=>(await h.play(side,{self:h.unit('S',10000,[s],{speed:200}),opp:h.unit('E',1000000,[h.wait()])}))[0];const b=await run(slice(sk(),[0,1]));assert.equal(1000000-b.opp.currentHp,n,'正式主傷害必須精確命中邊界');events.length=0;const r=await run(slice(sk(),[0,1,3]));assert.equal(h.statuses(r.opp).includes('詛咒'),n>300);if(n<300){assert.equal(b.opp.currentHp-r.opp.currentHp,2575);const extra=events.filter(d=>String(d.damageType).includes(fury?'true':'percent'));assert.equal(extra.length,1,'兩項基數必須只有一次附加傷害');}else assert.ok(!events.some(d=>/true|percent/.test(String(d.damageType))),'等於300沒有任何附加或狂暴替代傷害');
    }finally{delete h.S.S;delete h.S.E;}
   }
  });
  await check(`${side} Blockly改值保存改名後合計(300+10000)×10%=1030`,async()=>{
   h.S.S=force(100);try{const run=async(s:any)=>(await h.play(side,{self:h.unit('S',10000,[s],{speed:200}),opp:h.unit('E',1000000,[h.wait()])}))[0];const b=await run(slice(edited,[0,1])),r=await run(slice(edited,[0,1,3]));assert.equal(b.opp.currentHp-r.opp.currentHp,1030);}finally{delete h.S.S;}
  });
  await check(`${side} 合計傷害只吃一次上限；附加封印不執行`,async()=>{
   h.S.S=force(100);try{for(const mode of ['cap','sealed']){
    const act={op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'百分比',cap:200,turns:2,next:false}};
    const trait=mode==='sealed'?{}:{trait:{name:'通用傷害防護',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'測試防護',trig:'entrance',parsed:true,body:[{acts:[{...act,label:act.op}]}]}}}]}};
    if(mode==='cap')validateKit((trait as any).trait.kit);
    const [r]=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,1,3])],{speed:200,extra:{isAdditionalInvalid:mode==='sealed'}}),opp:h.unit('E',1000000,[h.wait()],{extra:trait})});assert.equal(1000000-r.opp.currentHp,100+(mode==='cap'?200:0));
   }}finally{delete h.S.S;}
  });
  await check(`${side} 消回合成功才抵擋下1次攻擊技能，次數用完恢復`,async()=>{
   for(const seeded of [false,true]){h.S.E=(c:any,e:any)=>{if(seeded&&e===T.ON_ENTRANCE)c.addTimerTo(c.actor,{id:'fixture-clear',name:'測試回合類',remaining:3,tickAt:'round_end',kind:'turn_effect',source:'skill',scope:'elf',payload:{}},false);};
    try{const atk={...h.wait(),name:'普通攻擊',category:'物理',power:30};const r=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,1,2]),h.wait()],{speed:200}),opp:h.unit('E',1000000,[atk]),turns:(_,t)=>[t===1?0:1,0]},2);assert.equal(r[0].self.currentHp===10000,seeded);assert.ok(r[1].self.currentHp<r[0].self.currentHp);}finally{delete h.S.E;}
   }
  });
  await check(`${side} 固有不微弱仍在附加封印下生效，固有封印停止`,async()=>{
   const s=slice(sk(),[0,1]);s.type='火';const run=async(skill:any,extra:any={})=>(await h.play(side,{self:h.unit('S',10000,[skill],{speed:200,extra}),opp:h.unit('E',1000000,[h.wait()],{type:'水'})}))[0];const b=await run(slice(s,[0])),r=await run(s,{isAdditionalInvalid:true}),off=await run(s,{isInherentInvalid:true});assert.ok(1000000-r.opp.currentHp>(1000000-b.opp.currentHp)*1.8);assert.ok(Math.abs(off.opp.currentHp-b.opp.currentHp)<=2);
  });
  await check(`${side} 擊敗後當回合不狂暴，下回合開始3回合狂暴，到期解除`,async()=>{
   const other=side==='p1'?'p2':'p1';h.S.S=force(1000);
   try{const r=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,1,4]),h.wait()],{speed:200}),opp:h.unit('E',100,[h.wait()]),oppBench:[h.unit('B',1000000,[h.wait()])],turns:async(e,t)=>{if(t===2){e.onSwitchElf(other,1);await e.idle();}return [t===1?0:1,0];}},4);assert.ok(!h.statuses(r[0].self).includes('狂暴'));assert.ok(h.statuses(r[1].self).includes('狂暴'));assert.ok(h.statuses(r[2].self).includes('狂暴'));assert.ok(!h.statuses(r[3].self).includes('狂暴'));}finally{delete h.S.S;}
  });
  await check(`${side} 擊敗後下場清除待啟動狂暴，替補不借且回場不重建`,async()=>{
   const other=side==='p1'?'p2':'p1';h.S.S=force(1000);
   try{const r=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,1,4]),h.wait()],{speed:200}),selfBench:[h.unit('C',10000,[h.wait()])],opp:h.unit('E',100,[h.wait()]),oppBench:[h.unit('B',1000000,[h.wait()])],turns:async(e,t)=>{if(t===2){e.onSwitchElf(other,1);await e.idle();}return [t===1?0:t===2?{switch:1}:{switch:0},0];}},3);assert.equal(r[1].self.name,'C');assert.equal(r[2].self.name,'S');for(const row of r)assert.ok(!h.statuses(row.self).includes('狂暴'));}finally{delete h.S.S;}
  });
 }
 assert.equal(calls,0);console.log(`夜冥昭遷移 ${checks} 項通過，舊技能handler0次`);
}finally{if(old)reg['夜·冥昭瞢闇']=old;else delete reg['夜·冥昭瞢闇'];await h.close();}
process.exit(0);
