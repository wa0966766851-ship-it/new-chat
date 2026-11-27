/**
 * 通用積木（2026-11-16，聖靈奧斯卡實裝時補齊；不含精靈名稱）：
 * - stat_random{side,count,v,mirror?}：隨機 count 種能力（攻防特攻特防速度命中）各 ±v；mirror:'opp' 時對手附加等量反向變化。
 * - status_hand_over{statuses}：在場精靈身上列出的異常，依剩餘回合數附加給對方在場精靈（被免疫照常判定）；有任一項即成功。
 * - round_opp_restrict{priority?,stabDisabled?,typeAdvantageDisabled?,addInvalid?}：對手「當回合」限制，回合結束到期。
 *   priority＝先制等級調整為定值；stabDisabled＝失去本系加成；typeAdvantageDisabled＝克制倍數最高 1；addInvalid＝技能附加效果失效。
 * - drain_mult_turns{mult,turns,next?}：期間自身每次吸取效果×mult（讀取端 battle/hpDrain.drainMultiplierOf）。
 * 條件 opp_selected{kind,advantage?}：對手當回合選擇（none＝未選擇技能，技能／攻擊／屬性）；advantage：true＝該技能對自身克制倍數高於 1，false＝不高於 1。
 */
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { getTypeMatchup } from '../../utils/statCalculator';

type AddBlockTimer = (...args: any[]) => any;
const STATS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
const KIND = ['none', '技能', '攻擊', '屬性'];

export const SELECTION_RULE_ACTION_FIELDS = {
  stat_random: ['side', 'count', 'v', 'mirror'],
  status_hand_over: ['statuses', 'allStatuses'],
  round_opp_restrict: ['priority', 'stabDisabled', 'typeAdvantageDisabled', 'addInvalid'],
  drain_mult_turns: ['mult', 'turns', 'next'],
} as const;
export const SELECTION_RULE_CONDITION_FIELDS = { opp_selected: ['kind', 'advantage'] } as const;

export function selectionRuleActionIssue(op: string, p: any): string | null {
  if (!(op in SELECTION_RULE_ACTION_FIELDS)) return null;
  if (op === 'stat_random') {
    if (!['self', 'opp'].includes(p?.side)) return '隨機能力變化需指定自身或對手';
    if (!(Number.isInteger(p.count) && p.count >= 1 && p.count <= 6)) return '隨機能力種類需 1–6';
    if (!(Number.isInteger(p.v) && p.v !== 0 && Math.abs(p.v) <= 6)) return '能力等級變化需 ±1–6';
    if (p.mirror !== undefined && p.mirror !== 'opp') return '等量反向變化只能給對手';
  }
  if(op==='status_hand_over'&&p.allStatuses!==undefined&&typeof p.allStatuses!=='boolean')return '所有異常需布林值';
  if (op === 'status_hand_over' && p?.allStatuses!==true && !(Array.isArray(p?.statuses) && p.statuses.length && p.statuses.every((s: any) => typeof s === 'string' && s))) return '需列出要轉移的異常';
  if (op === 'round_opp_restrict') {
    if (p.priority !== undefined && !(Number.isInteger(p.priority) && Math.abs(p.priority) <= 10)) return '先制定值需 -10～10 的整數';
    if (p.addInvalid !== undefined && !['all', '攻擊', '屬性'].includes(p.addInvalid)) return '附加效果失效範圍不明';
    if (p.priority === undefined && !p.stabDisabled && !p.typeAdvantageDisabled && !p.addInvalid) return '當回合限制至少需一項';
  }
  if (op === 'drain_mult_turns') {
    if (!(Number.isFinite(p?.mult) && p.mult > 1 && p.mult <= 10)) return '吸取倍率需大於 1、至多 10';
    if (!(Number.isInteger(p.turns) && p.turns >= 1 && p.turns <= 99)) return '回合數需為 1–99 的整數';
  }
  return null;
}
export function selectionRuleConditionIssue(c: string, p: any): string | null {
  if (c !== 'opp_selected') return null;
  if (!KIND.includes(p?.kind)) return '對手選擇類型需為 none／技能／攻擊／屬性';
  if (p.advantage !== undefined && typeof p.advantage !== 'boolean') return '克制判定需為是／否';
  return null;
}

