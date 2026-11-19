import type { BattleEventContext } from './types';
import type { Timer } from '../battle/timers';

type StageOperation = 'clear' | 'steal' | 'reverse';

export function stageTimerBlocksOperation(timers: Timer[] | undefined, ownerId: string, value: number, operation: StageOperation): boolean {
  return timers?.some(timer => {
    const guard = (timer.payload as any)?.block?.stageGuard;
    return !timer.pendingActivation && timer.remaining > 0 &&
      (timer.scope === 'team' || !timer.ownerBattleId || String(timer.ownerBattleId) === ownerId) &&
      (value > 0 ? guard === 'up' && operation !== 'reverse' : value < 0 && guard === 'down' && operation !== 'steal');
  }) || false;
}

/** 能力等級的操作保護只讀仍有效且屬於本持有者的計時器。 */
export function stageOperationBlocked(ctx: BattleEventContext, side: 'p1' | 'p2', value: number, operation: StageOperation): boolean {
  const elf = side === ctx.actor ? ctx.self : ctx.target;
  return stageTimerBlocksOperation(side === 'p1' ? ctx.p1Timers : ctx.p2Timers, String(elf.battleId || elf.id), value, operation);
}
