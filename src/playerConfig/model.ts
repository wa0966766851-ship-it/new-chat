import type {Elf} from '../types';
import {compactBuiltinOverrides,slimTeamRecord,slimTeamPresets} from '../data/savedTeamCompact';
import {MAX_CONFIG_BYTES,parseConfigJson} from './codec';
import {resolveTypeQuery} from '../utils/typeQuery';
import {GEM_BY_ID} from '../training/gems';

export const ROSTER_KEYS=['seer_custom_elves','seer_default_elves_overrides','seer_last_used_p1_team','seer_last_used_p2_team','seer_p1_backpack_presets','seer_p2_backpack_presets'] as const;
export const EQUIPMENT_KEYS=['p1','p2'].flatMap(side=>['suit','eyewear','title','flame','annual_bonus'].map(slot=>`seer_${side}_${slot}`));
export const OPTIONAL_KEYS=['battleAnimationSettings','seer_turn_timer_v1','seer_battle_pass_mode','seer_perf_mode','seer_music_continue_across_scenes','seer_scene_resources','seer_backgrounds','seer_playlist'];
export const CONFIG_KEYS=[...ROSTER_KEYS,...EQUIPMENT_KEYS,...OPTIONAL_KEYS];
const core=new Set<string>([...ROSTER_KEYS,...EQUIPMENT_KEYS]),optional=new Set(OPTIONAL_KEYS);
const object=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const disposable=new Set(['rawPrompt','decompositionReport','logs','battleRecords']);
const sensitive=/^(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization|credentials)$/i;
export const CONFIG_FEATURES=['roster-v1','training-v1','kits-v1','equipment-v1','images-v1','level-120-v1','starting-hp-v1','inscription-gems-v1','inscription-appearance-v1'] as const;
export interface Configuration {kind:'seer-player-config';schemaVersion:1;label:string;createdAt:string;appVersion:string;requiredFeatures:readonly string[];entries:Record<string,string>}
export interface ConfigCatalog {elves:Elf[];aliases:Record<string,string>;normalize:(elf:any)=>any;validateKit:(kit:any,path?:string)=>void;equipment?:Record<string,Record<string,{name:string}>>;skins?:Record<string,string[]>}
export interface ImportPlan {writes:Record<string,string>;before:Record<string,string|null>;warnings:string[];label:string;customCount:number;overrideCount:number;teams:{side:string;names:string[];starter:string}[];equipment:{side:string;slot:string;id:string;name?:string}[]}
function safeTree(value:any,catalog?:ConfigCatalog):any{
 if(Array.isArray(value))return value.map(v=>safeTree(v,catalog));
 if(!object(value))return value;
 const out:Record<string,any>={};
 for(const [k,v] of Object.entries(value)){
  if(disposable.has(k)||sensitive.test(k))continue;
  if(['path','imageUrl','avatarUrl','url','body','thumb'].includes(k)&&typeof v==='string'&&/^(?:javascript:|vbscript:|file:|data:(?!image\/))/i.test(v.trim()))throw Error('配置含有不支援的圖片或資源網址');
  if(k==='customCode'&&typeof v==='string'&&v.trim())throw Error('配置含有舊式自訂程式碼，請先轉為積木圖紙再分享');
  if(k==='kit'&&v!==undefined&&catalog)catalog.validateKit(v,'配置.kit');
  out[k]=safeTree(v,catalog);
 }
 return out;
}
export function captureConfiguration(storage:Pick<Storage,'getItem'>,label:string,appVersion:string,includeSettings=false):Configuration{
 const entries:Record<string,string>={};
 for(const key of [...core,...(includeSettings?optional:[])]){
  const raw=storage.getItem(key);if(raw===null)continue;
  entries[key]=ROSTER_KEYS.includes(key as any)||optional.has(key)&&!['seer_perf_mode','seer_music_continue_across_scenes','seer_battle_pass_mode'].includes(key)
   ? JSON.stringify(safeTree(parseConfigJson(raw))):raw;
 }
 const doc:Configuration={kind:'seer-player-config',schemaVersion:1,label:label.trim().slice(0,80)||'我的配置',createdAt:new Date().toISOString(),appVersion,requiredFeatures:CONFIG_FEATURES,entries};
 if(new TextEncoder().encode(JSON.stringify(doc)).length>MAX_CONFIG_BYTES)throw Error('配置超過4 MB，請減少內嵌圖片或分開分享精靈圖紙');
 return doc;
}
function unpack(value:any):{entries:Record<string,string>;label:string;appVersion:string;legacy:boolean;notes?:string[]}{
 if(!object(value))throw Error('存檔需為配置物件');
 if(value.kind==='seer-player-config'){
  if(!object(value.entries))throw Error('配置缺少內容');
  const notes:string[]=[];
  if(value.schemaVersion!==1)notes.push(`來源配置格式為${String(value.schemaVersion).slice(0,30)}，只讀取可辨識的相容欄位。`);
  if(Array.isArray(value.requiredFeatures)){const unsupported=value.requiredFeatures.filter((v:any)=>!CONFIG_FEATURES.includes(v));if(unsupported.length)notes.push(`來源含${unsupported.length}項較新功能，將逐項檢查相容性，不支援內容保留本機設定。`);}
  return {entries:value.entries,label:typeof value.label==='string'?value.label.slice(0,80):'匯入配置',appVersion:String(value.appVersion||'').slice(0,80),legacy:false,notes};
 }
 if(value.schemaVersion===1&&object(value.storage))return {entries:value.storage,label:'舊版本機備份',appVersion:'',legacy:true};
 if(value.schema===1&&object(value.entries))return {entries:value.entries,label:'桌面存檔備份',appVersion:'',legacy:true};
 throw Error('不是支援的配置或存檔備份');
}
const TRAINING_FIELDS=['level','growthType','startingHp','ivs','evs','natureModifiers','guildBonuses','inscriptions','resistances','trait','alienTraits','groupIds','skills','skinId','path','height','weight','gender','hasAnnualBonus','critValue'];
export function prepareConfiguration(value:unknown,storage:Pick<Storage,'getItem'>,catalog:ConfigCatalog,currentVersion:string,includeSettings=false):ImportPlan{
 const doc=unpack(value),warnings:string[]=[...(doc.notes||[])],incoming:Record<string,any>={};
 const skip=(label:string,error:unknown)=>warnings.push(`略過${label.slice(0,120)}：${(error instanceof Error?error.message:String(error)).slice(0,240)}`);
 if(Object.keys(doc.entries).length>512)throw Error('備份項目過多，請使用精靈配置檔案匯入');
 if(doc.legacy)warnings.push('舊備份只取精靈、陣容與配裝；其他私人資料不會帶入。');
 if(doc.appVersion&&doc.appVersion!==currentVersion)warnings.push(`來源版本${doc.appVersion}與目前${currentVersion}不同；內建精靈沿用目前版本定義，自訂積木先檢查相容性。`);
 for(const [key,raw] of Object.entries(doc.entries)){
  if(!core.has(key)&&!(includeSettings&&optional.has(key))){if(core.has(key)||optional.has(key))continue;warnings.push(`略過非配置項目：${key.slice(0,100)}`);continue;}
  try{
  if(typeof raw!=='string'||raw.length>MAX_CONFIG_BYTES)throw Error(`${key}內容無效`);
  if(EQUIPMENT_KEYS.includes(key)){
   if(!/^[a-zA-Z0-9_.:-]{0,160}$/.test(raw))throw Error('配裝識別碼無效');
   const slot=key.split('_').slice(2).join('_');if(raw&&catalog.equipment?.[slot]&&!catalog.equipment[slot][raw])throw Error('目前版本沒有這件配裝，保留原本選擇');incoming[key]=raw;
  }else if(optional.has(key)){
   incoming[key]=raw; if(!['seer_perf_mode','seer_music_continue_across_scenes','seer_battle_pass_mode'].includes(key))incoming[key]=JSON.stringify(safeTree(parseConfigJson(raw),catalog));
  }else incoming[key]=parseConfigJson(raw);
  }catch(error){skip(key,error);}
 }
 if(!Object.keys(incoming).length)throw Error('這份檔案沒有可套用的配置內容');
 const read=(key:string,fallback:any)=>{const raw=storage.getItem(key);return raw===null?fallback:parseConfigJson(raw);};
 const bases=new Map(catalog.elves.map(e=>[String(e.id),e]));
 const id=(v:any)=>catalog.aliases[String(v)]||String(v);
 const ownCustom=read('seer_custom_elves',[]),ownOverrides=read('seer_default_elves_overrides',{});
 if(!Array.isArray(ownCustom)||!object(ownOverrides))throw Error('目前精靈存檔格式異常，請先匯出原始備份修復');
 if(ownCustom.some((e:any)=>!object(e)||typeof e.id!=='string'))throw Error('目前自訂精靈清單有損壞項目，未套用配置');
 const customs=new Map(ownCustom.map((e:any)=>[String(e.id),e]));
 const overrides:Record<string,any>={...ownOverrides};
 const explicitPatches:Record<string,any>={},importedIds=new Set<string>(),importedOverrides=new Set<string>();
 let customCount=0;
 const validateElf=(e:any)=>{
  e=safeTree(e,catalog);
  if(!object(e)||typeof e.type!=='string'||!e.type||e.type.length>100||typeof e.name!=='string'||!e.name||e.name.length>200||!Array.isArray(e.skills)||e.skills.length>5)throw Error('精靈名稱或技能配置不完整');
  if(!resolveTypeQuery(e.type))throw Error(`目前版本不支援【${e.name}】的屬性`);
  for(const field of ['height','weight','critValue'])if(e[field]!==undefined&&(!Number.isFinite(e[field])||e[field]<0))throw Error(`【${e.name}】${field}數值無效`);
  if(!Number.isInteger(e.level??100)||(e.level??100)<1||(e.level??100)>120)throw Error(`【${e.name}】等級須為1至120`);
  if(e.startingHp&&(!['percent','absolute'].includes(e.startingHp.mode)||!Number.isFinite(e.startingHp.value)||e.startingHp.value<1||e.startingHp.mode==='percent'&&e.startingHp.value>100))throw Error('開戰體力設定無效');
  if(e.inscriptions!==undefined){
   if(!Array.isArray(e.inscriptions)||e.inscriptions.length>3)throw Error('刻印孔格式無效');
   e.inscriptions=e.inscriptions.map((inscription:any)=>{
    if(inscription==null)return inscription;
    if(!object(inscription)||!object(inscription.stats)||Object.values(inscription.stats).some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))throw Error('刻印數值無效');
    const next={...inscription};
    if(next.gem&&(!GEM_BY_ID[next.gem.id]||typeof next.gem.skillName!=='string'||next.gem.skillName.length>200)){warnings.push(`【${e.name}】的未知寶石已略過，保留刻印數值。`);delete next.gem;}
    if(next.skinId!==undefined&&(typeof next.skinId!=='string'||!/^\d{1,9}$/.test(next.skinId))){warnings.push(`【${e.name}】的刻印外觀無法辨識，恢復預設圖樣。`);delete next.skinId;}
    next.skinIcon=next.skinId?`/seer/countermark/${next.skinId}.png`:undefined;
    return next;
   });
  }
  for(const trait of [e.soulMark,e.trait,...(object(e.alienTraits)?Object.values(e.alienTraits).flatMap(v=>Array.isArray(v)?v:[v]):[])])if(trait!=null&&(!object(trait)||typeof trait.name!=='string'||trait.effectMode!==undefined&&!['auto','description','kit','registry'].includes(trait.effectMode)))throw Error(`【${e.name}】特性格式尚不支援`);
  if(e.skillPool!==undefined&&(!Array.isArray(e.skillPool)||e.skillPool.length>500))throw Error(`【${e.name}】預備技能庫無效`);
  for(const sk of [...e.skills,...(e.skillPool||[])])if(!object(sk)||typeof sk.name!=='string'||!['物理','特殊','屬性'].includes(sk.category)||!Number.isFinite(sk.power)||sk.power<0||!Number.isFinite(sk.pp)||sk.pp<0||sk.effectMode!==undefined&&!['auto','description','kit','registry'].includes(sk.effectMode)||sk.category!=='屬性'&&!resolveTypeQuery(sk.type||''))throw Error(`【${e.name}】技能格式、屬性或數值不相容`);
  for(const stats of [e.ivs,e.evs,e.baseStats,e.guildBonuses])if(stats!==undefined&&(!object(stats)||Object.values(stats).some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)))throw Error(`【${e.name}】培養數值無效`);
  const clean=catalog.normalize(e);
  return {...clean,effects:[],battleStatuses:{},battleStatus:'normal',battleStatusDuration:0,statStages:{},shield:0,barrier:0,isVanished:false,isDead:false,deathImmunity:undefined,fatalHold:undefined,fatalResistSeal:undefined,survivalRule:undefined};
 };
 const staticFields=new Set(['id','name','type','baseStats','skillPool','soulMark','kit','imageUrl','avatarUrl','seerId','isCustom','description','builtinEffectBindings','sharedSkillPoolFrom','category','destinyRank',...TRAINING_FIELDS]);
 const patchElf=(base:any,patch:Record<string,any>,label:string)=>{
  if(Object.keys(patch).length>200)throw Error('單一精靈配置欄位過多');
  let current={...base};const accepted:Record<string,any>={};
  for(const [key,value] of Object.entries(patch)){
   if(key==='id')continue;
   if(!staticFields.has(key)&&!(key in base)){skip(`${label}.${key}`,'目前版本沒有此欄位');continue;}
   try{
    if(key==='skinId'&&value&&catalog.skins?.[base.id]&&!catalog.skins[base.id].includes(value))throw Error('目前版本沒有這個皮膚，保留原外觀');
    if(key==='path'&&typeof value==='string'&&value.startsWith('/seer/')&&patch.skinId&&catalog.skins?.[base.id]&&!catalog.skins[base.id].includes(patch.skinId))throw Error('來源皮膚尚未支援，保留本機立繪');
    let next=value;
    if((key==='skills'||key==='skillPool')&&Array.isArray(value)){
     if(value.length>(key==='skills'?5:500))throw Error('技能數量超出目前版本上限');
     const kept:any[]=[];let compatible=0;
     for(const [index,skill] of value.entries())try{const valid=safeTree(skill,catalog);validateElf({...current,skills:[valid],skillPool:[]});kept.push(valid);compatible++;}catch(error){skip(`${label}的技能${skill?.name||index+1}`,error);if(key==='skills'&&current.skills?.[index])kept.push(current.skills[index]);}
     if(value.length&&!compatible)throw Error('此組技能皆不相容，保留本機原技能');
     next=key==='skillPool'?[...new Map([...(current.skillPool||[]),...kept].map(s=>[s.name,s])).values()]:kept;
    }
    const result=validateElf({...current,[key]:next});current=result;accepted[key]=result[key];
   }catch(error){skip(`${label}.${key}`,error);}
  }
  return {elf:current,patch:accepted};
 };
 if(incoming.seer_custom_elves!==undefined){
  if(!Array.isArray(incoming.seer_custom_elves)||incoming.seer_custom_elves.length>500)skip('自訂精靈清單','格式無效或超過500隻');
  else for(const e of incoming.seer_custom_elves)try{if(!object(e)||typeof e.id!=='string'||!e.id||e.id.length>200)throw Error('自訂精靈缺少識別碼');customs.set(e.id,validateElf(e));importedIds.add(e.id);customCount++;}catch(error){skip(`自訂精靈${e?.name||''}`,error);}
 }
 if(incoming.seer_default_elves_overrides!==undefined){
  if(!object(incoming.seer_default_elves_overrides)||Object.keys(incoming.seer_default_elves_overrides).length>1000)skip('內建精靈培養配置','格式無效');
  else for(const [key,patch] of Object.entries(incoming.seer_default_elves_overrides))try{
   const elfId=id(key),base=bases.get(elfId);if(!base)throw Error(`目前版本缺少內建精靈${elfId}`);
   if(!object(patch)||patch.id!==undefined&&id(patch.id)!==elfId)throw Error('精靈識別碼與培養配置不一致');
   const result=patchElf({...base,...(ownOverrides[elfId]||{})},patch,base.name);if(!Object.keys(result.patch).length)continue;
   overrides[elfId]=result.elf;explicitPatches[elfId]=result.patch;importedIds.add(elfId);importedOverrides.add(elfId);
  }catch(error){skip(`內建精靈${key}`,error);}
 }
 const teams:ImportPlan['teams']=[];
 const team=(record:any,side:string)=>{
  if(!object(record)||!Array.isArray(record.team)||record.team.length>12)throw Error(`${side}陣容格式不完整或超過12格`);
  const used=new Set<string>();
  const members=record.team.flatMap((member:any,index:number)=>{try{
   if(!object(member)||member.id===undefined||member.isExtra)throw Error('陣容不能包含戰鬥中召喚的額外單位');
   const elfId=id(member.id),base=customs.get(String(member.id))??bases.get(elfId);
   if(!base)throw Error(`目前版本找不到陣容精靈${elfId}，請一併匯入其自訂精靈資料`);
   // Old backups sometimes stored training only inside the team. Promote it to the warehouse,
   // since battle launch resolves the current warehouse instead of the saved team copy.
   let latest:any;
   if(bases.has(elfId)&&!customs.has(String(member.id))){
    const training=Object.fromEntries(TRAINING_FIELDS.filter(k=>member[k]!==undefined).map(k=>[k,member[k]]));
    if(Array.isArray(training.skills))training.skills=training.skills.map((sk:any)=>[...base.skills,...(base.skillPool||[])].find((s:any)=>s.name===sk.name)??sk);
    latest=patchElf({...base,...(overrides[elfId]||{})},{...training,...(explicitPatches[elfId]||{})},base.name).elf;overrides[elfId]=latest;importedOverrides.add(elfId);
   }else latest=base;
   const battleId=typeof member.battleId==='string'&&member.battleId.length<=200?member.battleId:`${side}_${elfId}_${index}`;
   if(used.has(battleId))throw Error('陣容包含重複的精靈實例識別碼');used.add(battleId);
   importedIds.add(elfId);return [{...latest,battleId,isExtra:false}];
  }catch(error){skip(`${side.toUpperCase()}第${index+1}格`,error);return [];}
  });
  if(record.team.length&&!members.length)throw Error('沒有可帶入的相容成員，保留原陣容');
  if(members.length!==record.team.length)warnings.push(`${side.toUpperCase()}已略過不相容成員，依保留次序重新編排：前6格出戰，其餘待命。`);
  const original=typeof record.starterId==='string'?record.starterId:'';
  const starter=members.slice(0,6).find((m:any)=>m.battleId===original||m.id===id(original))??members[0];
  return {team:members,starterId:starter?.battleId||'',timestamp:new Date().toISOString()};
 };
 const writes:Record<string,string>={};
 for(const side of ['p1','p2']){
  const key=`seer_last_used_${side}_team`;
  if(incoming[key]!==undefined)try{const r=team(incoming[key],side);writes[key]=JSON.stringify(slimTeamRecord(r));teams.push({side,names:r.team.map((e:any)=>e.name),starter:r.team.find((e:any)=>e.battleId===r.starterId)?.name||''});}catch(error){skip(`${side.toUpperCase()}陣容`,error);}
  const presets=`seer_${side}_backpack_presets`;
  if(incoming[presets]!==undefined){if(!object(incoming[presets])||Object.keys(incoming[presets]).length>100)skip('背包預設','格式無效');else{const merged={...read(presets,{})};let applied=0;for(const [name,r] of Object.entries(incoming[presets]))try{merged[name]=team(r,side);applied++;}catch(error){skip(`背包預設${name}`,error);}if(applied)writes[presets]=JSON.stringify(slimTeamPresets(merged));}}
 }
 if(customCount)writes.seer_custom_elves=JSON.stringify([...customs.values()]);
 if(importedOverrides.size)writes.seer_default_elves_overrides=JSON.stringify(compactBuiltinOverrides(overrides,catalog.elves));
 for(const key of [...EQUIPMENT_KEYS,...(includeSettings?OPTIONAL_KEYS:[])])if(incoming[key]!==undefined)writes[key]=incoming[key];
 const hidden=read('seer_deleted_elves',[]);if(Array.isArray(hidden)&&hidden.some(v=>importedIds.has(id(v))))writes.seer_deleted_elves=JSON.stringify(hidden.filter(v=>!importedIds.has(id(v))));
 if(!Object.keys(writes).length)throw Error('沒有可帶入的相容內容，原存檔未更動。'+warnings.slice(0,3).join('；'));
 const before=Object.fromEntries(Object.keys(writes).map(key=>[key,storage.getItem(key)]));
 const distinctWarnings=[...new Set(warnings)];
 return {writes,before,warnings:distinctWarnings,label:doc.label,customCount,overrideCount:importedOverrides.size,teams,equipment:EQUIPMENT_KEYS.filter(k=>incoming[k]!==undefined).map(k=>{const slot=k.split('_').slice(2).join('_');return {side:k.split('_')[1],slot,id:incoming[k],name:catalog.equipment?.[slot]?.[incoming[k]]?.name};})};
}
export async function loadConfigCatalog():Promise<ConfigCatalog>{
 const [{DEFAULT_ELVES,loadImportedElves},{ELF_ID_MAPPING},{normalizeElfStats},{validateKit},{SUIT_CATALOG,EYEWEAR_CATALOG},{TITLE_CATALOG},{FLAME_BY_ID},{availableElfSkins}]=await Promise.all([import('../data/defaultElves'),import('../data/elfRegistry'),import('../utils/elfStats'),import('../effects/kitValidation'),import('../data/suitsAndEyewears'),import('../data/titles'),import('../data/battleFlames'),import('../data/elfSkins')]);
 await loadImportedElves();return {elves:DEFAULT_ELVES,aliases:ELF_ID_MAPPING,normalize:normalizeElfStats,validateKit,equipment:{suit:SUIT_CATALOG,eyewear:EYEWEAR_CATALOG,title:TITLE_CATALOG,flame:FLAME_BY_ID},skins:Object.fromEntries(DEFAULT_ELVES.map(e=>[e.id,availableElfSkins(e).map(s=>s.id)]))};
}
