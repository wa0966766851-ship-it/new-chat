// 5014 燦 魂印「燦」通用件（DSH 20261018 第二十三批）。
// 缺口：
//   ① non_true_damage_third{}：受到非真實傷害時降低至原始傷害的⅓（引擎既有 incoming 管線讀取端）。
//   ② weakness_damage_turns{turns}：計算傷害時以對手當前雙防較低者的 60% 作為防禦值（弱點傷害）。
//   ③ heal_as_percent_damage{ratio, next}：恢復自身最大體力 ratio，並於當回合結束對對手造成等量百分比傷害。
//   ④ pp_max_to_one{side}：把對手被降低後 PP 值不大於 1 的技能，其 PP 上限歸 1。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const CAN_ACTION_FIELDS: Record<string, readonly string[]> = {
  non_true_damage_third: [],
  weakness_damage_turns: ['turns'],
  heal_as_percent_damage: ['ratio', 'next'],
  pp_max_to_one: ['side'],
};

export function canActionIssue(op: string, p: any): string | null {
  if (op === 'non_true_damage_third') return null;
  if (op === 'weakness_damage_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return '弱點傷害需1至100回合';
    return null;
  }
  if (op === 'heal_as_percent_damage') {
    if (!(p.ratio > 0 && p.ratio <= 1)) return '恢復轉百分比傷害需0至100%比例';
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
    // 受到非真實傷害降低至⅓：以「本回合受傷減免」旗標供引擎 incoming 管線讀取。
    non_true_damage_third: (ctx: BattleEventContext): boolean => {
      (ctx as any).setPlayerState?.('canNonTrueThird', true);
      return true;
    },
    // 弱點傷害：N 回合內自身攻擊技能計算傷害時，以對手雙防較低者的 60% 作為其防禦值。
    weakness_damage_turns: (ctx: BattleEventContext, p: any): boolean => {
      (ctx as any).setPlayerState?.('canWeaknessTurns', p.turns);
      return true;
    },
    // 恢復最大體力 ratio，並於當回合結束對對手造成等量百分比傷害。
    heal_as_percent_damage: (ctx: BattleEventContext, p: any): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf) return false;
      const amount = Math.floor((Number(elf.maxHp) || 0) * p.ratio);
      if (amount <= 0) return false;
      (ctx as any).applyHeal?.(ctx.actor, amount);
      (ctx as any).addTimerTo?.(ctx.actor, {
        id: 'canHealPercentDamage', name: '恢復轉百分比傷害', kind: 'turn_effect',
        remaining: 1, tickAt: 'round_end', scope: 'elf', source: 'soulmark',
        payload: { block: { percentFromHeal: amount } },
      }, false);
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
