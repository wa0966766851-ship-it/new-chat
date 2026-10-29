import type { Elf, Skill } from '../types';
import legacy from './legacyJiuqingDefinitions.json';
import { modifiedBuiltinDefinitions } from './builtinEffectBindings';

const stable=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const same=(a:unknown,b:unknown)=>stable(a)===stable(b);
const main=['生塵眷盼','如日方升','遂心快意','蒼靈銜樂','清璨星辰落'];
// 接手版曾把既有分類符號換成裝飾，並將備招註記寫進效果文案。
const normalizedText=(text?:string)=>(text||'').replace(/\r/g,'').replace(/^◈/gm,'■').replace(/^🎆/gm,'🎯').replace(/\n?\s*[（(]\s*備選\s*[）)]\s*$/,'').trim();

/** 精確認領接手版本的全文與積木；自訂圖紙／文案／主技能選擇一律保留。 */
export function correctSavedJiuqing(elf:Elf,defaults:Elf[]):Elf {
  if(String(elf?.id)!=='5036'||elf.name!=='九青')return elf;
  const source=defaults.find(e=>String(e.id)==='5036'&&e.name==='九青');if(!source)return elf;
  const protectedDefinitions=modifiedBuiltinDefinitions(elf,defaults);
  const correct=<T extends {name:string;description?:string;effectMode?:string;kit?:unknown[]}>(value:T|undefined,current:T|undefined,kind:string):T|undefined=>{
    if(!value||!current||protectedDefinitions.has(value)||value.effectMode!=='kit')return value;
    if(value.description===current.description&&value.effectMode===current.effectMode&&same(value.kit,current.kit))return value;
    if(!legacy.some(old=>old.kind===kind&&old.name===value.name&&old.description===value.description&&same(old.kit,value.kit)))return value;
    return {...value,description:current.description,effectMode:current.effectMode,kit:structuredClone(current.kit)};
  };
  const sources=[...source.skills,...(source.skillPool||[])];
  const fixSkill=(s:Skill)=>{
    const fixed=correct(s,sources.find(c=>c.name===s.name),'skill')!;
    const canonical=sources.find(c=>c.name===s.name);
    const description=canonical&&normalizedText(fixed.description)===normalizedText(canonical.description)?canonical.description:fixed.description;
    // 第五身分與效果版本無關；自訂文案／積木也必須沿用這五招的身分。
    const fifth=s.name==='清璨星辰落';
    const flagChanged=main.includes(s.name)&&!!fixed.isFifthSkill!==fifth;
    return flagChanged||description!==fixed.description?{...fixed,description,...(main.includes(s.name)?{isFifthSkill:fifth}:{})}:fixed;
  };
  let skills=elf.skills.map(fixSkill);
  let pool=elf.skillPool?.map(fixSkill);
  const soulMark=elf.kit?.some(e=>e.source!=='skill')?elf.soulMark:correct(elf.soulMark,source.soulMark,'soul');
  // 已知錯誤版本把整個九招池放進攜帶欄；完整五主招才可精確認領，其餘移回池。
  if(skills.length>5&&main.every(name=>skills.filter(s=>s.name===name).length===1)){
    const extras=skills.filter(s=>!main.includes(s.name));
    pool=[...(pool||[])];
    for(const skill of extras)if(!pool.some(s=>same(s,skill)))pool.push(skill);
    skills=main.map(name=>skills.find(s=>s.name===name)!);
  }
  // 內部仍是四招＋第五，顯示端才將第五移至最左。只排列完整主列，不替換自選備招。
  if(skills.length===5&&main.every(name=>skills.filter(s=>s.name===name).length===1)
    &&skills.some((s,i)=>s.name!==main[i]))skills=main.map(name=>skills.find(s=>s.name===name)!);
  if(soulMark===elf.soulMark&&skills.every((s,i)=>s===elf.skills[i])&&pool?.every((s,i)=>s===elf.skillPool?.[i])!==false)return elf;
  return {...elf,soulMark,skills,...(pool?{skillPool:pool}:{})};
}
