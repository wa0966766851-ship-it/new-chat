import type { Elf } from '../types';
import type { Timer } from './timers';
export function activeConstraints(timers: Timer[] | undefined, elf: Elf): Record<string, any>[] {
  return (timers ?? []).filter(t=>t.remaining>0&&!t.pendingActivation&&(t.scope==='team'||!t.ownerBattleId||t.ownerBattleId===(elf.battleId||elf.id))).map(t=>t.payload??{});
}
