import type { Elf, Skill } from '../types';
import { calculateEffectiveStat } from '../utils/statCalculator';
import {readPassiveSoulMechanic} from '../battle/finalExtraSoulMechanics';

type Formula = (actor: Elf, target: Elf, skill: Skill, defendingTeam: Elf[], attackStage: number, effectiveAttack?: number) => { damage: number; isCrit: boolean; typeMultiplier: number; statResetApplied?: 'def' | 'spdef' } | undefined;

/** 公式替換獨立於一般攻擊公式；使用已經調整完的能力值。 */
export const SpecialDamageFormulaRegistry: Formula[] = [
  (actor, _target, skill, team, attackStage, effectiveAttack) => {
    if (skill.category !== '特殊') return;
    const owner = team.find(e => e.currentHp>0&&!e.isVanished&&
      (readPassiveSoulMechanic(e,'special_attack_panel_formula')||(/無序[·.]蝕言/.test(e.name)&&e.soulMark?.effectMode!=='kit')));
    if (!owner) return;
    const finalSpdef = calculateEffectiveStat(owner.calculatedStats.spdef, owner.statStages?.spdef || 0);
    const attack = effectiveAttack ?? calculateEffectiveStat(actor.calculatedStats.spatk, attackStage);
    const perPoint=readPassiveSoulMechanic(owner,'special_attack_panel_formula')?.reductionPerPoint??.01;
    return { damage: Math.max(0, Math.floor(attack * (1 - finalSpdef * perPoint))), isCrit: false, typeMultiplier: 1 };
  },
];

export function specialDamageFormula(actor: Elf, target: Elf, skill: Skill, team: Elf[], attackStage: number, effectiveAttack?: number) {
  for (const formula of SpecialDamageFormulaRegistry) {
    const result = formula(actor, target, skill, team, attackStage, effectiveAttack);
    if (result) return result;
  }
}
