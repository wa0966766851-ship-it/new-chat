import type { Elf, Skill } from '../types';
import { calculateEffectiveStat } from '../utils/statCalculator';

type Formula = (actor: Elf, target: Elf, skill: Skill, defendingTeam: Elf[], attackStage: number) => { damage: number; isCrit: boolean; typeMultiplier: number; statResetApplied?: 'def' | 'spdef' } | undefined;

/** 公式替換獨立於一般攻擊公式；使用已經調整完的能力值。 */
export const SpecialDamageFormulaRegistry: Formula[] = [
  (actor, _target, skill, team, attackStage) => {
    if (skill.category !== '特殊') return;
    const owner = team.find(e => /無序[·.]蝕言/.test(e.name) && e.currentHp > 0 && !e.isVanished);
    if (!owner) return;
    const finalSpdef = calculateEffectiveStat(owner.calculatedStats.spdef, owner.statStages?.spdef || 0);
    const attack = calculateEffectiveStat(actor.calculatedStats.spatk, attackStage);
    return { damage: Math.max(0, Math.floor(attack * (1 - finalSpdef / 100))), isCrit: false, typeMultiplier: 1 };
  },
];

export function specialDamageFormula(actor: Elf, target: Elf, skill: Skill, team: Elf[], attackStage: number) {
  for (const formula of SpecialDamageFormulaRegistry) {
    const result = formula(actor, target, skill, team, attackStage);
    if (result) return result;
  }
}
