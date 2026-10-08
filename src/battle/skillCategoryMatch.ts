/** 技能分類（物理／特殊／屬性）與「攻擊」集合不可互相替代。 */
export function matchesSkillCategory(rule: string, category: string): boolean {
  return rule === 'all' || rule === category || rule === '攻擊' && category !== '屬性';
}
