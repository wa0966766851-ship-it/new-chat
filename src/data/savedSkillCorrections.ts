import type {Elf,Skill} from '../types';
import {correctSavedOdinPp} from './savedOdinPpCorrection';

/** 只修正已知舊版內建定義；圖紙或全文有其他改動時保留使用者版本。 */
export function applySavedSkillCorrections(elf:Elf,defaults:Elf[]):Elf{
  elf = restoreSavedBuiltinKits(elf, defaults);
  if(elf && Array.isArray(elf.skills) && String(elf.id)==='5019')return correctSavedOdinPp(elf);
  if(!elf || !Array.isArray(elf.skills) || String(elf.id)!=='5024')return elf;
  const canonical=defaults.find(e=>String(e.id)==='5024');
  const name='無限・虛數湮滅',current=[...(canonical?.skills||[]),...(canonical?.skillPool||[])].find(s=>s.name===name);
  if(!current || current.priority!==3 || !current.description.startsWith('■ 先制+3\n'))return elf;
  let changed=false;
  const correct=(skill:Skill):Skill=>{
    if(skill.name!==name || skill.priority!==1 ||
      skill.description!==current.description.replace('■ 先制+3\n','■ 先制+1\n'))return skill;
    if(skill.effectMode && !['auto','kit'].includes(skill.effectMode))return skill;
    if(skill.kit?.length){
      const restored=skill.kit.map(e=>e.codeId==='skill_property'&&e.params.property==='base_priority'&&e.params.value===1&&!(e.params.conditions||[]).length
        ?{...e,customText:e.customText==='■ 先制+1'?'■ 先制+3':e.customText,params:{...e.params,value:3}}:e);
      if(JSON.stringify(restored)!==JSON.stringify(current.kit))return skill;
    }
    changed=true;
    return {...skill,priority:3,description:current.description,effectMode:current.effectMode,kit:structuredClone(current.kit)};
  };
  const skills=elf.skills.map(correct),skillPool=elf.skillPool?.map(correct);
  return changed?{...elf,skills,...(skillPool?{skillPool}:{})}:elf;
}

/** 同名同全文的舊內建存檔補回積木；保留既有積木、明確模式、自訂原文與配裝。 */
function restoreSavedBuiltinKits(elf: Elf, defaults: Elf[]): Elf {
  if (!elf || String(elf.id).startsWith('custom_')) return elf;
  const canonical = defaults.find(e => String(e.id) === String(elf.id));
  if (!canonical || elf.name !== canonical.name) return elf;
  const restore = <T extends {name: string; description?: string; effectMode?: string; kit?: unknown[]}>(value: T | undefined, source: T | undefined): T | undefined => {
    if (!value || !source?.kit?.length || value.kit?.length || value.name !== source.name ||
      value.description !== source.description || (value.effectMode && value.effectMode !== 'auto')) return value;
    return {...value, effectMode: source.effectMode, kit: structuredClone(source.kit)};
  };
  const soulMark = elf.kit?.some(e => e.source !== 'skill') ? elf.soulMark : restore(elf.soulMark, canonical.soulMark);
  const trait = restore(elf.trait, canonical.trait);
  const skills = elf.skills?.map(s => restore(s, [...canonical.skills, ...(canonical.skillPool || [])].find(n => n.name === s.name))!);
  const skillPool = elf.skillPool?.map(s => restore(s, [...canonical.skills, ...(canonical.skillPool || [])].find(n => n.name === s.name))!);
  const traits = elf.alienTraits, native = canonical.alienTraits;
  const gen2Trait = restore(traits?.gen2Trait, native?.gen2Trait);
  const exclusiveTrait = restore(traits?.exclusiveTrait, native?.exclusiveTrait);
  const alienTrait = restore(traits?.alienTrait, native?.alienTrait);
  const generalTrait = restore(traits?.generalTrait, native?.generalTrait);
  const exclusiveTraits = traits?.exclusiveTraits?.map(t => restore(t, native?.exclusiveTraits?.find(n => n.name === t.name))!);
  if (soulMark === elf.soulMark && trait === elf.trait && !skills?.some((s,i) => s !== elf.skills[i]) &&
    !skillPool?.some((s,i) => s !== elf.skillPool?.[i]) && gen2Trait === traits?.gen2Trait && exclusiveTrait === traits?.exclusiveTrait &&
    alienTrait === traits?.alienTrait && generalTrait === traits?.generalTrait &&
    !exclusiveTraits?.some((t,i) => t !== traits?.exclusiveTraits?.[i])) return elf;
  return {...elf, soulMark, trait, skills, ...(skillPool ? {skillPool} : {}), ...(traits ? {alienTraits: {...traits, gen2Trait, exclusiveTrait, exclusiveTraits, alienTrait, generalTrait}} : {})};
}
