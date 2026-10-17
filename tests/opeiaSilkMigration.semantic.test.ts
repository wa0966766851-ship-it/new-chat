import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_OPEIA_SKILL_KITS as defs} from '../src/data/migratedOpeiaSkillKits';
import source from '../src/data/elfSourceText.json';
const h=await createHarness();let checks=0,calls=0;
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {handleOpeiaSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/opeia/registry.ts');
const reg=getBattleSkillRegistry(),old=reg['毒噬魂絲'];reg['毒噬魂絲']=()=>{calls++;};
const sk=()=>structuredClone(h.find('5018','毒噬魂絲'));
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const trait={name:'起始無效一次',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'測試用無效一次',trig:'entrance',parsed:true,body:[{acts:[{op:'invalid_next',p:{kind:'all',uses:1},label:'無效一次'}]}]}}}]};
const attack={...h.wait(),name:'測量飛行攻擊',type:'飛行',category:'物理',power:100};
let edited:any;
try{
 await check('GLM毒噬魂絲完整來源精確匹配、Blockly全圖往返，改吸取1/4、失效回復1/4與視圖三次',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5018'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂毒絲',kit:s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const p=JSON.parse(x.getFieldValue('PARAMS')),op=x.getFieldValue('OP');if(op==='drain'||op==='heal')p.ratio=.25;if(op==='attack_type_view_uses')p.uses=3;x.setFieldValue(JSON.stringify(p),'PARAMS');}
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 使用前強化快照：吸取成功只沉默，不因清零再弱化；原先無提升才弱化`,async()=>{
   for(const boosted of [false,true]){
    const [r]=await h.play(side,{self:h.unit('S',10000,[sk()],{maxHp:100000,speed:200}),opp:h.unit('E',1000000,[h.wait()],{statStages:boosted?{atk:2}:undefined})});
    assert.equal(r.self.statStages.atk||0,boosted?2:0);assert.equal(r.opp.statStages.atk,boosted?0:-1);assert.equal(r.opp.statStages.def||0,boosted?0:-1);assert.equal(h.statuses(r.opp).includes('沉默'),boosted);
   }
  });
  await check(`${side} 體力恰半不翻倍，高於半才翻倍；Blockly改比例的實扣與實際回復`,async()=>{
   for(const [s,ratio] of [[sk(),1/3],[edited,.25]] as any){for(const hp of [500000,500001,900000]){
    const control={...structuredClone(s),kit:s.kit.filter((e:any)=>e.order!==5)};
    const run=async(skill:any)=>(await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:1000000,speed:200}),opp:h.unit('E',hp,[h.wait()],{maxHp:1000000})}))[0];
    const b=await run(control),r=await run(s),lost=Math.min(b.opp.currentHp,Math.floor(1000000*ratio*(hp>500000?2:1)));
    assert.equal(b.opp.currentHp-r.opp.currentHp,lost,`${hp}/${ratio}`);
    // 專案既定吸取契約以結算傷害恢復，不以殘血限縮恢復基數（hpDrain.ts）。
    assert.equal(r.self.currentHp,1000+Math.floor(1000000*ratio*(hp>500000?2:1)));
   }}
  });
  await check(`${side} 對手強化作下降的傷害視圖，不改真實等級；附加封印仍讀固有但不吸取`,async()=>{
   const s=sk();s.kit=s.kit.filter((e:any)=>e.order<=2);const control=structuredClone(s);control.kit=control.kit.filter((e:any)=>e.order!==2);
   const run=async(skill:any,def:number)=>(await h.play(side,{self:h.unit('S',10000,[skill],{speed:200,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',1000000,[h.wait()],{statStages:{def,spdef:def}})}))[0];
   const viewed=await run(s,2),down=await run(control,-2);assert.equal(viewed.opp.currentHp,down.opp.currentHp);assert.equal(viewed.opp.statStages.def,2);assert.equal(viewed.self.statStages.def||0,0);
   const [sealed]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:10000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',1000000,[h.wait()],{statStages:{atk:2}})});assert.equal(sealed.self.currentHp,1000);assert.equal(sealed.opp.statStages.atk,2);assert.ok(!h.statuses(sealed.opp).includes('沉默'));
  });
  await check(`${side} 無效回復與視圖只執行一次，真實舊魂印不重播；等待不耗、到次數後復原`,async()=>{
   h.S.S=(c:any,e:any,d:any)=>{if(e===T.SKILL_INVALID)handleOpeiaSoulMark(c,e,d);};
   try{for(const [s,n,gain] of [[sk(),2,5000],[edited,3,2500]] as any){
    const run=async(withView:boolean)=>{const skill=structuredClone(s);if(!withView)skill.kit.find((e:any)=>e.order===6).params.clause.body[0].acts=skill.kit.find((e:any)=>e.order===6).params.clause.body[0].acts.filter((a:any)=>a.op!=='attack_type_view_uses');
     return h.play(side,{self:h.unit('S',1000,[skill,h.wait(),attack],{maxHp:10000,type:'無屬性'}),opp:h.unit('E',1000000,[h.wait()],{extra:{trait}}),turns:(_,t)=>[t===1?0:t===2?1:2,0]},n+3);};
    const r=await run(true),base=await run(false);assert.equal(r[0].self.currentHp,1000+gain,'失效回血不能由魂印再執行一次');assert.equal(r[0].state[`${side}RegistryState`].opeiaTreatInsectAttacks||0,0,'舊專屬次數不能重新建立');assert.equal(r[1].state[`${side}RegistryState`].attackTypeOverrideUses,n);
    for(let i=2;i<n+2;i++){const actual=r[i-1].opp.currentHp-r[i].opp.currentHp,normal=base[i-1].opp.currentHp-base[i].opp.currentHp;assert.ok(Math.abs(actual-2*normal)<=2,`${normal}→${actual}`);}assert.equal(r[n+1].state[`${side}RegistryState`].attackTypeOverrideUses,0);
    assert.equal(r[n+1].opp.currentHp-r[n+2].opp.currentHp,base[n+1].opp.currentHp-base[n+2].opp.currentHp);assert.equal(r[n+2].opp.type,'普通');
   }
    const [sealed]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:10000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',1000000,[h.wait()],{extra:{trait}})});
    assert.equal(sealed.self.currentHp,1000);assert.ok(!sealed.state[`${side}RegistryState`].attackTypeOverrideUses);
    const switched=await h.play(side,{self:h.unit('S',1000,[sk(),h.wait(),attack],{maxHp:10000}),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',1000000,[h.wait()],{extra:{trait}}),turns:(_,t)=>[t===1?0:t===2?{switch:1}:t===3?{switch:0}:2,0]},4);
    assert.equal(switched[1].self.id,'B');assert.ok(!switched[1].state[`${side}RegistryState`].attackTypeOverrideUses);assert.equal(switched[3].self.id,'S');assert.ok(!switched[3].state[`${side}RegistryState`].attackTypeOverrideUses);
   }finally{delete h.S.S;}
  });
 }
 assert.equal(calls,0);console.log(`毒噬魂絲整合 ${checks} 項通過`);
}finally{if(old)reg['毒噬魂絲']=old;else delete reg['毒噬魂絲'];delete h.S.S;await h.close();}
process.exit(0);
