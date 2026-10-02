import type { Elf, BaseStats } from '../../types';
import { isAliveBySurvivalRule } from '../../battle/survivalRules';
import { calculateElfStats } from '../../utils/elfStats';
import { applyEquipmentToElfStats } from '../../data/suitsAndEyewears';
/** 種族加成後重算面板、裝備只套一次；持續體力與PP不因開局reset回滿。 */
export function buildExplorationSnapshot(elf: Elf, baseStats: BaseStats, suit?: string, title?: string): Elf {
  const stats=calculateElfStats(baseStats,elf.level,elf.ivs,elf.evs,elf.natureModifiers,elf.inscriptions,elf.guildBonuses,elf.hasAnnualBonus);
  const calculatedStats=applyEquipmentToElfStats(stats,suit,undefined,undefined,title);
  return {...elf,baseStats,calculatedStats,maxHp:calculatedStats.hp,
    currentHp:(elf as any).explorationVitals?Math.min(calculatedStats.hp,isAliveBySurvivalRule(elf.currentHp,elf.survivalRule)?elf.currentHp:Math.max(0,elf.currentHp)):calculatedStats.hp,
    statStages:{atk:0,def:0,spatk:0,spdef:0,speed:0,accuracy:0}, effects:[],
    battleStatus:'normal',battleStatuses:{},shield:0,barrier:0,
    skills:elf.skills.map(s=>({...s,maxPp:s.maxPp??s.pp,pp:(elf as any).explorationVitals?s.pp:(s.maxPp??s.pp)}))};
}
