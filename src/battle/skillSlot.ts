import type { Elf, Skill } from '../types';

/**
 * 第五技能的唯一判定：身分由資料旗標 isFifthSkill 決定，格位、威力、名稱都不能替代。
 * 規範資料格式是「4 招普通 + 第五技能放在 skills[4]」；沒有第五技能的精靈（例如皮皮）整列都不帶旗標。
 * 回傳第五技能在 skills 的格位，沒有則 -1。
 */
export function fifthSkillSlot(skills: readonly Pick<Skill, 'isFifthSkill'>[]): number {
  // 相容舊存檔重複旗標：標準末格已有明確旗標時優先採用；未標記時不推定。
  return skills[4]?.isFifthSkill ? 4 : skills.slice(0, 5).findIndex(skill => skill.isFifthSkill);
}

export interface DisplayedSkill<T> { skill: T; slot: number; isFifth: boolean }

/**
 * 技能欄顯示順序的唯一來源（戰鬥技能列、精靈介紹、背包詳情、唯讀檔案、編輯器預覽、圖鑑／命運之輪等共用）：
 * 最多 5 格；有第五技能時一律排第一格，其餘維持原相對順序。slot 是資料中的原格位（換招／扣 PP 用），不是畫面位置。
 */
export function orderSkillsForDisplay<T extends Pick<Skill, 'isFifthSkill'> = Skill>(skills: readonly T[] | undefined | null, limit = 5): DisplayedSkill<T>[] {
  const main = (skills || []).slice(0, limit);
  const fifth = fifthSkillSlot(main);
  const rows = main.map((skill, slot) => ({ skill, slot, isFifth: slot === fifth }));
  return fifth > 0 ? [rows[fifth], ...rows.filter(row => row.slot !== fifth)] : rows;
}

/** 戰鬥中 visibleSkills 會把原格位寫入 battleSlot；用同一規則排出顯示順序。 */
export function orderBattleSkillsForDisplay<T extends Pick<Skill, 'battleSlot'>>(elfSkills: readonly Pick<Skill, 'isFifthSkill'>[], visible: readonly T[]): T[] {
  const fifth = fifthSkillSlot(elfSkills);
  const first = fifth >= 0 ? visible.find(skill => skill.battleSlot === fifth) : undefined;
  return first ? [first, ...visible.filter(skill => skill !== first)] : [...visible];
}

/**
 * 內建精靈的存檔補旗標：預設資料裡是第五技能的招式，存檔主列完全沒有第五旗標時補回。
 * 只依預設的明確旗標補，不依格位／威力推定；主列已有任何第五旗標（玩家自選或已修正）不動。
 * 無需補時回傳 undefined；否則回傳新陣列（不就地修改輸入）。
 */
export function restoreBuiltinFifthFlags<T extends Pick<Skill, 'name' | 'isFifthSkill'>>(skills: readonly T[] | undefined, canonicalSkills: readonly Pick<Skill, 'name' | 'isFifthSkill'>[] | undefined): T[] | undefined {
  if (!skills || !canonicalSkills) return undefined;
  const fifthNames = new Set(canonicalSkills.filter(s => s.isFifthSkill).map(s => s.name));
  if (!fifthNames.size || skills.slice(0, 5).some(s => s.isFifthSkill)) return undefined;
  let changed = false;
  const next = skills.map((s, i) => {
    if (i < 5 && fifthNames.has(s.name)) { changed = true; return { ...s, isFifthSkill: true }; }
    return s;
  });
  return changed ? next : undefined;
}

/**
 * 匯入／解析後整理成規範格式：只保留第一個第五旗標，且滿 5 招時第五技能放在 skills[4]（4 普通 + 第五）。
 * 不足 5 招時保持原順序；沒有旗標的精靈不推定第五。不就地修改輸入。
 */
export function canonicalSkillRow<T extends Pick<Skill, 'isFifthSkill'>>(skills: readonly T[]): T[] {
  const first = skills.findIndex(s => s.isFifthSkill);
  const row = skills.map((s, i) => s.isFifthSkill && i !== first ? { ...s, isFifthSkill: false } : s);
  if (first < 0 || row.length < 5 || first === 4 || first > 4) return row;
  const [fifth] = row.splice(first, 1);
  row.splice(4, 0, fifth);
  return row;
}

/** 選擇時保存槽號；PP刷新或幻化換名後仍扣原槽。同名且無槽號時不猜第一格。 */
export function skillSlot(elf: Pick<Elf, 'skills'>, selected?: Skill | null): number {
  if (!selected) return -1;
  const explicit = selected.battleSlot;
  if (Number.isInteger(explicit) && explicit! >= 0 && explicit! < elf.skills.length) return explicit!;
  const reference = elf.skills.indexOf(selected);
  if (reference >= 0) return reference;
  const matches = elf.skills.flatMap((s, i) => s.name === selected.name ? [i] : []);
  return matches.length === 1 ? matches[0] : -1;
}
