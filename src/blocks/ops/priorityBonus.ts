// 先制即時修正（DSH 20261018 第十一批·第一波；5015 魂印「夜」狂暴先制+1 的通用積木化）。
// prio_bonus{v}：先制判定事中查詢——在 modify_priority 節點把本次先制加總 v（可為負）。
// 與 prio_turns／prio_next（先制計時器／次數）不同：這是「條件事中查詢」，每次先制計算重新判定，
// 不建立計時器、不消耗次數；觸發條件（如 has_status 狂暴）由 Kit 子句條件表達，非零整數由合約把關。
// 讀取端：battleEngine.calcPriority 的 MODIFY_PRIORITY 派發（priorityComp 併入 clause ctx），
// 與 pp_priority 同一模式；引擎在派發後才結算 base+bonus，因此事中修正即時生效。
import type { BattleEventContext } from '../../effects/types';

export const PRIORITY_BONUS_ACTION_FIELDS = { prio_bonus: ['v'] } as const;

export function priorityBonusActionIssue(op: string, p: any, trig?: string): string | null {
  if (!(op in PRIORITY_BONUS_ACTION_FIELDS)) return null;
  if (trig !== 'modify_priority') return '先制即時修正需在先制判定節點執行';
  if (!Number.isInteger(p?.v) || p.v === 0 || Math.abs(p.v) > 6) return '先制即時修正需為非零-6至6整數';
  return null;
}

export function priorityBonusOperations() {
  return {
    prio_bonus: (ctx: BattleEventContext, p: { v: number }): boolean => {
      const comp = (ctx as any).priorityComp || (ctx as any).effectEventData?.priorityComp;
      if (!comp || typeof comp.bonus !== 'number') return false;
      comp.bonus += p.v;
      return true;
    },
  };
}
