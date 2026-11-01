// 5041 岳峙淵渟.卡修斯 專用 op（DSH 2026-10-31）。
// 只收本精靈需要、且既有積木無法表達的效果；能複用既有 op（timed／drain／damage_multiplier_turns／
// convert_damage_to_heal_next／next_ally_entry／add_invalid_turns／no_switch…）的一律複用。
// 通用讀取端：battle/teamPassiveRules.ts（護盾扣減減半、超額攔截、超額真傷重生）、
//   battle/statusRules.ts（山神守護時：異常不可轉化為控制／弱化類、原效果取消、替代規則）、
//   battle/skillRules.ts（符合條件的技能不消耗PP）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { queueHpDrain } from '../../battle/hpDrain';
import { statusReplacementActive } from '../../battle/statusRules';
import { getStatuses } from '../../utils/battleHelpers';
import { StatusRegistry } from '../../effects/statusRegistry';
import { canonicalStatusName } from '../../effects/statusIdentity';
import type { StatusCategory } from '../../effects/statusTypes';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const CATEGORIES: StatusCategory[] = ['CONTROL', 'WEAKENING', 'RESTRICTIVE', 'EVOLUTIONARY', 'AUXILIARY'];

export const CASSIUS_SHAN_ACTION_FIELDS: Record<string, readonly string[]> = {
  clear_both_shields: ['drainRatio', 'threshold', 'maxHpBonus'],
  drain_shield_ratio: ['ratio'],
  drain_then_shield: ['ratio'],
  escalating_drain: ['base', 'step', 'max'],
  power_multiplier: ['v'],
  stat_transfer_down: [],
  barrier_add: ['side', 'flat'],
  status_if_absent_else_heal: ['status', 'turns', 'healRatio'],
  status_end_cleanse: ['status', 'turns'],
  team_rules: ['shieldDeductionRatio', 'excessIntercept', 'excessTrueRebirth'],
  team_intercept_settle: ['shieldRatio', 'healRatio'],
  status_rules: ['whileStatus', 'conversionTargetBan', 'cancelEffects', 'replacePpFree', 'replaceInvalidateOppTurns'],
  replacement_invalidate_opp: [],
  skill_rules: ['ppFreeKind', 'ppFreeWhenFieldShield'],
  shield_lost_watch: ['scope', 'once', 'body'],
};

