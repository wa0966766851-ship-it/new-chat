import type { BattleEventContext } from '../../effects/types';

/** A 組新增的通用條件欄位（登記於 sequenceContract.SEQUENCE_CONDITION_FIELDS）。 */
export const GROUP_A_CONDITION_FIELDS: Record<string, readonly string[]> = {
  // 玩家戰鬥狀態鍵比對（通用讀取；不含任何精靈專屬邏輯）。未設定的鍵以 p.fallback 代入。
  player_state: ['key', 'equals', 'fallback', 'neg','thisRound'],
};

/** 純條件求值：無法辨識回傳 undefined，交還 runtime 的預設分支。 */
export function groupAEvalCond(ctx: BattleEventContext, c: { c: string; p?: any }): boolean | undefined {
  const p = c.p || {};
  if (c.c === 'player_state') {
    if(p.thisRound&&ctx.getPlayerState(p.key+':round')!==ctx.roundNumber)return false;
    const raw = (ctx as any).getPlayerState?.(p.key);
    const value = raw === undefined || raw === null ? p.fallback : raw;
    const result = value === p.equals;
    return p.neg ? !result : result;
  }
  return undefined;
}

export function groupAConditionIssue(c: Record<string, any>): string | undefined {
  if (c.c !== 'player_state') return undefined;
  const p = c.p || {};
  if (typeof p.key !== 'string' || !p.key) return '玩家狀態條件需指定鍵';
  if (!['string', 'number', 'boolean'].includes(typeof p.equals)) return '玩家狀態條件需指定比對值';
  return undefined;
}
