import type { Elf } from '../../types';
import { getStatuses } from '../../utils/battleHelpers';
import { resolveRecoveryTransition } from '../survivalRules';

/** 決策沿用實際存活下限，不把可存活的負體力當成瀕死。 */
export function survivalMargin(elf: Elf): number {
  const rule = elf.survivalRule;
  if (rule?.active && elf.currentHp <= 0) {
    if (rule.mode === 'freeze_at_zero') return 1;
    if (rule.mode === 'god_descent') return Math.max(0, Math.min(1, (elf.currentHp - rule.minHp) / Math.max(1, -rule.minHp)));
  }
  return Math.max(0, Math.min(1, elf.currentHp / Math.max(1, elf.maxHp)));
}
export function abnormalSideEffectsSuppressed(elf: Elf): boolean {
  const statuses = getStatuses(elf);
  return !!elf.suppressAbnormalSideEffectsWhenParalyzed && Math.max(statuses['麻痺'] || 0, statuses['麻痹'] || 0, statuses.paralyzed || 0) > 0;
}
/** 回復型道具的有效體力差；神降按正式恢復轉換，而非藥瓶標示量。 */
export function itemRecoveryGain(elf: Elf, amount: number): number {
  // 藥劑依正式 isPotion 規則不受減療；神降仍轉為體力調整。
  const transition = resolveRecoveryTransition(elf.currentHp, elf.maxHp, amount, elf.survivalRule);
  return Math.max(0, transition.hp - elf.currentHp);
}
