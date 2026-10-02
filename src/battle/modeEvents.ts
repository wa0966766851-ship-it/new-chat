import { handleDestinyInterceptor } from '../effects/destinyInterceptors';
import type { BattleEventContext, EffectTiming } from '../effects/types';
const handlers={destiny:handleDestinyInterceptor};
/** 主流程只派送模式事件；模式效果實作仍位於外部註冊表。 */
export function dispatchModeEvent(ctx: BattleEventContext, event: EffectTiming, data?: any): void {
  const handler=ctx.specialMode && handlers[ctx.specialMode];
  handler?.(ctx,event,data);
}
