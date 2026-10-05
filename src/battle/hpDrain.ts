import type { BattleEventContext } from '../effects/types';

export type HpDrainType = 'fixed' | 'percent' | 'true';
/** 類型由原文決定，不能用「吸取／汲取」日誌或計算完的數值猜測。 */
export function queueHpDrain(
  ctx: Pick<BattleEventContext, 'actor' | 'applyPinkDamage' | 'applyTrueDamage' | 'applyHeal'>,
  targetSide: 'p1' | 'p2', amount: number, type: HpDrainType, label?: string,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const value = Math.floor(amount);
  const settled = type === 'true'
    ? ctx.applyTrueDamage(targetSide, value, label)
    : ctx.applyPinkDamage(targetSide, value, label, undefined, undefined, type);
  // 保留結算值與實際扣血的區別；護罩／殘血不能直接把恢復量變成0。
  if (Number.isFinite(settled) && settled > 0) ctx.applyHeal(ctx.actor, settled);
  return settled;
}
