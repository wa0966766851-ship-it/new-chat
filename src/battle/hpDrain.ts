import type { BattleEventContext } from '../effects/types';
import type { DamageCalculationOptions } from './damageCalculation';

export type HpDrainType = 'fixed' | 'percent' | 'true';
/** 類型由原文決定，不能用「吸取／汲取」日誌或計算完的數值猜測。 */
/**
 * 「吸取效果翻倍」等期限倍率（積木 drain_mult_turns 的 drainMult）：吸取方持有的有效計時器相乘。
 * 只作用於吸取（扣血＋等量恢復），不影響一般傷害。
 */
export function drainMultiplierOf(ctx: { actor: 'p1' | 'p2' }): number {
  const timers: any[] = (ctx as any)[`${ctx.actor}Timers`] || [];
  return timers.filter(t => t?.payload?.block?.drainMult > 1 && !t.pendingActivation && (t.remaining ?? 0) > 0)
    .reduce((m, t) => m * Number(t.payload.block.drainMult), 1);
}

export function queueHpDrain(
  ctx: Pick<BattleEventContext, 'actor' | 'applyPinkDamage' | 'applyTrueDamage' | 'applyHeal'>,
  targetSide: 'p1' | 'p2', amount: number, type: HpDrainType, label?: string, opts?: DamageCalculationOptions,
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const value = Math.floor(amount * drainMultiplierOf(ctx));
  const settled = type === 'true'
    ? ctx.applyTrueDamage(targetSide, value, label)
    : ctx.applyPinkDamage(targetSide, value, label, undefined, undefined, type, opts);
  // 保留結算值與實際扣血的區別；護罩／殘血不能直接把恢復量變成0。
  if (Number.isFinite(settled) && settled > 0) ctx.applyHeal(ctx.actor, settled);
  return settled;
}
