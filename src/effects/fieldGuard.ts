import type { BattleEventContext } from './types';
import { EffectTiming } from './types';

/** 回合節點對全隊廣播；只有在場精靈才該響應的魂印用這個擋掉場下觸發。 */
export const FIELD_ONLY_EVENTS = new Set<string>([EffectTiming.ROUND_START, EffectTiming.ROUND_END, EffectTiming.BATTLE_PHASE_END, EffectTiming.ENFORCE]);

export function isOnField(ctx: BattleEventContext): boolean {
  const active: any = ctx.actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2;
  const self: any = ctx.self;
  if (!active || !self) return true;
  return (self.battleId && active.battleId) ? self.battleId === active.battleId : self === active || self.id === active.id;
}

/** 場下且為回合節點：不處理 */
export const benchSkip = (ctx: BattleEventContext, event: string) => FIELD_ONLY_EVENTS.has(event) && !isOnField(ctx);
