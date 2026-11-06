export type DamageNature = "true" | "non_true";
export type NonPositiveSurvivalMode = "none" | "freeze_at_zero" | "god_descent";

export interface NonPositiveSurvivalRule {
  mode: NonPositiveSurvivalMode;
  active: boolean;
  /** 換到場下後規則是否仍保留。永久規則不應使用一般回合倒數。 */
  preserveOffField: boolean;
  /**
   * 2026-11-02：下限倍率（神降＝70，意即下限 = -70 × 當前最大體力）。
   * 這是公式參數，不是算好的數字——體力上限會隨效果變動（臨時上限、異能、
   * 幻化、技能加成），下限必須跟著重算，不能在設定當下就固定住。
   */
  floorMult?: number;
  /**
   * 舊欄位：設定當下算好的下限快照。
   * 只在 floorMult 未提供時作為退路（相容既有存檔／測試）。
   */
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

/**
 * 2026-11-02：非正體力存活判定。
 *
 * 原本只看「規則是否啟用」，完全不看 currentHp 是否已到下限，
 * 導致神降的雷伊停在 -70×最大體力 卻永遠不死（戰鬥卡在 p1_select）。
 *
 * 依使用者裁定（方案 A）：體力下限是「死亡線」——
 *   hp > minHp → 存活；hp ≤ minHp → 死亡。
 * 其他模式（六刃 freeze_at_zero 等）minHp 為 0，行為不變。
 */
/**
 * 2026-11-02：神降下限一律由公式即時算出。
 *   floorMult 有值 → 下限 = -floorMult × 當前最大體力
 *   否則退回舊的 minHp 快照
 * 這樣體力上限變動（臨時上限／異能／幻化／技能加成）時下限會自動跟上。
 */
export function godDescentFloor(rule: NonPositiveSurvivalRule | undefined, maxHp: number): number {
  if (!rule?.active || rule.mode !== 'god_descent') return 0;
  if (Number.isFinite(rule.floorMult) && (rule.floorMult as number) > 0) {
    return -(rule.floorMult as number) * Math.max(0, maxHp);
  }
  return Number.isFinite(rule.minHp) ? rule.minHp : 0;
}

export function isAliveBySurvivalRule(currentHp: number, rule?: NonPositiveSurvivalRule, maxHp = 0): boolean {
  if (currentHp > 0) return true;
  // 2026-11-02 修正：神降的語意是「體力下限往負方向移」，不是「到達下限就死亡」。
  // 原本只看 rule.active 是對的——只要規則還在，非正體力就是存活。
  // 真正的死亡由 resolveDamageTransition 依 floor 夾住後另行判定。
  return !!rule?.active && rule.mode !== "none";
}

/**
 * 統一傷害後體力判定。
 *
 * - 一般精靈：最低0，抵達0即死亡。
 * - 六刃：體力最低0；其後仍受到傷害，但傷害不再改變體力，仍然存活。
 * - 雷伊：首次跨過0即進入神降。非真傷本身免疫，改作-70%最大體力調整；
 *   真傷正常扣除。之後持續使用相同規則，最低為-70倍最大體力。
 */
export function resolveDamageTransition(
  currentHp: number,
  maxHp: number,
  incomingDamage: number,
  nature: DamageNature,
  rule: NonPositiveSurvivalRule = standardSurvivalRule(),
  options: { ignoreNonTrueImmunity?: boolean } = {},
): DamageTransition {
  const amount = Math.max(0, Math.floor(incomingDamage));
  const crossingZero = currentHp > 0 && currentHp - amount <= 0;

  if (!rule.active || rule.mode === "none") {
    const hp = Math.max(0, currentHp - amount);
    return { hp, alive: hp > 0, enteredNonPositive: crossingZero, ignoredDamage: false, damageApplied: Math.max(0, currentHp - hp), hpAdjustment: hp - currentHp };
  }

  if (rule.mode === "freeze_at_zero") {
    // 2026-11-05 使用者確認：不免疫傷害，只凍結體力下限為0。
    // damageApplied 沿用「實際體力扣除量」；原傷害由既有 receipt／跳字流程保存。
    // 亦修復舊錯誤版本已留下的負體力，不讓後續傷害繼續保持負數。
    const hp = Math.max(0, currentHp - amount);
    return { hp, alive: true, enteredNonPositive: crossingZero, ignoredDamage: false,
      damageApplied: Math.max(0, currentHp - hp), hpAdjustment: hp - currentHp };
  }

  const floor = godDescentFloor(rule, maxHp);
  if (nature === "non_true" && !options.ignoreNonTrueImmunity && (currentHp <= 0 || crossingZero)) {
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
  maxHp: number,
  currentHp: number,
  amount: number,
  rule: NonPositiveSurvivalRule = standardSurvivalRule(),
): HpAdjustmentTransition {
  const requested = Math.floor(amount);
  const floor = godDescentFloor(rule, maxHp);
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
  // 恢復不會讓體力下降（體力已高於上限時維持原值）
  const hp = Math.max(currentHp, Math.min(maxHp, currentHp + Math.max(0, Math.floor(requestedRecovery))));
  return { hp, exitedGodDescent: false, ignoredRecovery: false, hpAdjustment: hp - currentHp };
}

