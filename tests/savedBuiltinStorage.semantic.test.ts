import assert from 'node:assert/strict';
import {createServer} from 'vite';
import historical from '../src/data/legacyReyDescriptions.json';
import legacySoulKits from '../src/data/legacySoulKitFingerprints.json';
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
  const {DEFAULT_ELVES:defs}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const {repairSavedBuiltinStorage:repair,BUILTIN_SAVE_KEYS:keys}=await server.ssrLoadModule('/src/data/savedBuiltinStorage.ts');
  const rey=structuredClone(defs.find((e:any)=>e.id==='5029'));delete rey.kit;
  for(const d of [rey.soulMark,...rey.skills,...rey.skillPool||[],...rey.alienTraits.exclusiveTraits]){const old=historical.definitions.find((x:any)=>x.name===d.name);if(old){d.description=old.description;delete d.kit;delete d.effectMode;}}
  rey.battleId='original-instance';rey.skills[0].pp=2;rey.currentHp=99;
  const values=new Map<string,string>();const getItem=(key:string)=>values.get(key)??null;const setItem=(key:string,value:string)=>{values.set(key,value);};
  for(const key of keys)setItem(key,JSON.stringify(key==='seer_custom_elves'?[rey]:key==='seer_default_elves_overrides'?{'5029':rey}:key.includes('presets')?{1:{name:'保留槽名',team:[rey],starterId:rey.battleId}}:{team:[rey],starterId:rey.battleId}));
  const originals=new Map(values);const result=repair({getItem,setItem},defs);assert.equal(result.length,6);assert.ok(result.every((r:any)=>r.status==='repaired'));
  for(const key of keys){assert.equal(getItem('seer_before_builtin_kit_repair_20261021_'+key),originals.get(key));const v=JSON.parse(getItem(key)!);const e=key==='seer_custom_elves'?v[0]:key==='seer_default_elves_overrides'?v['5029']:key.includes('presets')?v[1].team[0]:v.team[0];assert.equal(e.soulMark.kit.length,10);assert.equal(e.battleId,rey.battleId);assert.equal(e.currentHp,99);assert.equal(e.skills[0].pp,2);}
  assert.deepEqual(repair({getItem,setItem},defs),[],'再次啟動不重複修改／備份');
  // 真實舊頂層描述積木，也必須通過六條儲存路徑而非僅直接呼叫修復函數。
  const puni=structuredClone(defs.find((e:any)=>e.id==='5000'));
  delete puni.soulMark.kit;delete puni.soulMark.effectMode;
  puni.kit=structuredClone(legacySoulKits.definitions.find(d=>d.elfId==='5000')!.kit);
  values.clear();
  for(const key of keys)setItem(key,JSON.stringify(key==='seer_custom_elves'?[puni]:key==='seer_default_elves_overrides'?{'5000':puni}:key.includes('presets')?{1:{team:[puni]}}:{team:[puni]}));
  const puniOriginals=new Map(values);
  assert.equal(repair({getItem,setItem},defs).length,6);
  for(const key of keys){
    const v=JSON.parse(getItem(key)!);
    const e=key==='seer_custom_elves'?v[0]:key==='seer_default_elves_overrides'?v['5000']:key.includes('presets')?v[1].team[0]:v.team[0];
    assert.equal(e.soulMark.effectMode,'kit');assert.ok(e.soulMark.kit.length>0);
    assert.deepEqual(e.kit,puni.kit);
    assert.equal(getItem('seer_before_builtin_kit_repair_20261021_'+key),puniOriginals.get(key));
  }
  assert.deepEqual(repair({getItem,setItem},defs),[]);
  const nextDefs=structuredClone(defs),nextPuni=nextDefs.find((e:any)=>e.id==='5000');
  nextPuni.soulMark.description+=' 新版本驗證';nextPuni.soulMark.kit[0].customText+=' 新版本驗證';
  assert.equal(repair({getItem,setItem},nextDefs).length,6,'來源版本更新須穿過六條實際儲存路徑');
  for(const key of keys){
    const v=JSON.parse(getItem(key)!);
    const e=key==='seer_custom_elves'?v[0]:key==='seer_default_elves_overrides'?v['5000']:key.includes('presets')?v[1].team[0]:v.team[0];
    assert.deepEqual(e.soulMark.kit,nextPuni.soulMark.kit);
    assert.equal(getItem('seer_before_builtin_kit_repair_20261021_'+key),puniOriginals.get(key),'升級保留最初備份');
  }
  assert.deepEqual(repair({getItem,setItem},nextDefs),[]);
  setItem(keys[0],'{bad json');setItem(keys[1],originals.get(keys[1])!);const original=originals.get(keys[1])!;values.delete('seer_before_builtin_kit_repair_20261021_'+keys[1]);
  const failed=repair({getItem,setItem:(k:string,v:string)=>{if(k.startsWith('seer_before_'))throw Error('quota');setItem(k,v);}},defs);assert.ok(failed.some((r:any)=>r.status==='failed'));assert.equal(getItem(keys[1]),original,'備份失敗時原存檔必須不動');
  console.log('✓ 六條實際儲存路徑開畫面前修復，原始備份／配裝與實例保留／冪等／損壞JSON隔離／空間不足安全失敗');
}finally{await server.close();}
