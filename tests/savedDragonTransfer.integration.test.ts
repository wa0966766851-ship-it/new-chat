import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {applySavedSkillCorrections}=await h.server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
 const {unpackReviewedKits}=await h.server.ssrLoadModule('/src/data/packedReviewedKits.ts');
 const {default:historical}=await h.server.ssrLoadModule('/src/data/legacyDimensionalDragon.json');
 const {default:wrappers}=await h.server.ssrLoadModule('/src/data/legacyDimensionalDragonWrappers.json');
 const {buildWrappedKit,wrappedLabel}=await h.server.ssrLoadModule('/src/blocks/ops/legacyWrappedKit.ts');
 const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 const {soulDefinition}=await h.server.ssrLoadModule('/src/effects/soulDefinitionSource.ts');
 const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {countedAlive}=await h.server.ssrLoadModule('/src/battle/turnLimit.ts');
 const {legalActions}=await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
 const old=unpackReviewedKits(historical).find((d:any)=>d.kind==='soul');
 const canonical=DEFAULT_ELVES.find((e:any)=>e.id==='5021');
 const wrapped=structuredClone(canonical);delete wrapped.builtinEffectBindings;
 wrapped.soulMark={...wrapped.soulMark,...wrappers.definitions[0],effectMode:'kit'};
 const upgradedWrapper=applySavedSkillCorrections(wrapped,DEFAULT_ELVES);
 assert.deepEqual(upgradedWrapper.soulMark.kit,canonical.soulMark.kit,'已發布 legacy_handler 包裝必須升級為實際積木，否則沒有死亡轉交規則');
 const currentWrapper=structuredClone(wrapped);
 currentWrapper.soulMark={...canonical.soulMark,kit:buildWrappedKit('soul','5021',canonical.name,canonical.soulMark.description,wrappedLabel('soul',canonical.name,'龍'))};
 const topWrapper=structuredClone(wrapped);topWrapper.kit=topWrapper.soulMark.kit;delete topWrapper.soulMark.kit;
 const registryNoKit=structuredClone(wrapped);delete registryNoKit.soulMark.kit;registryNoKit.soulMark.effectMode='registry';
 const protectedWrapper=structuredClone(wrapped);protectedWrapper.soulMark.kit[0].params.clause.body[0].acts[0].label+='玩家修改';
 assert.deepEqual(applySavedSkillCorrections(protectedWrapper,DEFAULT_ELVES).soulMark,protectedWrapper.soulMark,'未知改動不能被當成舊版包裝覆蓋');
 const variants=[wrapped,currentWrapper,topWrapper,registryNoKit].map(e=>applySavedSkillCorrections(e,DEFAULT_ELVES));
 for(const e of variants)assert.equal(effectRoute(soulDefinition(e),true),'kit','進場必須走真正積木，不得回退舊 handler');
 const saved=structuredClone(canonical);delete saved.builtinEffectBindings;
 saved.soulMark={...saved.soulMark,description:old.description,kit:old.kit,effectMode:'kit'};
 const fixed=applySavedSkillCorrections(saved,DEFAULT_ELVES);
 assert.deepEqual(fixed.soulMark.kit,canonical.soulMark.kit,'已發布舊積木即使非空也須升級');
 assert.equal(saved.soulMark.description,old.description,'不可原地修改舊存檔');
 const custom=structuredClone(saved);custom.soulMark.kit[0].customText+='玩家編輯';
 assert.deepEqual(applySavedSkillCorrections(custom,DEFAULT_ELVES).soulMark.kit,custom.soulMark.kit,'保留玩家自訂積木');
 for(const side of ['p1','p2'] as const){
  const extras=Array.from({length:6},(_,i)=>({...h.unit('extra'+i,500,[h.wait()]),isExtra:true}));
  const [switched]=await h.play(side,{self:h.unit('normal0',1000,[h.wait()]),opp:h.unit('other',1000,[h.wait()]),selfBench:[...extras,h.unit('normal7',1000,[h.wait()])],turns:()=>[{switch:7},0]},1);
  const actualTeam=switched.state[side+'Team'];
  assert.equal(switched.state[side+'ActiveIndex'],7,'召喚物前插後正常隊友仍可換上');
  assert.ok(actualTeam.slice(1,7).every((e:any)=>e.isExtra),'真正額外精靈不能被清除身分');
  assert.equal(countedAlive(actualTeam,(e:any)=>e.currentHp<=0),2,'勝負計數排除真正額外，保留正常隊友');
  assert.deepEqual(legalActions(switched.state,side,true).filter((a:any)=>a.kind==='switch').map((a:any)=>a.index),[0]);

  const kill=h.kitSkill('致死驗證',[{op:'dmg',p:{flat:20000,type:'真實'}}]);
  for(const version of [fixed,...variants]){
  const dragon={...structuredClone(version),battleId:'receiver',currentHp:10000,maxHp:10000,calculatedStats:{...fixed.calculatedStats,hp:10000},skills:[h.wait()]};
  const [out]=await h.play(side,{self:h.unit('holder',1000,[h.wait()],{speed:1}),opp:h.unit('killer',100000,[kill],{speed:300}),selfBench:[dragon,h.unit('bench-holder',3333,[h.wait()])]},1);
  const team=out.state[side+'Team'],holder=team[0],receiver=team[1],bench=team[2];
  assert.equal(holder.isVanished,true,'死亡持有者必須正式消逝');
  assert.equal(holder.maxHp,0,'消逝令體力上限歸零');
  assert.equal(receiver.maxHp,11000,'場下次元龍取得死亡者1000點紀錄');
  assert.equal(receiver.calculatedStats.hp,11000);
  const mark=receiver.marks.find((m:any)=>m.id==='poem_chapter');
  assert.deepEqual(mark.effects.poemHpSnapshots.slice(0,2),[10000,1000]);
  assert.ok(bench.marks.some((m:any)=>m.id==='poem_chapter'&&m.effects.poemHpSnapshots[0]===3333),'轉交不能清除其他存活後備的紀錄');
  assert.ok(!out.logs.some((s:string)=>s.includes('次元龍帝臨世')),'禁止悄悄執行舊魂印路徑');
  assert.ok(receiver.snapshotResourceRules?.poem_chapter,'開戰已安裝通用死亡轉交積木');
  const [cross]=await h.play(side,{self:h.unit('enemy-holder',1000,[h.wait()],{speed:1}),opp:h.unit('killer',100000,[kill],{speed:300}),oppBench:[structuredClone(dragon)]},1);
  const other=side==='p1'?'p2':'p1';
  assert.equal(cross.state[side+'Team'][0].isVanished,true,'敵方死亡持有者同樣消逝');
  assert.equal(cross.state[other+'Team'][1].maxHp,11000,'敵方死亡者的紀錄也必須轉入場下次元龍');
  assert.equal(cross.state[other+'Team'][1].marks.find((m:any)=>m.id==='poem_chapter').count,2,'自身1篇＋死亡持有者1篇，不能只顯示逐回合增加');
  }
  console.log(side+'：舊版實際積木升級 → 後備安裝 → 正式死亡 → 消逝並轉交體力及詩章通過');
  const receiver={...structuredClone(upgradedWrapper),battleId:'multi-receiver',currentHp:10000,maxHp:10000,calculatedStats:{...fixed.calculatedStats,hp:10000},skills:[h.wait()]};
  const members=[1000,2000,3000].map((hp,i)=>h.unit('multi-holder'+i,hp,[h.wait()],{speed:1}));
  members.push(receiver);
  const enemy=[h.unit('multi-killer',100000,[kill],{speed:300})];
  const other=side==='p1'?'p2':'p1';
  const engine=createBattleEngine({initialP1Team:side==='p1'?members:enemy,initialP2Team:side==='p2'?members:enemy,
   p1StarterId:(side==='p1'?members:enemy)[0].id,p2StarterId:(side==='p2'?members:enemy)[0].id,battleMode:'PVP',preparedTeams:true,isFast:()=>true});
  try{
   engine.mount();engine.start();await engine.idle();
   for(let i=0;i<3;i++){
    if(i){engine.onSwitchElf(side,i);await engine.idle();}
    const before=engine.getState();
    engine.onSkillSelect('p1',before.p1.skills[0]);engine.onSkillSelect('p2',before.p2.skills[0]);await engine.idle();
    const after=engine.getState(),team=after[side+'Team'];
    assert.equal(team[i].isVanished,true,`每一個死亡持有者都要消逝 ${JSON.stringify({side,i,beforePhase:before.phase,phase:after.phase,active:after[side+'ActiveIndex'],hp:team[i].currentHp,logs:after.logs.slice(-6)})}`);
    assert.equal(team[i].maxHp,0);
    assert.equal(team[3].maxHp,[11000,15000,24000][i],'連續三次死亡須依每篇原始體力紀錄累加');
    assert.equal(team[3].marks.find((m:any)=>m.id==='poem_chapter').count,[2,5,9][i],'累積轉移篇數不可只跟回合數增加');
   }
   console.log(side+'：連續三隻死亡，後備次元龍篇數 2 → 5 → 9，上限 11000 → 15000 → 24000');
  }finally{engine.unmount();}
 }
}finally{await h.close();}
process.exit(0);
