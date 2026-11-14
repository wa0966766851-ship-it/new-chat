import type {Elf,Skill} from '../types';

const stable=(value:unknown)=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
 ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const fields=['name','type','category','power','priority','accuracy','isFifthSkill','description','effectType','effectDetail','effectMode','kit'] as const;
const definition=(skill:Skill)=>Object.fromEntries(fields.filter(k=>skill[k]!==undefined).map(k=>[k,skill[k]]));

/** 本次已知舊定義的精確升級；自訂文字、積木、數值及出戰技能配置均保留。 */
export function correctSavedAinsAndReserve(elf:Elf,defaults:Elf[]):Elf {
 if(elf.isCustom||!['5038','5025'].includes(String(elf.id)))return elf;
 const canonical=defaults.find(e=>String(e.id)===String(elf.id)&&e.name===elf.name);
 if(!canonical)return elf;
 const sources=[...canonical.skills,...(canonical.skillPool||[])];
 const fix=(skill:Skill):Skill=>{
  if(String(elf.id)!=='5038')return skill;
  const source=sources.find(s=>s.name===skill.name);
  if(!source||!['不滅君焰','王.傲視王權'].includes(source.name))return skill;
  const old=structuredClone(source);
  if(source.name==='不滅君焰'){
   if(skill.isSureHit)return skill;
   old.description=old.description.replace(/^必中\n/,'');
   old.kit=old.kit?.filter(e=>!(e.codeId==='skill_property'&&e.params.property==='sure_hit'));
  }else{
   if(skill.isSureHit!==source.isSureHit)return skill;
   old.description=old.description.replace('反轉自身能力下降狀態','反轉自身能力提升狀態');
   old.kit=old.kit?.map(e=>{
    if(e.codeId!=='effect_sequence'||!e.customText?.startsWith('反轉自身能力下降狀態'))return e;
    const text=e.customText.replace('反轉自身能力下降狀態','反轉自身能力提升狀態');
    const clause=e.params.clause;
    return {...e,customText:text,params:{...e.params,clause:{...clause,raw:text,body:clause.body.map((step:any)=>({...step,acts:step.acts?.map((act:any)=>act.op==='stat_reverse'?{...act,p:{...act.p,kind:'up'}}:act)}))}}};
   });
  }
  if(stable(definition(skill))!==stable(definition(old)))return skill;
  return {...skill,description:source.description,isSureHit:source.isSureHit,kit:structuredClone(source.kit)};
 };
 const skills=elf.skills.map(fix),pool=elf.skillPool?.map(fix);
 const have=new Set([...skills,...(pool||[])].map(s=>s.name));
 const additions=(canonical.skillPool||[]).filter(s=>!have.has(s.name)&&(String(elf.id)==='5025'||s.name==='諸邪皆伏'));
 if(!additions.length&&skills.every((s,i)=>s===elf.skills[i])&&pool?.every((s,i)=>s===elf.skillPool?.[i])!==false)return elf;
 return {...elf,skills,skillPool:[...(pool||[]),...structuredClone(additions)]};
}