/** 對手當回合選擇的技能（引擎 ctx.opponentSkill；切換／道具／未選為 null）。 */
const selectedOf = (ctx: BattleEventContext): any => {
  const sk: any = (ctx as any).opponentSkill;
  return sk && typeof sk === 'object' && sk.name ? sk : null;
};
export function evalSelectionRuleCondition(ctx: BattleEventContext, c: { c: string; p?: any }): boolean | undefined {
  if (c.c !== 'opp_selected') return undefined;
  const p = c.p || {}, sk = selectedOf(ctx);
  if (p.kind === 'none') return !sk;
  if (!sk) return false;
  if (p.kind === '攻擊' && sk.category === '屬性') return false;
  if (p.kind === '屬性' && sk.category !== '屬性') return false;
  if (p.advantage !== undefined) {
    const self: any = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
    if ((getTypeMatchup(String(sk.type || ''), String(self?.type || '')) > 1) !== p.advantage) return false;
  }
  return true;
}

const live = (ctx: BattleEventContext, side: 'p1' | 'p2'): any => (side === 'p1' ? ctx.activeP1 : ctx.activeP2) || (side === ctx.actor ? ctx.self : ctx.target);

export function selectionRuleOperations(addBlockTimer: AddBlockTimer) {
  return {
    stat_random: (ctx: BattleEventContext, p: any): boolean => {
      if (selectionRuleActionIssue('stat_random', p)) return false;
      const side = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      const picks = (ctx.shuffleArray ? ctx.shuffleArray([...STATS]) : [...STATS]).slice(0, p.count);
      const changes = Object.fromEntries(picks.map((k: string) => [k, p.v]));
      const ok = ctx.applyStatChange(side, changes)?.success === true;
      if (p.mirror === 'opp') ctx.applyStatChange(side === ctx.actor ? ctx.targetSide : ctx.actor, Object.fromEntries(picks.map((k: string) => [k, -p.v])));
      return ok;
    },
    status_hand_over: (ctx: BattleEventContext, p: any): boolean => {
      if (selectionRuleActionIssue('status_hand_over', p)) return false;
      const own = live(ctx, ctx.actor), statuses: Record<string, number> = ctx.getStatuses(own) || {};
      const present = (p.allStatuses===true?Object.keys(statuses):p.statuses as string[]).filter(s => Number(statuses[s]) > 0);
      for (const s of present) ctx.applyStatusWithImmunityCheck(ctx.targetSide, s, Math.max(1, Number(statuses[s]) || 1));
      return present.length > 0;
    },
    round_opp_restrict: (ctx: BattleEventContext, p: any): boolean => {
      if (selectionRuleActionIssue('round_opp_restrict', p)) return false;
      const payload: Record<string, any> = {
        ...(p.priority !== undefined ? { priorityFixed: p.priority } : {}),
        ...(p.stabDisabled ? { stabDisabled: true } : {}),
        ...(p.typeAdvantageDisabled ? { typeAdvantageDisabled: true } : {}),
        ...(p.addInvalid ? { addInvalid: p.addInvalid } : {}),
      };
      // 當回合：回合結束到期；不因後出手補回合。
      addBlockTimer(ctx, ctx.targetSide, '當回合限制', 1, 'turns', payload, false, 'round_counter', true);
      return true;
    },
    drain_mult_turns: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (selectionRuleActionIssue('drain_mult_turns', p)) return false;
      addBlockTimer(ctx, ctx.actor, '吸取效果翻倍', p.turns, 'turns', { drainMult: p.mult }, !!p.next, st.sourceKind === 'skill' ? 'turn_effect' : 'round_counter');
      return true;
    },
  };
}

/** 讀取端：該側目前的當回合限制（先制定值、失去本系、克制最高 1）。 */
export function roundRestrictionOf(timers: any[] | undefined): { priority?: number; stabDisabled: boolean; typeAdvantageDisabled: boolean } {
  const live = (timers || []).filter(t => t.payload?.block && !t.pendingActivation && (t.remaining ?? 0) > 0).map(t => t.payload.block);
  const fixed = live.find(b => Number.isFinite(b.priorityFixed));
  return { ...(fixed ? { priority: fixed.priorityFixed } : {}), stabDisabled: live.some(b => b.stabDisabled), typeAdvantageDisabled: live.some(b => b.typeAdvantageDisabled) };
}