export function cassiusShanActionIssue(op: string, p: any, bodyIssue?: (body: any[]) => string | null): string | null {
  if (op === 'clear_both_shields') {
    if (!(p.drainRatio >= 0 && p.drainRatio <= 2)) return '清除護盾需0至200%吸取比例';
    if (!Number.isFinite(p.threshold) || p.threshold < 0) return '清除護盾需非負門檻';
    if (!Number.isFinite(p.maxHpBonus) || p.maxHpBonus < 0) return '清除護盾需非負體力上限加成';
    return null;
  }
  if (op === 'drain_shield_ratio' || op === 'drain_then_shield') {
    if (!(p.ratio > 0 && p.ratio <= 2)) return '吸取護盾需0至200%比例';
    return null;
  }
  if (op === 'escalating_drain') {
    if (!(p.base > 0 && p.base <= 1)) return '遞增吸取需0至100%基礎比例';
    if (!(p.step >= 0 && p.step <= 1)) return '遞增吸取需0至100%每步增幅';
    if (!(p.max > 0 && p.max <= 1)) return '遞增吸取需0至100%上限';
    return null;
  }
  if (op === 'power_multiplier') {
    if (!(p.v > 0 && p.v <= 10)) return '威力倍率需大於0且不超過10';
    return null;
  }
  if (op === 'barrier_add') {
    if (!['self', 'opp'].includes(p.side)) return '護罩需指定對象';
    if (!Number.isFinite(p.flat) || p.flat <= 0) return '護罩需正數量';
    return null;
  }
  if (op === 'status_if_absent_else_heal') {
    if (typeof p.status !== 'string' || !p.status) return '需狀態名稱';
    if (!Number.isInteger(p.turns) || p.turns < 1) return '需正整數回合';
    if (!(p.healRatio > 0 && p.healRatio <= 1)) return '需0至100%恢復比例';
    return null;
  }
  if (op === 'status_end_cleanse') {
    if (typeof p.status !== 'string' || !StatusRegistry[canonicalStatusName(p.status)]) return '需已登記的異常名稱';
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 20) return '需1至20回合監看期限';
    return null;
  }
  if (op === 'team_rules') {
    const keys = Object.keys(p).filter(k => p[k] !== undefined);
    if (!keys.length) return '隊伍被動規則至少一項';
    if (p.shieldDeductionRatio !== undefined && !(p.shieldDeductionRatio > 0 && p.shieldDeductionRatio < 1)) return '護盾扣減比例需介於0與1之間';
    for (const k of ['excessIntercept', 'excessTrueRebirth']) if (p[k] !== undefined && p[k] !== true) return '布林規則只接受true';
    return null;
  }
  if (op === 'team_intercept_settle') {
    if (!(p.shieldRatio > 0 && p.shieldRatio <= 1)) return '攔截結算需0至100%護盾消耗比例';
    if (!(p.healRatio >= 0 && p.healRatio <= 1)) return '攔截結算需0至100%恢復比例';
    return null;
  }
  if (op === 'status_rules') {
    if (typeof p.whileStatus !== 'string' || !StatusRegistry[canonicalStatusName(p.whileStatus)]) return '異常規則需已登記的條件異常';
    for (const k of ['conversionTargetBan', 'cancelEffects']) {
      if (p[k] !== undefined && (!Array.isArray(p[k]) || !p[k].length || p[k].some((c: any) => !CATEGORIES.includes(c)))) return '異常規則分類需為已登記的異常分類';
    }
    if (p.replacePpFree !== undefined && p.replacePpFree !== true) return '布林規則只接受true';
    if (p.replaceInvalidateOppTurns !== undefined && (!Number.isInteger(p.replaceInvalidateOppTurns) || p.replaceInvalidateOppTurns < 1 || p.replaceInvalidateOppTurns > 10)) return '附加失效回合需1至10整數';
    return null;
  }
  if (op === 'skill_rules') {
    if (p.ppFreeKind !== undefined && !['攻擊', '屬性'].includes(p.ppFreeKind)) return '技能規則類型需攻擊或屬性';
    if (p.ppFreeWhenFieldShield !== undefined && p.ppFreeWhenFieldShield !== true) return '布林規則只接受true';
    if (p.ppFreeKind === undefined && p.ppFreeWhenFieldShield === undefined) return '技能規則需明確不消耗PP條件';
    return null;
  }
  if (op === 'shield_lost_watch') {
    if (!['self', 'team'].includes(p.scope)) return '護盾消失監看需自身或己方範圍';
    if (typeof p.once !== 'boolean') return '護盾消失監看需明確一次或每次';
    if (!Array.isArray(p.body) || !p.body.length) return '護盾消失監看需子流程';
    return bodyIssue?.(p.body) ?? null;
  }
  return null;
}

