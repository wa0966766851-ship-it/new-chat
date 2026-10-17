import { markAppliesToElf, type Mark } from './marks';

/** 持有者自帶的恢復限制；期限由印記統一管理，藥劑範圍明確宣告。 */
export interface MarkRecoveryReduction {
  ratio: number;
  perStack: boolean;
  includePotions: boolean;
}

export function markRecoveryReductionIssue(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '印記恢復限制需為參數物件';
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['ratio', 'perStack', 'includePotions'].includes(k))) return '印記恢復限制包含未接通欄位';
  if (typeof p.ratio !== 'number' || !Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 1) return '印記恢復減少比例需大於0、不超過100%';
  if (typeof p.perStack !== 'boolean' || typeof p.includePotions !== 'boolean') return '印記恢復限制需明確層數與藥劑規則';
  return null;
}

/** 累加減少比例，保留旧 blkHealReduce 的效果及藥劑豁免；不同持有者不互相影響。 */
export function markRecoveryReduction(marks: readonly Mark[], elf: { battleId?: string; id?: string }, isPotion = false): number {
  let reduction = 0;
  for (const mark of marks) {
    if (!markAppliesToElf(mark, elf)) continue;
    const p = mark.effects?.recoveryReduction;
    if (p !== undefined) {
      // 已宣告新格式但資料損壞時，不另套用不相符的舊限制。
      if (!markRecoveryReductionIssue(p) && (!isPotion || p.includePotions)) reduction += p.ratio * (p.perStack ? mark.count : 1);
    } else if (!isPotion) {
      const legacy = Number(mark.effects?.blkHealReduce) || 0;
      reduction += Math.max(0, legacy) * (mark.effects?.blkHealPerStack ? mark.count : 1);
    }
  }
  return reduction;
}
