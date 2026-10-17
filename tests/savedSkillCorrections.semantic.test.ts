import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const {createRoot}=await import('react-dom/client');
const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[],entries:[]}});
try{
  const {DEFAULT_ELVES:defaults}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {applySavedSkillCorrections:correct}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const canonical=defaults.find((e:any)=>e.id==='5024');
  const s=canonical.skills.find((s:any)=>s.name==='無限・虛數湮滅')||canonical.skillPool.find((s:any)=>s.name==='無限・虛數湮滅');
  assert.equal(s.priority,3);
  const oldSkill={...structuredClone(s),priority:1,pp:7,currentPp:2,description:s.description.replace('■ 先制+3\n','■ 先制+1\n'),kit:s.kit.map((e:any)=>e.params.property==='base_priority'?{...e,customText:'■ 先制+1',params:{...e.params,value:1}}:structuredClone(e))};
  const evs={hp:0,atk:252,def:0,spatk:0,spdef:0,speed:0};
  const old={...structuredClone(canonical),isCustom:true,skills:[oldSkill],skillPool:[structuredClone(oldSkill)],evs,shield:333};
  const snapshot=structuredClone(old),fixed=correct(old,defaults);
  assert.equal(fixed.skills[0].priority,3);assert.equal(fixed.skillPool[0].priority,3);assert.equal(fixed.skills[0].description,s.description);assert.deepEqual(fixed.skills[0].kit,s.kit);
  assert.equal(fixed.skills[0].pp,7);assert.equal(fixed.skills[0].currentPp,2);assert.deepEqual(fixed.evs,evs);assert.equal(fixed.shield,333);assert.deepEqual(old,snapshot);assert.equal(correct(fixed,defaults),fixed);
  const native={...old,skills:[{...oldSkill,kit:undefined,effectMode:undefined}],skillPool:[]};assert.deepEqual(correct(native,defaults).skills[0].kit,s.kit);
  const edited=structuredClone(old);edited.skills[0].kit[2].params.clause.body[0].acts[0].p.side='self';edited.skillPool=[];
  for(const protectedElf of [edited,{...old,id:'custom_5024'},{...old,id:'5023'},{...old,skills:[{...oldSkill,effectMode:'registry'}],skillPool:[]},{...old,skills:[{...oldSkill,description:oldSkill.description+'自訂'}],skillPool:[]}])assert.equal(correct(protectedElf,defaults),protectedElf);
  const {GameDataProvider,useGameData}=await server.ssrLoadModule('/src/contexts/GameDataContext.tsx');
  let shown:any;
  function Display(){shown=useGameData().allElves.find((e:any)=>e.id==='5024');return React.createElement('span',null,`${shown.skills[0].description}\n先制級：${shown.skills[0].priority}`);}
  for(const store of ['seer_default_elves_overrides','seer_custom_elves']){
    localStorage.clear();localStorage.setItem(store,JSON.stringify(store==='seer_custom_elves'?[old]:{'5024':old}));
    await act(async()=>root.render(React.createElement(GameDataProvider,{key:store},React.createElement(Display))));
    assert.match(document.getElementById('root')!.textContent!,/^■ 先制\+3\n/);assert.match(document.getElementById('root')!.textContent!,/先制級：3$/);assert.deepEqual(shown.skills[0].kit,s.kit);assert.equal(shown.skills[0].currentPp,2);
  }
  console.log('Saved source correction: exact old native/Kit, reserve pool, custom protection, immutable/idempotent and both real React storage routes passed');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
