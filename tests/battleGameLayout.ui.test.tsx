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
 const ui=(value:any)=><BattleContext.Provider value={value}><BattleScreenUI battleMode="PVE" loadouts={{p1:{suit:"future_armor",flame:"flame_gold"},p2:{eyewear:"roamer_as"}}} onSkillSelect={()=>{}} onSwitchElf={()=>{}} onUseItem={()=>{}} onReset={()=>{}} onBackToMenu={()=>{}} onAutoBattleToggle={()=>{}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={{}}/></BattleContext.Provider>;
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
 const {INTERCEPTOR_EFFECTS}=await server.ssrLoadModule('/src/utils/destinyGacha.ts');
 for(const layout of ['game','classic']) {
  localStorage.setItem('battleLayoutStyle',layout);
  await act(async()=>window.dispatchEvent(new dom.window.Event('battle-layout-pref')));
  await render(withP1(e=>{e.destinyRank='C';e.interceptorEffect=INTERCEPTOR_EFFECTS.block_attack;}));
  assert.equal(document.querySelector('[data-battle-root]')!.getAttribute('data-layout'),layout);
  const chip=[...document.querySelectorAll<HTMLButtonElement>('button[title]')].find(b=>b.title.includes('C級命運攔截'));
  assert.ok(chip,`${layout} 顯示C級攔截`);assert.ok(chip.title.includes(INTERCEPTOR_EFFECTS.block_attack.description));
 }
 localStorage.setItem('battleLayoutStyle','game');await act(async()=>window.dispatchEvent(new dom.window.Event('battle-layout-pref')));
 ok('原廠風與實用風顯示C級攔截名稱及完整描述');


 const controls = document.querySelector('[data-battle-controls]')!;
 const trigger = controls.querySelector<HTMLButtonElement>('[aria-expanded]')!;
 assert.equal(trigger.getAttribute('aria-expanded'), 'false');
 assert.equal(controls.querySelector('[data-pass-button]'), null);
 await act(async()=>trigger.click());
 assert.equal(trigger.getAttribute('aria-expanded'), 'true');
 assert.ok(controls.querySelector('[data-pass-button]'));
 await act(async()=>trigger.click());
 assert.equal(controls.querySelector('[data-pass-button]'), null);
 ok('對戰控制預設收合，點擊可展開與收回');

 // 二、護盾／護罩在血條下方（同一 HUD 內、HP 列之後）。
 await render(withP1(e=>{e.shield=300;e.barrier=200;}));
 const hud=document.querySelector('[data-hud="p1"]')!;
 const hp=hud.querySelector('.btg-hp')!, prot=hud.querySelector('[data-protection="p1"]')!;
 assert.ok(prot&&hp.compareDocumentPosition(prot)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'護盾列在血條之後');
 assert.ok(!hp.contains(prot)&&!prot.contains(hp),'不與血條同列');
 ok('護盾／護罩在血條下方');
 const press=async(selector:string)=>{const button=document.querySelector<HTMLButtonElement>(selector);assert.ok(button,selector);await act(async()=>button.click());};
 await press('[data-battle-loadout="p1"]');
 const loadout=document.querySelector('[role="dialog"][aria-label="P1 本場配裝"]')!;
 assert.match(loadout.textContent!,/戰鬥火焰/);
 assert.match(loadout.textContent!,/未來/);
 assert.ok(loadout.querySelector('img'),'套裝用既有圖片');
 await press('[aria-label="關閉效果詳情"]');
 await press('[data-battle-loadout="p2"]');
 assert.match(document.querySelector('[role="dialog"][aria-label="P2 本場配裝"]')!.textContent!,/目鏡/);
 await press('[aria-label="關閉效果詳情"]');
 await render({...value,battleFormat:'peak_6v6'});
 await press('[data-battlefield]');
 assert.match(document.querySelector('[role="dialog"][aria-label="巔峰場地"]')!.textContent!,/50.*額外精靈/);
 await press('[aria-label="關閉效果詳情"]');
 ok('雙方配裝圖與火焰、巔峰場地實際規則可查看');

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
 // 六、道具：新分類與搜尋（名稱／效果／異常名，空白分隔全部符合）。
 await render(value);
 await act(async()=>{([...document.querySelectorAll('.btg-cmd')].find(b=>b.getAttribute('data-en')==='ITEM') as HTMLButtonElement).click();});
 const search=document.querySelector('[data-item-search] input') as HTMLInputElement;
 assert.ok(search,'道具頁有搜尋框');
 for(const label of ['持續恢復','攻擊・干擾','附加異常','強化狀態'])assert.ok(document.body.textContent!.includes(label),`分類 ${label}`);
 const typeQuery=async(q:string)=>{await act(async()=>{const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!;setter.call(search,q);search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 // 原廠風卡片只留名稱與數量；說明在上方資訊列，比對時以道具目錄的名稱＋說明為準。
 const {BATTLE_ITEMS}=await server.ssrLoadModule('/src/utils/battleHelpers.ts');
 const names=()=>[...document.querySelectorAll('[data-item-stock]')].map(e=>{const it=BATTLE_ITEMS.find((x:any)=>x.id===e.getAttribute('data-item-stock'));return `${it?.name} ${it?.description}`;});
 await typeQuery('麻痺');
 assert.ok(names().some(t=>t.includes('麻痺藥劑'))&&!names().some(t=>t.includes('全滿體力藥劑')),'依異常名搜尋');
 await typeQuery('不在場 體力');
 assert.ok(names().length>0&&names().every(t=>t.includes('體力')),'多關鍵字同時符合');
 await typeQuery('不存在的道具');
 assert.ok(document.querySelector('[data-item-empty]'),'無結果提示');
 await typeQuery('');
 const tile=document.querySelector('.btg-item') as HTMLButtonElement;
 assert.ok(tile&&!tile.textContent!.includes('回復'),'卡片不放說明');
 await act(async()=>{tile.dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true}));});
 assert.ok(document.querySelector('[data-item-desc]')?.getAttribute('data-item-desc'),'移上時說明出現在上方資訊列');
 ok('道具新分類與搜尋');
 // 七、藥劑不鎖按鈕：不能用時仍可點、顯示原因（不改用 disabled）。
 await typeQuery('');
 await render({...value,phase:'resolving'});
 await act(async()=>{([...document.querySelectorAll('.btg-cmd')].find(b=>b.getAttribute('data-en')==='ITEM') as HTMLButtonElement).click();});
 const potionBtn=document.querySelector('[data-item-unusable]') as HTMLButtonElement;
 assert.ok(potionBtn&&!potionBtn.disabled&&potionBtn.getAttribute('aria-disabled')==='true','不能用的藥劑仍可點開查看');
 await act(async()=>{potionBtn.click();});
 assert.ok(document.querySelector('[data-item-notice]')?.textContent?.includes('目前不是選擇階段'),'點下顯示原因');
 ok('藥劑：可看不可用＋原因');

 // 八、背包：技能一覽（PP／可否使用），廢除照樣顯示資訊。
 const bag = withP1(e=>{e.skills[other].isAbolished=true;});
 const extra = {...structuredClone(bag.p1), battleId:'extra', name:'額外測試', isExtra:true};
 const reserve = {...structuredClone(bag.p1), battleId:'reserve', name:'普通測試'};
 await render({...bag,p1Team:[bag.p1,extra,reserve]});
 await act(async()=>{([...document.querySelectorAll('.btg-cmd')].find(b=>b.getAttribute('data-en')==='TEAM') as HTMLButtonElement).click();});
 const benchRail=document.querySelector<HTMLElement>('[data-bench-scroll]')!;
 assert.deepEqual([...benchRail.querySelectorAll('[data-bench-idx]')].map(element=>element.getAttribute('data-bench-idx')), ['0','2','1'], '普通精靈先列，並保留實際換人索引');
 const benchCard=benchRail.querySelector<HTMLButtonElement>('[data-bench-idx]')!;
 const pointer=(target: HTMLElement,type:string,x:number,timeStamp:number)=>{
  const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x});
  Object.defineProperties(event,{pointerType:{value:'mouse'},pointerId:{value:1},timeStamp:{value:timeStamp}});
  target.dispatchEvent(event);
 };
 await act(async()=>{pointer(benchCard,'pointerdown',100,10);pointer(benchCard,'pointermove',30,30);});
 assert.equal(benchRail.scrollLeft,70,'橫拖卡片移動精靈列');
 await act(async()=>{pointer(benchCard,'pointerup',30,130);benchCard.click();});
 assert.ok(document.querySelector('[data-bench-scroll]'),'橫拖後仍停留在換人清單');
 await act(async()=>{(document.querySelector('[data-team-view-skills]') as HTMLButtonElement).click();});
 const table=document.querySelector('[data-team-skill-table]')!;
 assert.ok(table,'切換為技能一覽');
 assert.deepEqual([...table.querySelectorAll('h4')].map(heading=>heading.textContent), ['普通精靈','額外精靈']);
 assert.ok(table.textContent!.includes('已廢除'),'廢除技能仍列出並標示');
 assert.ok(/PP \d+\/\d+/.test(table.textContent!),'列出 PP');
 ok('背包技能一覽');
 console.log(`原廠風對戰版面 ${checks} 項通過`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
