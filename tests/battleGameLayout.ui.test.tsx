// 原廠風對戰版面（2026-11-07）：常駐列用實際特性／特質資料、效果列可收起、可切回實用風、技能狀態（廢除／轉化／固有效果失效）。
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
const {createRoot}=await import('react-dom/client');
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const root=createRoot(document.getElementById('root')!);
let checks=0;const ok=(label:string)=>{checks++;console.log('✓ '+label);};
try {
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {prepareSavedBattleRoster}=await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
 const {createBattleEngine}=await server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {BattleContext}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
 const {BattleScreenUI}=await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');
 const {effectDefinitionEntries}=await server.ssrLoadModule('/src/battle/effectSources.ts');
 const {fifthSkillSlot}=await server.ssrLoadModule('/src/battle/skillSlot.ts');
 const elves:any[]=DEFAULT_ELVES;
 const base=elves.find(e=>fifthSkillSlot(e.skills)>=0 && e.skills.length>=5)!;
 const team=prepareSavedBattleRoster([base],[base],false,'p1');
 const engine=createBattleEngine({initialP1Team:team,initialP2Team:structuredClone(team),p1StarterId:team[0].battleId,p2StarterId:team[0].battleId,battleMode:'PVE',preparedTeams:true});
 const state=engine.getState();
 const ui=(value:any)=><BattleContext.Provider value={value}><BattleScreenUI battleMode="PVE" onSkillSelect={()=>{}} onSwitchElf={()=>{}} onUseItem={()=>{}} onReset={()=>{}} onBackToMenu={()=>{}} onAutoBattleToggle={()=>{}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={{}}/></BattleContext.Provider>;
 const render=async(value:any)=>{await act(async()=>root.render(ui(value)));};
 const withP1=(patch:(e:any)=>void)=>{const p1=structuredClone(state.p1);patch(p1);return {...state,p1,phase:'p1_select'};};

 // 一、預設為原廠風；常駐列只放實際的特性／特質（不出現佔位名稱），抗性用專屬圖示。
 const traitName='測試特性甲', alienName='測試特質乙';
 const value=withP1(e=>{
  e.trait={name:traitName,description:'特性說明'};
  e.alienTraits={exclusiveTrait:{name:alienName,description:'特質說明'}};
  e.resistances={damageResist:{crit:20,fixed:10,percent:5},statusResist:{slots:[],allImmune:false}};
 });
 localStorage.clear();
 await render(value);
 const rootEl=document.querySelector('[data-battle-root]')!;
 assert.equal(rootEl.getAttribute('data-layout'),'game');
 assert.equal(rootEl.getAttribute('data-gskin'),'tactical-cyan','原廠風預設外觀：戰術・青');ok('預設原廠風（戰術・青）');
 const passive=document.querySelector('[data-status-tray="p1"] [data-tray-row="passive"]')!;
 assert.ok(passive,'有常駐列');
 const expectedNames=effectDefinitionEntries(value.p1).filter((x:any)=>!x.soul).map((x:any)=>x.name);
 for(const n of [traitName,alienName])assert.ok(expectedNames.includes(n));
 for(const n of expectedNames)assert.ok(passive.textContent!.includes(n),`常駐列顯示 ${n}`);
 assert.ok(passive.querySelector('[data-sig="特性"]')&&passive.querySelector('[data-sig="特質"]'),'特性／特質分開標示');
 assert.ok([...passive.querySelectorAll('img')].some(img=>img.getAttribute('src')==='/seer/signbuff/1.png'),'抗性用印記 1 號圖');
 ok('常駐列：抗性＋實際特性／特質');

 // 二、護盾／護罩在血條下方（同一 HUD 內、HP 列之後）。
 await render(withP1(e=>{e.shield=300;e.barrier=200;}));
 const hud=document.querySelector('[data-hud="p1"]')!;
 const hp=hud.querySelector('.btg-hp')!, prot=hud.querySelector('[data-protection="p1"]')!;
 assert.ok(prot&&hp.compareDocumentPosition(prot)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'護盾列在血條之後');
 assert.ok(!hp.contains(prot)&&!prot.contains(hp),'不與血條同列');
 ok('護盾／護罩在血條下方');

 // 三、效果列可整排收起，再展開。
 await render(value);
 await act(async()=>{(document.querySelector('[data-tray-toggle]') as HTMLButtonElement).click();});
 assert.equal(document.querySelector('[data-tray-row]'),null,'收起後不渲染效果列');
 assert.equal(localStorage.getItem('battleTrayHidden'),'1');
 await act(async()=>{(document.querySelector('[data-tray-toggle]') as HTMLButtonElement).click();});
 assert.ok(document.querySelector('[data-tray-row="passive"]'),'展開後恢復');
 ok('效果列收起／展開（記住偏好）');

 // 四、技能狀態：單招廢除 → 蓋章且不可出招；全部廢除 → 整列提示；固有效果失效 → 標籤。
 const fifth=fifthSkillSlot(state.p1.skills);
 const other=[0,1,2,3,4].find(i=>i!==fifth)!;
 await render(withP1(e=>{e.skills[other].isAbolished=true;}));
 const abolished=[...document.querySelectorAll('[data-act-side="p1"] > button')].filter(b=>b.textContent!.includes('已廢除'));
 assert.equal(abolished.length,1);assert.equal(abolished[0].getAttribute('data-skill-disabled'),'true');
 await render(withP1(e=>{e.skills.forEach((s:any)=>{s.isAbolished=true;});}));
 assert.ok(document.querySelector('.btg-lock')?.textContent?.includes('所有技能已廢除'));
 assert.equal([...document.querySelectorAll('[data-act-side="p1"] > button')].filter(b=>b.textContent!.includes('已廢除')).length,5);
 await render(withP1(e=>{e.isInherentInvalid=true;}));
 assert.equal([...document.querySelectorAll('[data-act-side="p1"] > button')].filter(b=>b.textContent!.includes('固有效果失效')).length,5);
 ok('廢除／全部廢除／固有效果失效');

 // 五、可切回實用風（舊版完整保留），再切回原廠風。
 localStorage.setItem('battleLayoutStyle','classic');
 await act(async()=>{window.dispatchEvent(new window.Event('battle-layout-pref'));});
 await render(value);
 assert.equal(document.querySelector('[data-battle-root]')!.getAttribute('data-layout'),'classic');
 assert.ok(document.querySelector('.bt-skill'),'實用風技能列');
 assert.equal(document.querySelector('.btg-skill'),null);
 localStorage.setItem('battleLayoutStyle','game');
 await act(async()=>{window.dispatchEvent(new window.Event('battle-layout-pref'));});
 assert.equal(document.querySelector('[data-battle-root]')!.getAttribute('data-layout'),'game');
 ok('原廠風／實用風切換');
 console.log(`原廠風對戰版面 ${checks} 項通過`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
