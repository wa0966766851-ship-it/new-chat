// 異常規則（通用讀取端；DSH 2026-10-31，5041 魂印「山神守護時」使用，名稱不綁特定精靈）。
// 持有者在「條件異常」（whileStatus）期間：
//   conversionTargetBan：其所處的異常不可被轉化為這些分類的異常（衍化／轉化的目標分類）；
//   cancelEffects：這些分類異常的「原有效果」取消（異常本身仍在、回合數照算）；
//   replacePpFree：原有效果被取消期間，改為選擇使用技能不受 PP 值限制；
//   replaceInvalidateOpp：改為技能使用後令對手 N 回合內技能附加效果失效。
// 純函式，只吃異常表與規則，不 import battleHelpers（避免循環）。
import { StatusRegistry } from '../effects/statusRegistry';
import { canonicalStatusName } from '../effects/statusIdentity';
import type { StatusCategory } from '../effects/statusTypes';

export interface ElfStatusRules {
  whileStatus: string;
  conversionTargetBan?: StatusCategory[];
  cancelEffects?: StatusCategory[];
  replacePpFree?: boolean;
  replaceInvalidateOppTurns?: number;
}
declare module '../types' { interface Elf { statusRules?: ElfStatusRules } }

const present = (statuses: Record<string, number>, name: string) =>
  Object.entries(statuses).some(([id, turns]) => turns > 0 && canonicalStatusName(id) === canonicalStatusName(name));
const categoriesOf = (id: string): StatusCategory[] => StatusRegistry[canonicalStatusName(id)]?.categories || [];

/** 條件異常存在時的規則；否則 undefined。 */
export function activeStatusRules(rules: ElfStatusRules | undefined, statuses: Record<string, number>): ElfStatusRules | undefined {
  return rules && present(statuses, rules.whileStatus) ? rules : undefined;
}

/** 目前被取消原有效果的異常 id（不含條件異常自身）。 */
export function cancelledStatusIds(rules: ElfStatusRules | undefined, statuses: Record<string, number>): string[] {
  const active = activeStatusRules(rules, statuses);
  if (!active?.cancelEffects?.length) return [];
  return Object.keys(statuses).filter(id => statuses[id] > 0 && canonicalStatusName(id) !== canonicalStatusName(active.whileStatus)
    && categoriesOf(id).some(c => active.cancelEffects!.includes(c)));
}

/** 去掉被取消原有效果的異常後的異常表（供機制查詢；顯示與回合數照舊使用原表）。 */
export function effectiveStatusTable(rules: ElfStatusRules | undefined, statuses: Record<string, number>): Record<string, number> {
  const cancelled = cancelledStatusIds(rules, statuses);
  if (!cancelled.length) return statuses;
  return Object.fromEntries(Object.entries(statuses).filter(([id]) => !cancelled.includes(id)));
}

/** 異常是否被禁止轉化為 targetId（目標屬於被禁分類）。 */
export function statusConversionBlocked(rules: ElfStatusRules | undefined, statuses: Record<string, number>, targetId: string): boolean {
  const active = activeStatusRules(rules, statuses);
  return !!active?.conversionTargetBan?.length && categoriesOf(targetId).some(c => active.conversionTargetBan!.includes(c));
}

/**
 * 條件異常存在時的替代規則。
 *
 * 2026-11-02 修正：原本要求「至少一個異常被取消原效果」才生效，
 * 這是錯的。原文「自身處於山神守護狀態時：
 *   > 取消控制類異常與弱化類異常附加效果
 *   > 改為自身1回合內選擇使用技能不受當前PP值限制」
 * —— 「改為」是並列的替代規則，不是「取消效果」的附屬結果。
 * 只要條件異常還在，替代規則就生效（即使身上沒有任何控制／弱化類異常）。
 */
export function statusReplacementActive(rules: ElfStatusRules | undefined, statuses: Record<string, number>): ElfStatusRules | undefined {
  return activeStatusRules(rules, statuses);
}
