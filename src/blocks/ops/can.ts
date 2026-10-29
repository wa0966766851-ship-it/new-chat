// 5014 燦 魂印「燦」通用件（DSH 20261018 第二十三批）。
// 缺口：
//   ① non_true_damage_third{}：受到非真實傷害時降低至原始傷害的⅓（引擎既有 incoming 管線讀取端）。
//   ② weakness_damage_turns{turns}：計算傷害時以對手當前雙防較低者的 60% 作為防禦值（弱點傷害）。
//   ③ heal_as_percent_damage{ratio, next}：恢復自身最大體力 ratio，並於當回合結束對對手造成等量百分比傷害。
//   ④ pp_max_to_one{side}：把對手被降低後 PP 值不大於 1 的技能，其 PP 上限歸 1。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { multiplyDamageReduction } from '../../battle/damageReduction';
import { getStatuses, isControlStatus, syncLegacy, isAuxiliaryStatus, removeStatusEffect, addStatusEffect } from '../../utils/battleHelpers';
import { sameStatus } from '../../effects/statusIdentity';
import { readMarkStacks } from '../../effects/markQueries';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const activeElf = (ctx: BattleEventContext, side: S): any => {
  const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
  return ctx.getFullTeam(side).find(e => idOf(e) === idOf(active)) || active;
};

export const CAN_ACTION_FIELDS: Record<string, readonly string[]> = {
  non_true_damage_third: [],
  weakness_damage_turns: ['turns'],
  heal_as_percent_damage: ['ratio', 'next'],
  pp_max_to_one: ['side'],
  status_turns_count: ['status', 'mult', 'markId'],
  control_duration_reduce: ['min'],
  pp_reduce_floor: ['side', 'min', 'capAtFloor'],
  statuses_merge: ['status', 'includeIncoming'],
  phase_protect: ['kind'],
  delayed_rebirth_arm: ['rounds', 'perMark', 'requireExtra', 'ratio'],
  delayed_rebirth_tick: [],
};
export function canEvalCond(ctx: BattleEventContext, c: any): boolean | undefined {
  if (c.c === 'holder_active') return idOf(activeElf(ctx, ctx.actor)) === idOf(ctx.self);
  if (c.c === 'event_is_holder') return String((ctx as any).observedEventOwnerBattleId) === idOf(ctx.self);
  if (c.c !== 'summoned_extra_alive') return undefined;
  return ctx.getFullTeam(ctx.actor).some(e => e.isExtra && !e.isVanished && e.currentHp > 0
    && e.name === c.p.name && String(e.summonerId) === idOf(ctx.self));
}

export function canActionIssue(op: string, p: any, trig?: string): string | null {
  if (op === 'delayed_rebirth_tick') return trig === 'team_round_end' ? null : '背包重生倒數需正式隊伍回合末';
  if (op === 'delayed_rebirth_arm') return trig === 'team_defeated' && Number.isSafeInteger(p.rounds) && p.rounds > 0 && p.rounds <= 10000
    && typeof p.requireExtra === 'string' && !!p.requireExtra && Number.isFinite(p.ratio) && p.ratio > 0 && p.ratio <= 1
    && p.perMark?.side === 'self' && typeof p.perMark.id === 'string' && !!p.perMark.id && Number.isSafeInteger(p.perMark.mult) && p.perMark.mult > 0
    ? null : '延後重生需被擊敗事件、正回合、印記縮減、存活召喚物及體力比例';
  if (op === 'statuses_merge') return typeof p.status === 'string' && p.status.length > 0 && typeof p.includeIncoming === 'boolean'
    && (p.includeIncoming ? ['before_status', 'team_before_status'] : ['status_received', 'team_status_received']).includes(trig || '') ? null : '異常合併需正式附加前後事件、目標狀態及明確是否包含待附加狀態';
  if (op === 'phase_protect') return ['turn', 'stat'].includes(p.kind) ? null : '階段保護需回合類或能力上升';
  if (op === 'status_turns_count') return typeof p.status === 'string' && p.status.length > 0 && Number.isSafeInteger(p.mult) && p.mult > 0 && typeof p.markId === 'string' && p.markId.length > 0 ? null : '異常回合計數需狀態、印記及正整數倍率';
  if (op === 'control_duration_reduce') return Number.isSafeInteger(p.min) && p.min >= 1 ? null : '控制回合減少需正整數下限';
  if (op === 'pp_reduce_floor') return ['self', 'opp'].includes(p.side) && Number.isSafeInteger(p.min) && p.min >= 1 && typeof p.capAtFloor === 'boolean' ? null : 'PP減少需目標、正下限及明確上限規則';
  if (op === 'non_true_damage_third') return ['incoming', 'incoming_nontrue', 'incoming_skill', 'incoming_attack'].includes(trig || '') ? null : '減傷必須在受到傷害前執行';
  if (op === 'weakness_damage_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return '弱點傷害需1至100回合';
    return null;
  }
  if (op === 'heal_as_percent_damage') {
    if (!Number.isFinite(p.ratio) || !(p.ratio > 0 && p.ratio <= 1)) return '恢復轉百分比傷害需0至100%比例';
    if (p.next !== undefined && typeof p.next !== 'boolean') return '恢復轉百分比傷害的 next 需布林';
    return null;
  }
  if (op === 'pp_max_to_one') {
    if (!['self', 'opp'].includes(p.side)) return 'PP上限歸一需指定自身或對手';
    return null;
  }
  return null;
}