export function cassiusShanOperations(helpers: {
  liveElf: (ctx: BattleEventContext, side: S) => any;
  addBlockTimer: (...args: any[]) => any;
  runAct: (ctx: BattleEventContext, act: any, st: RunState) => any;
}) {
  const holder = (ctx: BattleEventContext) => ({ side: ctx.actor, id: idOf(ctx.self), elf: ctx.self as any });
  return {
    /** 消除雙方護盾護罩，吸取對手消除量等量體力；超過門檻則提升體力上限。 */
    clear_both_shields: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!self || !opp) return false;
      const oppTotal = Math.max(0, Number(opp.shield) || 0) + Math.max(0, Number(opp.barrier) || 0);
      const selfTotal = Math.max(0, Number(self.shield) || 0) + Math.max(0, Number(self.barrier) || 0);
      if (oppTotal + selfTotal <= 0) return false;
      ctx.updateAnyElf(ctx.targetSide, idOf(opp), { shield: 0, barrier: 0 } as any);
      ctx.updateAnyElf(ctx.actor, idOf(self), { shield: 0, barrier: 0 } as any);
      const drained = Math.floor(oppTotal * p.drainRatio);
      if (drained > 0) queueHpDrain(ctx, ctx.targetSide, drained, 'fixed', '萬壑崩摧·吸取');
      if (oppTotal > p.threshold && p.maxHpBonus > 0) {
        const now = helpers.liveElf(ctx, ctx.actor);
        ctx.updateAnyElf(ctx.actor, idOf(now), {
          maxHp: now.maxHp + p.maxHpBonus,
          currentHp: now.currentHp + p.maxHpBonus,
        } as any);
        ctx.addLog?.(`⛰️ 【萬壑崩摧】：消除量 ${oppTotal} 超過 ${p.threshold}，體力上限 +${p.maxHpBonus}！`, 'effect');
      }
      return true;
    },

    /** 吸取雙方護盾值 N% 的體力（對手固定傷害，自身等量恢復）。 */
    drain_shield_ratio: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!self || !opp) return false;
      const total = (Number(self.shield) || 0) + (Number(self.barrier) || 0)
        + (Number(opp.shield) || 0) + (Number(opp.barrier) || 0);
      return queueHpDrain(ctx, ctx.targetSide, Math.floor(total * p.ratio), 'fixed', '雙方護盾吸取') > 0;
    },

    /** 吸取對手最大體力 N% 並為自身附加等量護盾（等量＝實際吸取量）。 */
    drain_then_shield: (ctx: BattleEventContext, p: any): boolean => {
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!opp) return false;
      const settled = queueHpDrain(ctx, ctx.targetSide, Math.floor((Number(opp.maxHp) || 0) * p.ratio), 'percent', '吸取並附加護盾');
      if (settled <= 0) return false;
      ctx.applyShield(ctx.actor, settled);
      return true;
    },

    /** 遞增吸取對手最大體力：每次使用提升，最高上限。 */
    escalating_drain: (ctx: BattleEventContext, p: any): boolean => {
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!opp) return false;
      const key = 'cassiusEscalatingDrainUses';
      const uses = Number(ctx.getPlayerState(key)) || 0;
      ctx.setPlayerState(key, uses + 1);
      const ratio = Math.min(p.max, Math.round((p.base + p.step * uses) * 1e9) / 1e9);
      const settled = queueHpDrain(ctx, ctx.targetSide, Math.floor((Number(opp.maxHp) || 0) * ratio), 'percent', '歸塵·吸取');
      ctx.addLog?.(`⛰️ 【歸塵】：吸取對手最大體力 ${Math.round(ratio * 100)}%（第 ${uses + 1} 次使用，實際 ${settled}）`, 'effect');
      return settled > 0;
    },


    /** 本次技能威力倍率。 */
    power_multiplier: (ctx: BattleEventContext, p: any): boolean => {
      const cur = Number(ctx.getPlayerState('powerMultiplierThisAction')) || 1;
      ctx.setPlayerState('powerMultiplierThisAction', cur * p.v);
      return true;
    },

    /** 解除自身能力下降並等量附加給對手（每項能力：自身歸回下降前、對手同等級下降）。 */
    stat_transfer_down: (ctx: BattleEventContext): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      if (!self) return false;
      const downs = Object.entries(self.statStages || {}).filter(([, v]) => typeof v === 'number' && (v as number) < 0) as [string, number][];
      if (!downs.length) return false;
      ctx.applyStatChange(ctx.actor, Object.fromEntries(downs.map(([k, v]) => [k, -v])));
      ctx.applyStatChange(ctx.targetSide, Object.fromEntries(downs));
      ctx.addLog?.(`⛰️ 【萬壑崩摧】：自身能力下降已解除並附加給對手！`, 'effect');
      return true;
    },

    /** 為指定方附加護罩。 */
    barrier_add: (ctx: BattleEventContext, p: any): boolean => {
      const side: S = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      const e = helpers.liveElf(ctx, side);
      if (!e) return false;
      ctx.updateAnyElf(side, idOf(e), { barrier: (Number(e.barrier) || 0) + Math.floor(p.flat) } as any);
      ctx.addLog?.(`🔵 【${e.name}】獲得 ${Math.floor(p.flat)} 點護罩！`, 'effect');
      return true;
    },

    /** 若無該狀態則附加，否則恢復體力。 */
    status_if_absent_else_heal: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      if (!self) return false;
      const statuses = (ctx as any).getStatuses?.(self) || {};
      if (statuses[p.status] > 0) {
        const heal = Math.floor((Number(self.maxHp) || 0) * p.healRatio);
        if (heal > 0) ctx.applyHeal(ctx.actor, heal);
        return true;
      }
      ctx.applyStatusWithImmunityCheck(ctx.actor, p.status, p.turns);
      return true;
    },

    /** 登記：指定異常回合結束（自然到期）時，同時解除自身其他異常狀態。 */
    status_end_cleanse: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      helpers.addBlockTimer(ctx, ctx.actor, '異常結束時解除其他異常', p.turns, 'turns',
        { trig: 'status_end', once: true, sourceKind: st.sourceKind, body: [{ acts: [{ op: 'cleanse_on_status_end', p: { status: p.status }, label: 'cleanse_on_status_end' }] }] },
        false, 'turn_effect', true, 'elf', 'cassiusCleanse:' + idOf(ctx.self));
      return true;
    },
    cleanse_on_status_end: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const data = st.event?.data?.effectEventData || st.event?.data;
      if (!data || canonicalStatusName(data.status) !== canonicalStatusName(p.status) || data.reason !== 'expired') return false;
      const r = helpers.runAct(ctx, { op: 'cure_status', p: { side: 'self' }, label: 'cure_status' }, { last: null, lastAmount: 0 });
      ctx.addLog?.(`⛰️ 【${data.status}】結束，同時解除其他異常狀態！`, 'effect');
      return r === true;
    },

    // ── 魂印：隊伍被動規則（通用讀取端 battle/teamPassiveRules.ts）──
    team_rules: (ctx: BattleEventContext, p: any): boolean => {
      const h = holder(ctx);
      if (!h.id) return false;
      const patch = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
      ctx.updateAnyElf(h.side, h.id, { teamRules: { ...(h.elf.teamRules || {}), ...patch } } as any);
      return true;
    },
    /** 戰鬥階段結束：若本階段有超額攔截，消耗當前護盾 consume，恢復在場精靈消耗量 heal 的體力。 */
    team_intercept_settle: (ctx: BattleEventContext, p: any): boolean => {
      if (!ctx.getPlayerState('teamInterceptPending')) return false;
      ctx.setPlayerState('teamInterceptPending', false);
      // 觀察者 ctx 的 self 是後備持有者；須取「在場精靈」的最新狀態
      const base = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
      const active = (ctx.getFullTeam?.(ctx.actor) || []).find((e: any) => idOf(e) === idOf(base)) || base;
      const shield = Math.max(0, Number(active?.shield) || 0);
      const consumed = Math.floor(shield * p.shieldRatio);
      if (consumed <= 0) return false;
      ctx.updateAnyElf(ctx.actor, idOf(active), { shield: shield - consumed } as any);
      const heal = Math.floor(consumed * p.healRatio);
      if (heal > 0) ctx.applyHeal(ctx.actor, heal);
      ctx.addLog?.(`⛰️ 【護盾守護】：戰鬥階段結束，消耗 ${consumed} 點護盾，恢復 ${heal} 點體力！`, 'effect');
      return true;
    },

    // ── 魂印：異常規則（通用讀取端 battle/statusRules.ts）──
    status_rules: (ctx: BattleEventContext, p: any): boolean => {
      const h = holder(ctx);
      if (!h.id) return false;
      const prev = h.elf.statusRules || {};
      const merge = (a?: string[], b?: string[]) => [...new Set([...(a || []), ...(b || [])])];
      const next: any = { ...prev, whileStatus: p.whileStatus };
      if (p.conversionTargetBan) next.conversionTargetBan = merge(prev.conversionTargetBan, p.conversionTargetBan);
      if (p.cancelEffects) next.cancelEffects = merge(prev.cancelEffects, p.cancelEffects);
      if (p.replacePpFree) next.replacePpFree = true;
      if (p.replaceInvalidateOppTurns) next.replaceInvalidateOppTurns = p.replaceInvalidateOppTurns;
      ctx.updateAnyElf(h.side, h.id, { statusRules: next } as any);
      return true;
    },
    /** 原效果被取消期間的替代規則：技能使用後令對手 N 回合內技能附加效果失效。 */
    replacement_invalidate_opp: (ctx: BattleEventContext): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      const rules = statusReplacementActive(self?.statusRules, getStatuses(self));
      if (!rules?.replaceInvalidateOppTurns) return false;
      helpers.runAct(ctx, { op: 'add_invalid_turns', p: { kind: 'all', turns: rules.replaceInvalidateOppTurns }, label: 'add_invalid_turns' }, { last: null, lastAmount: 0 });
      ctx.addLog?.(`⛰️ 山神守護取代原效果：對手 ${rules.replaceInvalidateOppTurns} 回合內技能附加效果失效！`, 'effect');
      return true;
    },
    skill_rules: (ctx: BattleEventContext, p: any): boolean => {
      const h = holder(ctx);
      if (!h.id) return false;
      ctx.updateAnyElf(h.side, h.id, { skillRules: { ...(h.elf.skillRules || {}), ppCostFree: { ...(p.ppFreeKind ? { skillKind: p.ppFreeKind } : {}), ...(p.ppFreeWhenFieldShield ? { whenFieldShield: true } : {}) } } } as any);
      return true;
    },

    /** 登記護盾消失監看（引擎 SHIELD_BROKEN）；scope=self 只看持有者、team 看己方在場精靈；once=只觸發一次。 */
    shield_lost_watch: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      helpers.addBlockTimer(ctx, ctx.actor, p.once ? '護盾消失時（一次）' : '護盾每次消失時', p.once ? 1 : 9999, 'uses',
        { trig: 'shield_broken', once: p.once, sourceKind: st.sourceKind, body: structuredClone(p.body) },
        false, undefined, false, p.scope === 'team' ? 'team' : 'elf',
        `cassiusShieldLost:${p.scope}:${p.once ? 'once' : 'every'}:${idOf(ctx.self)}:${JSON.stringify(p.body).length}`);
      return true;
    },
  };
}
