import type {Elf,Skill} from '../types';

/** 只修正已知舊版內建定義；圖紙或全文有其他改動時保留使用者版本。 */
export function applySavedSkillCorrections(elf:Elf,defaults:Elf[]):Elf{
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
