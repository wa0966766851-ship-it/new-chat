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
  cancelExceptCategory?: StatusCategory;
  replacePpFree?: boolean;
  replaceInvalidateOppTurns?: number;
}
export interface StatusProjection {
  target: 'holder' | 'opponent';
  category: StatusCategory;
  status: string;
}
/** 2026-11-21：多個來源（例如狂暴、平靜、山神守護、砥礪）各自一組規則並存，不再互相覆蓋 whileStatus。舊存檔的單一物件仍相容。 */
export type ElfStatusRuleSet = ElfStatusRules | readonly ElfStatusRules[];
declare module '../types' { interface Elf { statusRules?: ElfStatusRuleSet; markStatusProjections?: readonly StatusProjection[] } }
export const statusRuleList = (rules: ElfStatusRuleSet | undefined): ElfStatusRules[] => !rules ? [] : Array.isArray(rules) ? [...rules] : [rules as ElfStatusRules];

export function statusMatchesProjection(name: string, category: StatusCategory): boolean {
  const categories = categoriesOf(name);
  return !categories.includes('BOSS_ONLY') && !categories.includes('NO_EFFECT') && categories.includes(category);
}

export function applyStatusProjections(statuses: Record<string, number>, rules?: readonly StatusProjection[]): Record<string, number> {
  if (!rules?.length) return statuses;
  const next: Record<string, number> = {};
  for (const [name, turns] of Object.entries(statuses)) {
    const key = rules.find(rule => statusMatchesProjection(name, rule.category))?.status ?? name;
    next[key] = Math.max(next[key] ?? 0, turns);
  }
  return next;
}

const present = (statuses: Record<string, number>, name: string) =>
  Object.entries(statuses).some(([id, turns]) => turns > 0 && canonicalStatusName(id) === canonicalStatusName(name));
const categoriesOf = (id: string): StatusCategory[] => StatusRegistry[canonicalStatusName(id)]?.categories || [];

/** 條件異常存在的規則組。 */
export function activeStatusRuleSets(rules: ElfStatusRuleSet | undefined, statuses: Record<string, number>): ElfStatusRules[] {
  return statusRuleList(rules).filter(r => present(statuses, r.whileStatus));
}
/** 條件異常存在時的規則（多組合併：分類取聯集、布林任一、回合取最大）；否則 undefined。 */
export function activeStatusRules(rules: ElfStatusRuleSet | undefined, statuses: Record<string, number>): ElfStatusRules | undefined {
  const sets = activeStatusRuleSets(rules, statuses);
  if (!sets.length) return undefined;
  if (sets.length === 1) return sets[0];
  const union = (k: 'conversionTargetBan' | 'cancelEffects') => { const v = [...new Set(sets.flatMap(r => r[k] || []))]; return v.length ? v : undefined; };
  const turns = Math.max(0, ...sets.map(r => r.replaceInvalidateOppTurns || 0));
  return { whileStatus: sets[0].whileStatus, conversionTargetBan: union('conversionTargetBan'), cancelEffects: union('cancelEffects'),
    ...(sets.some(r => r.replacePpFree) ? { replacePpFree: true } : {}), ...(turns ? { replaceInvalidateOppTurns: turns } : {}) };
}

/** 目前被取消原有效果的異常 id（各組分別判定後取聯集；不含該組自身的條件異常）。 */
export function cancelledStatusIds(rules: ElfStatusRuleSet | undefined, statuses: Record<string, number>): string[] {
  const out = new Set<string>();
  for (const active of activeStatusRuleSets(rules, statuses)) {
    if (!active.cancelEffects?.length && !active.cancelExceptCategory) continue;
    for (const id of Object.keys(statuses)) if (statuses[id] > 0 && canonicalStatusName(id) !== canonicalStatusName(active.whileStatus)
      && (active.cancelExceptCategory ? !categoriesOf(id).includes(active.cancelExceptCategory) : categoriesOf(id).some(c => active.cancelEffects!.includes(c)))) out.add(id);
  }
  return [...out];
}

/** 去掉被取消原有效果的異常後的異常表（供機制查詢；顯示與回合數照舊使用原表）。 */
export function effectiveStatusTable(rules: ElfStatusRuleSet | undefined, statuses: Record<string, number>): Record<string, number> {
  const cancelled = cancelledStatusIds(rules, statuses);
  if (!cancelled.length) return statuses;
  return Object.fromEntries(Object.entries(statuses).filter(([id]) => !cancelled.includes(id)));
}

/** 異常是否被禁止轉化為 targetId（任一生效規則組禁止即禁止）。 */
export function statusConversionBlocked(rules: ElfStatusRuleSet | undefined, statuses: Record<string, number>, targetId: string): boolean {
  return activeStatusRuleSets(rules, statuses).some(active => !!active.conversionTargetBan?.length && categoriesOf(targetId).some(c => active.conversionTargetBan!.includes(c)));
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
export function statusReplacementActive(rules: ElfStatusRuleSet | undefined, statuses: Record<string, number>): ElfStatusRules | undefined {
  return activeStatusRules(rules, statuses);
}
