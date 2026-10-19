// 組 5（龍魂雜項）通用件聚合：5010 海／5000 神／5009 獅／5021 龍／5026／5027／arena_14（DSH 20261018 最後衝刺）。
// 共用檔只註冊本檔一個聚合（runtime.ts 一行 spread、sequenceContract.ts 一行 import／spread／hook）。
// level_gate{level,body}：持有者目前等級恰為 level 才執行 body（「若自身的等級為100」類條件；
//   沒有等級條件查詢時以子流程表達，body 內 once／survive 等語意不變）。
//   選填 onceKey：等級符合時才消耗的「每場限1次」（語意同 once{key}；等級不符不消耗）——用來避免 level_gate＋once 兩層巢狀
//   把魂印資料推過匯入圖紙的深度上限（25層）。
// during_opp_action{body}：致命等事件發生在「對手出手回合」（引擎 currentActiveActor 非持有者）才執行 body。
// round_checkpoint_snapshot／arm／restore（5000 輪迴；本組自行實作，不共用任何 entry_state 函式）：
//   snapshot：回合開始時記錄持有者體力、能力等級、各技能 PP（對應「當回合選擇操作之後的狀態」）；
//   arm：把本回合快照標記為待還原（僅同一精靈、同一回合有效）；
//   restore：回合結束時若已 arm 且仍是同一精靈，將體力／能力等級／PP 還原為快照並解除 arm。
// prio_force_first{}：modify_priority 節點把本次出手順序設為必定先手（comp.forcedFirst）。
// pp_add_random{count,amount}：自身 PP 未滿的技能中隨機（無放回）count 個各恢復 amount 點 PP。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { applyKitPpOperation } from '../../effects/ppOperations';

export const GROUP5_ACTION_FIELDS: Record<string, readonly string[]> = {
  level_gate: ['level', 'body', 'onceKey'],
  during_opp_action: ['body'],
  round_checkpoint_snapshot: [], round_checkpoint_arm: [], round_checkpoint_restore: [],
  prio_force_first: [],
  pp_add_random: ['count', 'amount'],
};

export function group5ActionIssue(op: string, p: any, nested?: (body: any[], trig: string) => string | null, trig?: string): string | null {
  if (op === 'level_gate') {
    if (!Number.isInteger(p.level) || p.level < 1 || p.level > 200) return '等級條件需1至200整數';
    if (!Array.isArray(p.body) || !p.body.length) return '等級條件需非空主體';
    if (p.onceKey !== undefined && (typeof p.onceKey !== 'string' || !p.onceKey || p.onceKey.length > 200)) return '等級條件的次數鍵需為非空字串';
    if (nested) { const issue = nested(p.body, trig || 'use'); if (issue) return '等級條件主體：' + issue; }
    return null;
  }
  if (op === 'during_opp_action') {
    if (!Array.isArray(p.body) || !p.body.length) return '對手出手回合條件需非空主體';
    if (nested) { const issue = nested(p.body, trig || 'use'); if (issue) return '對手出手回合條件主體：' + issue; }
    return null;
  }
  if (op === 'round_checkpoint_arm' && trig !== 'fatal') return '輪迴待還原標記需在致命抵擋節點執行';
  if (op === 'round_checkpoint_snapshot' && trig !== 'round_start') return '輪迴快照需在回合開始節點執行';
  if (op === 'round_checkpoint_restore' && trig !== 'round_end') return '輪迴還原需在回合結束節點執行';
  if (op === 'prio_force_first' && trig !== 'modify_priority') return '必定先手需在先制判定節點執行';
  if (op === 'pp_add_random') {
    if (!Number.isInteger(p.count) || p.count < 1 || p.count > 10) return '隨機恢復PP需1至10個技能';
    if (!Number.isInteger(p.amount) || p.amount < 1 || p.amount > 100) return '隨機恢復PP需1至100點';
    return null;
  }
  return null;
}

const idOf = (e: any) => String(e?.battleId || e?.id || '');
const CP_KEY = 'blkRoundCheckpoint';

export function group5Operations(h: { runStmts: (ctx: BattleEventContext, body: any[], st: RunState) => void; liveElf: (ctx: BattleEventContext, side: 'p1' | 'p2') => any }) {
  return {
    level_gate: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const level = Number((h.liveElf(ctx, ctx.actor) || ctx.self)?.level);
      if (level !== p.level) return false;
      if (p.onceKey) {
        const key = `blockOnce:${(ctx as any).illusionEffectKey || ''}:${p.onceKey}`;
        if (ctx.getPlayerState(key)) return false;
        ctx.setPlayerState(key, true);
      }
      h.runStmts(ctx, p.body, st);
      return st.last === true || !!st.survived;
    },
    during_opp_action: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const active = ctx.getPlayerState('currentActiveActor');
      if (!active || active === ctx.actor) return false;
      h.runStmts(ctx, p.body, st);
      return st.last === true || !!st.survived;
    },
    round_checkpoint_snapshot: (ctx: BattleEventContext): boolean => {
      const self: any = h.liveElf(ctx, ctx.actor) || ctx.self;
      if (!self) return false;
      ctx.setPlayerState(CP_KEY, {
        id: idOf(self), round: ctx.roundNumber ?? 0, armed: false,
        hp: self.currentHp, statStages: { ...(self.statStages || {}) },
        pp: (self.skills || []).map((s: any) => ({ name: s.name, pp: s.pp })),
      });
      return true;
    },
    round_checkpoint_arm: (ctx: BattleEventContext): boolean => {
      const cp: any = ctx.getPlayerState(CP_KEY);
      const self: any = h.liveElf(ctx, ctx.actor) || ctx.self;
      if (!cp || cp.id !== idOf(self)) return false;
      ctx.setPlayerState(CP_KEY, { ...cp, armed: true });
      return true;
    },
    round_checkpoint_restore: (ctx: BattleEventContext): boolean => {
      const cp: any = ctx.getPlayerState(CP_KEY);
      const self: any = h.liveElf(ctx, ctx.actor) || ctx.self;
      if (!cp?.armed) return false;
      ctx.setPlayerState(CP_KEY, { ...cp, armed: false });
      if (cp.id !== idOf(self) || !(self.currentHp > 0)) return false;
      const skills = (self.skills || []).map((s: any, i: number) => (cp.pp[i] && cp.pp[i].name === s.name ? { ...s, pp: cp.pp[i].pp } : s));
      ctx.updateElf(ctx.actor, { currentHp: cp.hp, statStages: { ...cp.statStages }, skills } as any);
      ctx.addLog('✨ 時空倒流！體力、PP值與能力等級返回當回合選擇操作後的狀態！', 'effect');
      return true;
    },
    prio_force_first: (ctx: BattleEventContext): boolean => {
      const comp = (ctx as any).priorityComp || (ctx as any).effectEventData?.priorityComp;
      if (!comp) return false;
      comp.forcedFirst = true;
      return true;
    },
    pp_add_random: (ctx: BattleEventContext, p: any): boolean => {
      const self: any = h.liveElf(ctx, ctx.actor) || ctx.self;
      const pool = [...(self?.skills || [])].filter((s: any) => s.pp !== undefined && s.pp < (s.maxPp ?? 5));
      const r = (ctx as any).rng || Math.random, selected = new Set<any>();
      for (let n = Math.min(p.count, pool.length); n > 0; n--) selected.add(pool.splice(Math.min(pool.length - 1, Math.floor(r() * pool.length)), 1)[0]);
      if (!selected.size) return false;
      return applyKitPpOperation(ctx, ctx.actor, 'add', p.amount, (s: any) => selected.has(s));
    },
  };
}
