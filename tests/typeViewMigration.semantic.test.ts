import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_TYPE_VIEW_SKILL_KITS as defs} from '../src/data/migratedTypeViewSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const a=(op:string,p:any)=>({op,p,label:op});
const sk=()=>structuredClone(h.find('5014','暮光舞動'));
const trait=(acts:any[])=>({name:'通用起始效果',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,
 params:{clause:{raw:'起始效果',trig:'entrance',parsed:true,body:[{acts}]}}}]});
const view={uses:2,attackType:'光',targetType:'暗影'};
const attack={...h.wait(),name:'測量攻擊',category:'物理',power:100,type:'普通'};
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const registry=getBattleSkillRegistry(),old=registry['暮光舞動'];registry['暮光舞動']=()=>{calls++;throw Error('不准重播暮光舞動handler');};
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {handleScarlettSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/scarlett/registry.ts');
try{
 let edited:any;
 await check('六句正式來源、封裝與Blockly保存重載；改視圖次數3並保存',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5014'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂暮光',kit:s.kit.map((e:any)=>{
    const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
    for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'&&x.getFieldValue('OP')==='attack_type_view_uses'){
      const p=JSON.parse(x.getFieldValue('PARAMS'));p.uses=3;p.attackType='火';p.targetType='草';x.setFieldValue(JSON.stringify(p),'PARAMS');
    }
    w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);
    const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;
  })};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
 });
 await check('次數／未知屬性／額外鍵與不支援的永久屬性轉換拒絕',()=>{
  for(const p of [{uses:0},{uses:1.2},{uses:NaN},{attackType:'未知'},{targetType:''},{handler:'custom'}])assert.throws(()=>validateKit(h.kitSkill('壞',[a('attack_type_view_uses',{...view,...p})]).kit));
  for(const p of [{side:'both'},{untilSwitch:false},{type:'腳本'}])assert.throws(()=>validateKit(h.kitSkill('壞',[a('change_type',{side:'opp',type:'暗影',untilSwitch:true,...p})]).kit));
 });
 for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
  await check(`${side} 通用視圖真正改兩次攻擊克制，屬性等待不消耗，期滿復原且不改實際屬性`,async()=>{
   const play=(grant:boolean)=>h.play(side,{self:h.unit('S',10000,[h.wait(),attack],{type:'無屬性',extra:grant?{trait:trait([a('attack_type_view_uses',view)])}:{}}),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);
   const base=await play(false),r=await play(true);
   assert.equal(r[0].state[`${side}RegistryState`].attackTypeOverrideUses,2);
   for(const i of [1,2]){const normal=base[i-1].opp.currentHp-base[i].opp.currentHp,changed=r[i-1].opp.currentHp-r[i].opp.currentHp;assert.ok(Math.abs(changed-2*normal)<=1,`${normal}→${changed}`);}
   assert.equal(r[2].state[`${side}RegistryState`].attackTypeOverrideUses,0);
   assert.equal(r[2].opp.currentHp-r[3].opp.currentHp,base[2].opp.currentHp-base[3].opp.currentHp);
   assert.equal(r[3].self.type,'無屬性');assert.equal(r[3].opp.type,'普通');
  });
  await check(`${side} 僅改自身或僅改目標的獨立參數都有真正讀取端`,async()=>{
   for(const targetOnly of [false,true]){
    const p=targetOnly?{uses:1,targetType:'草'}:{uses:1,attackType:'火'};
    const hit={...attack,type:targetOnly?'火':'普通'};
    const play=(grant:boolean)=>h.play(side,{self:h.unit('S',10000,[hit],{type:'無屬性',extra:grant?{trait:trait([a('attack_type_view_uses',p)])}:{}}),opp:h.unit('E',100000,[h.wait()],{type:targetOnly?'普通':'草'})});
    const [base]=await play(false),[r]=await play(true);
    assert.ok(Math.abs((100000-r.opp.currentHp)-2*(100000-base.opp.currentHp))<=1);
    assert.equal(r.self.type,'無屬性');assert.equal(r.opp.type,targetOnly?'普通':'草');
   }
  });
  await check(`${side} 完整技能強化、轉暗影與五回合恢復實際量附傷；禁療與滿血不捏造附傷`,async()=>{
   for(const hp of [1000,4500,8500,9000]){
    const [r]=await h.play(side,{self:h.unit('S',hp,[sk()],{maxHp:9000,speed:200}),opp:h.unit('E',100000,[h.wait()])});
    const gain=Math.min(9000-hp,hp<4500?6000:3000);assert.equal(r.self.currentHp,hp+gain);assert.equal(r.opp.currentHp,100000-gain);
    assert.deepEqual(r.self.statStages,{spatk:2,def:2,spdef:2,speed:2,accuracy:1});assert.equal(r.opp.type,'暗影');
   }
   const [blocked]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:9000}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:trait([a('no_heal',{turns:3})])}})});
   assert.equal(blocked.self.currentHp,1000);assert.equal(blocked.opp.currentHp,100000);
   const hit=h.kitSkill('每回合一千傷害',[a('dmg',{flat:1000,type:'真實'})]);
   const r=await h.play(side,{self:h.unit('S',1000,[sk(),h.wait()],{maxHp:9000,speed:200}),opp:h.unit('E',100000,[hit]),turns:(_,t)=>[t===1?0:1,0]},6);
   assert.deepEqual(r.map(x=>x.self.currentHp),[6000,8000,8000,8000,8000,7000]);
   assert.deepEqual(r.map((x,i)=>(i?r[i-1].opp.currentHp:100000)-x.opp.currentHp),[6000,3000,1000,1000,1000,0]);
  });
  await check(`${side} 原本暗影才封下一次技能，轉型後下場恢復原型`,async()=>{
   const hit=h.kitSkill('一百傷害',[a('dmg',{flat:100,type:'真實'})]);
   const r=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:200}),opp:h.unit('E',100000,[hit],{type:'暗影'}),turns:(_,t)=>[t===1?0:1,0]},2);
   assert.equal(r[0].self.currentHp,10000);assert.equal(r[1].self.currentHp,9900);
   const switched=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()]),opp:h.unit('E',100000,[h.wait()],{type:'水'}),oppBench:[h.unit('B',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:t===3?{switch:0}:0]},3);
   assert.equal(switched[2].opp.type,'水');
  });
  await check(`${side} 技能無效才獲得兩次視圖，改名且Blockly改三次後照新值執行`,async()=>{
   for(const [s,n,at,tt] of [[sk(),2,'光','暗影'],[edited,3,'火','草']] as any){
    const r=await h.play(side,{self:h.unit('S',10000,[s,h.wait(),attack],{speed:10,type:'無屬性'}),opp:h.unit('E',100000,[h.wait()],{extra:{trait:trait([a('invalid_next',{kind:'all',uses:1})])}}),turns:(_,t)=>[t===1?0:t===2?1:2,0]},3);
    assert.deepEqual(r[0].self.statStages,{});const reg=r[0].state[`${side}RegistryState`];assert.equal(reg.attackTypeOverrideUses,n);assert.equal(reg.attackTypeOverride,at);assert.equal(reg.targetTypeOverride,tt);
    assert.equal(r[1].state[`${side}RegistryState`].attackTypeOverrideUses,n);assert.equal(r[2].state[`${side}RegistryState`].attackTypeOverrideUses,n-1);
   }
   const [ok]=await h.play(side,{self:h.unit('S',10000,[sk()]),opp:h.unit('E',100000,[h.wait()])});assert.ok(!ok.state[`${side}RegistryState`].attackTypeOverrideUses);
  });
  await check(`${side} 視圖下場清除不傳隊友，回場不復活`,async()=>{
   const grant=h.kitSkill('授予視圖',[a('attack_type_view_uses',view)]);
   const r=await h.play(side,{self:h.unit('S',10000,[grant,h.wait()]),selfBench:[h.unit('B',10000,[h.wait()])],opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===2?{switch:1}:t===3?{switch:0}:t===1?0:1,0]},4);
   assert.equal(r[1].self.id,'B');assert.ok(!r[1].state[`${side}RegistryState`].attackTypeOverrideUses);
   assert.ok(!r[1].state[`${side}ElfState`].S.registry.attackTypeOverrideUses);
   assert.equal(r[2].self.id,'S');assert.ok(!r[3].state[`${side}RegistryState`].attackTypeOverrideUses);
  });
  await check(`${side} 零威力攻擊仍按使用次數消耗；等待不耗，未行動不耗`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',10000,[{...attack,power:0}],{extra:{trait:trait([a('attack_type_view_uses',view)])}}),opp:h.unit('E',100000,[h.wait()])});
   assert.equal(r.state[`${side}RegistryState`].attackTypeOverrideUses,1);
   const [stopped]=await h.play(side,{self:h.unit('S',10000,[attack],{extra:{battleStatuses:{睡眠:3},trait:trait([a('attack_type_view_uses',view)])}}),opp:h.unit('E',100000,[h.wait()])});
   assert.equal(stopped.state[`${side}RegistryState`].attackTypeOverrideUses,2);
  });
  await check(`${side} 下兩回合先制+2真正排序，附加封印不啟動；舊魂印不重建專屬監控`,async()=>{
   const order:string[]=[];h.S.S=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('S');};h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('E');};
   try{await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{speed:10}),opp:h.unit('E',100000,[{...h.wait(),priority:1}],{speed:500}),turns:(_,t)=>[t===1?0:1,0]},4);
    assert.deepEqual(order,['E','S','S','E','S','E','E','S']);
   }finally{delete h.S.S;delete h.S.E;}
   const [sealed]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:9000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',100000,[h.wait()])});
   assert.equal(sealed.self.currentHp,1000);assert.deepEqual(sealed.self.statStages,{});assert.equal(sealed.opp.type,'普通');assert.equal(sealed.state[`${side}Timers`].length,0);
   h.S.S=handleScarlettSoulMark;
   try{const [real]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:9000}),opp:h.unit('E',100000,[h.wait()])});
    assert.ok(!real.state[`${side}RegistryState`].selfSkillHealTurns);
    assert.ok(!real.state[`${side}Timers`].some((t:any)=>t.id.includes('scarlett_k3')));
   }finally{delete h.S.S;}
  });
 }
 assert.equal(calls,0);console.log(`${checks} 暮光舞動與通用攻擊屬性視圖檢查通過`);
}finally{delete h.S.S;delete h.S.E;if(old===undefined)delete registry['暮光舞動'];else registry['暮光舞動']=old;await h.close();}
