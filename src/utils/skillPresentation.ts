import type { Skill } from '../types';

/** 技能分類優先於舊資料的系別。只投影顯示，不改戰鬥公式或轉化來源。 */
export function skillDisplayType(skill:Pick<Skill,'type'|'category'>):string {
  if(skill.category==='屬性')return '無屬性';
  const type=String(skill.type || '').trim();
  return !type || ['--','無','屬性','无属性','無屬性'].includes(type)?'無屬性':type;
}
export function skillDisplayTypeLabel(skill:Pick<Skill,'type'|'category'>):string {
  const type=skillDisplayType(skill);
  return type==='無屬性'?type:type.replace(/系$/,'')+'系';
}
