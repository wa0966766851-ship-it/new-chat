import type { BattleEventContext } from '../effects/types';

/** 亮節（官方）：持有者機率不高於 50% 的異常狀態附加效果，機率下降至 0。 */
export function statusChanceBlocked(ctx: BattleEventContext, percent: number): boolean {
  if (!(percent > 0) || percent > 50) return false;
  try {
    return (ctx.getMarks?.(ctx.actor) || []).some(m => m.count > 0 && m.effects?.statusChanceZeroAtMost50);
  } catch { return false; }
}
