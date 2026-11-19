import type { Elf } from '../types';
import { checkElfDead } from './elfAlive';

export const battleIdentity = (elf: Elf) => String(elf.battleId || elf.id);

/** 預選只保存個體身分；不保存會隨戰鬥改變的能力或傷害快照。 */
export function extraTargetPool(team: Elf[], active: Elf, pools: string[]) {
  return team.filter(elf => battleIdentity(elf) !== battleIdentity(active) && !elf.isVanished && !checkElfDead(elf)
    && (elf.isExtra ? pools.includes('foe_extra') : pools.includes('foe_bench')));
}

export function isPreparedExtraTarget(owner: Elf, side: 'p1' | 'p2', victim: Elf, active: Elf): boolean {
  return !owner.isVanished && !victim.isVanished && !checkElfDead(owner) && !checkElfDead(victim) && battleIdentity(victim) !== battleIdentity(active)
    && owner.preparedExtraAttack?.side === side && owner.preparedExtraAttack.ids.includes(battleIdentity(victim)) === true;
}
