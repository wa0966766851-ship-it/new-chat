import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';

const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame:(fn:any)=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout,alert:()=>{}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
(window as any).__BATTLE_FAST__=true;
const {createRoot}=await import('react-dom/client');
const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
let checks=0;
async function click(text:string) {const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);assert.ok(b,text);await act(async()=>b.click());}
try {
  const {ElfBlocklyPanel:Panel}=await server.ssrLoadModule('/src/components/ElfBlocklyPanel.tsx');
  const {default:Editor}=await server.ssrLoadModule('/src/components/ElfEditor.tsx');
  const {default:Battle}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {resetPrd}=await server.ssrLoadModule('/src/utils/prd.ts');
  const {getStatuses}=await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const original=JSON.stringify(DEFAULT_ELVES);
  const skill={name:'自訂引用技能',description:'🎯 恢復自身37點體力',category:'物理',type:'普通',power:40,pp:10,maxPp:10,isSureHit:true};
  const initial:any={...structuredClone(DEFAULT_ELVES[0]),id:'preset-custom',name:'自訂引用精靈',isCustom:true,trait:undefined,alienTraits:undefined,
    soulMark:{name:'空魂印',description:'',effectType:'none',effectValue:0},kit:[],skills:[skill]};
  let writes=0;
  const applySkill=(i:number,kit:any)=>{writes++;initial.skills[i]={...initial.skills[i],kit,effectMode:'kit'};};
  await act(async()=>root.render(React.createElement(Panel,{elf:initial,elfName:initial.name,soulKit:[],skills:initial.skills,
    onSoulKitChange:()=>writes++,onSkillKitChange:applySkill,onSoulModeChange:()=>writes++,onSkillModeChange:(i:number,mode:string)=>{writes++;initial.skills[i].effectMode=mode;},
    onTraitChange:()=>writes++,onInsertSoulDesc:()=>writes++,onInsertSkillDesc:()=>writes++,onReplaceSoulDesc:()=>writes++,
    onReplaceSkillDesc:(i:number,text:string)=>{writes++;initial.skills[i].description=text;}})));
  const selector=document.querySelector('[aria-label="積木編輯對象"]') as HTMLSelectElement;
  await act(async()=>{selector.value='0';selector.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.match(document.querySelector('[aria-label="預設積木"]')!.textContent!,/恢復自身37點體力/);
  assert.equal(writes,0);assert.equal(document.querySelector('.blocklySvg'),null);checks++;
  await click('套用既存效果');
  for(let i=0;i<80&&!document.querySelector('article button:not(:disabled)');i++) await act(async()=>{await new Promise(r=>setTimeout(r,20));});
  const search=document.querySelector('[aria-label="搜尋可套用效果"]') as HTMLInputElement;assert.ok(search);
  await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(search,'雙重暗影');search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  assert.ok(document.querySelectorAll('article').length>0);
  assert.ok(document.querySelectorAll('article').length<=12,'效果庫一頁最多12個卡片，不建立全庫畫布');
  const card=[...document.querySelectorAll('article')].find(a=>a.textContent?.includes('雙重暗影'))!;assert.ok(card);
  const use=card.querySelector('button')!;assert.equal(use.disabled,false);
  dom.window.confirm=()=>false;await act(async()=>use.click());assert.equal(writes,0);assert.equal(initial.skills[0].name,'自訂引用技能');checks++;
  dom.window.confirm=()=>true;await act(async()=>use.click());
  assert.equal(writes,3);assert.equal(initial.skills[0].name,'自訂引用技能');assert.equal(initial.skills[0].maxPp,10);
  assert.equal(initial.skills[0].description,'🎯 令對手防禦-1\n🎯 100%令對手進入害怕狀態');
  assert.equal(initial.skills[0].kit[0].params.def,-1);assert.equal(initial.skills[0].kit[1].params.status,'害怕');
  assert.equal(document.querySelector('[aria-label="可執行效果庫"]'),null);assert.equal(JSON.stringify(DEFAULT_ELVES),original);checks++;
  let saved:any;
  await act(async()=>root.render(React.createElement(Editor,{initialElf:initial,onSaveElf:(elf:any)=>saved=elf,onBack:()=>{}})));
  await click('儲存精靈修改');assert.ok(saved);assert.deepEqual(saved.skills[0].kit,initial.skills[0].kit);assert.equal(saved.skills[0].effectMode,'kit');
  const restored=parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:saved})).elf;
  assert.deepEqual(restored.skills[0].kit,saved.skills[0].kit);checks++;
  const {EffectBlockToggle}=await server.ssrLoadModule('/src/components/EffectBlockToggle.tsx');
  await act(async()=>root.render(React.createElement('div',null,...[true,false].map((open,i)=>React.createElement('details',{key:i,open,'data-profile-detail':i},
    React.createElement('summary',null,`技能${i}`),React.createElement(EffectBlockToggle,{elf:initial,skill:initial.skills[0]},'原文備援'))))));
  assert.equal(document.querySelector('[aria-label="預設積木"]'),null,'精靈描述預設為文字，不自動載入積木');
  assert.ok(document.querySelector('[data-profile-detail="0"]')!.textContent!.includes('原文備援'),'預設顯示原文描述');
  const toggleBlocks=async(i:number)=>{const b=[...document.querySelectorAll(`[data-profile-detail="${i}"] nav button`)].find(b=>b.textContent?.trim()==='積木／實裝核對') as HTMLButtonElement;assert.ok(b,'積木檢視切換');await act(async()=>b.click());};
  await toggleBlocks(0);
  for(let i=0;i<80&&!document.querySelector('[data-profile-detail="0"] [aria-label="預設積木"]');i++) await act(async()=>{await new Promise(r=>setTimeout(r,20));});
  assert.ok(document.querySelector('[data-profile-detail="0"] [aria-label="預設積木"]'),'已展開技能預設展示結構化積木');
  assert.equal(document.querySelector('[data-profile-detail="1"] [aria-label="預設積木"]'),null,'收合技能不建立效果檢視');
  assert.equal(document.querySelector('.blocklySvg'),null);checks++;
  const closed=document.querySelector('[data-profile-detail="1"]') as HTMLDetailsElement;
  await toggleBlocks(1);assert.equal(closed.querySelector('[aria-label="預設積木"]'),null,'收合中即使切到積木檢視也不建立');
  await act(async()=>{closed.open=true;closed.dispatchEvent(new dom.window.Event('toggle'));});
  assert.ok(closed.querySelector('[aria-label="預設積木"]'));assert.equal(JSON.stringify(DEFAULT_ELVES),original);checks++;
  const make=(id:string,speed:number):any=>({id,battleId:id,name:id,type:'普通',level:100,currentHp:4000,maxHp:4000,
    baseStats:{hp:4000,atk:100,def:1000,spatk:100,spdef:1000,speed},calculatedStats:{hp:4000,atk:100,def:1000,spatk:100,spdef:1000,speed},statStages:{def:0},
    skills:[{name:'等待',type:'普通',category:'屬性',power:0,pp:10,maxPp:10}]});
  let driver:any;
  for(const side of ['p1','p2']) for(const sealed of [false,true]) {
    const self={...make('preset-holder',200),isCustom:true,skills:[{...restored.skills[0],accuracy:100,isSureHit:true}],isAdditionalInvalid:sealed};
    const target=make('preset-target',100);
    await act(async()=>root.render(React.createElement(Battle,{key:`${side}/${sealed}`,initialP1Team:[side==='p1'?self:target],initialP2Team:[side==='p2'?self:target],
      p1StarterId:side==='p1'?self.id:target.id,p2StarterId:side==='p2'?self.id:target.id,battleMode:'PVP',preparedTeams:true,onBackToMenu:()=>{},onDriverInit:(d:any)=>driver=d})));
    resetPrd(()=>0);
    await act(async()=>{driver.onSkillSelect('p1',driver.getSyncState().p1.skills[0]);driver.onSkillSelect('p2',driver.getSyncState().p2.skills[0]);});
    for(let i=0;i<150&&!(driver.getSyncState().turnNumber===2&&driver.getSyncState().phase==='p1_select');i++) await act(async()=>{await new Promise(r=>setTimeout(r,20));});
    const state=driver.getSyncState(),opp=side==='p1'?'p2':'p1';
    assert.equal(state.turnNumber,2);assert.equal(state.phase,'p1_select');assert.equal(state[opp].statStages.def,sealed?0:-1);
    assert.equal(Number(getStatuses(state[opp])['害怕']||0)>0,!sealed);
    assert.ok(state[opp].currentHp<4000);assert.equal(state[side].skills[0].pp,9);checks++;
  }
  console.log(`預設展示→效果庫搜尋／取消／套用→編輯儲存→圖紙重載→真實雙側戰鬥 ${checks} 項通過；未開啟前端視窗。`);
} finally {await act(async()=>root.unmount());await server.close();dom.window.close();}
