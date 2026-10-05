import { normalizeDamageType, isSkillDamageType } from './damageSemantics';

/** 演出只讀分類，不因技能名或日誌內含「汲取」而改變傷害類型。 */
export function damagePopupStyle(type: string) {
  const normalized = normalizeDamageType({ damageType: type });
  const heal = type === 'heal' || type === 'adjust_up';
  const pink = normalized === 'fixed' || normalized === 'percent' || type === 'adjust_down';
  const white = normalized === 'true';
  const skill = isSkillDamageType(normalized) || type === 'crit';
  return { heal, pink, white, skill,
    colorClass: heal ? 'text-green-400' : pink ? 'text-pink-400' : white ? 'text-white' : skill ? 'text-red-500' : 'text-slate-200' };
}
export function damagePopupLabel(label?: string): string | undefined {
  return label && !/吸取|汲取/.test(label) ? label : undefined;
}
