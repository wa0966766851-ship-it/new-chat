import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, SVGElement: dom.window.SVGElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  fetch: async () => ({ ok: false, json: async () => ({}) }) });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.matchMedia = ((media: string) => ({ media, matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any;
const { createRoot } = await import('react-dom/client');
const { GameDataProvider, useGameData } = await import('../src/contexts/GameDataContext');
const { default: StartScreen } = await import('../src/components/StartScreen');
const { DEFAULT_ELVES } = await import('../src/data/defaultElves');
const { calculateElfStats } = await import('../src/utils/elfStats');
const {default:dragonWrappers}=await import('../src/data/legacyDimensionalDragonWrappers.json');
const {effectRoute}=await import('../src/effects/effectConnection');
const {soulDefinition}=await import('../src/effects/soulDefinitionSource');
const root = createRoot(document.getElementById('root')!);

const launches:any[][]=[];
const click=async(e:HTMLElement|null)=>{assert.ok(e);await act(async()=>e!.click());};
const roster=DEFAULT_ELVES.slice(0,12).map((e,i)=>({...structuredClone(e),battleId:'r'+i,isExtra:i>=3}));
const oldDragon=structuredClone(DEFAULT_ELVES.find(e=>e.id==='5021')!);delete oldDragon.builtinEffectBindings;
oldDragon.soulMark={...oldDragon.soulMark!,...dragonWrappers.definitions[0],effectMode:'kit'} as any;
roster[1]={...oldDragon,battleId:'r1',isExtra:false};
localStorage.setItem('seer_default_elves_overrides',JSON.stringify({'5021':oldDragon}));
roster[0]={...roster[0],id:'custom_roster_source',name:'更新來源驗證',isCustom:true};
localStorage.setItem('seer_custom_elves',JSON.stringify([roster[0]]));
let data:any;function Probe(){data=useGameData();return null;}
for(const side of ['p1','p2'])localStorage.setItem('seer_last_used_'+side+'_team',JSON.stringify({team:roster,starterId:'r0'}));
// aegis 殼的賽制選單在 lazy 載入的 LegacyTeamWorkspace 內（Suspense fallback 為空）；先等它掛載，再驅動真實的賽制 <select>。
const formatSelect=()=>[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='peak_3v3'));
const mounted=async()=>{for(let i=0;i<200&&!formatSelect();i++)await act(async()=>{await new Promise(r=>setTimeout(r,25));});assert.ok(formatSelect(),'賽制選單（LegacyTeamWorkspace）已載入');};
const format=async(value:string)=>{await mounted();const el=formatSelect()!;assert.ok(el);await act(async()=>{el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});};
try{
 await act(async()=>root.render(<GameDataProvider><Probe/><StartScreen presentation="aegis" onNavigateToCustom={()=>{}} onStartBattle={(...args)=>launches.push(args)}/></GameDataProvider>));
 for(const peak of ['peak_3v3','peak_6v6']){
  await format(peak);await click(document.querySelector('.workspace-launch'));
  await format('normal_6v6');await click(document.querySelector('.workspace-launch'));
  const battle=launches.at(-1)!;assert.ok(battle);
  for(const team of [battle[1],battle[2]]){
   assert.equal(team.length,6);assert.ok(team.every((e:any)=>e.isExtra===false));
   assert.equal(team[0].initialBench.length,6);assert.ok(team[0].initialBench.every((e:any)=>e.isExtra===false),'待命快照也不能帶額外標記');
   assert.equal(effectRoute(soulDefinition(team[1]),true),'kit','舊倉庫覆寫與舊背包同時存在時，真實進戰資料仍須走新積木');
   assert.ok(team[1].soulMark.kit.some((e:any)=>JSON.stringify(e).includes('snapshot_resource_rule')),'實際選隊入口帶入死亡轉交積木');
  }
 }
 const latest=structuredClone(data.allElves.find((e:any)=>e.id==='custom_roster_source'));
 latest.soulMark={...latest.soulMark,name:'更新魂印',description:'玩家更新後的魂印',effectMode:'kit',kit:[]};
 latest.trait={name:'更新特質',description:'玩家更新後的特質',effectMode:'kit',kit:[]};latest.kit=[];
 await act(async()=>data.updateElf(latest));
 await click(document.querySelector('.workspace-launch'));
 for(const team of [launches.at(-1)![1],launches.at(-1)![2]]){
  assert.deepEqual(team[0].soulMark,latest.soulMark,'倉庫更新不換精靈，背包自動取得新魂印與空積木');
  assert.deepEqual(team[0].trait,latest.trait);assert.deepEqual(team[0].kit,[],'頂層舊積木也要同步清除');
 }
 const reload=document.querySelector('[data-team-side="p1"]')!;
 await click(reload.querySelector<HTMLElement>('[aria-label="載入紀錄"]'));
 await click(document.querySelector('.workspace-launch'));
 assert.deepEqual(launches.at(-1)![1][0].soulMark,latest.soulMark,'重新載入舊紀錄不能把新效果換回舊副本');
 console.log('倉庫更新與重新載入舊背包：魂印、特質、頂層積木同步通過');
 console.log('實際 StartScreen：污染存檔 + 巔峰3/6選禁 → 普通6v6，雙方出戰及待命身分通過');
}finally{await act(async()=>root.unmount());dom.window.close();}
process.exit(0);
