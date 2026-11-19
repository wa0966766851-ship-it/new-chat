import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),ResizeObserver:class{observe(){}unobserve(){}disconnect(){}}});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const {createRoot}=await import('react-dom/client');
// 只替換資料庫邊界；禁選、選隊及原編號都操作正式 StartScreen。
(globalThis as any).__PEAK_TEST_ELVES__=Array.from({length:12},(_,i)=>({id:`test_${i}`,name:`原池精靈${i+1}`,type:'普通',level:100,maxHp:500,currentHp:500,baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},calculatedStats:{hp:500,atk:100,def:100,spatk:100,spdef:100,speed:100},skills:[],soulMark:{name:'測試',description:''}}));
const server=await createServer({configFile:false,plugins:[{name:'peak-fixture',enforce:'pre',transform(_:string,id:string){if(id.replaceAll('\\','/').endsWith('/contexts/GameDataContext.tsx'))return `export const useGameData=()=>({allElves:globalThis.__PEAK_TEST_ELVES__,customElves:[],deletedCount:0,updateElf:()=>{},deleteCustomElf:()=>{},restoreDeletedElves:()=>{},clearLocalCache:()=>{},forceReloadData:()=>{}});`;}}],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const root=createRoot(document.getElementById('root')!);
const click=async(e:HTMLElement)=>{assert.ok(e);await act(async()=>e.click());};
const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes(text))!;
const cards=(side:string)=>[...document.querySelectorAll<HTMLElement>(`[data-bp-card="${side}"]`)];
try{
 const {default:Start}=await server.ssrLoadModule('/src/components/StartScreen.tsx');
 for(const mode of ['PVE','PVP']){
  localStorage.clear();await act(async()=>root.render(React.createElement(Start,{key:mode,initialBattleFormat:'peak_6v6',initialBattleMode:mode,onStartBattle:()=>{}})));
  await click(button('開始對戰'));
  const originals=Object.fromEntries(['p1','p2'].map(side=>[side,cards(side).map(c=>c.dataset.instance)]));
  for(const side of ['p1','p2'])assert.equal(cards(side).length,12);
  for(const card of cards('p2').slice(0,3))await click(card);
  if(mode==='PVP')for(const card of cards('p1').slice(2,5))await click(card);
  assert.equal(button('確認禁用').disabled,false);await click(button('確認禁用'));
  for(const side of ['p1','p2']){
   const pool=cards(side);assert.equal(pool.length,12,`${mode}/${side} 被禁與未選用者保留原位`);
   assert.deepEqual(pool.map(c=>c.dataset.instance),originals[side]);
   assert.deepEqual(pool.map(c=>Number(c.querySelector<HTMLElement>('[data-bp-slot]')!.dataset.bpSlot)),Array.from({length:12},(_,i)=>i+1));
   const banned=pool.filter(c=>c.dataset.banned==='1');assert.equal(banned.length,3);
   for(const c of banned){assert.match(c.textContent!,/已禁用/);assert.equal(c.querySelector('[title*="首發"]'),null);}
   const before=pool.map(c=>c.textContent);await click(banned[0]);assert.deepEqual(cards(side).map(c=>c.textContent),before,'點擊已禁用卡不能改變編隊');
  }
  console.log(mode,'巔峰禁選：雙方12位原編號、禁用保留與禁止選用通過');
 }
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
