// 技能規則（通用讀取端；DSH 2026-10-31，5041 魂印「山」使用，名稱不綁特定精靈）。
// elf.skillRules.ppCostFree：符合類型（及場上護盾條件）的技能，使用時不消耗 PP。
import type { Elf, Skill } from '../types';

export interface ElfSkillRules {
  ppCostFree?: { skillKind?: '攻擊' | '屬性'; whenFieldShield?: boolean };
}
declare module '../types' { interface Elf { skillRules?: ElfSkillRules } }

const isStatusSkill = (sk: Skill) => sk.category === '屬性';
export function ppCostFreeByRule(elf: Elf, sk: Skill, opp?: Elf | null): boolean {
  const rule = elf.skillRules?.ppCostFree;
  if (!rule) return false;
  if (rule.skillKind === '屬性' && !isStatusSkill(sk)) return false;
  if (rule.skillKind === '攻擊' && isStatusSkill(sk)) return false;
  if (rule.whenFieldShield && !(((elf.shield || 0) > 0) || ((opp?.shield || 0) > 0))) return false;
  return true;
}