export function canOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any }) {
  return {
    delayed_rebirth_arm: (ctx: BattleEventContext, p: any): boolean => {
      const elf = ctx.getFullTeam(ctx.actor).find(e => idOf(e) === idOf(ctx.self));
      if (!elf || elf.currentHp > 0 || elf.isVanished) return false;
      ctx.setPlayerState(`blockRebirth:${idOf(elf)}`, { remaining: Math.max(1, p.rounds - readMarkStacks(ctx, p.perMark) * p.perMark.mult),
        requireExtra: p.requireExtra, ratio: p.ratio, diedRound: ctx.roundNumber ?? 0 });
      return true;
    },
    delayed_rebirth_tick: (ctx: BattleEventContext): boolean => {
      const key = `blockRebirth:${idOf(ctx.self)}`, record = ctx.getPlayerState(key);
      if (!record) return false;
      const team = ctx.getFullTeam(ctx.actor), elf = team.find(e => idOf(e) === idOf(ctx.self));
      if (!elf || elf.currentHp > 0 || elf.isVanished || !canEvalCond(ctx, { c: 'summoned_extra_alive', p: { name: record.requireExtra } })) {
        ctx.setPlayerState(key, null); return false;
      }
      const round = ctx.roundNumber ?? 0;
      if (round <= record.diedRound || record.lastRound === round || idOf(activeElf(ctx, ctx.actor)) === idOf(elf)
        || !team.some(e => !e.isExtra && !e.isVanished && e.currentHp > 0)) return false;
      const remaining = record.remaining - 1;
      ctx.setPlayerState(key, remaining > 0 ? { ...record, remaining, lastRound: round } : null);
      if (remaining > 0) return true;
      ctx.updateElf(ctx.actor, { battleId: elf.battleId, id: elf.id, currentHp: Math.max(1, Math.floor(elf.maxHp * record.ratio)) });
      ctx.addLog(`✨ 【${elf.name}】於背包內重生，恢復體力！`, 'effect');
      return true;
    },
    statuses_merge: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const elf = activeElf(ctx, ctx.actor), data = st.event?.data || (ctx as any).effectEventData;
      const statuses = getStatuses(elf);
      let total = 0;
      const clone = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...elf.battleStatuses } };
      for (const [name, turns] of Object.entries(statuses)) if (!isAuxiliaryStatus(name)) {
        total += turns;
        removeStatusEffect(clone, name);
      }
      if (p.includeIncoming) total += Math.max(1, Number(data?.duration) || 3);
      if (!total) return false;
      addStatusEffect(clone, p.status, total);
      ctx.updateElf(ctx.actor, { battleId: elf.battleId, id: elf.id, effects: clone.effects,
        battleStatuses: clone.battleStatuses, battleStatus: clone.battleStatus, battleStatusDuration: clone.battleStatusDuration });
      if (p.includeIncoming && data) data.prevent = true;
      return true;
    },
    phase_protect: (ctx: BattleEventContext, p: any): boolean => {
      const active = activeElf(ctx, ctx.actor), recipient = ctx.contextForElf?.(ctx.actor, active) || ctx;
      recipient.setPlayerState(p.kind === 'turn' ? 'turnEffectsUnclearableTurns' : 'statBoostUnclearableTurns', 1);
      return true;
    },
    status_turns_count: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const count = [ctx.actor, ctx.targetSide].reduce((sum, side) => sum + (Number(getStatuses(activeElf(ctx, side as S))[p.status]) || 0), 0);
      st.lastAmount = count * readMarkStacks(ctx, { side: 'self', id: p.markId }) * p.mult;
      return st.lastAmount > 0;
    },
    control_duration_reduce: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (!(st.lastAmount > 0)) return false;
      const elf = activeElf(ctx, ctx.actor);
      const clone = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...elf.battleStatuses } };
      let changed = false;
      for (const [name, duration] of Object.entries(getStatuses(elf))) {
        if (!isControlStatus(name) || duration <= p.min) continue;
        const next = Math.max(p.min, duration - st.lastAmount);
        clone.battleStatuses[name] = next;
        clone.effects = clone.effects.map((effect: any) => sameStatus(effect.id, name) ? { ...effect, duration: next } : effect);
        changed = true;
      }
      if (changed) { syncLegacy(clone); ctx.updateElf(ctx.actor, { battleId: elf.battleId, id: elf.id, effects: clone.effects,
        battleStatuses: clone.battleStatuses, battleStatus: clone.battleStatus, battleStatusDuration: clone.battleStatusDuration }); }
      return changed;
    },
    pp_reduce_floor: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (!(st.lastAmount > 0)) return false;
      const side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const elf = activeElf(ctx, side);
      const skills = elf.skills.map((skill: any) => {
        const pp = Number(skill.pp) || 0;
        const next = pp > p.min ? Math.max(p.min, pp - st.lastAmount) : pp;
        return { ...skill, pp: next, ...(skill.currentPp !== undefined ? { currentPp: next } : {}),
          ...(p.capAtFloor && next <= p.min ? { maxPp: p.min, ppMaxOffset: 0 } : {}) };
      });
      ctx.updateElf(side, { battleId: elf.battleId, id: elf.id, skills });
      return true;
    },
    // 受到非真實傷害降低至⅓：直接改寫本次正式 incoming 減傷計算。
    non_true_damage_third: (_ctx: BattleEventContext, _p: any, st: RunState): boolean => {
      const comp = st.event?.data?.damageComp || st.event?.data;
      if (!comp?.isIncoming || comp.pure || comp.damageCategory === 'true' || comp.noReductionApplied) return false;
      return multiplyDamageReduction(comp, 1 / 3) > 0;
    },
    // 弱點傷害：N 回合內自身攻擊技能計算傷害時，以對手雙防較低者的 60% 作為其防禦值。
    weakness_damage_turns: (ctx: BattleEventContext, p: any): boolean => {
      ctx.setPlayerState('weakPointDefenseTurns', Math.max(p.turns, Number(ctx.getPlayerState('weakPointDefenseTurns')) || 0));
      ctx.setPlayerState('weakPointDefenseRatio', 0.6);
      return true;
    },
    // 恢復最大體力 ratio，並於當回合結束對對手造成等量百分比傷害。
    heal_as_percent_damage: (ctx: BattleEventContext, p: any): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf || elf.currentHp <= 0) return false;
      const amount = Math.floor((Number(elf.maxHp) || 0) * p.ratio);
      if (amount <= 0) return false;
      // 只有正式恢復回執才能決定傷害量；禁療、溢補與致死不得產生虛構恢復量。
      ctx.applyHeal(ctx.actor, amount, { onSettled: receipt => {
        const healed = receipt.hpGained;
        if (healed <= 0) return;
        const serial = (Number(ctx.getPlayerState('healReturnSequence')) || 0) + 1;
        ctx.setPlayerState('healReturnSequence', serial);
        const id = `heal_return:${idOf(elf)}:${serial}`;
        ctx.addTimerTo(ctx.actor, {
          id, name: '恢復轉百分比傷害', kind: 'turn_effect', remaining: 1,
          tickAt: 'round_end', scope: 'team', source: 'soulmark', stackRule: 'refresh',
          pendingActivation: p.next || undefined,
          payload: { block: { trig: 'round_end', once: true, sourceKind: 'soul',
            body: [{ acts: [{ op: 'dmg', p: { flat: healed, type: '百分比' }, label: '恢復等量傷害' }] }] } },
        } as any, false);
      } });
      return true;
    },
    // 把對手 PP 值不大於 1 的技能，其 PP 上限歸 1。
    pp_max_to_one: (ctx: BattleEventContext, p: any): boolean => {
      const side: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const team = (ctx as any).getFullTeam?.(side) || [];
      const active = (ctx as any).getActive?.(side);
      const elf = active || team.find((e: any) => !e?.isVanished);
      if (!elf || !Array.isArray(elf.skills)) return false;
      let any = false;
      for (const s of elf.skills) {
        if (typeof s?.pp === 'number' && s.pp <= 1) { s.maxPp = 1; any = true; }
      }
      return any;
    },
  };
}
