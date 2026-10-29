// 能力值威力／能力互比通用件（legacyWrapped 拆解；DSH 20261017）。
// power_add_stat：技能威力提升「指定能力值總和的X%」（雙攻總和威力句式，5009 辟冥·鎮獄斷）。
// stat_cmp：同一方的兩項能力互比（特攻不小於攻擊等句式）。
import type { BattleEventContext } from '../../effects/types';
import { queueActionPowerAdd } from '../../battle/actionDamageModifiers';

export const STAT_KEYS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy', 'hp'] as const;
const COMPARE = ['低於', '小於', '高於', '大於', '不小於', '不低於', '不大於', '不高於'];

/** 契約欄位（登記於 sequenceContract）。 */
export const POWER_STAT_ACTION_FIELDS: Record<string, readonly string[]> = {
  power_add_stat: ['stats', 'ratio'],
};
export const POWER_STAT_CONDITION_FIELDS: Record<string, readonly string[]> = {
  stat_cmp: ['side', 'statA', 'statB', 'op'],
};

const statOf = (elf: any, key: string) => Number((elf?.calculatedStats || {})[key]) || 0;

/** 契約補充檢查；回傳 null 代表通過。 */
export function powerStatActionIssue(op: string, p: any): string | null {
  if (op !== 'power_add_stat') return null;
  if (!Array.isArray(p.stats) || !p.stats.length || p.stats.length > STAT_KEYS.length
    || p.stats.some((s: any) => !(STAT_KEYS as readonly string[]).includes(s)) || new Set(p.stats).size !== p.stats.length)
    return '能力威力加值需明確能力鍵清單';
  if (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 1) return '能力威力加值需不大於100%的正比例';
  return null;
}
export function powerStatConditionIssue(c: Record<string, any>): string | undefined {
  if (c?.c !== 'stat_cmp') return undefined;
  const p = c.p || {};
  if (!['self', 'opp'].includes(p.side)) return '能力互比需明確持有者';
  if (!(STAT_KEYS as readonly string[]).includes(p.statA) || !(STAT_KEYS as readonly string[]).includes(p.statB)) return '能力互比需明確能力鍵';
  if (!COMPARE.includes(p.op)) return '能力互比需明確比較運算';
  return undefined;
}

/** 條件求值；無法辨識回傳 undefined 交還 runtime 預設分支。 */
export function powerStatEvalCond(ctx: BattleEventContext, c: Record<string, any>): boolean | undefined {
  if (c?.c !== 'stat_cmp') return undefined;
  const p = c.p || {};
  const elf = p.side === 'self' ? (ctx as any).self : (ctx as any).target;
  const a = statOf(elf, p.statA), b = statOf(elf, p.statB);
  switch (p.op) {
    case '低於': case '小於': return a < b;
    case '高於': case '大於': return a > b;
    case '不小於': case '不低於': return a >= b;
    case '不大於': case '不高於': return a <= b;
  }
  return undefined;
}

/** 執行端（併入 runtime 的 OPS）：威力加值＝所列能力總和×比例，走正式威力加值管線。 */
export function powerStatOperations() {
  return {
    power_add_stat: (ctx: BattleEventContext, p: any): boolean => {
      const sum = (p.stats as readonly string[]).reduce((n, k) => n + statOf((ctx as any).self, k), 0);
      const add = Math.floor(sum * p.ratio);
      if (!(add > 0)) return false;
      queueActionPowerAdd(ctx, add);
      return true;
    },
  };
}
