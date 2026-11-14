import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import measurements from '../src/data/elfPhysicalMeasurements.json';
import {fillElfPhysicalMeasurements as fill} from '../src/data/elfPhysicalMeasurements';
import {applySavedSkillCorrections} from '../src/data/savedSkillCorrections';
import {repairSavedBuiltinStorage,BUILTIN_SAVE_KEYS} from '../src/data/savedBuiltinStorage';
import raw from '../docs/data/seerapi/2026-11-10_physical-and-ains.raw.json';
const h=await createHarness();
try {
 const {DEFAULT_ELVES:elves,loadImportedElves}=await h.server.ssrLoadModule('/src/data/defaultElves.ts');
 await loadImportedElves();
 const ains=elves.find((e:any)=>e.id==='5038'),fear=elves.find((e:any)=>e.id==='5025'),lord=elves.find((e:any)=>e.id==='5024');
 const subdue=h.find('5038','諸邪皆伏');h.assertKitOnly(subdue);
 assert.deepEqual([subdue.power,subdue.pp,subdue.accuracy,subdue.category,subdue.type,subdue.isSureHit,subdue.isFifthSkill],[140,5,95,'特殊','火',false,false]);
 assert.equal(raw.skill.data.id,31271);assert.deepEqual(raw.skill.data.skill_effect[0].args,[200,400]);
 assert.ok(!ains.skills.some((s:any)=>s.name==='諸邪皆伏'),'只加入預備庫');
 assert.deepEqual(fear.skillPool,lord.skillPool,'共用相同五招及相同已驗證積木');
 assert.equal(fear.skills.length,5);assert.equal(fear.skillPool.length,5);
 for(const skill of fear.skillPool)h.assertKitOnly(skill);
 const old=structuredClone(ains);
 for(const list of [old.skills,old.skillPool])for(const s of list){
  if(s.name==='不滅君焰'){
   delete s.isSureHit;s.description=s.description.slice('必中\n'.length);
   s.kit=s.kit.filter((e:any)=>e.codeId!=='skill_property'||e.params.property!=='sure_hit');
  }
  if(s.name==='王.傲視王權'){
   s.description=s.description.replace('反轉自身能力下降狀態','反轉自身能力提升狀態');
   const e=s.kit.find((e:any)=>e.customText.startsWith('反轉自身能力下降狀態'));
   e.customText=e.customText.replace('反轉自身能力下降狀態','反轉自身能力提升狀態');
   e.params.clause.raw=e.customText;e.params.clause.body[0].acts[0].p.kind='up';
  }
 }
 old.skillPool=old.skillPool.filter((s:any)=>s.name!=='諸邪皆伏');old.skills[2].currentPp=1;old.skills[3].currentPp=2;
 const upgraded=applySavedSkillCorrections(old,elves);
 assert.deepEqual(upgraded.skills.map((s:any)=>s.kit),ains.skills.map((s:any)=>s.kit));
 assert.equal(upgraded.skills[2].currentPp,1);assert.equal(upgraded.skills[3].currentPp,2);
 assert.ok(upgraded.skillPool?.some(s=>s.name==='諸邪皆伏'));
 const customized=structuredClone(old);customized.skills[3].kit[2].params.clause.body[0].acts[0].p.side='opp';
 assert.deepEqual(applySavedSkillCorrections(customized,elves).skills[3],customized.skills[3],'保留使用者改過的積木');
 const savedFear=structuredClone(fear);delete savedFear.skillPool;
 const restored=applySavedSkillCorrections(savedFear,elves);
 assert.deepEqual(restored.skillPool,fear.skillPool);assert.deepEqual(restored.skills,fear.skills);
 const store=new Map<string,string>();
 for(const key of BUILTIN_SAVE_KEYS){
  const team=[old,savedFear];store.set(key,JSON.stringify(key==='seer_custom_elves'?team:key==='seer_default_elves_overrides'?{'5038':old,'5025':savedFear}:key.includes('presets')?{1:{team}}:{team}));
 }
 const storage={getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>{store.set(key,value);}};
 const originals=new Map(store);
 assert.equal(repairSavedBuiltinStorage(storage,elves).length,6);
 for(const key of BUILTIN_SAVE_KEYS){
  const value=JSON.parse(store.get(key)!);
  const team=key==='seer_custom_elves'?value:key==='seer_default_elves_overrides'?Object.values(value):key.includes('presets')?value[1].team:value.team;
  const a=team.find((e:any)=>e.id==='5038'),f=team.find((e:any)=>e.id==='5025');
  assert.ok(a.skillPool.some((s:any)=>s.name==='諸邪皆伏'));assert.deepEqual(a.skills[2].kit,ains.skills[2].kit);assert.equal(a.skills[2].currentPp,1);
  assert.equal(f.skillPool.length,5);
  assert.equal(store.get('seer_before_builtin_kit_repair_20261021_'+key),originals.get(key),'修復前保存原字串');
 }
 assert.deepEqual(repairSavedBuiltinStorage(storage,elves),[],'六條存檔路徑再次載入不重複添加或改寫');
 for(const m of measurements){
  const source=raw.encyclopedia.find(x=>'id' in x.data&&x.data.id===m.seerId)!;
  assert.ok(source&&'height' in source.data&&'weight' in source.data);
  assert.equal(m.height,source.data.height);assert.equal(m.weight,source.data.weight);
  const elf=elves.find((e:any)=>String(e.id)===m.id&&e.name===m.name);assert.ok(elf);
  assert.ok(elf.height>0&&elf.weight>0);
  const empty={...elf,height:0,weight:undefined};assert.deepEqual([fill(empty).height,fill(empty).weight],[m.height,m.weight]);
  assert.deepEqual([applySavedSkillCorrections(empty,elves).height,applySavedSkillCorrections(empty,elves).weight],[m.height,m.weight]);
  const edited={...elf,height:7,weight:8};assert.equal(fill(edited),edited);
  const custom={...empty,isCustom:true};assert.equal(fill(custom),custom);
 }
 for(const e of elves.filter((e:any)=>e.name.includes('譜尼'))){const empty={...e,height:0,weight:0};assert.equal(fill(empty),empty);}
 for(const id of ['7070','707070'])assert.equal(elves.find((e:any)=>e.id===id).height,129);
 assert.equal(elves.find((e:any)=>e.id==='7070').weight,74,'原有非零體重保留');
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 for(const side of ['p1','p2'] as const){
  const fixed:number[]=[];
  h.S.S=(_:any,event:any,data:any)=>{if(event===T.OPPONENT_DAMAGE&&data.damageType==='fixed')fixed.push(data.hpReduced);};
  for(const mode of ['hit','miss','sealed']){
   fixed.length=0;
   const sk={...subdue,accuracy:mode==='miss'?0:100};
   const r=await h.play(side,{self:h.unit('S',100000,[sk],{extra:{isAdditionalInvalid:mode==='sealed'}}),opp:h.unit('O',100000,[h.wait()],{speed:300})},1);
   if(mode==='hit'){assert.equal(fixed.length,1);assert.ok(fixed[0]>=200&&fixed[0]<=400);}
   else if(mode==='miss'){assert.equal(fixed.length,0);assert.equal(r[0].opp.currentHp,100000);}
   else {assert.equal(fixed.length,0,'附加失效時不附加固定傷害');assert.ok(r[0].opp.currentHp<100000,'技能主傷害仍存在');}
  }
  const flame={...h.find('5038','不滅君焰'),accuracy:0,isSureHit:false};
  const result=await h.play(side,{self:h.unit('S',10000,[flame]),opp:h.unit('O',10000,[h.wait()])},1);
  assert.equal(result[0].self.statStages.atk,1,'必中積木在零命中率下仍生效');
  delete h.S.S;
  console.log(`✓ ${side} 諸邪皆伏固定傷害／未命中、不滅君焰固有必中`);
 }
 console.log('✓ 舊存檔精確修正、預備庫、17隻身高體重與來源核對、自訂值／譜尼保留');
} finally {delete h.S.S;await h.close();}
