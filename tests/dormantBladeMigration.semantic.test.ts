import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_DORMANT_BLADE_SKILL_KITS as defs} from '../src/data/migratedDormantBladeSkillKit';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {handleWuxuSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/wuxu/registry.ts');
const reg=getBattleSkillRegistry(),old=reg['蟄刃復歸'];reg['蟄刃復歸']=()=>{calls++;throw Error('舊技能重播');};
const sk=()=>structuredClone(h.find('5022','蟄刃復歸'));
const only=(s:any,orders:number[])=>({...s,kit:s.kit.filter((e:any)=>orders.includes(e.order))});
const quiet=(s:any,orders:number[])=>({...only(s,orders),category:'屬性',power:0});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const kill=()=>{const s=h.kitSkill('測試致死',[{op:'dmg',p:{flat:1000000,type:'真實'}}],{priority:100});validateKit(s.kit);return s;};
const sourceHp=(r:any,side:string)=>r.state[side+'Team'].find((e:any)=>e.battleId==='S').currentHp;
let edited:any;
try{
 await check('完整來源／Blockly全條款往返，門檻6→1與復活比例1→1/2改名保存',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,(source as any)['5022'].skills[s.name].d);assert.deepEqual(s.kit,defs[0].kit);assert.equal(s.description,defs[0].description);validateKit(s.kit);defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂接力重生',kit:s.kit.map((e:any)=>{const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'&&x.getFieldValue('OP')==='rebirth_after_ally_turns'){const p=JSON.parse(x.getFieldValue('PARAMS'));p.afterRounds=1;p.ratio=.5;x.setFieldValue(JSON.stringify(p),'PARAMS');}w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;})};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  for(const p of [{afterRounds:-1,ratio:1},{afterRounds:1.5,ratio:1},{afterRounds:6,ratio:0},{afterRounds:6,ratio:2},{afterRounds:Infinity,ratio:1},{afterRounds:6,ratio:1,script:'x'}])assert.throws(()=>validateKit(h.kitSkill('壞契約',[{op:'rebirth_after_ally_turns',p}]).kit));
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 真實完整技能各條同時生效，恢復百分比未重播舊handler`,async()=>{
   const s={...sk(),pp:2};const base=only(s,[0,1,2,3,5,6]);const run=async(skill:any)=>(await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:12000,speed:200}),opp:h.unit('E',1000000,[h.wait()])}))[0];const b=await run(base),r=await run(s);assert.equal(r.self.currentHp,8880);assert.equal(b.self.currentHp,880);assert.equal(b.opp.currentHp-r.opp.currentHp,8000);assert.equal(r.state[side+'RegistryState'].teamConditionalRebirth[0].stage,'armed');assert.equal(calls,0);
  });
  await check(`${side} PP2→3次正式攻擊，固有封印停止連擊；平靜成功才即時提升五項`,async()=>{
   const counts:number[]=[];h.S.S=(_:any,e:any)=>{if(e===T.AFTER_ATTACK_HIT)counts.push(1);};try{for(const sealed of [false,true]){counts.length=0;const [r]=await h.play(side,{self:h.unit('S',12000,[{...only(sk(),[0,1,2,3]),pp:2}],{speed:200,extra:{isInherentInvalid:sealed}}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(counts.length,sealed?1:3);assert.ok(h.statuses(r.self).includes('平靜'));for(const k of ['atk','def','spdef','speed','accuracy'])assert.equal(r.self.statStages[k],1);assert.equal(r.self.statStages.spatk||0,0);}}finally{delete h.S.S;}
  });
  await check(`${side} 平靜免疫時不強化，附加封印不啟動持續與契約`,async()=>{
   h.S.S=(c:any,e:any)=>{if(e===T.ON_ENTRANCE)c.setPlayerState('immuneStatusTurns',99);};try{const [r]=await h.play(side,{self:h.unit('S',12000,[only(sk(),[0,3])],{speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.statStages.atk||0,0);}finally{delete h.S.S;}
   const [r]=await h.play(side,{self:h.unit('S',1000,[sk()],{maxHp:12000,speed:200,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.currentHp,1000);assert.equal(r.state[side+'RegistryState'].teamConditionalRebirth?.length||0,0);
  });
  await check(`${side} 半血嚴格分界，使用時實際恢復等量百分比，滿血不附加`,async()=>{
   for(const [hp,gain] of [[5999,6001],[6000,4000],[12000,0]]){const [r]=await h.play(side,{self:h.unit('S',hp,[quiet(sk(),[0,4])],{maxHp:12000,speed:200}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(r.self.currentHp-hp,gain);assert.equal(1000000-r.opp.currentHp,gain);}
  });
  await check(`${side} 五回合使用恢復含當回合，門檻每回合重判，第六回合停止`,async()=>{
   const trait={name:'測試恢復限制',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'恢復限制',trig:'entrance',parsed:true,body:[{acts:[{op:'recovery_reduce_turns',p:{side:'self',ratio:.75,turns:99,includePotions:true,next:false},label:'恢復限制'}]}]}}}]};validateKit(trait.kit as any);
   const r=await h.play(side,{self:h.unit('S',1000,[quiet(sk(),[0,4]),h.wait()],{maxHp:120000,speed:200,extra:{trait}}),opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},6);assert.deepEqual(r.map(x=>x.self.currentHp),[21000,41000,61000,71000,81000,81000]);assert.deepEqual(r.map(x=>1000000-x.opp.currentHp),[20000,40000,60000,70000,80000,80000]);
  });
  await check(`${side} 下兩回合先制+6，當回合與第四回合不借用`,async()=>{
   const r=await h.play(side,{self:h.unit('S',12000,[only(sk(),[0,5]),h.wait()],{speed:100}),opp:h.unit('E',1000000,[{...h.wait(),priority:5}],{speed:200}),turns:(_,t)=>[t===1?0:1,0]},4);for(let i=0;i<4;i++){const logs=r[i].logs.slice(i?r[i-1].logs.length:0),a=logs.findIndex((x:string)=>x.includes('【S】使用了')),b=logs.findIndex((x:string)=>x.includes('【E】使用了'));assert.ok(a>=0&&b>=0);assert.equal(a<b,i===1||i===2);}
  });
  await check(`${side} 真正死亡後下隻連續在場第6回合仍死，第7回合原持有者滿血重生`,async()=>{
   const r=await h.play(side,{self:h.unit('S',12000,[quiet(sk(),[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait(),kill()]),turns:async(e,t)=>{if(t===3){e.onSwitchElf(side,1);await e.idle();}return [t===1?0:1,t===2?1:0];}},9);assert.equal(sourceHp(r[1],side),0);assert.equal(sourceHp(r[7],side),0);assert.equal(sourceHp(r[8],side),12000);assert.equal(r[8].self.battleId,'B');assert.equal(r[8].self.currentHp,1000000);assert.equal(r[8].state[side+'RegistryState'].teamConditionalRebirth.length,0);
  });
  await check(`${side} 編輯保存後只需超過1回合且重生半血`,async()=>{
   const r=await h.play(side,{self:h.unit('S',12000,[quiet(edited,[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait(),kill()]),turns:async(e,t)=>{if(t===3){e.onSwitchElf(side,1);await e.idle();}return [t===1?0:1,t===2?1:0];}},4);assert.equal(sourceHp(r[2],side),0);assert.equal(sourceHp(r[3],side),6000);assert.equal(r[3].self.currentHp,1000000);
  });
  await check(`${side} 同名接力者換人取消，回場不重建`,async()=>{
   const r=await h.play(side,{self:h.unit('S',12000,[quiet(sk(),[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()],{extra:{name:'同名'}}),h.unit('C',1000000,[h.wait(),h.wait()],{extra:{name:'同名'}})],opp:h.unit('E',1000000,[h.wait(),kill()]),turns:async(e,t)=>{if(t===3){e.onSwitchElf(side,1);await e.idle();}return [t===1?0:t===5?{switch:2}:t===6?{switch:1}:1,t===2?1:0];}},12);for(let i=1;i<r.length;i++)assert.equal(sourceHp(r[i],side),0);assert.equal(r[11].state[side+'RegistryState'].teamConditionalRebirth.length,0);
  });
  await check(`${side} 接力者死亡取消，不轉給下一位`,async()=>{
   const r=await h.play(side,{self:h.unit('S',12000,[quiet(edited,[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()]),h.unit('C',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait(),kill()]),turns:async(e,t)=>{if(t===3||t===5){e.onSwitchElf(side,t===3?1:2);await e.idle();}return [t===1?0:1,t===2||t===4?1:0];}},7);for(let i=1;i<r.length;i++)assert.equal(sourceHp(r[i],side),0);assert.equal(r[6].self.battleId,'C');assert.equal(r[6].state[side+'RegistryState'].teamConditionalRebirth.length,0);
  });
  await check(`${side} 敵方換人不影響己方接力，完成後再次死亡不再重生`,async()=>{
   const r=await h.play(side,{self:h.unit('S',12000,[quiet(edited,[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait(),kill()]),oppBench:[h.unit('F',1000000,[h.wait(),kill()])],turns:async(e,t)=>{if(t===3||t===7){e.onSwitchElf(side,1);await e.idle();}return [t===1?0:t===5?{switch:0}:1,t===2||t===6?1:t===4?{switch:1}:0];}},9);assert.equal(sourceHp(r[2],side),0);assert.equal(sourceHp(r[3],side),6000);assert.equal(sourceHp(r[5],side),0);assert.equal(sourceHp(r[8],side),0);assert.equal(r[8].state[side+'RegistryState'].teamConditionalRebirth.length,0);
  });
  await check(`${side} 原持有者消逝時契約取消，不能重生消逝者`,async()=>{
   h.S.E=(c:any,e:any)=>{if(e===T.ON_KILL)c.vanishElf(c.targetSide,c.target);};try{const r=await h.play(side,{self:h.unit('S',12000,[quiet(edited,[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait(),kill()]),turns:async(e,t)=>{if(t===3){e.onSwitchElf(side,1);await e.idle();}return [t===1?0:1,t===2?1:0];}},5);assert.equal(sourceHp(r[4],side),0);assert.equal(r[4].state[side+'Team'].find((x:any)=>x.battleId==='S').isVanished,true);assert.equal(r[4].state[side+'RegistryState'].teamConditionalRebirth.length,0);}finally{delete h.S.E;}
  });
  await check(`${side} 首次技能無效不立契約；單純下場不視為死亡`,async()=>{
   const invalid=h.kitSkill('先封攻擊',[{op:'invalid_next',p:{kind:'攻擊',uses:1}}],{priority:100});const no=await h.play(side,{self:h.unit('S',12000,[only(sk(),[0,6]),h.wait()],{speed:200}),opp:h.unit('E',1000000,[invalid,h.wait()]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);assert.equal(no[1].state[side+'RegistryState'].teamConditionalRebirth?.length||0,0);
   const r=await h.play(side,{self:h.unit('S',12000,[quiet(edited,[0,6]),h.wait()],{speed:200}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:1,0]},4);assert.equal(sourceHp(r[3],side),12000);assert.equal(r[3].state[side+'RegistryState'].teamConditionalRebirth[0].stage,'armed');
  });
  await check(`${side} 正式六刃舊魂印換人分支不再替Kit建立按名字復活的追蹤`,async()=>{
   h.S['無序·六刃']=(c:any,e:any,d:any)=>{if(e===T.ON_SWITCH_OUT||e===T.ROUND_END)handleWuxuSoulMark(c,e,d);};try{const r=await h.play(side,{self:h.unit('S',12000,[quiet(sk(),[0,6]),h.wait()],{speed:200,extra:{name:'無序·六刃'}}),selfBench:[h.unit('B',1000000,[h.wait(),h.wait()])],opp:h.unit('E',1000000,[h.wait()]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:1,0]},3);assert.equal(r[2].state[side+'RegistryState'].wuxuBladeReviveTrackingActive||false,false);assert.equal(r[2].state[side+'RegistryState'].teamConditionalRebirth[0].stage,'armed');}finally{delete h.S['無序·六刃'];}
  });
 }
 assert.equal(calls,0);console.log(`蟄刃復歸 ${checks} 項通過，舊技能handler0次`);
}finally{if(old)reg['蟄刃復歸']=old;else delete reg['蟄刃復歸'];await h.close();}
process.exit(0);
