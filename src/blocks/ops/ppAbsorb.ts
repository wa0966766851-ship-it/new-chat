// 通用件：回合開始吸取對手全部技能 PP 並恢復自身同位槽（DSH 20261019）。
// 缺口：纏根「每回合吸取對手所有技能1點PP並恢復自身相同位數技能1點PP，損失過半翻倍」。
// 引擎既有讀取端 newElfLifecycle（ROUND_START 讀 payload.roundPpAbsorb）——本 op 只建 timer。
import type { BattleEventContext } from '../../effects/types';

type S = 'p1' | 'p2';

export const PP_ABSORB_ACTION_FIELDS: Record<string, readonly string[]> = {
  pp_absorb_turns: ['turns', 'amount', 'doubleWhenLostHalf'],
  // 使用技能後恢復滿量並造成等量百分比傷害（讀取端 newElfLifecycle payload.afterUseHealEqualPercent）
  heal_equal_percent_turns: ['turns', 'ratio'],
};

export function ppAbsorbActionIssue(op: string, p: any): string | null {
  if (op === 'pp_absorb_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return 'PP吸取需1至100回合';
    if (!Number.isInteger(p.amount) || p.amount < 1 || p.amount > 10) return 'PP吸取每次需1至10點';
    if (p.doubleWhenLostHalf !== undefined && typeof p.doubleWhenLostHalf !== 'boolean') return '翻倍開關需布林';
    return null;
  }
  if (op === 'heal_equal_percent_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return '回滿附傷需1至100回合';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '回滿附傷需0至100%比例';
    return null;
  }
  return null;
}

export function ppAbsorbOperations() {
  return {
    pp_absorb_turns: (ctx: BattleEventContext, p: any): boolean => {
      const elf = (ctx as any).self;
      const timerId = `pp_absorb_${(elf as any).battleId || (elf as any).id || 'src'}`;
      (ctx as any).addTimerTo?.(ctx.actor, {
        id: timerId, name: '回合吸取PP', kind: 'turn_effect', source: 'skill',
        remaining: p.turns, tickAt: 'round_end', scope: 'elf',
        payload: { roundPpAbsorb: { amount: p.amount, doubleWhenLostHalf: p.doubleWhenLostHalf !== false } },
      } as any, false);
      return true;
    },
    heal_equal_percent_turns: (ctx: BattleEventContext, p: any): boolean => {
      const elf = (ctx as any).self;
      const timerId = 'heal_equal_' + ((elf as any).battleId || (elf as any).id || 'src');
      ((globalThis as any).__HG ||= []).push('heal_op_ran');
      (ctx as any).addTimerTo?.(ctx.actor, {
        id: timerId, name: '使用技能後回滿附傷', kind: 'turn_effect', source: 'skill',
        remaining: p.turns, tickAt: 'round_end', scope: 'elf',
        payload: { afterUseHealEqualPercent: p.ratio },
      } as any, false);
      return true;
    },
  };
}