import type { Elf, Skill } from '../../../types';
import { clampSkillPp } from '../../../utils/battleHelpers';

const PROFILE_KEYS=['name','type','baseStats','soulMark','trait','alienTraits','abilities','kit','path','seerId',
  'artPresentation','spriteFacing','height','weight','gender','description','isAlienElf','category','trait_stone_thrower'] as const;
const SKILL_STATE_KEYS=['pp','currentPp','charge','battleSlot','skillRune','isRuneActive','specialBadge','specialMarks',
  'isAbolished','isPpPenalized','ppMaxOffset','ppMinOffset'] as const;

/** 更新已知內建定義，不重選技能、不重置遊戲進度，不以同名匹配不同ID或自訂精靈。 */
export function refreshExplorationElf(saved:Elf,pool:readonly Elf[]):Elf {
  if(saved.isCustom||saved.isExtra)return saved;
  const source=pool.find(e=>String(e.id)===String(saved.id));
  if(!source||source.isCustom)return saved;
  const next={...saved};
  for(const key of PROFILE_KEYS) {
    const value=(source as any)[key];
    if(value===undefined)delete (next as any)[key];else (next as any)[key]=structuredClone(value);
  }
  const definitions=[...(source.skills || []),...(source.skillPool || [])];
  const syncSkill=(skill:Skill):Skill=>{
    if(skill.isSkillStone)return skill;
    const definition=definitions.find(s=>s.name===skill.name&&!s.isSkillStone);
    if(!definition)return skill; // 不認識的技能可能是玩家自訂，不刪除也不換成預設。
    const updated=structuredClone(definition);
    // 舊定義只有pp時，那是基礎上限，不是存檔中的剩餘PP。
    updated.maxPp=definition.maxPp ?? definition.pp;
    for(const key of SKILL_STATE_KEYS)if(Object.hasOwn(skill,key))(updated as any)[key]=structuredClone((skill as any)[key]);
    updated.pp=clampSkillPp(updated,skill.pp,next);
    if(skill.currentPp!==undefined)updated.currentPp=updated.pp;
    return updated;
  };
  next.skills=saved.skills.map(syncSkill); // 保留已選槽位／技能石，包含從技能池選入的技能。
  next.skillPool=structuredClone(source.skillPool || []);
  return JSON.stringify(next)===JSON.stringify(saved)?saved:next;
}
