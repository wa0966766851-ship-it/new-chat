import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React,{act} from 'react';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
const {createRoot}=await import('react-dom/client');
const {default:Run}=await import('../src/components/InterstellarExploration/InterstellarRun');
const {loadRun,RUN_KEY}=await import('../src/modes/interstellar/runState');
const {generateLayerMap}=await import('../src/modes/interstellar/map');
const {buildExplorationSnapshot}=await import('../src/modes/interstellar/battleSnapshot');
const fixture:any={id:'e',name:'測試精靈',level:100,type:'普通',baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},skills:[{name:'a',type:'普通',category:'物理',power:10,pp:5}],soulMark:{name:'n',description:'',effectType:'none',effectValue:0}};
const elf=buildExplorationSnapshot(fixture,fixture.baseStats);const root=createRoot(document.getElementById('root')!);let launched:any;
const props={allElves:[elf],startingDiamonds:5,initialEquipType:'suit' as const,initialEquipId:'',selectedModifiers:['no_potions'],onEndRun:()=>{},onStartBattle:(p1:any,p2:any,mode:any,options:any)=>{launched={p1,p2,mode,options}}};
const click=async(label:string)=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent?.trim()===label);assert.ok(b,label);await act(async()=>b.click())};
try {
  await act(async()=>root.render(React.createElement(Run,props)));
  assert.equal(loadRun(localStorage).diamonds,5);
  await act(async()=>root.render(null));
  const nodes=generateLayerMap(1).map(n=>({...n,status:n.id==='L1-1a'?'current':n.id==='L1-start'?'unvisited':n.status}));
  const initial={...loadRun(localStorage),runElves:[elf],layers:[{id:1,nodes}],collectibles:[{id:'atk_bead'}],selectedModifiers:['no_potions']};
  localStorage.setItem(RUN_KEY,JSON.stringify(initial));
  await act(async()=>root.render(React.createElement(Run,{...props,selectedModifiers:[]})));
  assert.ok(document.body.textContent?.includes('0/2'),'禁藥令畫面顯示實際上限');
  const engage=[...document.querySelectorAll('button')].find(e=>e.textContent?.trim()==='ENGAGE NODE');
  // 實際節點按鈕啟動combat，隨後開戰交接並卸載探索。
  assert.ok(engage);await act(async()=>engage.click());await click('發動攻擊');
  assert.ok(launched);assert.equal(launched.options.interstellarOptions.maxPotionUsage,2);
  assert.ok(launched.p1[0].calculatedStats.atk>elf.calculatedStats.atk);
  await act(async()=>root.render(null));
  assert.equal(launched.options.interstellarOptions.onPotionUse(),true);
  const after={...launched.p1[0],currentHp:123,skills:[{...elf.skills[0],pp:2}]};
  launched.options.interstellarOptions.onBattleEnd('p1',[after]);
  const settled=loadRun(localStorage);assert.equal(settled.saerBeans,initial.saerBeans+80);assert.equal(settled.potionUsage,1);assert.equal(settled.runElves[0].currentHp,123);assert.equal(settled.runElves[0].skills[0].pp,2);
  launched.options.interstellarOptions.onBattleEnd('p1',[after]);assert.equal(loadRun(localStorage).saerBeans,settled.saerBeans);
  await act(async()=>root.render(React.createElement(Run,{...props,selectedModifiers:[]})));
  assert.ok(document.body.textContent?.includes('戰鬥勝利'));await click('返回地圖');
  assert.equal(loadRun(localStorage).lastBattleResult,null);assert.deepEqual(loadRun(localStorage).selectedModifiers,['no_potions']);
  console.log('真實探索元件：新局5鑽、藏品還原、開戰卸載、藥劑／結算／HP與PP／重掛通過');
} finally {await act(async()=>root.unmount());dom.window.close()}

