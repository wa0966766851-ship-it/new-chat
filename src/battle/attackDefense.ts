import { getElfAdvancedMechanics } from '../data/traitsRegistry';
import type { DamageComputation } from '../effects/types';
import type { Elf } from '../types';
import { resourceQueryActive } from './resourceQueryRules';
import { normalizeDamageType } from './damageSemantics';

/** 攻擊免疫（命中階段）與傷害抵擋／轉化／上限（結算階段）分開。
 * 不代表無視一般減傷、閃避、技能失效、死亡條件或護罩。 */
export interface AttackDefenseBypass {
  block?: boolean;
  conversion?: boolean;
  limit?: boolean;
  shield?: boolean;
}
export function attackDefenseBypass(elf: Pick<Elf, 'id' | 'battleId'>, registry: Record<string, any>, damageType: string): AttackDefenseBypass {
  if (normalizeDamageType({ damageType }) !== 'skill_attack') return {};
  // 特質「戰士」：自身攻擊無視對手傷害限制、抵擋、轉化傷害與護盾承傷（攻擊免疫另於命中判定處理）
  if (getElfAdvancedMechanics(elf as Elf).ignoreImmuneShieldEffects) return { block: true, conversion: true, limit: true, shield: true };
  const rule = registry.attackDefenseBypassUntilSwitch;
  if ((!rule || rule.ownerBattleId !== (elf.battleId || elf.id)) && !resourceQueryActive(elf as Elf,'ignoreDamageBlock') && !resourceQueryActive(elf as Elf,'ignoreDamageLimit')) return registry.blkIgnoreBlock?{block:true}:{};
  const owned = rule?.ownerBattleId === (elf.battleId || elf.id) ? rule : {};
  return { block: owned.block === true || registry.blkIgnoreBlock === true || resourceQueryActive(elf as Elf,'ignoreDamageBlock'), conversion: owned.conversion === true,
    limit: owned.limit === true || resourceQueryActive(elf as Elf,'ignoreDamageLimit'), shield: owned.shield === true };
}
export function bypassesAttackDefense(comp: Pick<DamageComputation, 'damageCategory' | 'attackDefenseBypass'> | undefined, kind: keyof AttackDefenseBypass): boolean {
  return comp?.damageCategory === 'skill_attack' && comp.attackDefenseBypass?.[kind] === true;
}
/** 只移除傷害上限；不能把乘區0恢復1，否則會抹掉攻擊者自己受到的傷害失效。 */
export function applyAttackDefenseLimit(comp: DamageComputation): void {
  if (bypassesAttackDefense(comp, 'limit')) delete comp.limit;
}
