import { resolveRecoveryTransition, type NonPositiveSurvivalRule } from './survivalRules';

/** 吸血、吸取與汲取的恢复請求均經同一限制；神降按原規則轉成體力調整。 */
export function isRecoveryBlocked(hp: number, rule: NonPositiveSurvivalRule | undefined, blocked: boolean): boolean {
  return blocked && !(rule?.active && rule.mode === 'god_descent' && hp <= 0);
}
export function resolveRecoveryEffect(hp: number, maxHp: number, amount: number, multiplier: number, blocked: boolean, rule?: NonPositiveSurvivalRule) {
  if (isRecoveryBlocked(hp, rule, blocked)) return { hp, hpAdjustment: 0, ignoredRecovery: false, exitedGodDescent: false };
  return resolveRecoveryTransition(hp, maxHp, Math.floor(amount * multiplier), rule);
}
