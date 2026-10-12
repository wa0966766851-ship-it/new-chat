import type { BattleEventContext } from './types';
import { EffectTiming } from './types';

/** PP恢復不觸發；削除、正常出招及內部消耗共用同一因果鏈。 */
export function isPpConsumption(event: EffectTiming, data: any): boolean {
  return (event === EffectTiming.ON_PP_CONSUME || event === EffectTiming.PP_CHANGED && data?.removed > 0)
    && Array.isArray(data?.consumedSlots) && data.consumedSlots.length > 0;
}

/** 狀態銀行按持有者隔離，沿用舊攜帶路徑的每槽一次規則，跨路由亦不重播。 */
export function withPpConsumptionChain<T>(ctx: BattleEventContext, event: EffectTiming, data: any, run: () => T): T {
  if (!isPpConsumption(event, data)) return run();
  const existing = ctx.getPlayerState('ppCarryChain');
  if (!existing) ctx.setPlayerState('ppCarryChain', { seen: [] });
  try { return run(); }
  finally { if (!existing) ctx.setPlayerState('ppCarryChain', undefined); }
}

export function claimPpCarriedSlot(ctx: BattleEventContext, slot: number): boolean {
  const chain = ctx.getPlayerState('ppCarryChain');
  if (!chain || chain.seen.includes(slot)) return false;
  chain.seen.push(slot);
  ctx.setPlayerState('ppCarryChain', chain);
  return true;
}
