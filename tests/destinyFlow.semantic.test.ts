import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React,{act} from 'react';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,
  HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,
  getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(f,0),cancelAnimationFrame:clearTimeout});
const {createRoot}=await import('react-dom/client');
const {default:Wheel}=await import('../src/components/DestinyWheelScreen');
const elves=Array.from({length:20},(_,i):any=>({id:String(i),name:`卡${i}`,type:'普通',level:100,destinyRank:i===0?'S':i<4?'A':i<8?'C':'B',
  currentHp:500,maxHp:500,baseStats:{hp:100,atk:100,def:100,spatk:100,spdef:100,speed:100},calculatedStats:{hp:500},skills:[],
  soulMark:{name:'n',description:'',effectType:'none',effectValue:0}}));
const root=createRoot(document.getElementById('root')!);let launched:any;
const click=async(label:string)=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent?.includes(label));assert.ok(b,label);assert.equal(b.disabled,false);await act(async()=>b.click())};
try {
  await act(async()=>root.render(React.createElement(Wheel,{allElves:elves,onBack:()=>{},onStartBattle:(...args:any[])=>launched=args})));
  await click('立即前往抽卡');await act(async()=>{await new Promise(r=>setTimeout(r,1550))});
  const hidden=[...document.querySelectorAll('span')].filter(e=>e.textContent==='點擊翻開此牌');assert.equal(hidden.length,24);
  await act(async()=>hidden[0].click());assert.ok(document.body.textContent?.includes('1 / 24'));
  await click('點一次全翻所有牌');assert.ok(document.body.textContent?.includes('24 / 24'));
  await click('下一步：進入 Ban');
  const section=[...document.querySelectorAll('h4')].find(e=>e.textContent?.includes('點擊敵方'))?.parentElement;
  assert.ok(section);const cards=[...section.querySelectorAll<HTMLElement>('.cursor-pointer')];assert.equal(cards.length,12);
  for(const card of cards.slice(0,3))await act(async()=>card.click());
  await click('確認禁用');assert.ok(document.body.textContent?.includes('6 / 6'));
  await click('啟動巔峰對決');assert.ok(launched);
  const [,p1,p2,first1,first2]=launched;
  assert.equal(p1.length,6);assert.equal(p2.length,6);
  assert.ok(p1.some((e:any)=>e.battleId===first1));assert.ok(p2.some((e:any)=>e.battleId===first2),'P2首發使用正確戰鬥實例');
  assert.equal(new Set([...p1,...p2].map(e=>e.battleId)).size,12,'雙方實例不衝突');
  await act(async()=>root.render(React.createElement(Wheel,{key:'empty',allElves:[],onBack:()=>{},onStartBattle:()=>{throw Error('短池不能開戰')}})));
  await click('立即前往抽卡');assert.ok(document.querySelector('[role="alert"]')?.textContent?.includes('卡池不足'));
  console.log('真實命運元件：單翻1/24、全翻、Ban3／Pick6、双首發身份與短池提示通過');
} finally {await act(async()=>root.unmount());dom.window.close()}
