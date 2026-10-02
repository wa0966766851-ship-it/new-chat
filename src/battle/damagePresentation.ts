/** 傷害數字與 HP 扣減量是兩個欄位；存活規則限制 HP 不代表真傷免疫。 */
export function damagePresentationAmount(nature: string, resolvedDamage: number, hpDamage: number): number {
  const value = nature === 'true' ? resolvedDamage : hpDamage;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
