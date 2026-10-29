import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import desktop from '../src/data/legacyCorruptedReyDesktop.json';
import legacy from '../src/data/legacyCorruptedReyDefinitions.json';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const {createRoot}=await import('react-dom/client');
const root=createRoot(document.getElementById('root')!);
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const {DEFAULT_ELVES:defaults}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {GameDataProvider,useGameData}=await server.ssrLoadModule('/src/contexts/GameDataContext.tsx');
 const {ElfReadOnlyProfile}=await server.ssrLoadModule('/src/components/ElfReadOnlyProfile.tsx');
 const {prepareSavedBattleRoster}=await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
 const {repairSavedBuiltinStorage}=await server.ssrLoadModule('/src/data/savedBuiltinStorage.ts');
 const sources=[desktop[0],legacy.find(e=>e.id==='707070')!];
 for(const old of sources){
  const source=defaults.find((e:any)=>e.id===old.id);
  const saved={...structuredClone(source),soulMark:structuredClone(old.soulMark)};
  if(old.id==='7070')saved.destinyRank='A';
  saved.skills=saved.skills.map((s:any)=>({...s,...structuredClone(old.skills.find(v=>v.name===s.name)||{})}));
  localStorage.clear();localStorage.setItem('seer_default_elves_overrides',JSON.stringify({[saved.id]:saved}));
  let warehouse:any;
  function Probe(){const {allElves}=useGameData();warehouse=allElves.find((e:any)=>e.id===saved.id);return <ElfReadOnlyProfile elf={warehouse} onClose={()=>{}}/>;}
  const check=()=>{const text=document.body.textContent!;
   assert.ok(text.includes(old.id==='7070'?'對手不處於能力提升狀態則自身先制+1且使用技能後100%令對手繳械':'對手不處於能力提升狀態則自身所有技能先制+2且使用技能後100%令對手繳械'));
   for(const phrase of ['繳械:弱化類異常，限制類異常','選擇技能階段令選擇的技能PP值歸0','麻痺:控制類異常'])assert.ok(text.includes(phrase),phrase);
   if(old.id==='707070')for(const phrase of ['入魔：附屬類異常','下次使用攻擊技能時額外附加自身最大體力70%*n'])assert.ok(text.includes(phrase),phrase);
  };
  await act(async()=>root.render(<GameDataProvider><Probe/></GameDataProvider>));
  check();assert.equal(warehouse.soulMark.description,source.soulMark.description,'圖鑑資料來源不能被舊覆寫蓋回');
  if(old.id==='7070')assert.equal(warehouse.destinyRank,'B','圖鑑資料須接收新分級');
  const battle=prepareSavedBattleRoster([saved],[warehouse],false,'p1')[0];
  assert.deepEqual(battle.soulMark.kit,source.soulMark.kit);
  await act(async()=>root.render(<ElfReadOnlyProfile elf={battle} battleSide="p1" onClose={()=>{}}/>));check();
  const full=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('完整介紹'))!;
  await act(async()=>full.click());check();
  const area=document.querySelector('.spot-traits')!;
  assert.ok(area.textContent?.includes('繳械:弱化類異常，限制類異常'));
  assert.equal(document.querySelectorAll('.spot-skills article').length,5);
  await act(async()=>root.render(null));
  repairSavedBuiltinStorage(localStorage,defaults);
  await act(async()=>root.render(<GameDataProvider><Probe/></GameDataProvider>));check();
  assert.equal(JSON.parse(localStorage.getItem('seer_default_elves_overrides')!)[saved.id].soulMark.description,source.soulMark.description);
  await act(async()=>root.render(null));
 }
 console.log('真實舊版覆寫 → 圖鑑資料 → 戰鬥詳情 → 完整介紹 → 存檔重載：兩隻雷伊正式魂印與積木一致');
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
