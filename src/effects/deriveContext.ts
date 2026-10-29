import type { BattleEventContext } from './types';

/**
 * 以原型繼承衍生上下文：保留原型鏈上的計時器、事件與即時 getter。
 * 不可用 `{...ctx}`（展開只複製自有可列舉屬性，會丟掉節點上下文繼承來的資料）。
 */
export function deriveContext<T extends BattleEventContext>(ctx: T, overrides: Record<string, unknown>): T {
  const derived = Object.create(ctx);
  for (const [key, value] of Object.entries(overrides)) {
    Object.defineProperty(derived, key, { value, writable: true, configurable: true, enumerable: true });
  }
  return derived;
}
