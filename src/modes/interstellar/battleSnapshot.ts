import type { Elf, BaseStats } from '../../types';
import { isAliveBySurvivalRule } from '../../battle/survivalRules';
import { calculateElfStats } from '../../utils/elfStats';
import { applyEquipmentToElfStats } from '../../data/suitsAndEyewears';
/** 延續體力：保留「已損失體力」，而非以舊上限截斷（裝備加體力上限時，滿血仍是滿血）。 */
function carriedHp(elf: Elf, newMax: number): number {
  if (!isAliveBySurvivalRule(elf.currentHp, elf.survivalRule)) return Math.max(0, Math.min(newMax, elf.currentHp));
  if (elf.currentHp <= 0) return Math.min(newMax, elf.currentHp); // 特殊存活規則（可負體力）原樣保留
  const oldMax = Number.isFinite(elf.maxHp) && elf.maxHp > 0 ? elf.maxHp : newMax;
  const lost = Math.max(0, oldMax - elf.currentHp);
  return Math.max(1, Math.min(newMax, newMax - lost));
}
/** 種族加成後重算面板、裝備只套一次；持續體力與PP不因開局reset回滿。 */
export function buildExplorationSnapshot(elf: Elf, baseStats: BaseStats, suit?: string, title?: string, panel?: (s: BaseStats) => BaseStats): Elf {
  const stats=calculateElfStats(baseStats,elf.level,elf.ivs,elf.evs,elf.natureModifiers,elf.inscriptions,elf.guildBonuses,elf.hasAnnualBonus);
  const equipped=applyEquipmentToElfStats(stats,suit,undefined,undefined,title);
  const calculatedStats=panel?panel(equipped):equipped; // 遺物等面板加成
  return {...elf,baseStats,calculatedStats,maxHp:calculatedStats.hp,
    currentHp:(elf as any).explorationVitals?carriedHp(elf,calculatedStats.hp):calculatedStats.hp,
    statStages:{atk:0,def:0,spatk:0,spdef:0,speed:0,accuracy:0}, effects:[],
    battleStatus:'normal',battleStatuses:{},shield:0,barrier:0,
    skills:elf.skills.map(s=>({...s,maxPp:s.maxPp??s.pp,pp:(elf as any).explorationVitals?s.pp:(s.maxPp??s.pp)}))};
}
