import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
try {
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {validateKit}=await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 const {addStatusEffect}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const {resetPrd}=await h.server.ssrLoadModule('/src/utils/prd.ts');
 const elf=DEFAULT_ELVES.find((e:any)=>e.id==='5036');assert.ok(elf);
 const {applySavedSkillCorrections}=await h.server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
 const {default:legacy}=await h.server.ssrLoadModule('/src/data/legacyJiuqingDefinitions.json');
 const saved=structuredClone(elf);
 for(const skill of [...saved.skills,...saved.skillPool]){const old=legacy.find((d:any)=>d.name===skill.name);Object.assign(skill,{description:old.description,kit:structuredClone(old.kit),pp:1});}
 const oldSoul=legacy.find((d:any)=>d.kind==='soul');Object.assign(saved.soulMark,{description:oldSoul.description,kit:structuredClone(oldSoul.kit)});
 saved.skills=[saved.skills[4],...saved.skills.slice(0,4)];saved.skills.forEach((s:any)=>s.isFifthSkill=['蒼靈銜樂','清璨星辰落'].includes(s.name));
 const fixedSaved=applySavedSkillCorrections(saved,DEFAULT_ELVES);
 assert.deepEqual(fixedSaved.skills.map((s:any)=>s.name),elf.skills.map((s:any)=>s.name));
 assert.deepEqual(fixedSaved.skills.map((s:any)=>!!s.isFifthSkill),[false,false,false,false,true]);
 assert.ok(fixedSaved.skills.every((s:any)=>s.pp===1));assert.deepEqual(fixedSaved.soulMark.kit,elf.soulMark.kit);
 const custom=structuredClone(saved);custom.skills[0].kit[0].customText='使用者自訂';custom.soulMark.description+='自訂文案';
 const customFixed=applySavedSkillCorrections(custom,DEFAULT_ELVES);assert.deepEqual(customFixed.skills.find((s:any)=>s.name===custom.skills[0].name),custom.skills[0]);assert.deepEqual(customFixed.soulMark,custom.soulMark);
 assert.deepEqual(customFixed.skills.map((s:any)=>s.name),elf.skills.map((s:any)=>s.name));
 assert.deepEqual(customFixed.skills.map((s:any)=>!!s.isFifthSkill),[false,false,false,false,true]);
 assert.equal(applySavedSkillCorrections(customFixed,DEFAULT_ELVES),customFixed);checks+=2;
 const clone=(name:string,orders?:number[])=>{const s=structuredClone(h.find('5036',name));if(orders)s.kit=s.kit.filter((e:any)=>orders.includes(e.order));return s;};
 const soul=(skills:any[],speed=200,hp=100000)=>h.unit('5036',hp,skills,{speed,extra:{name:'九青',soulMark:structuredClone(elf.soulMark),calculatedStats:{hp,atk:400,spatk:200,def:300,spdef:300,speed}}});
 const attack={...h.wait(),name:'普通攻擊',category:'物理',power:150};
 const baseDamage=(ctx:any,event:any,data:any)=>{if(event===T.BEFORE_DAMAGE&&!data.damageComp?.isIncoming&&data.damageComp?.damageCategory==='skill_attack'){data.damageComp.base=100;data.damageComp.increasePercent=1;data.damageComp.decreasePercent=0;data.damageComp.multiplier=1;}};
 defineCustomBlocks();
 for(const def of [elf.soulMark,...elf.skillPool]) {
  assert.equal(def.effectMode,'kit');validateKit(def.kit);
  assert.ok(!JSON.stringify(def.kit).includes('legacy_handler'),'不可用舊專屬程式替代積木');
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{
   for(const e of def.kit)assert.ok(buildEntryBlock(w as any,e));
   Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
   const back=r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser(def===elf.soulMark?'soulmark':'skill')(b,old.node,old.order);}).sort((a:any,b:any)=>a.order-b.order);
   assert.deepEqual(back,[...def.kit].sort((a:any,b:any)=>a.order-b.order),`${def.name}積木存讀`);checks++;
  }finally{w.dispose();r.dispose();}
 }
 for(const side of ['p1','p2'] as const){
  const other=side==='p1'?'p2':'p1';
  const edited=clone('清璨星辰落',[4]);edited.category='屬性';edited.power=0;edited.kit[0].params.clause.body[0].acts[0].p.ratio=.1;
  const [editResult]=await h.play(side,{self:h.unit('S',10000,[edited],{speed:200}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(100000-editResult.opp.currentHp,1020,'修改積木參數必須改變正式戰鬥');checks++;
  // 加法增傷100%與「額外50%」應相乘：100×2×1.5=300，不改技能威力。
  h.S.S=baseDamage;
  const speed=clone('生塵眷盼',[3]);speed.isSureHit=true;
  const [boost]=await h.play(side,{self:h.unit('S',10000,[speed],{speed:200,statStages:{atk:1}}),opp:h.unit('E',100000,[h.wait()])});
  assert.equal(100000-boost.opp.currentHp,300);assert.equal(boost.self.skills[0].power,90);checks++;delete h.S.S;
  // 下2回合增傷，第三回合到期；和原有加法100%獨立相乘。
  h.S.S=baseDamage;
  const buff=clone('遂心快意',[3]);
  const mult=await h.play(side,{self:h.unit('S',10000,[buff,attack],{speed:200}),opp:h.unit('E',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},4);
  assert.deepEqual(mult.slice(1).map((r,i)=>mult[i].opp.currentHp-r.opp.currentHp),[400,400,200]);checks++;delete h.S.S;
  // 真正陣亡才連動；清轉雄性，旭的真傷不能被提前清血吞掉。
  const lethal=h.kitSkill('致死',[{op:'dmg',p:{flat:200000,type:'真實'}}]);
  const [death]=await h.play(side,{self:soul([h.wait()]),selfBench:[h.unit('B',1000,[h.wait()])],opp:h.unit('E',100000,[lethal])});
  const extras=death.state[`${side}Team`].filter((e:any)=>e.isExtra);
  assert.equal(extras.length,2);assert.ok(extras.every((e:any)=>e.currentHp===0));assert.equal(extras.find((e:any)=>e.name==='清').gender,'雄性');
  assert.ok(death.logs.some((s:string)=>s.includes('旭')&&s.includes('520')),death.logs.join('\n'));checks++;
  // 出入場還原與重算面板，不能複利。
  const switches=await h.play(side,{self:soul([h.wait()]),selfBench:[h.unit('B',100000,[h.wait()])],opp:h.unit('E',100000,[h.wait()]),turns:(_e,t)=>[t===2?{switch:1}:t===3?{switch:0}:0,0]},3);
  assert.deepEqual([switches[0].self.calculatedStats.atk,switches[0].self.calculatedStats.spatk],[600,600]);
  const benched=switches[1].state[`${side}Team`].find((e:any)=>e.id==='5036');assert.deepEqual([benched.calculatedStats.atk,benched.calculatedStats.spatk],[400,200]);
  assert.deepEqual([switches[2].self.calculatedStats.atk,switches[2].self.calculatedStats.spatk],[600,600]);checks++;
  // 額外精靈可受正常指定傷害死亡，不存在九青活著就不死的特權。
  h.S.E=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE){const xu=ctx.getFullTeam(ctx.targetSide).find((e:any)=>e.name==='旭');ctx.applyTrueDamageToElf(ctx.targetSide,xu.battleId,520,'測試正常指定傷害');}};
  const [xuDead]=await h.play(side,{self:soul([h.wait()]),opp:h.unit('E',100000,[h.wait()])});delete h.S.E;
  assert.equal(xuDead.state[`${side}Team`].find((e:any)=>e.name==='旭').currentHp,0);assert.deepEqual([xuDead.self.calculatedStats.atk,xuDead.self.calculatedStats.spatk],[400,400]);checks++;
  // 後手、雙方無法行動：用真正出招事實判斷，不能借排序。
  const [last]=await h.play(side,{self:soul([h.wait()],50),opp:h.unit('E',100000,[h.wait()],{speed:200})});
  assert.ok(last.state[`${side}RegistryState`].immuneStatusTurns>0);assert.deepEqual(last.self.statStages,{});checks++;
  const stopped=soul([h.wait()]),stoppedOpp=h.unit('E',100000,[h.wait()]);addStatusEffect(stopped,'疲憊',5);addStatusEffect(stoppedOpp,'疲憊',5);
  const [none]=await h.play(side,{self:stopped,opp:stoppedOpp});assert.deepEqual(none.self.statStages,{atk:1,spatk:1,speed:1});checks++;
  // 生塵原本無強化才禁療；有強化且可消除，傷害上限持續當回合與下一回合。
  const capSkill=clone('生塵眷盼',[1,2]);capSkill.category='屬性';capSkill.power=0;capSkill.isSureHit=true;
  const strong=h.unit('E',100000,[attack],{statStages:{atk:1},extra:{calculatedStats:{hp:100000,atk:5000,spatk:300,def:300,spdef:300,speed:100}}});
  const caps=await h.play(side,{self:h.unit('S',10000,[capSkill,h.wait()],{speed:200}),opp:strong,turns:(_e,t)=>[t===1?0:1,0]},3);
  assert.equal(10000-caps[0].self.currentHp,250);assert.equal(caps[0].self.currentHp-caps[1].self.currentHp,250);assert.ok(caps[1].self.currentHp-caps[2].self.currentHp>250);checks++;
  const [noHeal]=await h.play(side,{self:h.unit('S',10000,[capSkill],{speed:200}),opp:h.unit('E',5000,[h.healSkill(1000)],{maxHp:10000})});
  assert.equal(noHeal.opp.currentHp,5000);checks++;
  // MISS不附睡眠。
  const sleep=clone('安魂曲');sleep.accuracy=0;
  const [miss]=await h.play(side,{self:h.unit('S',10000,[sleep],{speed:200}),opp:h.unit('E',10000,[h.wait()])});assert.ok(!h.statuses(miss.opp).includes('睡眠'));checks++;
  // 兩回合固定傷害，第三回合不再扣。
  const fixed=clone('誅神巨闕');
  const ticks=await h.play(side,{self:h.unit('S',10000,[fixed,h.wait()],{speed:200}),opp:h.unit('E',10000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},3);
  assert.deepEqual(ticks.map(r=>r.opp.currentHp),[9850,9700,9700]);checks++;
  const defend=clone('如日方升',[2]);
  const strengthen=h.kitSkill('測試強化',[{op:'stat',p:{side:'self',stats:['攻擊'],v:1}}]);
  const [fatigue]=await h.play(side,{self:h.unit('S',10000,[defend],{speed:200}),opp:h.unit('E',10000,[strengthen])});
  assert.ok(h.statuses(fatigue.opp).includes('疲憊'));assert.equal(fatigue.opp.statStages.atk||0,0,'命中前疲憊應阻止本次屬性技能');checks++;
  // 第4回合仍反彈，第5回合已到期；剝離疲憊監控避免混入另一條款。
  for(const round of [4,5]){
   const reflect=clone('如日方升',[1]);
   const sleepHit=h.kitSkill('施加睡眠',[{op:'status',p:{side:'opp',status:'睡眠',turns:3}}]);
   const hist=await h.play(side,{self:h.unit('S',10000,[reflect,h.wait()],{speed:200}),opp:h.unit('E',10000,[h.wait(),sleepHit]),turns:(_e,t)=>[t===1?0:1,t===round?1:0]},round);
   assert.equal(h.statuses(hist.at(-1).self).includes('睡眠'),round===5);assert.equal(h.statuses(hist.at(-1).opp).includes('睡眠'),round===4);
  }checks++;
  // 備招：連擊不依PP；逐擊固定傷害必須經正式AFTER_ATTACK_HIT。
  const combo=clone('永世相約');combo.isSureHit=true;combo.pp=1;
  const multiResults=[];
  for(const random of [1,0]){
   let hitEvents=0;
   // 只在傷害公式完成後固定機率抽樣，分別驗證5%事件的失敗與成功端，不更改正式技能。
   h.S.S=(_ctx:any,event:any)=>{if(event===T.AFTER_ATTACK_HIT){hitEvents++;resetPrd(()=>random);}};
   const [many]=await h.play(side,{self:h.unit('S',100000,[structuredClone(combo)],{speed:200}),opp:h.unit('E',100000,[h.wait()])});delete h.S.S;
   const hitLog=many.logs.find((s:string)=>/\d+連擊/.test(s));assert.ok(hitLog,many.logs.join('\n'));
   const hitCount=Number(hitLog.match(/(\d+)連擊/)[1]);assert.ok(hitCount>=7&&hitCount<=25);assert.equal(many.self.skills[0].pp,0);assert.equal(hitEvents,hitCount);
   multiResults.push({hp:many.opp.currentHp,hitCount});
  }
  assert.equal(multiResults[0].hitCount,multiResults[1].hitCount);assert.equal(multiResults[0].hp-multiResults[1].hp,multiResults[0].hitCount*20);checks++;
  const evade=clone('聖鈞無雙隕',[1]);evade.category='屬性';evade.power=0;
  const incoming={...attack,isSureHit:false,accuracy:100};
  const dodges=await h.play(side,{self:h.unit('S',100000,[evade,h.wait()],{speed:200}),opp:h.unit('E',100000,[incoming]),turns:(_e,t)=>[t===1?0:1,0]},3);
  assert.equal(dodges[0].self.currentHp,100000);assert.equal(dodges[1].self.currentHp,100000);assert.ok(dodges[2].self.currentHp<100000);
  assert.ok(h.statuses(dodges[0].opp).length>=2);assert.ok(h.statuses(dodges[1].opp).length>=2);checks++;
  // 擊殺後的下一次屬性無效屬於對方陣營，穿插攻擊不消耗。
  const fifthKill=clone('清璨星辰落',[3]);
  const killed=await h.play(side,{self:h.unit('S',10000,[fifthKill,h.wait()],{speed:200}),opp:h.unit('E',1,[h.wait()]),oppBench:[h.unit('B',100000,[attack,strengthen])],turns:async(engine,t)=>{
   if(t===2){engine.onSwitchElf(other,1);await engine.idle();}
   return [t===1?0:1,t<=2?0:1];
  }},4);
  assert.equal(killed[1].opp.name,'B');assert.equal(killed[2].opp.statStages.atk||0,0);assert.equal(killed[3].opp.statStages.atk,1);checks++;
  // 未擊敗效果跨己方切換保留，只有接續攻擊消耗一次。
  const fifthCrit=clone('清璨星辰落',[2]);
  const criticals=await h.play(side,{self:h.unit('S',10000,[fifthCrit],{speed:200}),selfBench:[h.unit('B',10000,[attack])],opp:h.unit('E',100000,[h.wait()]),turns:(_e,t)=>[t===2?{switch:1}:0,0]},3);
  const critTimers=(r:any)=>(r.state[`${side}Timers`]||[]).filter((t:any)=>t.payload?.block?.crit&&t.remaining>0);
  assert.equal(critTimers(criticals[0])[0].scope,'team');assert.equal(critTimers(criticals[1]).length,1);assert.equal(critTimers(criticals[2]).length,0);checks++;
  // 固有穿透受附加封鎖仍有效；護盾維持原量，護罩仍吸收百分比傷害。
  const pierce=clone('蒼靈銜樂');pierce.isSureHit=true;
  h.S.E=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE){ctx.setPlayerState('blockAttackCount',5);ctx.updateElf(ctx.actor,{shield:99999,barrier:99999});}};
  const [bypass]=await h.play(side,{self:h.unit('S',10000,[pierce],{speed:200,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',100000,[h.wait()])});
  assert.ok(bypass.opp.currentHp<100000);assert.equal(bypass.opp.shield,99999);assert.equal(bypass.state[`${other}RegistryState`].blockAttackCount,5);checks++;
  const [barrier]=await h.play(side,{self:h.unit('S',10000,[pierce],{speed:200}),opp:h.unit('E',100000,[h.wait()])});delete h.S.E;
  assert.equal(barrier.opp.shield,99999);assert.equal(barrier.opp.barrier,96999);checks++;
  // 回合末取得的免疫只維持至下一回合末；中間雙方未出手不應續期。
  for(const kind of ['status','stat']){
   h.S.E=(ctx:any,event:any)=>{if(event===T.ROUND_START&&ctx.roundNumber===2){ctx.setPlayerState('actionPreventedRound',2);ctx.setOpponentState('actionPreventedRound',2);}};
   const punish=kind==='status'?h.kitSkill('催眠',[{op:'status',p:{side:'opp',status:'睡眠',turns:3}}]):h.kitSkill('降攻',[{op:'stat',p:{side:'opp',stats:['攻擊'],v:-1}}]);
   const hist=await h.play(side,{self:soul([h.wait()],kind==='status'?50:200),opp:h.unit('E',100000,[h.wait(),punish],{speed:100}),turns:(_e,t)=>[0,t===3?1:0]},3);delete h.S.E;
   if(kind==='status')assert.ok(h.statuses(hist[2].self).includes('睡眠'),'異常免疫不多延長一回合');
   else assert.equal(hist[2].self.statStages.atk,0,'免降到期後原本+1可降回0');
  }checks++;
 }
 console.log(`九青正式引擎與積木存讀：${checks}組通過`);
}finally{delete h.S.S;delete h.S.E;await h.close();}
process.exit(0);
