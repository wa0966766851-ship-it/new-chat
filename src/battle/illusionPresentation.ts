import type {Elf} from '../types';
import { bindBag } from './bagTargets';

/** 只取外觀；精靈戰鬥身分、體力與技能持有者均保持原本精靈。 */
export function appearanceElf<T extends Pick<Elf, 'name' | 'id'>>(elf: T & { illusion?: Elf['illusion'] }): T {
  return elf.illusion ? { ...elf, name: elf.illusion.target.name,
    seerId: elf.illusion.target.seerId, path: elf.illusion.target.path,
    height: elf.illusion.target.height, weight: elf.illusion.target.weight,
    artPresentation: elf.illusion.target.artPresentation, illusion: undefined } : elf;
}

/** 相容舊名稱；位數、待命快照與順延規則見 bagTargets.ts。 */
export function bindInitialCounterparts(roster: Elf[], activeCount: number): Elf[] {
  return bindBag(roster, activeCount);
}
