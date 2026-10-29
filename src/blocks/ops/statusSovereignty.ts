// 夜之主權（DSH 20261018 第十一批·第一波；5015 混沌·布萊克 魂印「夜」常駐規則的通用積木化）。
// 兩個常駐規則 op，狀態清單全由 Kit 參數提供（反硬編碼）：
//   status_immunity_bypass{statuses}：持有者的「異常免疫類效果」（通用免疫／反彈／分類防護、
//     次數免疫、套裝／魂印附加前防護、特性免疫）始終無法免疫清單中的異常——
//     寫入個體範圍鍵 blkStatusImmunityBypass；讀取端 battle/contextBuilders.applyStatusWithImmunityCheck。
//   status_conversion_ban{statuses}：持有者身上清單中的異常無法被轉化為其他異常狀態——
//     寫入個體範圍鍵 blkStatusConversionBan；讀取端 blocks/runtime.convert_status。
// 兩者皆為常駐規則（不隨回合遞減、下場不因戰鬥流程清除）；重複執行只做聯集合併，不疊層。
// 「黯痕」等「無法附加」型禁令不是免疫類效果，不在讓路範圍（維持原引擎語意）。
import type { BattleEventContext } from '../../effects/types';
import { StatusRegistry } from '../../effects/statusRegistry';
import { canonicalStatusName } from '../../effects/statusIdentity';

export const STATUS_SOVEREIGNTY_ACTION_FIELDS = {
  status_immunity_bypass: ['statuses'],
  status_conversion_ban: ['statuses'],
} as const;

export function statusSovereigntyActionIssue(op: string, p: any): string | null {
  if (!(op in STATUS_SOVEREIGNTY_ACTION_FIELDS)) return null;
  if (!Array.isArray(p?.statuses) || p.statuses.length === 0 || p.statuses.length > 8
    || p.statuses.some((s: any) => typeof s !== 'string' || !s || !StatusRegistry[canonicalStatusName(s)]))
    return '常駐主權規則需1至8個已登記的異常名稱清單';
  return null;
}

const mergeRule = (ctx: BattleEventContext, key: string, p: { statuses: string[] }, verb: string): boolean => {
  const names = p.statuses.map(canonicalStatusName);
  const prev: string[] = (ctx.getPlayerState(key) || []).map(canonicalStatusName);
  const next = [...new Set([...prev, ...names])];
  ctx.setPlayerState(key, next);
  ctx.addLog(`🌙 【${ctx.self?.name}】常駐規則：${names.join('、')}${verb}！`, 'effect');
  return true;
};

export function statusSovereigntyOperations() {
  return {
    status_immunity_bypass: (ctx: BattleEventContext, p: { statuses: string[] }) =>
      mergeRule(ctx, 'blkStatusImmunityBypass', p, '不受任何異常免疫類效果影響'),
    status_conversion_ban: (ctx: BattleEventContext, p: { statuses: string[] }) =>
      mergeRule(ctx, 'blkStatusConversionBan', p, '無法被轉化為其他異常狀態'),
  };
}
