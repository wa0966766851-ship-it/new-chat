// 戰鬥藥劑通用 op（legacyWrapped 拆解；DSH 20261017）。
// 「偷取對手藥劑並立即使用」：消耗對手庫存中指定藥劑，效果歸自身；
// 未配置正式庫存時不可憑空偷取（與 ctx.useBattleItem 的防護一致）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

/** 契約欄位（登記於 sequenceContract.SEQUENCE_ACTION_FIELDS）。 */
export const ITEM_USE_ACTION_FIELDS: Record<string, readonly string[]> = {
  use_stolen_item: ['itemId'],
};

/** 契約補充檢查；回傳 null 代表通過。 */
export function itemUseActionIssue(op: string, p: any): string | null {
  if (op !== 'use_stolen_item') return null;
  if (typeof p.itemId !== 'string' || !p.itemId || p.itemId.length > 100) return '偷取藥劑需明確物品識別碼';
  return null;
}

/** 執行端（併入 runtime 的 OPS）。 */
export function itemUseOperations() {
  return {
    use_stolen_item: (ctx: BattleEventContext, p: any, _st: RunState): boolean => {
      if (typeof ctx.useBattleItem !== 'function') return false;
      // 偷取＝庫存在對手、受益者為自身；與舊專屬程式 useBattleItem(targetSide, itemId, actor) 同一管道。
      const ok = ctx.useBattleItem(ctx.targetSide, p.itemId, ctx.actor);
      if (!ok) ctx.addLog?.('藥劑已用盡或目前無法偷取。', 'effect');
      return ok === true;
    },
  };
}
