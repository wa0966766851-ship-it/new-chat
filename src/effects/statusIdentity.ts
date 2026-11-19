import { StatusRegistry } from './statusRegistry';
import type { StatusCategory } from './statusTypes';
import { STATUS_NAMES_MAP } from './statusAliases';
/** 使用登記表已明示的別名，不以相似字猜測異常身分。 */
export const canonicalStatusName = (name: string) => { const mapped = STATUS_NAMES_MAP[name] || name; return StatusRegistry[mapped]?.name || mapped; };
/**
 * 關閉回合數的異常：不扣回合、不顯示回合數、下場保留。回合結算與介面都讀這裡，不各自判斷分類。
 * 兩者是不同的事（2026-11-15 使用者規則）：
 *  - BOSS 類異常＝附屬類＋關閉回合數；某個實例若「開啟了回合數」（timed），它就不再算 BOSS 類，照一般附屬類倒數。
 *  - 其他異常關閉了回合數（noDuration）也不會因此變成 BOSS 類。
 */
export const isDurationlessStatus = (name: string, instance?: { timed?: boolean }): boolean =>
  StatusRegistry[canonicalStatusName(name)]?.noDuration === true && instance?.timed !== true;
/** 這個異常實例是否屬於 BOSS 類：登錄為 BOSS 類，且實例沒有開啟回合數。turns 為介面上的剩餘回合（BOSS 類固定 999）。 */
export const isBossClassInstance = (name: string, instance?: { timed?: boolean; turns?: number }): boolean => {
  const entry = StatusRegistry[canonicalStatusName(name)];
  if (!entry?.categories.includes('BOSS_ONLY') || instance?.timed === true) return false;
  const n = Number(instance?.turns);
  return !(Number.isFinite(n) && n > 0 && n < 99);
};
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
