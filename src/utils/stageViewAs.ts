/**
 * 2026-10-31：能力等級「視為」投影（純函式，不改任何真實 statStages）。
 *
 * 官方無極聖武魂印：
 *   ② 將對手的能力提升視為同級能力下降。
 *   ③ 將自身的能力下降視為對手的同級能力下降。
 *
 * 這兩條是「視為」，只影響讀取等級的計算，不真的改等級。
 * 但舊實作只在 damageCalculator 內對 atk/def 生效，
 * 導致速度（出手順序）、命中、以及其他屬性完全不受影響。
 *
 * 這裡集中成一個投影函式，讓所有讀等級的地方都能套用同一套規則。
 */
export interface StageViewFlags {
  /** ② 對手的能力提升視為同級下降 */
  oppBoostAsDrop?: boolean;
  /** ③ 自身的能力下降視為對手的同級下降 */
  selfDropAsOppDrop?: boolean;
}

/**
 * 把視為規則套用到「攻擊方等級」與「防守方等級」。
 * 回傳新值，不修改傳入物件。
 */
export function applyStageViewAs(
  atkS: number,
  defS: number,
  flags: StageViewFlags,
): { atkS: number; defS: number } {
  let a = Number(atkS) || 0;
  let d = Number(defS) || 0;
  // ② 對手（防守方）的正等級視為同級下降
  if (flags.oppBoostAsDrop && d > 0) d = -d;
  // ③ 自身（攻擊方）的負等級視為對手的同級下降
  if (flags.selfDropAsOppDrop && a < 0) { d = Math.max(-6, d + a); a = 0; }
  return { atkS: a, defS: d };
}

/**
 * 單一屬性版本的「視為」投影（供速度、命中、或其他非傷害屬性使用）。
 * 回傳「該屬性」在視為規則下的等級。
 */
export function applyStageViewAsSingle(
  stage: number,
  side: "self" | "opp",
  flags: StageViewFlags,
): number {
  const s = Number(stage) || 0;
  if (side === "self" && flags.selfDropAsOppDrop && s < 0) return 0;
  if (side === "opp" && flags.oppBoostAsDrop && s > 0) return -s;
  return s;
}
