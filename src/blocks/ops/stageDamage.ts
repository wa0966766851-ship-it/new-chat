// 能力等級傷害／場下PP上限 通用件（legacyWrapped 拆解；DSH 20261017）。
// stage_sum_damage：「（敵我雙方或指定方）能力等級總和×N點固定傷害」附加給對手。
//   等級計值：上升為正、下降也計值（原文「能力等級*30」＝各項等級的絕對等級數總和）。
// stage_any 條件：任一方存在指定方向（up/down/any）的能力等級——「消除失敗（含視為弱化無法解除）」判讀。
// pp_cap_floor_bench：對手場下所有精靈 PP 上限扣除至等同當前 PP（最低 min）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

const STAGE_KEYS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 契約欄位（登記於 sequenceContract）。 */
export const STAGE_DAMAGE_ACTION_FIELDS: Record<string, readonly string[]> = {
  stage_sum_damage: ['flat', 'sides'],
  pp_cap_floor_bench: ['min'],
};
export const STAGE_DAMAGE_CONDITION_FIELDS: Record<string, readonly string[]> = {
  stage_any: ['side', 'kind'],
};

const stageLevels = (elf: any): number => STAGE_KEYS.reduce((n, k) => n + Math.abs(Number(elf?.statStages?.[k]) || 0), 0);
const hasDirection = (elf: any, kind: string): boolean =>
  STAGE_KEYS.some(k => {
    const v = Number(elf?.statStages?.[k]) || 0;
    return kind === 'any' ? v !== 0 : kind === 'up' ? v > 0 : v < 0;
  });

/** 契約補充檢查；回傳 null 代表通過。 */
export function stageDamageActionIssue(op: string, p: any): string | null {
  if (op === 'stage_sum_damage') {
    if (!Number.isSafeInteger(p.flat) || p.flat <= 0 || p.flat > 100000) return '能力等級傷害需正整數點數';
    if (!['self', 'opp', 'both'].includes(p.sides)) return '能力等級傷害需明確計值方';
    return null;
  }
  if (op === 'pp_cap_floor_bench') {
    if (!Number.isInteger(p.min) || p.min < 0 || p.min > 10) return '場下PP上限下限需0至10整數';
    return null;
  }
  return null;
}
export function stageDamageConditionIssue(c: Record<string, any>): string | undefined {
  if (c?.c !== 'stage_any') return undefined;
  const p = c.p || {};
  if (!['self', 'opp', 'both'].includes(p.side)) return '能力等級存在查詢需明確持有者';
  if (!['up', 'down', 'any'].includes(p.kind)) return '能力等級存在查詢需明確方向';
  return undefined;
}

/** 執行端（併入 runtime 的 OPS；dealDamage 由 runtime 注入避免循環）。 */
export function stageDamageOperations(helpers: {
  liveElf: (ctx: BattleEventContext, side: 'p1' | 'p2') => any;
  dealDamage: (ctx: BattleEventContext, side: 'p1' | 'p2', amount: number, type: string, elem?: string, st?: RunState) => number;
}) {
  return {
    stage_sum_damage: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const sides = p.sides === 'both' ? [ctx.actor, ctx.targetSide] : [p.sides === 'self' ? ctx.actor : ctx.targetSide];
      const sum = sides.reduce((n, s) => n + stageLevels(helpers.liveElf(ctx, s as 'p1' | 'p2')), 0);
      if (!sum) return false;
      st.lastAmount = helpers.dealDamage(ctx, ctx.targetSide, sum * p.flat, '固定', undefined, st);
      ctx.addLog?.('📉 依雙方能力等級總和附加 ' + (sum * p.flat) + ' 點固定傷害！', 'effect');
      return true;
    },
    pp_cap_floor_bench: (ctx: BattleEventContext, p: any): boolean => {
      // 對手場下（非在場）所有精靈：PP 上限扣除至等同當前 PP，最低 min。
      if (!ctx.getFullTeam) return false;
      const team = ctx.getFullTeam(ctx.targetSide) || [];
      const active = ctx.targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2;
      let changed = 0;
      for (const e of team) {
        if (!e || (e.battleId || e.id) === (active?.battleId || active?.id) || e.isExtra) continue;
        for (const s of (e.skills || []) as any[]) {
          if (typeof s.maxPp === 'number' && typeof s.pp === 'number' && s.maxPp > Math.max(p.min, s.pp)) {
            s.maxPp = Math.max(p.min, s.pp); changed++;
          }
        }
      }
      if (changed) ctx.addLog?.('📉 對手場下精靈 PP 上限已扣除至當前 PP（最低 ' + p.min + '）！', 'effect');
      return changed > 0;
    },
  };
}

/** 條件求值；無法辨識回傳 undefined 交還 runtime 預設分支。 */
export function stageDamageEvalCond(ctx: BattleEventContext, c: Record<string, any>): boolean | undefined {
  if (c?.c !== 'stage_any') return undefined;
  const p = c.p || {};
  const elfs = p.side === 'both'
    ? [(ctx as any).self, (ctx as any).target]
    : [p.side === 'self' ? (ctx as any).self : (ctx as any).target];
  return elfs.some(e => hasDirection(e, p.kind));
}
