import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import legacyRey from '../src/data/legacyReyDescriptions.json';
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
  for(const protectedElf of [edited,{...old,id:'custom_5024'},{...old,id:'5023'},{...old,skills:[{...oldSkill,effectMode:'registry'}],skillPool:[]},{...old,skills:[{...oldSkill,description:oldSkill.description+'自訂'}],skillPool:[]}]){ const result=correct(protectedElf,defaults); assert.deepEqual({...result,builtinEffectBindings:undefined},{...protectedElf,builtinEffectBindings:undefined},'自訂效果與配裝不變；允許其他內建效果登記來源'); }
  const {GameDataProvider,useGameData}=await server.ssrLoadModule('/src/contexts/GameDataContext.tsx');
  let shown:any;
  function Display(){shown=useGameData().allElves.find((e:any)=>e.id==='5024');return React.createElement('span',null,`${shown.skills[0].description}\n先制級：${shown.skills[0].priority}`);}
  for(const store of ['seer_default_elves_overrides','seer_custom_elves']){
    localStorage.clear();localStorage.setItem(store,JSON.stringify(store==='seer_custom_elves'?[old]:{'5024':old}));
    await act(async()=>root.render(React.createElement(GameDataProvider,{key:store},React.createElement(Display))));
    assert.match(document.getElementById('root')!.textContent!,/^■ 先制\+3\n/);assert.match(document.getElementById('root')!.textContent!,/先制級：3$/);assert.deepEqual(shown.skills[0].kit,s.kit);assert.equal(shown.skills[0].currentPp,2);
  }
  console.log('Saved source correction: exact old native/Kit, reserve pool, custom protection, immutable/idempotent and both real React storage routes passed');
  const {syncOtherworldReyDescriptions:syncRey}=await server.ssrLoadModule('/src/data/otherworldReyDescriptions.ts');
  const {createBattleEngine}=await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const rey=defaults.find((e:any)=>e.id==='5029');
  const oldRey=structuredClone(rey);
  for(const definition of [oldRey.soulMark,oldRey.alienTraits.gen2Trait,...oldRey.alienTraits.exclusiveTraits]){
    delete definition.kit;delete definition.effectMode;
    const old=legacyRey.definitions.find(d=>d.name===definition.name);
    if(old)definition.description=old.description;
  }
  oldRey.skills[0].pp=3;oldRey.evs={hp:252,atk:0,def:0,spatk:0,spdef:0,speed:0};
  const restored=syncRey(correct(oldRey,defaults));
  assert.deepEqual(restored.soulMark.kit,rey.soulMark.kit);
  assert.deepEqual(restored.alienTraits.exclusiveTraits,rey.alienTraits.exclusiveTraits,'同步文字不得丟棄特質積木');
  assert.equal(restored.skills[0].pp,3);assert.deepEqual(restored.evs,oldRey.evs);
  const once=correct(oldRey,defaults);assert.equal(correct(once,defaults),once);
  assert.deepEqual(correct({...oldRey,isCustom:true},defaults).soulMark.kit,rey.soulMark.kit,'內建精靈只改配裝也會標 isCustom，不應漏遷移');
  for(const protectedElf of [{...oldRey,isCustom:true,name:'我的自訂精靈'},{...oldRey,id:'custom_5029'},
    {...oldRey,soulMark:{...oldRey.soulMark,description:'自訂魂印'}},
    {...oldRey,soulMark:{...oldRey.soulMark,effectMode:'registry'}}]){
    assert.equal(correct(protectedElf,defaults).soulMark,protectedElf.soulMark);
  }
  for(const store of ['seer_default_elves_overrides','seer_custom_elves']){
    let loaded:any;
    function ReiDisplay(){loaded=useGameData().allElves.find((e:any)=>e.id==='5029');return React.createElement('span',null,loaded.name);}
    localStorage.clear();localStorage.setItem(store,JSON.stringify(store==='seer_custom_elves'?[oldRey]:{'5029':oldRey}));
    await act(async()=>root.render(React.createElement(GameDataProvider,{key:'rey'+store},React.createElement(ReiDisplay))));
    assert.deepEqual(loaded.soulMark.kit,rey.soulMark.kit);
    assert.deepEqual(loaded.alienTraits.exclusiveTraits,rey.alienTraits.exclusiveTraits);
    for(const side of ['p1','p2']){
      const self=structuredClone(loaded);self.battleId='saved-rey';
      const enemy=structuredClone(defaults.find((e:any)=>e.id==='5001'));
      Object.assign(enemy,{id:'copy-target',battleId:'copy-target',name:'複製對象',soulMark:undefined,trait:undefined,alienTraits:undefined,statStages:{atk:2,def:3}});
      const p1=side==='p1'?self:enemy,p2=side==='p2'?self:enemy;
      const engine=createBattleEngine({initialP1Team:[p1],initialP2Team:[p2],p1StarterId:p1.battleId,p2StarterId:p2.battleId,preparedTeams:true,battleMode:'PVP',isFast:()=>true});
      try{engine.mount();engine.start();await engine.idle();const actual=engine.getState()[side];
        assert.equal(actual.statStages.atk,2,`${store}/${side}選招前複製攻擊`);
        assert.equal(actual.statStages.def,3,`${store}/${side}選招前複製防禦`);
        assert.equal(actual.suppressAbnormalSideEffectsWhenParalyzed,true,'正式魂印旗標');
        assert.ok(actual.survivalRule?.active,'正式神明特質已執行');
      }finally{engine.unmount();}
    }
  }
  console.log('Rey saved data: both real React storage routes × P1/P2 copy before selection, soul flags and god trait passed');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
