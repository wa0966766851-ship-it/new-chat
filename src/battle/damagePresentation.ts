import { isSkillDamageType } from './damageSemantics';
/**
 * 傷害數字與 HP 扣減量是兩個欄位。
 * - 技能傷害（受屬性克制影響的傷害）與真實傷害：顯示實際算出的傷害值（不因剩餘體力或存活規則截短）。
 * - 固定／百分比等：顯示體力變化量。
 */
export function damagePresentationAmount(nature: string, resolvedDamage: number, hpDamage: number): number {
  const value = nature === 'true' || isSkillDamageType(nature) ? resolvedDamage : hpDamage;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
