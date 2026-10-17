import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_FAREWELL_SKILL_KITS as defs} from '../src/data/migratedFarewellSkillKit';
import source from '../src/data/elfSourceText.json';
const h=await createHarness();let checks=0;
const sk=()=>structuredClone(h.find('5008','訣別'));
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const trait=(acts:any[],node='on_entered',trig='entrance')=>({name:'測試通用效果',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',role:'innate',node,order:0,params:{clause:{raw:'測試用',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}}]});
const guard=trait([{op:'status_guard',p:{cls:''}}],'before_status_apply','before_status');
const slice=(s:any,orders:number[])=>({...s,kit:s.kit.filter((e:any)=>orders.includes(e.order))});
let edited:any;
try{
 await check('訣別完整來源與Kit，Blockly改固定吸取150→75、正先制2→1回合保存改名',()=>{
  const s=sk();h.assertKitOnly(s);assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5008'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{edited={...s,name:'自訂訣別',kit:s.kit.map((e:any)=>{
   const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'){const p=JSON.parse(x.getFieldValue('PARAMS')),op=x.getFieldValue('OP');if(op==='drain')p.flat=75;if(op==='no_pos_prio_turns')p.turns=1;x.setFieldValue(JSON.stringify(p),'PARAMS');}
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;
  })};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  for(const p of [{perStatusTurns:'team'},{ratio:.2},{perMark:{id:'x',side:'self'}},{flat:-1}])assert.throws(()=>validateKit(h.kitSkill('壞',[{op:'drain',p:{flat:150,perStatusTurns:'both',...p}}]).kit));
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 雙倍吸取並把本次提升鏡像成下降，成功不清PP；無提升則兩個不同槽歸零`,async()=>{
   for(const boosted of [false,true]){
    const s=slice(sk(),[0,1,2]);const [r]=await h.play(side,{self:h.unit('S',10000,[s],{speed:200}),opp:h.unit('E',1000000,[h.wait(),{...h.wait(),name:'二'},{...h.wait(),name:'三'},{...h.wait(),name:'四'}],{statStages:boosted?{atk:2,def:-1}:{}})});
    assert.equal(r.self.statStages.atk||0,boosted?4:0);assert.equal(r.opp.statStages.atk||0,boosted?-4:0);assert.equal(r.opp.skills.filter((s:any)=>s.pp===0).length,boosted?0:2);if(boosted)assert.equal(r.opp.statStages.def,-1);
   }
  });
  await check(`${side} 鏡像被免弱拒絕時走PP備援，沒有成功弱化不冒稱成功`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',10000,[slice(sk(),[0,2])],{speed:200,statStages:{atk:2}}),opp:h.unit('E',1000000,[h.wait(),{...h.wait(),name:'二'},{...h.wait(),name:'三'}],{extra:{trait:trait([{op:'immune_statdown_turns',p:{turns:2}}])}})});
   assert.equal(r.opp.statStages.atk||0,0);assert.equal(r.opp.skills.filter((s:any)=>s.pp===0).length,2);
  });
  await check(`${side} 任一技能PP<2才把35%威力增量加倍，等於2不加倍`,async()=>{
   for(const pp of [1,2]){
    const s=slice(sk(),[0,3]),control=slice(sk(),[0]);control.power=s.power*(pp===1?1.7:1.35);
    const run=async(skill:any)=>(await h.play(side,{self:h.unit('S',10000,[skill],{speed:200}),opp:h.unit('E',1000000,[h.wait(),{...h.wait(),name:'低PP槽',pp,currentPp:pp===1?5:1}])}))[0];
    const b=await run(control),r=await run(s);assert.ok(Math.abs(b.opp.currentHp-r.opp.currentHp)<=2,`${pp}: ${b.opp.currentHp} / ${r.opp.currentHp}`);
   }
  });
  await check(`${side} 施加後雙方異常回合真實加總、每回合150；Blockly改75後實際減半`,async()=>{
   const base=sk();base.kit=base.kit.map((e:any)=>e.order!==4?e:{...e,params:{clause:{...e.params.clause,body:[e.params.clause.body[0]]}}});
   const run=async(s:any)=>(await h.play(side,{self:h.unit('S',500000,[s],{maxHp:1000000,speed:200}),opp:h.unit('E',1000000,[h.wait()])}))[0];
   const b=await run(base),r=await run(sk()),e=await run(edited);
   assert.equal(b.opp.currentHp-r.opp.currentHp,1800);assert.equal(b.opp.currentHp-e.opp.currentHp,900);assert.equal(r.self.currentHp-b.self.currentHp,1800);assert.equal(e.self.currentHp-b.self.currentHp,900);
   assert.ok(h.statuses(r.self).includes('混亂'));assert.ok(h.statuses(r.opp).includes('流血'));
  });
  await check(`${side} 全部異常失敗不吸取，僅一方成功也按實際存在回合計量`,async()=>{
   const base=sk();base.kit=base.kit.map((e:any)=>e.order!==4?e:{...e,params:{clause:{...e.params.clause,body:[e.params.clause.body[0]]}}});
   for(const both of [false,true]){
    const run=async(s:any)=>(await h.play(side,{self:h.unit('S',500000,[s],{maxHp:1000000,speed:200,extra:both?{trait:guard}:{}}),opp:h.unit('E',1000000,[h.wait()],{extra:{trait:guard}})}))[0];
    const b=await run(base),r=await run(sk());assert.equal(b.opp.currentHp-r.opp.currentHp,both?0:900);assert.equal(r.self.currentHp-b.self.currentHp,both?0:900);
   }
  });
  await check(`${side} 吸取成功後下兩回合正先制失效、當回合不提前；到期恢復，改1回合可編輯`,async()=>{
   for(const [s,n] of [[sk(),2],[edited,1]] as any)for(const dynamic of [false,true]){
    const attack={...h.wait(),name:'自身普通攻擊',category:'物理',power:20};
    const enemy=dynamic?{...h.kitSkill('對手動態先制',[{op:'pp_priority',p:{perPp:1}}]),kit:[{codeId:'effect_sequence',source:'skill',role:'innate',node:'modify_priority',order:0,params:{clause:{raw:'動態先制',trig:'modify_priority',parsed:true,body:[{acts:[{op:'pp_priority',p:{perPp:1},label:'pp_priority'}]}]}}}]}:{...h.wait(),name:'對手先制1',priority:1};
    const r=await h.play(side,{self:h.unit('S',10000,[slice(s,[0,1]),attack],{speed:200}),opp:h.unit('E',1000000,[enemy],{speed:10,statStages:{atk:1}}),turns:(_,t)=>[t===1?0:1,0]},4);
    for(let t=0;t<4;t++){const logs=r[t].logs.slice(t?r[t-1].logs.length:0);const own=logs.findIndex((l:string)=>l.includes('【S】使用了')),opp=logs.findIndex((l:string)=>l.includes('【E】使用了'));assert.ok(own>=0&&opp>=0);assert.equal(own<opp,t>0&&t<=n,`回合${t+1}，n=${n}`);}
   }
  });
 }
 console.log(`訣別遷移 ${checks} 項通過`);
}finally{await h.close();}
process.exit(0);
