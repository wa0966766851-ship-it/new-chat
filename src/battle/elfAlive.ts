import type { Elf } from '../types';
import { isAliveBySurvivalRule } from './survivalRules';

/** 陣亡判定（考慮存活規則與免死回合）。引擎、規則、註冊表共用。 */
export const checkElfDead = (elf: Elf | undefined | null) => {
  if (!elf) return true;
  if (isAliveBySurvivalRule(elf.currentHp, elf.survivalRule)) return false;
  if (elf.deathImmunity && elf.deathImmunity.deathImmuneTurns > 0) return false;
  return true;
};
