export type DamageNature = "true" | "non_true";
export type NonPositiveSurvivalMode = "none" | "freeze_at_zero" | "god_descent";

export interface NonPositiveSurvivalRule {
  mode: NonPositiveSurvivalMode;
  active: boolean;
  /** 換到場下後規則是否仍保留。永久規則不應使用一般回合倒數。 */
  preserveOffField: boolean;
  /** 神降使用；六刃固定為0。 */
  minHp: number;
}

export interface DamageTransition {
  hp: number;
  alive: boolean;
  enteredNonPositive: boolean;
  ignoredDamage: boolean;
  /** 計入傷害統計的原傷害；神降的額外負體力變化不算傷害。 */
  damageApplied: number;
  hpAdjustment: number;
}

export const standardSurvivalRule = (): NonPositiveSurvivalRule => ({
  mode: "none",
  active: false,
  preserveOffField: false,
  minHp: 0,
});

/** 無序·六刃：非正體力仍存活；到0後，後續任何傷害不再改變體力。 */
export const liurenSurvivalRule = (): NonPositiveSurvivalRule => ({
  mode: "freeze_at_zero",
  active: true,
  preserveOffField: true,
  minHp: 0,
});

/** 異境神霆·雷伊：非正體力仍存活，最低可到最大體力的-70倍。 */
export const reyGodDescentRule = (maxHp: number): NonPositiveSurvivalRule => ({
  mode: "god_descent",
  active: true,
  preserveOffField: true,
  minHp: -70 * Math.max(0, maxHp),
});

export function isAliveBySurvivalRule(currentHp: number, rule?: NonPositiveSurvivalRule): boolean {
  if (currentHp > 0) return true;
  return !!rule?.active && rule.mode !== "none";
}

/**
 * 統一傷害後體力判定。
 *
 * - 一般精靈：最低0，抵達0即死亡。
 * - 六刃：首次被打至非正值時固定為0；其後傷害全部忽略，仍然存活。
 * - 雷伊：首次跨過0即進入神降。非真傷本身免疫，改作-70%最大體力調整；
 *   真傷正常扣除。之後持續使用相同規則，最低為-70倍最大體力。
 */
export function resolveDamageTransition(
  currentHp: number,
  maxHp: number,
  incomingDamage: number,
  nature: DamageNature,
  rule: NonPositiveSurvivalRule = standardSurvivalRule(),
): DamageTransition {
  const amount = Math.max(0, Math.floor(incomingDamage));
  const crossingZero = currentHp > 0 && currentHp - amount <= 0;

  if (!rule.active || rule.mode === "none") {
    const hp = Math.max(0, currentHp - amount);
    return { hp, alive: hp > 0, enteredNonPositive: crossingZero, ignoredDamage: false, damageApplied: Math.max(0, currentHp - hp), hpAdjustment: hp - currentHp };
  }

  if (rule.mode === "freeze_at_zero") {
    if (currentHp <= 0 || crossingZero) {
      return { hp: 0, alive: true, enteredNonPositive: crossingZero, ignoredDamage: currentHp <= 0, damageApplied: Math.max(0, currentHp), hpAdjustment: -Math.max(0, currentHp) };
    }
    const hp = currentHp - amount;
    return { hp, alive: true, enteredNonPositive: false, ignoredDamage: false, damageApplied: amount, hpAdjustment: -amount };
  }

  const floor = Number.isFinite(rule.minHp) ? rule.minHp : -70 * Math.max(0, maxHp);
  if (nature === "non_true" && (currentHp <= 0 || crossingZero)) {
    // 原傷害不進入體力；從0（首次進入）或當前負體力另作-70%最大體力調整。
    const baseHp = crossingZero ? 0 : currentHp;
    const hp = Math.max(floor, baseHp - Math.floor(maxHp * 0.7));
    return { hp, alive: true, enteredNonPositive: crossingZero, ignoredDamage: true, damageApplied: crossingZero ? Math.max(0, currentHp) : 0, hpAdjustment: hp - currentHp };
  }

  const hp = Math.max(floor, currentHp - amount);
  return { hp, alive: true, enteredNonPositive: crossingZero, ignoredDamage: false, damageApplied: amount, hpAdjustment: hp - currentHp };
}

export interface RecoveryTransition {
  hp: number;
  exitedGodDescent: boolean;
  ignoredRecovery: boolean;
  hpAdjustment: number;
}

export interface HpAdjustmentTransition {
  hp: number;
  applied: number;
}

/**
 * 體力調整不是傷害也不是恢復：不吃增減療、不受體力上限限制。
 * 一般精靈最低為0；神降中的雷伊可調整至其負體力下限。
 */
export function resolveHpAdjustment(
  currentHp: number,
  amount: number,
  rule: NonPositiveSurvivalRule = standardSurvivalRule(),
): HpAdjustmentTransition {
  const requested = Math.floor(amount);
  const floor = rule.active && rule.mode === "god_descent" && Number.isFinite(rule.minHp) ? rule.minHp : 0;
  const hp = Math.max(floor, currentHp + requested);
  return { hp, applied: hp - currentHp };
}

/** 六刃照常恢復；雷伊神降中取消原恢復量，改作+70%最大體力調整。 */
export function resolveRecoveryTransition(
  currentHp: number,
  maxHp: number,
  requestedRecovery: number,
  rule: NonPositiveSurvivalRule = standardSurvivalRule(),
): RecoveryTransition {
  if (rule.active && rule.mode === "god_descent" && currentHp <= 0) {
    const hp = Math.min(maxHp, currentHp + Math.floor(maxHp * 0.7));
    return { hp, exitedGodDescent: hp > 0, ignoredRecovery: true, hpAdjustment: hp - currentHp };
  }
  const hp = Math.min(maxHp, currentHp + Math.max(0, Math.floor(requestedRecovery)));
  return { hp, exitedGodDescent: false, ignoredRecovery: false, hpAdjustment: hp - currentHp };
}

