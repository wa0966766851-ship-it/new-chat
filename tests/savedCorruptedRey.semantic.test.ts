import assert from 'node:assert/strict';
import {createServer} from 'vite';
import legacy from '../src/data/legacyCorruptedReyDefinitions.json';
import desktopLegacy from '../src/data/legacyCorruptedReyDesktop.json';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const {DEFAULT_ELVES:defaults}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {applySavedSkillCorrections:fix}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
 const {CORRUPTED_REY_SKILL_TEXT:text}=await server.ssrLoadModule('/src/data/corruptedReyDescriptions.ts');
 const {CORRUPTED_REY_LEGACY_SOUL_SUMMARIES:summaries}=await server.ssrLoadModule('/src/data/corruptedRey.ts');
 for(const old of legacy){
  const current=defaults.find((e:any)=>e.id===old.id),saved={...structuredClone(current),soulMark:structuredClone(old.soulMark),skills:structuredClone(old.skills),currentHp:42,skinId:'test-keep'};
  saved.skills[0].currentPp=2;
  if(old.id==='7070')saved.destinyRank='A';
  const restored=fix(saved,defaults);
  if(old.id==='7070'){assert.equal(current.destinyRank,'B');assert.equal(restored.destinyRank,'B','已保存的舊分級也要更新');}
  assert.equal(restored.soulMark.description,current.soulMark.description);assert.deepEqual(restored.soulMark.kit,current.soulMark.kit);
  assert.equal(restored.currentHp,42);assert.equal(restored.skills[0].currentPp,2);assert.equal(restored.skinId,'test-keep');
  for(const s of restored.skills)assert.equal(s.description,text[s.name]);
  assert.equal(fix(restored,defaults),restored);
  const summary=structuredClone(saved);summary.soulMark.kit=summary.soulMark.kit.filter((e:any)=>!JSON.stringify(e.params?.clause?.body).includes('"op":"noop"'));summary.soulMark.description=summary.soulMark.kit.map((e:any)=>e.customText).join('\n');
  assert.equal(fix(summary,defaults).soulMark.description,current.soulMark.description);
  summary.soulMark.kit.forEach((e:any,i:number)=>{e.customText=summaries[old.id][i];e.params.clause.raw=e.customText;});
  summary.soulMark.description=summary.soulMark.kit.map((e:any)=>e.customText).join('\n');
  assert.equal(fix(summary,defaults).soulMark.description,current.soulMark.description,'畫面中的四／五行執行摘要');
  const rootOnly:any=structuredClone(summary);rootOnly.kit=rootOnly.soulMark.kit;delete rootOnly.soulMark.kit;
  assert.deepEqual(fix(rootOnly,defaults).soulMark.kit,current.soulMark.kit);
  const customLabel=structuredClone(saved);customLabel.soulMark.kit[0].customText+=' 我的圖紙';(customLabel.soulMark.kit[0].params as any).clause.raw=customLabel.soulMark.kit[0].customText;
  assert.deepEqual(fix(customLabel,defaults).soulMark,customLabel.soulMark);
  const custom=structuredClone(saved);custom.soulMark.description+='\n我的改動';assert.equal(fix(custom,defaults).soulMark.description,custom.soulMark.description);
  const customKit=structuredClone(saved);(customKit.soulMark.kit[0].params as any).clause.body[0].acts[0].p.ratio=.123;
  assert.deepEqual(fix(customKit,defaults).soulMark,customKit.soulMark);
  assert.ok(!JSON.stringify(current.soulMark.kit).includes('"op":"noop"'));
 }
 const {repairSavedBuiltinStorage,BUILTIN_SAVE_KEYS}=await server.ssrLoadModule('/src/data/savedBuiltinStorage.ts');
 for(const old of desktopLegacy){
  const current=defaults.find((e:any)=>e.id===old.id);
  const saved={...structuredClone(current),soulMark:structuredClone(old.soulMark),skinId:'keep-skin',currentHp:42};
  saved.skills=saved.skills.map((s:any)=>({...s,...structuredClone(old.skills.find(v=>v.name===s.name)||{}),currentPp:2}));
  saved.skillPool=structuredClone(saved.skills);
  const fixed=fix(saved,defaults);
  assert.equal(fixed.soulMark.description,current.soulMark.description,'桌面真實四行摘要必須升級');
  assert.deepEqual(fixed.soulMark.kit,current.soulMark.kit,'連同舊2回合參數一起升級');
  for(const skill of fixed.skills){
   const source=current.skills.find((s:any)=>s.name===skill.name);
   assert.equal(skill.description,source.description);
   assert.deepEqual(skill.kit,source.kit,'舊傷害類型接線也需更新');
   assert.equal(skill.currentPp,2);
  }
  assert.equal(fixed.currentHp,42);assert.equal(fixed.skinId,'keep-skin');assert.equal(fix(fixed,defaults),fixed);
  const custom=structuredClone(saved);custom.soulMark.kit[0].params.clause.body[0].acts[0].p.ratio=.123;
  assert.deepEqual(fix(custom,defaults).soulMark,custom.soulMark,'不可把自訂參數當成舊版本');
  const store=new Map<string,string>();
  const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
  for(const key of BUILTIN_SAVE_KEYS)storage.setItem(key,JSON.stringify(key==='seer_default_elves_overrides'?{[saved.id]:saved}:[saved]));
  const before=new Map(store);
  assert.equal(repairSavedBuiltinStorage(storage,defaults).filter((r:any)=>r.status==='repaired').length,6);
  for(const key of BUILTIN_SAVE_KEYS){
   const data=JSON.parse(storage.getItem(key)!);const elf=key==='seer_default_elves_overrides'?data[saved.id]:data[0];
   assert.equal(elf.soulMark.description,current.soulMark.description);
   assert.ok([...store].some(([k,v])=>k.startsWith('seer_before_builtin_kit_repair_')&&v===before.get(key)),'更新前備份');
  }
  assert.equal(repairSavedBuiltinStorage(storage,defaults).length,0,'重載不重複變更');
 }
 console.log('兩隻雷伊原文、摘要存檔升級、配裝與PP保留、自訂保護、冪等及無假積木通過');
}finally{await server.close();}
