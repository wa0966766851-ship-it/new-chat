import type { Elf } from '../types';
import type { DamageComputation } from '../effects/types';
import { getElfAdvancedMechanics } from '../data/traitsRegistry';
import { multiplyDamageReduction } from './damageReduction';
import { isSkillDamageType } from './damageSemantics';
import { distinctStoneCount } from '../data/skillStones';

const fourStones = (elf: Elf) => distinctStoneCount(elf) >= 4;

/** 投石者的50%是攻擊傷害修正，不是雙防修正或所有傷害減半。 */
export function applyAdvancedDamageModifiers(comp: DamageComputation, actor: Elf, target: Elf): void {
  if (comp.pure || comp.damageCategory !== 'skill_attack') return;
  const atk = getElfAdvancedMechanics(actor), def = getElfAdvancedMechanics(target);
  if (atk.damageBoost4Stones && fourStones(actor)) comp.increasePercent += atk.damageBoost4Stones;
  if (def.damageReduce4Stones && fourStones(target)) multiplyDamageReduction(comp, 1 - def.damageReduce4Stones);
}

/** 持有者自身的輸出上限，不可被「無視對手傷害限制」一起清掉。 */
export function applyOutgoingSkillRestriction(comp: DamageComputation, registry: Record<string, any>): void {
  if (comp.pure || !isSkillDamageType(comp.damageCategory) || !(registry.DarkScarTurns > 0)) return;
  if (comp.attackDefenseBypass?.limit || registry.blkIgnoreLimit || registry.ignoreDamageLimitThisAction) {
    multiplyDamageReduction(comp, 0.5, false);
  } else comp.outgoingLimit = Math.min(comp.outgoingLimit ?? Infinity, 1);
}
