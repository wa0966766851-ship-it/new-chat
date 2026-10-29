import type {Elf} from '../types';
import legacy from './legacyCorruptedReyDefinitions.json';
import desktopLegacy from './legacyCorruptedReyDesktop.json';
import {modifiedBuiltinDefinitions} from './builtinEffectBindings';
import {CORRUPTED_REY_LEGACY_SOUL_SUMMARIES as summaries} from './corruptedRey';
const key=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
/** 只認領已保存的接手版完整定義，保留配裝、技能槽與任何其他自訂修改。 */
export function correctSavedCorruptedRey(elf:Elf,defaults:Elf[]):Elf{
 const old=legacy.find(e=>e.id===String(elf.id)&&e.name===elf.name),source=defaults.find(e=>e.id===elf.id&&e.name===elf.name);
 if(!old||!source||elf.isCustom)return elf;
 // 分級是本次明確調整的內建資料；既有配裝覆寫也必須接收。
 if(String(elf.id)==='7070'&&source.destinyRank==='B'&&elf.destinyRank!=='B')elf={...elf,destinyRank:'B'};
 const protectedDefinitions=modifiedBuiltinDefinitions(elf,defaults);
 const desktop=desktopLegacy.find(e=>e.id===String(elf.id)&&e.name===elf.name);
 const definition=(v:any)=>({description:v.description,effectMode:v.effectMode,kit:v.kit});
 // 僅忽略已知版的展示標籤，不忽略參數、條件、行為或順序。
 const executable=(kit:any[])=>kit?.filter(e=>!JSON.stringify(e.params?.clause?.body??[]).includes('"op":"noop"')).map(e=>{
  const copy=structuredClone(e);delete copy.customText;if(copy.params?.clause)delete copy.params.clause.raw;return copy;
 });
 const fix=(value:any,previous:any,current:any,desktopPrevious?:any)=>{
  if(!value||!previous||!current||protectedDefinitions.has(value))return value;
  if(value.description===current.description&&key(value.kit)===key(current.kit)&&value.effectMode===current.effectMode)return value;
  // 由桌面實際存檔確認的舊版：包含寫死的2回合異常與舊傷害接線。
  // 完整比對描述和積木，不以名稱、近似參數或任何 status turns=2 泛認領。
  if(desktopPrevious&&key(definition(value))===key(definition(desktopPrevious)))return {...value,description:current.description,kit:structuredClone(current.kit),effectMode:current.effectMode};
  if(key(value)===key(previous))return {...value,description:current.description,kit:structuredClone(current.kit),effectMode:current.effectMode};
  // 早期四／五行摘要恰為積木 customText 全文；不認領任意改寫或僅靠名稱匹配。
  const joined=value.kit?.map((e:any)=>e.customText).join('\n');
  const summaryTexts=summaries[String(elf.id)]||[];
  const knownLabels=new Set([...previous.kit.map((e:any)=>e.customText),...current.kit.map((e:any)=>e.customText),...summaryTexts]);
  if(!value.kit?.every((e:any)=>knownLabels.has(e.customText)&&(!e.params?.clause||e.params.clause.raw===e.customText)))return value;
  const knownText=value.description===previous.description||value.description===current.description||value.description===joined;
  if(!knownText||key(executable(value.kit))!==key(executable(previous.kit)))return value;
  return {...value,description:current.description,kit:structuredClone(current.kit),effectMode:current.effectMode};
 };
 const rootKit=elf.kit?.filter(e=>e.source!=='skill');
 const previousSoul=rootKit?.length&&!elf.soulMark.kit?{...elf.soulMark,kit:rootKit}:elf.soulMark;
 const soulMark=protectedDefinitions.has(elf.soulMark)?elf.soulMark:fix(previousSoul,old.soulMark,source.soulMark,desktop?.soulMark);
 const rootChanged=previousSoul!==soulMark&&rootKit?.length;
 const kit=rootChanged?[...(elf.kit||[]).filter(e=>e.source==='skill'),...structuredClone(soulMark.kit)]:elf.kit;
 const fixSkill=(skill:any)=>fix(skill,old.skills.find(s=>s.name===skill.name),[...source.skills,...(source.skillPool||[])].find(s=>s.name===skill.name),desktop?.skills.find(s=>s.name===skill.name));
 const skills=elf.skills.map(fixSkill),skillPool=elf.skillPool?.map(fixSkill);
 return !rootChanged&&(soulMark===elf.soulMark||soulMark===previousSoul)&&skills.every((s,i)=>s===elf.skills[i])&&skillPool?.every((s,i)=>s===elf.skillPool?.[i])!==false?elf:{...elf,soulMark,skills,...(kit?{kit}:{}),...(skillPool?{skillPool}:{})};
}
