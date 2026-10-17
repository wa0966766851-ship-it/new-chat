import type {Elf} from '../types';

/** Old display mirrors are not clocks. A present authoritative registry key wins, including zero. */
const CLOCKS: Record<string,string> = {
  statusImmuneTurns: 'immuneStatusTurns',
  cannotUseAttrSkillsTurns: 'utilitySkillInvalidTurns',
  cannotUseAttackSkillsTurns: 'attackSkillInvalidTurns',
};
export function displayTurnValue(elf:Elf,registry:Record<string,any>,field:string):number {
  const key=CLOCKS[field];
  return Math.max(0,Number(key&&registry[key]!==undefined?registry[key]:(elf as any)[field]||0));
}
