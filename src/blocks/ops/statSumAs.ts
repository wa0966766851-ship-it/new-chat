// 組1 擁有：能力值總和視為某項能力（5029 雷伊雷神「雙攻總和視為特攻」等句式共用；DSH 20261018 final-g1）。
// stat_sum_as{from:[atk,spatk],as:'spatk',side?:'self'|'opp'}：
//   把 as 項改為 from 各項「目前」能力值之和（含 as 自己若列於 from）。原始 as 值寫入
//   blkStatSumAs:<個體>:<as>（只在尚未快照時寫入，重複觸發不複利，總和一律以快照值為準重算），
//   由 stat_sum_as_restore 還原（下場／神降結束等）。僅改寫 as 這一項，from 其他項保持不變。
import type { BattleEventContext } from '../../effects/types';

type S = 'p1' | 'p2';
export const STAT_SUM_KEYS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const snapKey = (id: string, as: string) => `blkStatSumAs:${id}:${as}`;

export const STAT_SUM_AS_ACTION_FIELDS: Record<string, readonly string[]> = {
  stat_sum_as: ['from', 'as', 'side'],
  stat_sum_as_restore: ['as', 'side'],
};

export function statSumAsActionIssue(op: string, p: any): string | null {
  if (op !== 'stat_sum_as' && op !== 'stat_sum_as_restore') return null;
  if (p.side !== undefined && !['self', 'opp'].includes(p.side)) return '能力總和視為需明確 self 或 opp';
  if (!(STAT_SUM_KEYS as readonly string[]).includes(p.as)) return '能力總和視為需明確目標能力鍵';
  if (op === 'stat_sum_as_restore') return null;
  if (!Array.isArray(p.from) || p.from.length < 2 || p.from.length > STAT_SUM_KEYS.length
    || p.from.some((k: any) => !(STAT_SUM_KEYS as readonly string[]).includes(k)) || new Set(p.from).size !== p.from.length)
    return '能力總和視為需至少兩項不重複的能力鍵';
  if (!p.from.includes(p.as)) return '能力總和的來源清單需包含被視為的能力鍵';
  return null;
}

function holder(ctx: BattleEventContext, side: 'self' | 'opp' | undefined): { elf: any; sideId: S } | null {
  const c: any = ctx;
  if (side === 'opp') {
    const elf = c.target ?? (c.targetSide === 'p1' ? c.activeP1 : c.activeP2);
    return elf ? { elf, sideId: c.targetSide as S } : null;
  }
  const elf = c.self ?? c.effectEventData?.elf ?? c.effectEventData?.incomingElf ?? (c.actor === 'p1' ? c.activeP1 : c.activeP2);
  return elf ? { elf, sideId: c.actor as S } : null;
}

function writeStats(ctx: BattleEventContext, h: { elf: any; sideId: S }, stats: Record<string, number>) {
  const c: any = ctx;
  if (h.sideId === c.actor) c.updateElf(c.actor, { calculatedStats: stats });
  else c.updateAnyElf?.(h.sideId, idOf(h.elf), { calculatedStats: stats });
}

export function statSumAsOperations() {
  return {
    stat_sum_as: (ctx: BattleEventContext, p: any): boolean => {
      const h = holder(ctx, p.side);
      if (!h) return false;
      const key = snapKey(idOf(h.elf), p.as);
      const getS = (ctx as any).getPlayerState?.bind(ctx);
      const setS = (ctx as any).setPlayerState?.bind(ctx);
      const ownerState = (k: string) => (h.sideId === (ctx as any).actor ? getS(k) : (ctx as any).getOpponentState?.(k));
      const cur = { ...(h.elf.calculatedStats || {}) } as Record<string, number>;
      const snap = ownerState(key);
      const original = snap && Number.isFinite(snap.original) ? snap.original : Number(cur[p.as]) || 0;
      // 以「快照值」代入 as 重算，重複觸發不複利。
      const sum = (p.from as string[]).reduce((n, k) => n + (k === p.as ? original : Number(cur[k]) || 0), 0);
      if (!snap) {
        if (h.sideId === (ctx as any).actor) setS(key, { original });
        else (ctx as any).setOpponentState?.(key, { original });
      }
      if (cur[p.as] === sum) return false;
      cur[p.as] = sum;
      writeStats(ctx, h, cur);
      ctx.addLog?.(`🔀 【${h.elf.name}】：${(p.from as string[]).join('＋')} 總和 ${sum} 視為${p.as}。`, 'effect');
      return true;
    },
    stat_sum_as_restore: (ctx: BattleEventContext, p: any): boolean => {
      const h = holder(ctx, p.side);
      if (!h) return false;
      const key = snapKey(idOf(h.elf), p.as);
      const own = h.sideId === (ctx as any).actor;
      const snap = own ? (ctx as any).getPlayerState?.(key) : (ctx as any).getOpponentState?.(key);
      if (!snap) return false;
      const cur = { ...(h.elf.calculatedStats || {}) } as Record<string, number>;
      cur[p.as] = snap.original;
      writeStats(ctx, h, cur);
      if (own) (ctx as any).setPlayerState(key, null); else (ctx as any).setOpponentState?.(key, null);
      return true;
    },
  };
}
