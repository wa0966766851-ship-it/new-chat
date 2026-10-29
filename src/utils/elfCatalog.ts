import type { Elf } from '../types';
import { applyElfOverrides } from '../data/elfRegistry';
import { applySavedSkillCorrections } from '../data/savedSkillCorrections';
import { calculateElfStats } from './statCalculator';

/** 唯一的介面目錄整備：不改動輸入、保留不同 ID 的同名精靈。戰鬥快照不經此處重置。 */
export function resolveElfCatalog(elves: readonly Elf[], defaults: Elf[], deletedIds: readonly string[] = []): Elf[] {
  const hidden = new Set(deletedIds), seen = new Set<string>();
  return elves.filter(elf => {
    if (!elf || hidden.has(elf.id) || hidden.has(elf.name)) return false;
    const key = elf.id || elf.name;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(elf => {
    const { updated, needsRecalc } = applyElfOverrides({ ...elf, soulMark: elf.soulMark ? { ...elf.soulMark } : elf.soulMark }, defaults);
    if (needsRecalc) {
      const stats = calculateElfStats(updated.baseStats, updated.level || 100, updated.ivs, updated.evs,
        updated.natureModifiers, updated.inscriptions, updated.guildBonuses, updated.hasAnnualBonus);
      updated.calculatedStats = stats; updated.maxHp = stats.hp; updated.currentHp = stats.hp;
    }
    return applySavedSkillCorrections(updated, defaults);
  });
}
