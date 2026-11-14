import { normalizeDamageType, isSkillDamageType } from './damageSemantics';

/** 演出只讀分類，不因技能名或日誌內含「汲取」而改變傷害類型。 */
export function damagePopupStyle(type: string) {
  const normalized = normalizeDamageType({ damageType: type });
  const heal = type === 'heal' || type === 'adjust_up';
  // 藥劑反噬傷害：與回復同色（綠字黃框），以負號表示。
  const potion = normalized === 'potion_backlash';
  const pink = normalized === 'fixed' || normalized === 'percent' || type === 'adjust_down';
  const white = normalized === 'true';
  const skill = isSkillDamageType(normalized) || type === 'crit';
  // 跳字外觀（2026-11-07，原廠風字體與配色）：skill 紅、pink 粉、heal 綠黃框、true 白、notice 另由 noticeVariant 判定。
  const variant = potion ? 'potion' : heal ? 'heal' : pink ? 'pink' : white ? 'true' : skill ? 'skill' : 'notice';
  return { heal, pink, white, skill, variant,
    colorClass: heal || potion ? 'text-green-400' : pink ? 'text-pink-400' : white ? 'text-white' : skill ? 'text-red-500' : 'text-slate-200',
    textShadow: heal || potion ? '-1px -1px 0 #eab308, 1px -1px 0 #eab308, -1px 1px 0 #eab308, 1px 1px 0 #eab308'
      : pink ? '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 2px 6px #000'
      : '0 0 2px #000, 0 2px 0 #000, 0 0 12px rgba(0,0,0,0.85)' };
}
export function damagePopupLabel(label?: string): string | undefined {
  return label && !/吸取|汲取/.test(label) ? label : undefined;
}

/** 文字跳字分類：Miss 與技能無效同一種外觀（evade）；附加效果失效為附屬標籤（addInvalid）。 */
export function noticeVariant(text?: string): 'evade' | 'addInvalid' | 'notice' {
  const t = String(text || '').trim();
  if (/^miss/i.test(t) || /^技能無效/.test(t)) return 'evade';
  if (/^附加效果失效/.test(t)) return 'addInvalid';
  return 'notice';
}
