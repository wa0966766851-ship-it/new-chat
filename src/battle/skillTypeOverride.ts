import { getTypeMatchup } from '../utils/statCalculator';
import { isSkillDamageType } from './damageSemantics';

export function skillTypeMultiplier(reg: Record<string, any> | undefined, type: string, targetType: string): number {
  if (Number(reg?.typeMultiplierUntilSwitch) > 0) return Number(reg!.typeMultiplierUntilSwitch);
  // 本次技能固定按指定克制倍率計算（例如「固定按最高克制倍率」＝4 倍）。
  if (Number(reg?.fixedTypeMultThisAction) > 0) return Number(reg!.fixedTypeMultThisAction);
  const target = reg?.targetTypeThisAction || targetType;
  if (Array.isArray(reg?.blkTypeOverride) && (reg?.blkTypeOverrideCurrentAction || (reg?.blkTypeOverrideUses || 0) > 0)) {
    return Math.max(...reg.blkTypeOverride.map((t: string) => getTypeMatchup(t, target)));
  }
  const multiplier = getTypeMatchup(type, target);
  return reg?.noResistedThisAction && multiplier > 0 && multiplier < 1 ? 1 : multiplier;
}

/** 延續按真正造成技能傷害的次數消耗；屬性／額外行動和一般攻擊相同。 */
export function consumeSkillTypeOverride(reg: Record<string, any>, category: string, amount: number): Record<string, any> {
  if (amount <= 0 || !isSkillDamageType(category) || reg.blkTypeOverrideCurrentAction || !(reg.blkTypeOverrideUses > 0)) return reg;
  return { ...reg, blkTypeOverrideUses: reg.blkTypeOverrideUses - 1 };
}
