import type { Elf, Skill } from '../types';

/**
 * 5019 奧丁：舊版內建 PP 誤植（世界樹 5/5、ᚱᚨᚷᚾᚨᚱᛟᚲ 0/0）→ 原廠值（世界樹 0/0、ᚱᚨᚷᚾᚨᚱᛟᚲ 1/1）。
 * 2026-11-16：世界樹 0/0 不再天生不受PP限制；須先經選招激活 ᚱᚷ 才可選（舊存檔的 ppUnlimited 一併移除）。
 * 只改「恰為舊誤植值」的技能；使用者自訂過 PP 的保留原值。
 */
const TREE = 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ';
const RAGNAROK = 'ᚱᚨᚷᚾᚨᚱᛟᚲ';

const fix = (skill: Skill): Skill => {
  const max = skill.maxPp ?? skill.pp;
  if (skill.name === TREE && skill.pp === 5 && max === 5) { const { ppUnlimited: _drop, ...rest } = skill; return { ...rest, pp: 0, maxPp: 0 }; }
  if (skill.name === TREE && skill.ppUnlimited === true) { const { ppUnlimited: _drop, ...rest } = skill; return rest; }
  if (skill.name === RAGNAROK && skill.pp === 0 && max === 0) return { ...skill, pp: 1, maxPp: 1 };
  return skill;
};

export function correctSavedOdinPp(elf: Elf): Elf {
  const skills = elf.skills.map(fix);
  const skillPool = elf.skillPool?.map(fix);
  const changed = skills.some((s, i) => s !== elf.skills[i]) || !!skillPool?.some((s, i) => s !== elf.skillPool![i]);
  return changed ? { ...elf, skills, ...(skillPool ? { skillPool } : {}) } : elf;
}
