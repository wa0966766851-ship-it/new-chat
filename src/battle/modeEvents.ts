import { handleDestinyInterceptor } from '../effects/destinyInterceptors';
import type { BattleEventContext, EffectTiming } from '../effects/types';
import { resolveBattlefield } from './battlefields';

const handlers: Partial<Record<string, (ctx: BattleEventContext, event: EffectTiming, data?: any) => void>> = {
  'destiny-interception': handleDestinyInterceptor,
};
/** 主流程只派送模式事件；模式效果實作仍位於外部註冊表。 */
export function dispatchModeEvent(ctx: BattleEventContext, event: EffectTiming, data?: any): void {
  for (const rule of resolveBattlefield(ctx.specialMode).effectIds) handlers[rule]?.(ctx, event, data);
}
