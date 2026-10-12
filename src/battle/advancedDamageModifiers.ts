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

/** 戰鬥中是否視為異能精靈（資料標記、類別，或特質「戰士」等 alwaysAlienElf）。 */
export function isAlienElf(elf: Elf | undefined | null): boolean {
  if (!elf) return false;
  return !!elf.isAlienElf || (elf as any).category === '異能精靈' || !!getElfAdvancedMechanics(elf).alwaysAlienElf;
}

/** 特質「無序星魂使徒」：對異能精靈造成傷害翻倍（所有傷害類別；屬「翻倍」獨立乘區）。 */
export function applyAlienDoubleDamage(comp: DamageComputation, actor: Elf | undefined, target: Elf | undefined): void {
  if (!actor || !target || comp.pure) return;
  if (getElfAdvancedMechanics(actor).doubleDamageToAlienElf && isAlienElf(target)) comp.multiplier *= 2;
}

/** 持有者自身的輸出上限，不可被「無視對手傷害限制」一起清掉。 */
export function applyOutgoingSkillRestriction(comp: DamageComputation, registry: Record<string, any>): void {
  if (comp.pure || !isSkillDamageType(comp.damageCategory) || !(registry.DarkScarTurns > 0)) return;
  if (comp.attackDefenseBypass?.limit || registry.blkIgnoreLimit || registry.ignoreDamageLimitThisAction) {
    multiplyDamageReduction(comp, 0.5, false);
  } else comp.outgoingLimit = Math.min(comp.outgoingLimit ?? Infinity, 1);
}
