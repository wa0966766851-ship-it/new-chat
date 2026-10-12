/** 百分比／固定／真實附加傷害共用的面板基數，不等同技能傷害公式的有效雙攻。 */
export const DAMAGE_STAT_BASES: Record<string, readonly string[]> = {
  'stat:攻擊和特攻': ['atk', 'spatk'],
  'stat:攻擊': ['atk'], 'stat:特攻': ['spatk'],
  'stat:防禦': ['def'], 'stat:特防': ['spdef'], 'stat:速度': ['speed'],
};
export const DAMAGE_BASE_CHOICES = ['當前體力', '已損失體力', '最大體力', '護盾值', ...Object.keys(DAMAGE_STAT_BASES)];
