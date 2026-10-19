import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();const play=h.play;h.play=async(...args:Parameters<typeof play>)=>{const result=await play(...args);for(const r of result)assert.ok(!r.logs.some((s:string)=>s.includes('效果待接通')),'正式測試不得把遭合約拒絕的測試配置當成功');return result;};try{
 const {MIGRATED_ARENA16_YARAN_SKILL_KIT:[source]}=await h.server.ssrLoadModule('/src/data/migratedArena16YaranKit.ts');
 const {MIGRATED_5016_MECH_SOUL_KIT:mech}=await h.server.ssrLoadModule('/src/data/migrated5016MechSoulKit.ts');
 const {MIGRATED_ARENA16_MONSTER_SKILL_KIT:[monster]}=await h.server.ssrLoadModule('/src/data/migratedArena16MonsterKit.ts');
 const {MIGRATED_ARENA16_AIDA_SKILL_KIT:[aida]}=await h.server.ssrLoadModule('/src/data/migratedArena16AidaKit.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 const sk=(orders:number[],extra:any={})=>({...h.wait(),...source,effectMode:'kit',kit:structuredClone(source.kit.filter((e:any)=>orders.includes(e.order))),...extra});
 defineCustomBlocks();for(const def of [source,mech,monster,aida]){const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{for(const e of def.kit){assert.equal(kitEntryIssue(e),null,def.name+'/'+e.order);assert.ok(buildEntryBlock(w as any,e));}Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser(def===mech?'soulmark':'skill')(b,old.node,old.order);}),def.kit);}finally{w.dispose();r.dispose();}}
 h.S['實際攻擊免疫']=(ctx:any,event:string)=>{if(event==='ON_ENTRANCE')ctx.addTimerTo(ctx.targetSide,{id:'實際無效',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{invalid:'all'}}},false);};
 for(const side of ['p1','p2'] as const){

  const aidaSkill=(orders:number[])=>({...h.wait(),...aida,effectMode:'kit',kit:structuredClone(aida.kit.filter((e:any)=>orders.includes(e.order)))});
  const immune=(kind:string)=>({name:'正式免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',role:'attached',node:kind==='異常'?'on_entered':'before_damage',order:0,customText:'免疫',params:{clause:{raw:'免疫',trig:kind==='異常'?'entrance':'incoming_nontrue',parsed:true,body:[{acts:[kind==='異常'?{op:'immune_status_turns',p:{turns:5,cls:'非附屬類',reflect:false},label:'免疫'}:{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce:1},label:'免疫'}]}]}}}]});
  for(const blocked of [false,true]){
   const out=await h.play(side,{self:h.unit('吸取持有者',100,[aidaSkill([2]),h.wait()],{maxHp:20000,speed:400}),opp:h.unit('吸取受方',9000,[h.wait()],{extra:blocked?{trait:immune('百分比')}:{}}),turns:(_e:any,t:number)=>[t===1?0:1,0]},2);
   assert.deepEqual(out.map(x=>x.opp.currentHp),[6000,3000],'首次取得效果及後續使用技能各吸3000，沒有回合末自動多吸');
   assert.deepEqual(out.map(x=>x.self.currentHp),[3100,6100],'百分比免疫時改真實吸取，每筆僅恢復一次');
  }
  for(const type of ['火','火.水','普通','無屬性'])for(const blocked of [false,true]){
   const [out]=await h.play(side,{self:h.unit('剝離持有者',10000,[aidaSkill([4])],{speed:400}),opp:h.unit('剝離受方',10000,[h.wait()],{type,extra:blocked?{trait:immune('異常')}:{}})});
   const n=['普通','無屬性'].includes(type)?0:type.split('.').length;
   assert.equal(out.opp.type,n?'普通':type);assert.equal(h.statuses(out.opp).length,blocked?0:n,'逐剝離種類抽取不同異常');
   assert.equal(out.state[side+'Marks'].find((m:any)=>m.id==='arena.dragonSoulMark')?.count||0,blocked&&n>0?1:0,'任意附加失敗僅加一層，無屬性零抽取不加');
  }


  const monsterSkill=(orders:number[],extra:any={})=>({...h.wait(),...monster,effectMode:'kit',category:'特殊',power:100,kit:structuredClone(monster.kit.filter((e:any)=>orders.includes(e.order))),...extra});
  for(const killed of [false,true]){
   const [out]=await h.play(side,{self:h.unit('獎勵持有者',10000,[monsterSkill([6],{power:killed?10000:100})],{speed:400}),opp:h.unit('獎勵受方',killed?1:9000,[h.wait()],{extra:{calculatedStats:{hp:killed?1:9000,atk:2000,def:2000,spatk:2000,spdef:2000,speed:300}}})});
   assert.equal(out.self.calculatedStats.atk,killed?360:300,'擊敗才五維點數乘1.2，不能使用時提升能力等級');assert.equal(out.self.statStages.atk||0,0);
   if(!killed){assert.equal(out.opp.maxHp,10000);assert.equal(out.opp.calculatedStats.atk,1000);assert.equal(out.opp.calculatedStats.speed,1,'五維扣相同上限差1000，下限1');}
  }
  const grant=h.kitSkill('對手立計時器',[{op:'immune_status_turns',p:{turns:4,cls:'非附屬類',reflect:false}}]);
  const out=await h.play(side,{self:h.unit('批次持有者',10000,[h.wait(),monsterSkill([3])],{speed:100}),opp:h.unit('批次受方',100000,[grant,h.wait()],{speed:400}),turns:(_e:any,t:number)=>[t===1?0:1,t===1?0:1]},2);
  const control=await h.play(side,{self:h.unit('批次持有者',10000,[h.wait(),{...h.wait(),category:'特殊',power:100}],{speed:100}),opp:h.unit('批次受方',100000,[grant,h.wait()],{speed:400}),turns:(_e:any,t:number)=>[t===1?0:1,t===1?0:1]},2);
  // clear_turn會解除免疫計時器，故三種均成功，沒有未觸發加成。
  assert.equal(out[1].opp.currentHp,control[1].opp.currentHp,'三種狀態全部成功時無額外傷害');



  const counted={name:'次數免疫',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',role:'attached',node:'on_entered',order:0,customText:'三次免疫',params:{clause:{raw:'三次免疫',trig:'entrance',parsed:true,body:[{acts:[{op:'immune_status_count',p:{count:3,reflect:false,scope:'self',persistsOffField:true},label:'免疫'}]}]}}}]};
  const failed=await h.play(side,{self:h.unit('批次持有者',10000,[h.wait(),monsterSkill([3])],{speed:100}),opp:h.unit('批次受方',100000,[grant,h.wait()],{speed:400,extra:{trait:counted}}),turns:(_e:any,t:number)=>[t===1?0:1,t===1?0:1]},2);
  assert.equal(100000-failed[1].opp.currentHp,4*(100000-control[1].opp.currentHp),'三種異常各未觸發，單次技能傷害提升300%即4倍，不能只提升100%');

  const capHistory=await h.play(side,{self:h.unit('先制持有者',10000,[monsterSkill([1,9,10])],{speed:400}),opp:h.unit('先制受方',100000,[{...h.wait(),priority:3}],{speed:100})},2);
  assert.ok(capHistory[0].logs.filter((s:string)=>s.includes('使用了'))[0].includes('先制受方'),'第一次使用前沒有龍魂之力不封對手先制');
  assert.ok(capHistory[1].logs.filter((s:string)=>s.includes('使用了')).slice(-2)[0].includes('先制持有者'),'再次使用前持有時封對手先制至自身');
  const fixedEntry=structuredClone(monster.kit.find((e:any)=>e.order===9));fixedEntry.params.conditions=[];
  const refs=[{...h.wait(),category:'特殊',power:100},{...h.wait(),category:'特殊',power:100,effectMode:'kit',kit:[fixedEntry]}];
  const refHistory=await h.play(side,{self:h.unit('先制持有者',10000,refs,{speed:400}),opp:h.unit('先制受方',100000,[{...h.wait(),priority:3}],{speed:100}),turns:(_e:any,t:number)=>[t-1,0]},2);
  assert.deepEqual(capHistory.map(x=>x.opp.currentHp),refHistory.map(x=>x.opp.currentHp),'第一次倍率正常，使用前已持有的第二次固定4倍');

  const formulaHits:number[]=[];
  for(const useKit of [true,false]){
   const skill=useKit?{...h.wait(),...monster,effectMode:'kit',category:'特殊',power:100,kit:structuredClone(monster.kit.filter((e:any)=>e.order===8))}:{...h.wait(),category:'特殊',power:100};
   const stats={hp:10000,atk:300,def:300,spatk:useKit?300:1600,spdef:300,speed:400};
   const targetStats={hp:100000,atk:300,def:200,spatk:300,spdef:useKit?300:100,speed:800};
   const [out]=await h.play(side,{self:h.unit('極值持有者',10000,[skill],{extra:{calculatedStats:stats}}),opp:h.unit('極值受方',100000,[h.wait()],{extra:{calculatedStats:targetStats}})});
   formulaHits.push(out.opp.currentHp);assert.equal(out.self.calculatedStats.spatk,useKit?300:1600,'公式視圖不改面板');assert.equal(out.opp.calculatedStats.spdef,useKit?300:100);
  }
  assert.equal(formulaHits[0],formulaHits[1],'雙方五維最高800×2與最低200×0.5進正式傷害公式');
  for(const [speed,oppPriority,expected] of [[300,2,true],[299,2,false],[301,2,true],[300,3,false]] as const){
   const own=h.unit('被挑戰方',10000,[h.wait()],{speed,extra:{soulMark:{...mech,effectMode:'kit',kit:structuredClone(mech.kit.filter((e:any)=>[1,9].includes(e.order)))}}});
   const [out]=await h.play(side,{self:own,opp:h.unit('排序對手',10000,[{...h.wait(),priority:oppPriority}],{speed:300})});
   const actions=out.logs.filter((s:string)=>s.includes('使用了'));assert.ok(actions.length>=2);assert.equal(actions[0].includes('被挑戰方'),expected,'被挑戰方僅同先制同速取得排序權，不能蓋過更高先制/速度');
  }
  for(const [full,fast] of [[true,true],[true,false],[false,true]] as const){
   const results:number[]=[];
   // 同一引擎種子、無其他效果，和明確威力的正式攻擊比對實際扣血。
   for(const kit of [true,false]){
    const expected=full?(fast?200:150):100;
    const skill=kit?sk([1],{category:'物理',power:100,isSureHit:true}):{...h.wait(),category:'物理',power:expected};
    const [out]=await h.play(side,{self:h.unit('威力持有者',full?10000:9000,[skill],{maxHp:10000,speed:fast?400:100}),opp:h.unit('威力受方',100000,[h.wait()],{speed:300})});
    results.push(out.opp.currentHp);
   }
   assert.equal(results[0],results[1],'滿血先手200、後手150、非滿血100，威力修正必須進正式公式');
  }
  for(const n of [0,1,3])for(const hp of [4000,9000]){
   const statuses=['中毒','燒傷','流血'].slice(0,n);
   const [out]=await h.play(side,{self:h.unit('清除持有者',hp,[sk([3])],{speed:300}),opp:h.unit('清除受方',6000,[h.wait()],{speed:100,extra:{battleStatuses:Object.fromEntries(statuses.map(s=>[s,3]))}})});
   assert.equal(out.opp.currentHp,6000-n*(hp>6000?400:200),'按實際解除數量造成200固定，HP較高則400，零解除沒有傷害');assert.deepEqual(h.statuses(out.opp),[]);
  }
  for(const invalid of [false,true]){
   const [out]=await h.play(side,{self:h.unit('無效補償持有者',1000,[sk([4],{category:'物理',power:100,isSureHit:true})],{maxHp:5000,speed:300}),opp:h.unit(invalid?'實際攻擊免疫':'無效補償受方',10000,[h.wait()],{})});
   assert.equal(out.self.currentHp,invalid?5000:1000,'只有真正技能無效才全回復');
  }
 }
 console.log('收尾：P1/P2機甲排序、雅髯威力與解除、吸取與剝離、怪物公式/先制/逐失敗增傷/擊敗點數及未擊敗上限交換、Blockly往返通過');
}finally{await h.close();}
