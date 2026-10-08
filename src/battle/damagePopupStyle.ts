import { normalizeDamageType, isSkillDamageType } from './damageSemantics';

/** 演出只讀分類，不因技能名或日誌內含「汲取」而改變傷害類型。 */
export function damagePopupStyle(type: string) {
  const normalized = normalizeDamageType({ damageType: type });
  const heal = type === 'heal' || type === 'adjust_up';
  const pink = normalized === 'fixed' || normalized === 'percent' || type === 'adjust_down';
  const white = normalized === 'true';
  const skill = isSkillDamageType(normalized) || type === 'crit';
  return { heal, pink, white, skill,
    colorClass: heal ? 'text-green-400' : pink ? 'text-pink-400' : white ? 'text-white' : skill ? 'text-red-500' : 'text-slate-200',
    textShadow: heal ? '-1px -1px 0 #eab308, 1px -1px 0 #eab308, -1px 1px 0 #eab308, 1px 1px 0 #eab308'
      : pink ? '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 2px 6px #000'
      : '0 0 2px #000, 0 2px 0 #000, 0 0 12px rgba(0,0,0,0.85)' };
}
export function damagePopupLabel(label?: string): string | undefined {
  return label && !/吸取|汲取/.test(label) ? label : undefined;
}
