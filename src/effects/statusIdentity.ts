import { StatusRegistry } from './statusRegistry';
import type { StatusCategory } from './statusTypes';
import { STATUS_NAMES_MAP } from './statusAliases';
/** 使用登記表已明示的別名，不以相似字猜測異常身分。 */
export const canonicalStatusName = (name: string) => { const mapped = STATUS_NAMES_MAP[name] || name; return StatusRegistry[mapped]?.name || mapped; };
export const sameStatus = (a: string, b: string) => canonicalStatusName(a) === canonicalStatusName(b);
export function statusOptionsFor(category: StatusCategory): string[] {
  const seen = new Set<string>();
  return Object.keys(StatusRegistry).filter(key => {
    const entry = StatusRegistry[key];
    if (!entry.categories.includes(category) || entry.categories.some(c => c === 'BOSS_ONLY' || c === 'NO_EFFECT' || c === 'AUXILIARY')) return false;
    if (seen.has(entry.name)) return false;
    seen.add(entry.name); return true;
  });
}
