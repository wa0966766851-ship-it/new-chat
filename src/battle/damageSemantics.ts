export type RuntimeDamageType =
  | "skill"
  | "skill_attack"
  | "skill_attribute"
  | "skill_extra_action"
  | "fixed"
  | "percent"
  | "true"
  | string;

/** 中文標籤／舊別名 → 引擎分類（applyPinkDamage 的 dmgType 常傳「百分比傷害」等中文） */
const DAMAGE_TYPE_ALIASES: Record<string, RuntimeDamageType> = {
  "百分比傷害": "percent", "百分比": "percent", "pink": "percent", "pink_damage": "percent",
  "固定傷害": "fixed", "固定": "fixed",
  "真實傷害": "true", "真實": "true", "true_dmg": "true",
  "攻擊傷害": "skill_attack", "技能傷害": "skill", "額外行動傷害": "skill_extra_action",
};

/** 將歷史事件名稱正規化成戰鬥引擎使用的傷害分類（'skill_attack'|'skill_attribute'|'skill_extra_action'|'skill'(泛技能)|'fixed'|'percent'|'true'）。 */
export function normalizeDamageType(data: any): RuntimeDamageType {
  const damageType = String(data?.damageType || "");
  if (damageType === "true_damage" || damageType === "absorb") {
    return "true";
  }
  if (damageType === "fixed_damage") return "fixed";
  if (damageType === "percent_damage") return "percent";
  return DAMAGE_TYPE_ALIASES[damageType] ?? damageType;
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
  /** 隊伍被動規則：攻擊傷害使護盾扣減時的扣減比例（0.5＝減半＝護盾容量加倍）。僅攻擊傷害適用。 */
  shieldDeductionRatio = 1,
): DamageAbsorptionResult {
  let remaining = Math.max(0, Math.floor(amount));
  let nextShield = Math.max(0, Math.floor(shield));
  let nextBarrier = Math.max(0, Math.floor(barrier));
  let shieldAbsorbed = 0;
  let barrierAbsorbed = 0;

  if (isSkillDamageType(damageType) && !ignoreShield && nextShield > 0) {
    const ratio = damageType === "skill_attack" && shieldDeductionRatio > 0 && shieldDeductionRatio < 1 ? shieldDeductionRatio : 1;
    // 扣減減半＝等效容量加倍：吸收量最多為 護盾/比例，護盾實際扣減為 吸收量×比例（無條件進位，避免 1 點傷害不扣盾）。
    shieldAbsorbed = Math.min(ratio < 1 ? Math.floor(nextShield / ratio) : nextShield, remaining);
    const deduction = ratio < 1 ? Math.min(nextShield, Math.ceil(shieldAbsorbed * ratio)) : shieldAbsorbed;
    nextShield -= deduction;
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
