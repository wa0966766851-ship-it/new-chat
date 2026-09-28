/**
 * 守護印記專屬層數規則（最終規格 A2-4）
 * 原則：不刪舊 handler（BattleScreen nextElfGuardianMark / imperialShieldRegistry 快照）；
 * 此處只定義新規則，供積木 custom / 未來 registry 调用。
 * 規則：
 *  - 基礎減傷 25%
 *  - 每層 +10%
 *  - 最高 55%（25% + 10% × 3），所以最多 3 層
 *  - 每次獲得 +1 層，持續 4 回合（與舊逻辑一致）
 */
export const GUARDIAN_BASE_REDUCTION = 0.25;
export const GUARDIAN_PER_STACK = 0.1;
export const GUARDIAN_MAX_REDUCTION = 0.55;
// 舊 handler（BattleScreen nextElfGuardianMark）以 min(4, +1) 累加，
// reduction = 0.25 + (stacks-1)*0.10，故 4 層封頂 55%。
// 最終規格寫「最多 3 層」與算式 25%+10%×3=55% 差一層，
// 此處以舊行為為準取 4 層，疑慮保留在 docs/疑慮清單.md。
export const GUARDIAN_MAX_STACKS = 4;
export const GUARDIAN_DURATION = 4;

export function guardianReduction(stacks: number): number {
  const s = Math.max(0, Math.min(GUARDIAN_MAX_STACKS, Math.floor(stacks)));
  if (s <= 0) return 0;
  // 第 1 層 25%，之後每層 +10%，封頂 55%
  return Math.min(GUARDIAN_MAX_REDUCTION, GUARDIAN_BASE_REDUCTION + (s - 1) * GUARDIAN_PER_STACK);
}

export function nextGuardianStacks(current: number): number {
  return Math.min(GUARDIAN_MAX_STACKS, Math.max(0, Math.floor(current || 0)) + 1);
}

export function describeGuardian(stacks: number): string {
  const r = guardianReduction(stacks);
  return `守護印記 ${Math.min(GUARDIAN_MAX_STACKS, Math.max(0, Math.floor(stacks)))} 層：受攻擊傷害減少 ${Math.round(r * 100)}%（${GUARDIAN_DURATION}回合）`;
}
