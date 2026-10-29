import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const {createRoot}=await import('react-dom/client');
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const root=createRoot(document.getElementById('root')!);
try {
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {applySavedSkillCorrections}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
 const {repairSavedBuiltinStorage,BUILTIN_SAVE_KEYS}=await server.ssrLoadModule('/src/data/savedBuiltinStorage.ts');
 const {prepareSavedBattleRoster}=await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
 const {createBattleEngine}=await server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {BattleContext}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
 const {BattleScreenUI}=await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');
 const {fifthSkillSlot}=await server.ssrLoadModule('/src/battle/skillSlot.ts');
 const {parseFullElfData}=await server.ssrLoadModule('/src/utils/fullElfParser.ts');
 const parsed=parseFullElfData('【核心技能組】\n[普通大招] 普通 物理\n威力 200 PP 5\n效果：無\n[指定大招] 普通 特殊 第五技能\n威力 1 PP 5\n效果：無');
 assert.deepEqual(parsed.skills.map((s:any)=>s.isFifthSkill),[false,true],'匯入器也不能依威力猜第五');
 const pipi=DEFAULT_ELVES.find((e:any)=>e.name==='皮皮');
 assert.equal(pipi.skills.length,5);
 assert.equal(fifthSkillSlot(pipi.skills),-1,'皮皮沒有第五技能');
 assert.ok(pipi.skillPool.some((s:any)=>s.name==='手下留情'),'第六招保留於替換庫');
 const canonical=DEFAULT_ELVES.find((e:any)=>e.id==='5036');
 const saved=structuredClone(canonical);
 saved.skills=[saved.skills[4],...saved.skills.slice(0,4)];
 saved.skills.forEach((s:any,i:number)=>{s.isFifthSkill=['清璨星辰落','蒼靈銜樂'].includes(s.name);s.pp=i+1;s.description+='使用者自訂';s.kit[0].customText+='自訂';});
 saved.skillPool.forEach((s:any)=>{s.isFifthSkill=['清璨星辰落','蒼靈銜樂'].includes(s.name);});
 saved.skills.push(...structuredClone(saved.skillPool.filter((s:any)=>!saved.skills.some((main:any)=>main.name===s.name))));
 const snapshot=structuredClone(saved);
 const decorated=structuredClone(canonical);
 for(const skill of [...decorated.skills,...decorated.skillPool])skill.description=skill.description.replace(/^■/gm,'◈').replace(/^🎯/gm,'🎆')+(['誅神巨闕','聖鈞無雙隕'].includes(skill.name)?'\n（備選）':'');
 const clean=applySavedSkillCorrections(decorated,DEFAULT_ELVES);
 assert.deepEqual(clean.skills.map((s:any)=>s.description),canonical.skills.map((s:any)=>s.description));
 assert.deepEqual(clean.skillPool.map((s:any)=>s.description),canonical.skillPool.map((s:any)=>s.description));
 for(const key of BUILTIN_SAVE_KEYS)localStorage.setItem(key,JSON.stringify({team:[saved]}));
 assert.equal(repairSavedBuiltinStorage(localStorage,DEFAULT_ELVES).length,BUILTIN_SAVE_KEYS.length);
 assert.equal(repairSavedBuiltinStorage(localStorage,DEFAULT_ELVES).length,0,'重複修復不能再次改動存檔');
 const repaired=JSON.parse(localStorage.getItem('seer_last_used_p1_team')!).team[0];
 assert.deepEqual(repaired.skills.map((s:any)=>s.name),canonical.skills.map((s:any)=>s.name));
 assert.deepEqual(repaired.skillPool.filter((s:any)=>s.isFifthSkill).map((s:any)=>s.name),['清璨星辰落']);
 for(const skill of repaired.skills){const old=saved.skills.find((s:any)=>s.name===skill.name);assert.equal(skill.pp,old.pp);assert.equal(skill.description,old.description);assert.deepEqual(skill.kit,old.kit);}
 assert.equal(applySavedSkillCorrections(repaired,DEFAULT_ELVES),repaired);
 const alternative=structuredClone(saved);alternative.skills=alternative.skills.slice(0,5);alternative.skills[1]=structuredClone(canonical.skillPool.find((s:any)=>s.name==='安魂曲'));
 assert.deepEqual(applySavedSkillCorrections(alternative,DEFAULT_ELVES).skills.map((s:any)=>s.name),alternative.skills.map((s:any)=>s.name),'不替換自選備招');
 const expected=['清璨星辰落','生塵眷盼','如日方升','遂心快意','蒼靈銜樂'];
 const team=prepareSavedBattleRoster([saved],[saved],false,'p1');
 assert.equal(team[0].skills.length,5,'啟動邊界也要修復九招，不能只依賴重開頁面的儲存修復');
 const engine=createBattleEngine({initialP1Team:team,initialP2Team:structuredClone(team),p1StarterId:team[0].battleId,p2StarterId:team[0].battleId,battleMode:'PVP',preparedTeams:true});
 const state=engine.getState();
 for(const side of ['p1','p2']){
  // 即使戰局內還帶有殘留旗標，畫面也只能有一個第五標記。
  const value={...state,phase:`${side}_select`};
  value[side].skills.find((s:any)=>s.name==='蒼靈銜樂').isFifthSkill=true;
  const selections:any[]=[];
  await act(async()=>root.render(<BattleContext.Provider value={value}><BattleScreenUI battleMode="PVP" onSkillSelect={(s:any,skill:any)=>selections.push([s,skill])} onSwitchElf={()=>{}} onUseItem={()=>{}} onReset={()=>{}} onBackToMenu={()=>{}} onAutoBattleToggle={()=>{}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={{}}/></BattleContext.Provider>));
  const buttons=[...document.querySelectorAll(`[data-act-side="${side}"] > button`)] as HTMLButtonElement[];
  assert.equal(buttons.length,5);
  assert.deepEqual(buttons.map(b=>expected.find(name=>b.textContent?.includes(name))),expected);
  assert.deepEqual(buttons.map(b=>b.textContent?.includes('第五')),[true,false,false,false,false]);
  for(const button of buttons)await act(async()=>button.click());
  assert.deepEqual(selections.map(([s,skill])=>[s,skill.name,skill.battleSlot]),expected.map((name,i)=>[side,name,[4,0,1,2,3][i]]));
  assert.deepEqual(selections.map(([,skill])=>skill.pp),expected.map(name=>saved.skills.find((s:any)=>s.name===name).pp));
 }
 // 普通技能威力再高也不是第五；明確標記的低威力技能仍是第五。
 for(const marked of [false,true]){
  const elf=structuredClone(state.p1);
  elf.skills=structuredClone(pipi.skills);
  elf.skills[0].power=200;
  elf.skills[4].power=1;
  if(marked)elf.skills[4].isFifthSkill=true;
  const value={...state,p1:elf,phase:'p1_select'};
  await act(async()=>root.render(<BattleContext.Provider value={value}><BattleScreenUI battleMode="PVP" onSkillSelect={()=>{}} onSwitchElf={()=>{}} onUseItem={()=>{}} onReset={()=>{}} onBackToMenu={()=>{}} onAutoBattleToggle={()=>{}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={{}}/></BattleContext.Provider>));
  const buttons=[...document.querySelectorAll('[data-act-side="p1"] > button')];
  const order=marked?[elf.skills[4],...elf.skills.slice(0,4)]:elf.skills;
  assert.deepEqual(buttons.map(b=>order.find((s:any)=>b.textContent?.includes(s.name))?.name),order.map((s:any)=>s.name));
  assert.equal(buttons.filter(b=>b.textContent?.includes('第五')).length,marked?1:0);
 }
 assert.deepEqual(saved,snapshot,'修復不改動輸入物件');
 console.log('九青：六種存檔修復、自訂積木與PP保留、備招保留、P1/P2實際技能列順序／唯一第五／點選槽位通過');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
