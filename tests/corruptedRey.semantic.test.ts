import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';

const h=await createHarness();let checks=0;
try{
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {validateKit}=await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
 const {addStatusEffect,getStatuses,isElfItemDisabled}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const {CORRUPTED_REY_SOUL_TEXT}=await h.server.ssrLoadModule('/src/data/corruptedReyDescriptions.ts');
 const {calculateDamage}=await h.server.ssrLoadModule('/src/utils/damageCalculator.ts');
 const {getTypeMatchup}=await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
 const {battleSkillRow}=await h.server.ssrLoadModule('/src/battle/skillSlot.ts');
 const elves=['7070','707070'].map(id=>DEFAULT_ELVES.find((e:any)=>e.id===id));
 defineCustomBlocks();
 for(const e of elves){
  assert.ok(e);assert.equal(e.skills.length,5);assert.deepEqual(e.skills.map((s:any)=>!!s.isFifthSkill),[false,false,false,false,true]);
  assert.equal(e.soulMark.description,CORRUPTED_REY_SOUL_TEXT[e.id]);
  for(const text of ['繳械:弱化類異常，限制類異常','選擇技能階段','麻痺:控制類異常','戰鬥階段結束時:'])assert.ok(e.soulMark.description.includes(text));
  if(e.id==='707070')for(const text of ['入魔：附屬類異常','攻擊技能PP值消耗量提升20倍','恢復自身所有技能全部PP值','自身下次使用攻擊技能時'])assert.ok(e.soulMark.description.includes(text));
  assert.equal(Object.values(e.baseStats).reduce((a:number,b:any)=>a+b,0),e.id==='7070'?735:800);
  for(const def of [e.soulMark,...e.skills]){
   assert.equal(def.effectMode,'kit');validateKit(def.kit);
   assert.ok(!JSON.stringify(def.kit).includes('legacy_handler'));
   const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{
    for(const entry of def.kit)assert.ok(buildEntryBlock(w as any,entry));
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    const back=r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser(def===e.soulMark?'soulmark':'skill')(b,old.node,old.order);}).sort((a:any,b:any)=>a.order-b.order);
    assert.deepEqual(back,def.kit);
   }finally{w.dispose();r.dispose();}
   checks++;
  }
 }
 const only=(id:string,name:string,orders:number[])=>{const s=structuredClone(h.find(id,name));s.power=0;s.kit=s.kit.filter((e:any)=>orders.includes(e.order));return s;};
 const passive=(e:any,orders:number[])=>({...structuredClone(e.soulMark),kit:structuredClone(e.soulMark.kit.filter((k:any)=>orders.includes(k.order)))});
 const plain=(id:string,skills:any[],hp=100000,extra:any={})=>h.unit(id,hp,skills,{speed:200,extra});
 for(const side of ['p1','p2'] as const){
  // 雷翼的實際扣除總和包含板凳；種族值原封保留。
  for(const e of elves){
   const unit=(id:string,soul?:any)=>plain(id,[h.wait()],10000,{name:id,calculatedStats:{hp:10000,atk:1000,def:1000,spatk:1000,spdef:1000,speed:1000},...(soul?{soulMark:soul}:{})});
   const [r]=await h.play(side,{self:unit(e.id,passive(e,[0])),opp:unit('enemy'),oppBench:[unit('bench')]},1);
   const ratio=e.id==='7070'?.2:.07,unitSize=e.id==='7070'?70:7;
   const loss=2*(Math.floor(10000*ratio)+5*Math.floor(1000*ratio)),bonus=Math.floor(loss/unitSize)*70;
   assert.equal(r.self.maxHp,10000+bonus);assert.equal(r.self.calculatedStats.atk,1000+bonus);
   assert.equal(r.opp.maxHp,10000-Math.floor(10000*ratio));
   assert.equal(r.state[`${side==='p1'?'p2':'p1'}Team`][1].calculatedStats.atk,1000-Math.floor(1000*ratio));checks++;
  }
  // 固定吸取與能力吸取成功分支。
  const [drain]=await h.play(side,{self:plain('actor',[only('7070','蝕雷',[1,2])]),opp:plain('target',[{...h.wait(),category:'物理'}],100000,{statStages:{atk:2}})},1);
  assert.equal(drain.opp.currentHp,99730);assert.equal(drain.self.statStages.atk,2);assert.equal(drain.opp.statStages.atk,0);
  assert.ok(drain.state[`${side==='p1'?'p2':'p1'}Timers`].some((t:any)=>t.payload?.block?.invalid==='屬性'));checks++;
  // 怨雷消除六項等級的絕對總和，正負不抵銷。
  const [stages]=await h.play(side,{self:plain('actor',[only('707070','怨雷',[2])],100000,{statStages:{atk:2,def:-1}}),opp:plain('target',[h.wait()],100000,{statStages:{speed:3,spdef:-2}})},1);
  assert.equal(stages.opp.currentHp,100000-8*70);assert.equal(stages.self.statStages.atk,0);checks++;
  // 入魔剩餘三回合：強化1×2³，最後套用能力等級上限6。
  const buff=plain('actor',[only('707070','失控霆魔',[1])]);addStatusEffect(buff,'入魔',3);
  const [scaled]=await h.play(side,{self:buff,opp:plain('target',[h.wait()])},1);
  assert.equal(scaled.self.statStages.atk,6);assert.equal(scaled.self.statStages.speed,6);checks++;
  // 選招繳械即扣PP並阻止行動；行動時才得到繳械不追溯扣PP。
  const disarmed=plain('actor',[h.kitSkill('本應扣血',[{op:'dmg',p:{flat:999,type:'真實'}}])]);addStatusEffect(disarmed,'繳械',2);
  const [dis]=await h.play(side,{self:disarmed,opp:plain('target',[h.wait()])},1);
  assert.equal(dis.self.skills[0].pp,0);assert.equal(dis.opp.currentHp,100000);checks++;
  assert.equal(isElfItemDisabled(disarmed),true);checks++;
  // 直接使用正式魂印的回合開始分支，繳械不是只有測試用技能能附加。
  for(const e of elves){
   const results=await h.play(side,{self:plain('actor',[h.wait()],100000,{soulMark:passive(e,[1])}),opp:plain('target',[h.kitSkill('對手行動',[{op:'dmg',p:{flat:123,type:'真實'}}])])},2);
   assert.equal(getStatuses(results[0].opp)['繳械'],2,`${e.name}未指定期限的繳械採共用預設3回合，回合末剩2`);
   assert.equal(isElfItemDisabled(results[0].opp),true);
   assert.equal(results[1].opp.skills[0].pp,0);
   assert.equal(results[1].self.currentHp,results[0].self.currentHp,'下一回合選技被繳械阻止');checks++;
   const boosted=await h.play(side,{self:plain('actor',[h.wait()],100000,{soulMark:passive(e,[1])}),opp:plain('target',[h.wait()],100000,{statStages:{atk:2}})});
   assert.equal(boosted[0].opp.statStages.atk,-2);assert.ok(getStatuses(boosted[0].opp)['麻痺']>0);checks++;
  }
  // 繳械附加失敗：墜霆的懲罰綁定目標，屬性封附加／攻擊PP二十倍各有獨立範圍。
  const immunity=h.kitSkill('先開免疫',[{op:'immune_status_turns',p:{turns:7,reflect:false}}],{priority:6});
  const [failedDisarm]=await h.play(side,{self:plain('actor',[h.wait()],100000,{soulMark:passive(elves[1],[1])}),opp:plain('target',[immunity])});
  assert.equal(getStatuses(failedDisarm.opp)['繳械'],undefined);
  const penaltyTimer=failedDisarm.state[`${side==='p1'?'p2':'p1'}Timers`].find((t:any)=>t.payload?.block?.ppMult===20);
  assert.ok(penaltyTimer);assert.equal(penaltyTimer.persistsOffField,true);assert.equal(penaltyTimer.payload.block.kind,'攻擊');assert.equal(penaltyTimer.payload.block.addInvalid,'屬性');checks++;
  // 階段末的恢復／百分比傷害與全部PP恢復，直接執行各自魂印條目。
  for(const e of elves){
   const skill={...h.wait(),pp:2,maxPp:99};
   const [phase]=await h.play(side,{self:plain('actor',[skill],10000,{currentHp:5000,soulMark:passive(e,[2])}),opp:plain('target',[h.turnEffectSkill()])});
   assert.equal(phase.self.currentHp,e.id==='7070'?8333:10000);
   assert.equal(phase.opp.currentHp,e.id==='7070'?96667:90000);
   assert.equal(phase.self.skills[0].pp,e.id==='7070'?1:99);checks++;
  }
  // 入魔看選擇而非成功出手：攻擊即使被控制，回合末仍額外扣所選槽1PP。
  const selected=plain('actor',[{...h.wait(),name:'攻擊',category:'物理',power:1,pp:10,maxPp:10}]);addStatusEffect(selected,'入魔',3);addStatusEffect(selected,'麻痺',2);
  const [sel]=await h.play(side,{self:selected,opp:plain('target',[h.wait()])},1);
  assert.equal(sel.self.skills[0].pp,9);assert.equal(sel.self.currentHp,100000);checks++;
  // 不選攻擊：失去最大體力20%，所有附屬異常延長1回合後再正常扣減。
  const idle=plain('actor',[h.wait()]);addStatusEffect(idle,'入魔',3);addStatusEffect(idle,'星哲',3);
  const [end]=await h.play(side,{self:idle,opp:plain('target',[h.wait()])},1);
  assert.equal(getStatuses(end.self)['入魔'],3);assert.equal(getStatuses(end.self)['星哲'],3);checks++;
  // 雙方各有4回合效果：合計縮短6；沒有變化不構成新觸發，保留待用量。
  const compressor=plain('compressor',[h.turnEffectSkill(),h.wait()],100000,{soulMark:passive(elves[1],[3])});
  const compressed=await h.play(side,{self:compressor,opp:plain('target',[h.turnEffectSkill(),h.wait()]),turns:(_e,t)=>t===1?[0,0]:[1,1]},2);
  assert.ok(Math.abs(compressed[0].state[`${side}RegistryState`]['pendingDamage:durationCompression']-4.2)<1e-9);
  assert.equal(getStatuses(compressed[0].self)['入魔'],6);
  assert.ok(Math.abs(compressed[1].state[`${side}RegistryState`]['pendingDamage:durationCompression']-4.2)<1e-9);checks++;
  // 最後一次覆寫而非累加，使用時清空待用追加。
  const pending=h.kitSkill('待用數值',[{op:'query_number',p:{side:'self',kind:'status_turns',status:'入魔'}},{op:'pending_damage_write',p:{key:'check',ratio:.7}},{op:'pending_damage_write',p:{key:'check',ratio:.7}},{op:'pending_damage_use',p:{key:'check',type:'百分比'}}]);
  const pendingActor=plain('actor',[pending],10000);addStatusEffect(pendingActor,'入魔',2);
  const [pendingResult]=await h.play(side,{self:pendingActor,opp:plain('target',[h.wait()])});
  assert.equal(pendingResult.opp.currentHp,86000);assert.equal(pendingResult.state[`${side}RegistryState`]['pendingDamage:check'],0);checks++;
  // 本次入魔期間抵擋技能傷害；提前解除即撤銷，重新入魔不再憑空取得抵擋。
  const guardActor=plain('actor',[h.kitSkill('狀態抵擋',[{op:'status',p:{side:'self',status:'入魔',turns:3}},{op:'status_guard_instance',p:{status:'入魔',kind:'技能'}}]),h.kitSkill('解除後再入魔',[{op:'cure_status',p:{side:'self'}},{op:'status',p:{side:'self',status:'入魔',turns:3}}])]);
  const hit=h.kitSkill('技能傷害',[{op:'dmg',p:{flat:1000,type:'技能',elem:'普通'}}]);
  const guarded=await h.play(side,{self:guardActor,opp:h.unit('target',100000,[hit],{speed:50}),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.equal(guarded[0].self.currentHp,80000); // 未選攻擊的20%體力流失仍生效，並非傷害免疫。
  assert.ok(guarded[1].self.currentHp<60000);checks++;
  // 次數致死存活：第一次保留1HP，第二次致死不再觸發。
  const survivor=plain('actor',[only('707070','怨雷',[4]),h.wait()],1000);
  const fatal=h.kitSkill('致死',[{op:'dmg',p:{flat:2000,type:'真實'}}]);
  const survived=await h.play(side,{self:survivor,opp:h.unit('target',100000,[fatal],{speed:50}),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.equal(survived[0].self.currentHp,1);assert.equal(survived[1].self.currentHp,0);checks++;
  // 效果被消除後確實給予次數免疫；監控本身一併被消除也需觸發。
  const watcher=plain('actor',[h.kitSkill('監控',[{op:'effect_end_watch',p:{turns:2,mode:'immune',count:2}}])]);
  const clear=h.kitSkill('消除再附異常',[{op:'clear_turn',p:{side:'opp'}},{op:'status',p:{side:'opp',status:'中毒',turns:2}}]);
  const [watched]=await h.play(side,{self:watcher,opp:h.unit('target',100000,[clear],{speed:50})});
  assert.equal(getStatuses(watched.self)['中毒'],undefined);checks++;
  // 轉化優先於反彈，保留來源異常回合數，並只消耗一次次數。
  const convert=plain('actor',[h.kitSkill('轉化',[{op:'status_convert_uses',p:{count:2,status:'入魔'}},{op:'immune_status_turns',p:{turns:7,reflect:true}}])]);
  const poison=h.kitSkill('施加中毒',[{op:'status',p:{side:'opp',status:'中毒',turns:3}}]);
  const [converted]=await h.play(side,{self:convert,opp:h.unit('target',100000,[poison],{speed:50})});
  assert.equal(getStatuses(converted.self)['入魔'],3);assert.equal(getStatuses(converted.opp)['中毒'],undefined);checks++;
  // 第五技能純追加：高血線翻倍，只有明確第五技帶標記。
  const [bonus]=await h.play(side,{self:plain('actor',[only('7070','墮影噬雷決',[4])],10000),opp:plain('target',[h.wait()])});
  assert.equal(bonus.opp.currentHp,92000);checks++;
  // 固定系別傷害使用技能傷害通道，無效分支是原值的2.5倍。
  for(const invalid of [false,true]){
   const skill=only('707070','魔化雷驅',[3,4]);
   const invalidator=h.kitSkill('技能無效',[{op:'invalid_next',p:{kind:'屬性',uses:1}}]);
   const [typed]=await h.play(side,{self:plain('actor',[skill],10000),opp:h.unit('target',100000,[invalid?invalidator:h.wait()],{speed:invalid?500:50})});
   assert.equal(typed.opp.currentHp,Math.max(0,100000-Math.floor(100000*(invalid?1.25:.5)*getTypeMatchup('混沌·電','普通'))));checks++;
  }
  // 系別傷害必須扣護盾，不能被替代成扣護罩的百分比傷害，也不能當真實傷害略過兩者。
  const [shielded]=await h.play(side,{self:plain('actor',[only('707070','魔化雷驅',[3])],10000),opp:plain('target',[h.wait()],100000,{shield:100,barrier:10000})});
  assert.equal(shielded.opp.shield,0);assert.equal(shielded.opp.barrier,10000);
  assert.equal(shielded.opp.currentHp,100000-Math.max(0,Math.floor(50000*getTypeMatchup('混沌·電','普通'))-100));checks++;
  const [barriered]=await h.play(side,{self:plain('actor',[only('7070','墮影噬雷決',[4])],10000),opp:plain('target',[h.wait()],100000,{shield:100,barrier:10000})});
  assert.equal(barriered.opp.shield,100);assert.equal(barriered.opp.barrier,2000);assert.equal(barriered.opp.currentHp,100000);checks++;
  // 增傷條件要在消除前讀取；不能先清除，再於公式前判斷而永遠落空。
  const compressionHit=async(boosted:boolean)=>{
   const skill=only('707070','沉淪混沌決',boosted?[2,3]:[3]);skill.power=170;
   const [r]=await h.play(side,{self:plain('actor',[skill]),opp:plain('target',[{...h.turnEffectSkill(),priority:6}])});
   assert.ok(!r.state[`${side==='p1'?'p2':'p1'}Timers`].some((t:any)=>t.kind==='turn_effect'));return 100000-r.opp.currentHp;
  };
  const baseDamage=await compressionHit(false),boostedDamage=await compressionHit(true);
  assert.ok(Math.abs(boostedDamage/baseDamage-2.7)<.05);checks++;
  const withPercent=async(boosted:boolean)=>{
   const skill=only('707070','沉淪混沌決',boosted?[2,3,5]:[3,5]);skill.power=170;
   return (await h.play(side,{self:plain('actor',[skill],10000),opp:plain('target',[{...h.turnEffectSkill(),priority:6}])}))[0];
  };
  const percentNormal=await withPercent(false),percentBoosted=await withPercent(true);
  assert.equal(100000-percentNormal.opp.currentHp-baseDamage,14000);
  assert.equal(100000-percentBoosted.opp.currentHp-boostedDamage,14000);checks++;
  // 入魔期間魂印僅抵擋技能傷害，固定／百分比／真實傷害仍各自結算。
  const guardedAttack=h.kitSkill('取得本次入魔抵擋',[{op:'status',p:{side:'self',status:'入魔',turns:3}},{op:'status_guard_instance',p:{status:'入魔',kind:'技能'}}],{category:'物理'});
  const mixed=h.kitSkill('混合傷害',[{op:'dmg',p:{flat:1000,type:'技能',elem:'普通'}},{op:'dmg',p:{flat:200,type:'百分比'}},{op:'dmg',p:{flat:300,type:'固定'}},{op:'dmg',p:{flat:400,type:'真實'}}]);
  const [mixedResult]=await h.play(side,{self:plain('actor',[guardedAttack]),opp:h.unit('target',100000,[mixed],{speed:50})});
  assert.equal(mixedResult.self.currentHp,99100);checks++;
  // 抵擋量來自正式攻擊傷害，再走真實反擊；不能拿0點實際扣血作為反擊量。
  const physical={...h.wait(),name:'物理攻擊',category:'物理',power:90,type:'普通'};
  const [unblocked]=await h.play(side,{self:plain('actor',[h.wait()]),opp:h.unit('target',100000,[physical],{speed:50})});
  const [countered]=await h.play(side,{self:plain('actor',[only('7070','暗蝕雷驅',[5])]),opp:h.unit('target',100000,[physical],{speed:50})});
  const counterAmount=100000-unblocked.self.currentHp;assert.ok(counterAmount>0);
  assert.equal(countered.self.currentHp,100000);assert.equal(countered.opp.currentHp,100000-counterAmount);checks++;
  // 怨雷：抵擋觸發前封印對手附加效果，觸發後解除，不永久封印。
  const extra=h.kitSkill('附加固定傷害',[{op:'dmg',p:{flat:100,type:'固定'}}]);
  const sealResults=await h.play(side,{self:plain('actor',[only('707070','怨雷',[3]),h.wait()]),opp:h.unit('target',100000,[extra,physical],{speed:50}),turns:(_e,t)=>[t===1?0:1,t===2?1:0]},3);
  assert.equal(sealResults[0].self.currentHp,100000);assert.equal(sealResults[1].self.currentHp,100000);assert.equal(sealResults[2].self.currentHp,99900);checks++;
  // 每個滿PP技能增加威力：公式前可讀、積木修改 amount 會實際改變傷害。
  const damageFor=async(amount:number)=>{
   const skill=only('707070','混沌墜霆閃',[5]);skill.power=160;
   skill.kit[0].params.clause.body[0].acts[0].p.amount=amount;
   return (await h.play(side,{self:plain('actor',[skill,h.wait(),h.wait()]),opp:plain('target',[h.wait()])}))[0];
  };
  const low=await damageFor(10),high=await damageFor(160);assert.ok(high.opp.currentHp<low.opp.currentHp);checks++;
  // 易傷只涵蓋非真實；下回合生效，百分比與固定均放大，真實不放大。
  const vulnerable=only('707070','魔化雷驅',[6]);
  const damages=h.kitSkill('三種傷害',[{op:'dmg',p:{flat:100,type:'固定'}},{op:'dmg',p:{flat:100,type:'百分比'}},{op:'dmg',p:{flat:100,type:'真實'}}]);
  const amplified=await h.play(side,{self:plain('actor',[vulnerable,damages]),opp:plain('target',[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},2);
  assert.equal(amplified[1].opp.currentHp,100000-270-270-100);checks++;
  // 雷翼的 ratio 是實際可編輯參數，改為10%便依10%換算。
  const editedSoul=passive(elves[0],[0]);editedSoul.kit[0].params.clause.body[0].acts.at(-1).p.ratio=.1;
  const [edited]=await h.play(side,{self:plain('actor',[h.wait()],10000,{soulMark:editedSoul}),opp:plain('target',[h.wait()],10000)});
  assert.equal(edited.opp.maxHp,9000);checks++;
 }
 // 克制改寫使用三個系別對自身的總和，不設4倍上限；普通精靈持有狀態亦生效。
 const actor=plain('actor',[h.wait()],10000,{type:'混沌·電'}),target=plain('target',[h.wait()],10000);
 addStatusEffect(actor,'入魔',3);
 const attack={...h.wait(),category:'物理',type:'普通',power:90};
 const result=calculateDamage(actor,target,attack,'p1',undefined,undefined,1,false);
 const expected=['神靈','聖靈','光'].reduce((s,t)=>s+getTypeMatchup(t,actor.type),0);
 assert.equal(result.typeMultiplier,expected);checks++;
 console.log(`魔化／墜霆雷伊：${checks}組圖紙往返與正式引擎數值檢查通過`);
}finally{await h.close();}
