import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
const dom = new JSDOM('<div class="ecl-root"><div id="root"></div></div>', {url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,SVGElement:dom.window.SVGElement,IS_REACT_ACT_ENVIRONMENT:true,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:(f:any)=>setTimeout(()=>f(performance.now()),0),cancelAnimationFrame:clearTimeout});
const {createRoot}=await import('react-dom/client');
const E=await import('../src/modes/interstellar/v2/engine');
const {DEFAULT_ELVES:pool}=await import('../src/data/defaultElvesLoaded');
const {default:Recruit}=await import('../src/components/InterstellarExploration/eclipse/Recruit');
const {RecruitScene}=await import('../src/components/InterstellarExploration/eclipse/Scenes');
const root=createRoot(document.getElementById('root')!);
let run:any=E.createRun({pool,equipType:'suit',equipId:'',modifiers:[],startingShards:99,seed:7});
for(const id of run.scene.offer.slice(0,3))run=E.toggleDraft(run,id);
run=E.confirmDraft(run,pool);
const base=structuredClone(run);
let Component:any=Recruit;
const render=()=>root.render(<Component run={run} pool={pool} dispatch={(f:any)=>{run=E.saveRunV2(localStorage,f(run));render();}}/>);
const click=async(el:any)=>{assert.ok(el);await act(async()=>el.click());};
const buttons=()=>[...document.querySelectorAll<HTMLButtonElement>('button')];
try{
 for(const slot of [0,1,2]){
  localStorage.clear();run=structuredClone(base);Component=Recruit;
  await act(async()=>root.render(null));await act(async()=>render());
  await click(document.querySelector('[data-testid=recruit-shards]'));
  const cards=buttons().filter(e=>e.querySelector('[data-price]'));
  assert.ok(cards.length>3);const before=run.team.length;
  await click(cards[slot]);assert.equal(run.team.length,before+1,`星晶招募第${slot+1}位`);
 }
 localStorage.clear();run=E.mintToken(E.mintToken(structuredClone(base),{kind:'any',types:[],match:'has',tier:'apex'}),{kind:'any',types:[],match:'has',tier:'apex'});
 Component=Recruit;await act(async()=>root.render(null));await act(async()=>render());
 for(const slot of [1,2]){
  await click(buttons().find(e=>e.textContent==='免費招募'));
  const cards=buttons().filter(e=>e.querySelector('[data-price="free"]'));assert.ok(cards.length>3);
  const before=run.team.length;await click(cards[slot]);assert.equal(run.team.length,before+1);
 }
 assert.equal(run.tokens.length,0);
 for(const slot of [0,1,2]){
  localStorage.clear();run=structuredClone(base);const ids=E.shardCandidates(run,pool).slice(0,3).map(e=>String(e.id));
  run.scene={kind:'recruit',offer:ids,note:'多候選測試'};Component=RecruitScene;
  await act(async()=>root.render(null));await act(async()=>render());
  await click(document.querySelectorAll('[data-pick=elf]')[slot]);
  await click(document.querySelector('[data-testid=pick-confirm]'));
  assert.ok(run.team.some((e:any)=>String(e.id)===ids[slot]));assert.equal(run.scene.kind,'map');
 }
 localStorage.clear();run=E.mintToken(structuredClone(base),{kind:'any',types:[],match:'has',tier:'apex'});Component=Recruit;
 await act(async()=>root.render(null));await act(async()=>render());await click(buttons().find(e=>e.textContent==='免費招募'));
 let cards=buttons().filter(e=>e.querySelector('[data-price="free"]'));const card=cards[1];
 const img=card.querySelector('img');assert.ok(img,'候選頭像');
 await act(async()=>img.dispatchEvent(new dom.window.Event('error',{bubbles:false})));
 const before=run.team.length;
 await click(card.querySelector('img,svg'));
 assert.equal(run.team.length,before+1,'頭像載入失敗後，點候選頭像仍須招募，不能被重試吞掉');
 assert.equal(run.tokens.length,0,'成功招募後消耗招募券');
 console.log('多候選招募、連續同款券、三選一、載入失敗頭像點擊招募：通過');
}finally{await act(async()=>root.unmount());dom.window.close();}
process.exit(0);
