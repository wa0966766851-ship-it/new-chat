import type { Elf } from '../types';
import type { Timer } from './timers';
export function activeConstraints(timers: Timer[] | undefined, elf: Elf): Record<string, any>[] {
  return (timers ?? []).filter(t=>t.remaining>0&&!t.pendingActivation&&(t.scope==='team'||!t.ownerBattleId||t.ownerBattleId===(elf.battleId||elf.id)))
    // 積木的鎖切換存於block；其餘block鍵有自己的語義，不能一律展開。
    .map(t=>t.payload?.block?.lockSwitch===true?{...t.payload,lockSwitch:true}:t.payload??{});
}
