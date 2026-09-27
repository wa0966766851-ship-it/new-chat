export type RuntimeDamageType =
  | "skill"
  | "skill_attack"
  | "skill_attribute"
  | "skill_extra_action"
  | "fixed"
  | "percent"
  | "true"
  | string;

/** 將歷史事件名稱正規化成戰鬥引擎使用的傷害分類。 */
export function normalizeDamageType(data: any): RuntimeDamageType {
  const damageType = String(data?.damageType || "");
  if (damageType === "true_damage" || damageType === "absorb" || String(data?.label || "").includes("汲取")) {
    return "true";
  }
  if (damageType === "fixed_damage") return "fixed";
  if (damageType === "percent_damage") return "percent";
  return damageType;
}

export const isSkillDamageType = (damageType: RuntimeDamageType): boolean =>
  damageType === "skill" || damageType === "skill_attack" || damageType === "skill_attribute" || damageType === "skill_extra_action";

export const isFixedOrPercentDamageType = (damageType: RuntimeDamageType): boolean =>
  damageType === "fixed" || damageType === "percent";

export const isNonTrueDamageType = (damageType: RuntimeDamageType): boolean =>
  isSkillDamageType(damageType) || isFixedOrPercentDamageType(damageType);

export interface DamageAbsorptionResult {
  amount: number;
  shield: number;
  barrier: number;
  shieldAbsorbed: number;
  barrierAbsorbed: number;
}

/**
 * 統一護盾／護罩結算。
 * - 技能傷害（包含額外行動傷害）由護盾吸收。
 * - 固定／百分比傷害由護罩吸收。
 * - 真實傷害不受兩者影響。
 * - ignoreShield 僅讓技能傷害略過護盾，不會錯誤略過護罩規則。
 */
export function settleDamageAbsorption(
  amount: number,
  damageType: RuntimeDamageType,
  shield: number,
  barrier: number,
  ignoreShield = false,
): DamageAbsorptionResult {
  let remaining = Math.max(0, Math.floor(amount));
  let nextShield = Math.max(0, Math.floor(shield));
  let nextBarrier = Math.max(0, Math.floor(barrier));
  let shieldAbsorbed = 0;
  let barrierAbsorbed = 0;

  if (isSkillDamageType(damageType) && !ignoreShield && nextShield > 0) {
    shieldAbsorbed = Math.min(nextShield, remaining);
    nextShield -= shieldAbsorbed;
    remaining -= shieldAbsorbed;
  } else if (isFixedOrPercentDamageType(damageType) && nextBarrier > 0) {
    barrierAbsorbed = Math.min(nextBarrier, remaining);
    nextBarrier -= barrierAbsorbed;
    remaining -= barrierAbsorbed;
  }

  return {
    amount: remaining,
    shield: nextShield,
    barrier: nextBarrier,
    shieldAbsorbed,
    barrierAbsorbed,
  };
}
