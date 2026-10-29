// 受擊減免分支／印記點數傷害上限 通用件（legacyWrapped 拆解；DSH 20261017）。
// incoming_reduction_branch：受到非真實傷害減免 ratio；「以此法減少的量」與 threshold 比較——
//   低於→結算後執行 bodyLow；不低於→bodyHigh（事後回調，減免量寫入 lastAmount 供 body 判讀）。
//   與舊專屬程式同構（keld soul 的 beforeFinalDamage/afterDamage 鏈），全通用。
// damage_cap_by_mark：持有「造成的技能傷害無法超過點數」印記（mark.count 為上限點數）——
//   引擎讀取端挂 BEFORE_DAMAGE（outgoing 技能傷害上限=min(現傷害, 點數)）；
//   印記層數歸零即失效；觸發或主動下場由 Kit 條目（on_damaged/on_switch_out）以 resource_mark_subtract 表達。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { multiplyDamageReduction } from '../../battle/damageReduction';

const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 條件欄位（登記於 sequenceContract）。 */
export const KELD_SOUL_CONDITION_FIELDS: Record<string, readonly string[]> = {
  // 本次事件傷害類型（fatal/damaged 事件判讀；如「僅真實傷害致死才強制存活」）。
  event_damage_type: ['type'],
  // 本次命中為本行動首擊（連擊每行動一次的「使用後」子句）。
  first_hit: [],
};

export function keldSoulConditionIssue(c: Record<string, any>): string | undefined {
  if (c?.c === 'event_damage_type') {
    if (!['固定', '百分比', '真實', '技能', '攻擊', '非真實'].includes(c.p?.type)) return '事件傷害類型需明確分類';
    return undefined;
  }
  return undefined;
}

/** 條件求值；無法辨識回傳 undefined 交還 runtime 預設分支。 */
export function keldSoulEvalCond(ctx: BattleEventContext, c: Record<string, any>): boolean | undefined {
  const data = (ctx as any).effectEventData || (c as any).st?.event?.data || {};
  if (c?.c === 'event_damage_type') {
    const raw = String(data.damageType || data.rawDamageType || '');
    const t = c.p.type;
    if (t === '真實') return /true/.test(raw);
    if (t === '非真實') return raw && !/true/.test(raw);
    if (t === '技能') return /skill/.test(raw);
    if (t === '攻擊') return /attack/.test(raw) && !/skill/.test(raw);
    if (t === '固定') return /fixed/.test(raw);
    if (t === '百分比') return /percent/.test(raw);
    return false;
  }
  if (c?.c === 'first_hit') {
    return (data.hitIndex ?? 0) === 0;
  }
  return undefined;
}

/** 契約欄位（登記於 sequenceContract）。 */
export const KELD_SOUL_ACTION_FIELDS: Record<string, readonly string[]> = {
  incoming_reduction_branch: ['ratio', 'threshold', 'thresholdBase', 'compareBase', 'bodyLow', 'bodyHigh'],
  damage_cap_by_mark: ['id', 'deduct', 'dir', 'kind', 'fixed', 'immune'],
  // 受到的固定／百分比傷害超過指定資源印記點數×ratio 時減半（霜寒幽光讀取端）。
  damage_reduce_by_resource: ['id', 'thresholdRatio', 'multiplier'],
  backlash_percent: ['key', 'ratio', 'type', 'consume'],
  // 無視對手不高於 N 的先制（引擎先制結算讀 oppPriorityCeiling；行動結束重置）。
  opp_priority_ceiling: ['value', 'perMark', 'mult'],
};

/** 契約補充檢查；回傳 null 代表通過。nested 驗 body 遞迴。 */
export function keldSoulActionIssue(op: string, p: any, nested: (body: any[], trig: string) => string | null): string | null {
  if (op === 'incoming_reduction_branch') {
    if (!(p.ratio > 0 && p.ratio < 1)) return '受擊減免比例需大於0且小於100%';
    if (p.thresholdBase !== undefined && !['currentHpThird'].includes(p.thresholdBase)) return '減免量閾值基數需為當前體力⅓';
    if (p.compareBase !== undefined && !['raw_damage', 'reduced'].includes(p.compareBase)) return '分支比較基數需為原始傷害或減少量';
    if (p.thresholdBase === undefined && (!Number.isInteger(p.threshold) || p.threshold < 0)) return '減免量閾值需非負整數';
    for (const key of ['bodyLow', 'bodyHigh'] as const) {
      if (p[key] !== undefined && !Array.isArray(p[key])) return '減免分支需為動作陣列';
      if (p[key] !== undefined) { const issue = nested(p[key], 'damaged'); if (issue) return '減免分支：' + issue; }
    }
    return null;
  }
  if (op === 'damage_cap_by_mark') {
    if (typeof p.id !== 'string' || !p.id || p.id.length > 200) return '印記傷害上限需明確印記ID';
    if (p.deduct !== undefined && (!Number.isInteger(p.deduct) || p.deduct < 0 || p.deduct > 100000)) return '觸發減點需非負整數';
    if (p.dir !== undefined && !['in', 'out'].includes(p.dir)) return '傷害上限方向需為 in 或 out';
    if (p.kind !== undefined && !['攻擊', '技能', '非真實', '固定', '百分比'].includes(p.kind)) return '傷害上限需明確傷害類型';
    if (p.fixed !== undefined && (!Number.isInteger(p.fixed) || p.fixed < 0 || p.fixed > 1000000)) return '固定上限值需非負整數';
    if (p.immune !== undefined && (typeof p.immune !== 'boolean' || p.dir !== 'in' || p.fixed === undefined)) return '整筆免疫只適用受傷方向的固定門檻';
    return null;
  }
  if (op === 'damage_reduce_by_resource') {
    if (typeof p.id !== 'string' || !p.id || p.id.length > 200) return '資源減傷需明確印記ID';
    if (!(p.thresholdRatio > 0) || !(p.multiplier > 0 && p.multiplier < 1)) return '資源減傷需正閾值比例與0至100%減半倍率';
    return null;
  }
  if (op === 'backlash_percent') {
    if (typeof p.key !== 'string' || !p.key || p.key.length > 200) return '反噬計數需穩定有限識別碼';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '反噬比例需0至100%';
    if (!['固定', '百分比', '真實'].includes(p.type)) return '反噬需明確傷害類型';
    if (typeof p.consume !== 'boolean') return '反噬需明確是否消耗計數';
    return null;
  }
  if (op === 'opp_priority_ceiling') {
    if (p.perMark !== undefined && (typeof p.perMark?.id !== 'string' || !p.perMark.id || !(p.perMark.mult > 0))) return '先制封頂層數需明確印記與正倍率';
    if (p.perMark === undefined && (!Number.isInteger(p.value) || p.value < 0 || p.value > 100)) return '先制封頂需0至100整數';
    return null;
  }
  return null;
}

/** 執行端（併入 runtime 的 OPS；runStmts 由 runtime 注入避免循環）。 */
export function keldSoulOperations(helpers: {
  runStmts: (ctx: BattleEventContext, body: any[], st: RunState) => void;
  dealDamage: (ctx: BattleEventContext, side: 'p1' | 'p2', amount: number, type: string, elem?: string, st?: RunState) => number;
}) {
  return {
    // 常駐查詢（魂印 before_damage / passive）：減免＋事後分支。body 在傷害結算後執行（afterDamage 回調）。
    incoming_reduction_branch: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const comp = (st.event?.data?.damageComp || st.event?.data) as any;
      if (!comp || !comp.isIncoming) return false;
      if (comp.damageCategory === 'true' || comp.pure) return false;
      if (comp.noReductionApplied) return false; // 無視減傷時不觸發「以此法減少」副作用（與舊防護一致）
      comp.beforeFinalDamage ||= [];
      (comp.beforeFinalDamage as Array<() => void>).push(() => {
        const stage2 = () => Math.max(0, comp.base * (1 + (comp.increasePercent || 0)) * Math.max(0, 1 - (comp.decreasePercent || 0)) * (comp.multiplier ?? 1) - (comp.flatReduction || 0));
        const before = stage2();
        const threshold = p.thresholdBase === 'currentHpThird' ? Math.floor((ctx.self?.currentHp || 0) / 3) : (p.threshold ?? 0);
        // 以「原傷害」比較門檻（5013 凕）：低於門檻的分支不減傷，只執行低傷分支（汲取等）。
        const lowByRaw = p.compareBase === 'raw_damage' && Math.floor(before) < threshold;
        let reduced = 0;
        if (!lowByRaw) {
          // 減傷一律經減傷政策（99%覆寫／腐朽衰減0／千秋一淚衰減），不可直接改 comp.decreasePercent。
          multiplyDamageReduction(comp, 1 - p.ratio);
          reduced = Math.max(0, Math.floor(before) - Math.floor(stage2()));
          if (reduced <= 0) return; // 政策使減傷失效（無視減傷）：不觸發「以此法減少」的副作用
        }
        // 修復（DSH 20261017）：afterDamage 必須是可調用函數（引擎 notifySettlement 直接調用）——
        // 過去誤賦為陣列導致 TypeError 被 settlement try/catch 吞掉、分支靜默不執行。
        const prevAfter = typeof comp.afterDamage === 'function' ? comp.afterDamage : undefined;
        comp.afterDamage = (receipt: any) => {

          if (prevAfter) { try { prevAfter(receipt); } catch (e) { console.error('[settlement callback]', e); } }
          const frame: RunState = { ...st, last: true, lastAmount: reduced, event: { trig: 'damaged', data: { ...st.event?.data, reducedByBranch: reduced, settledDamage: Number(receipt?.settledAmount) || 0 } } };
          const compareValue = p.compareBase === 'raw_damage' ? Math.floor(before) : reduced;
          helpers.runStmts(ctx, compareValue < threshold ? (p.bodyLow || []) : (p.bodyHigh || []), frame);
        };
      });
      return true;
    },
    // 常駐查詢：印記點數＝技能傷害上限（原 out 模式）；擴充 in 模式（DSH 20261018 第十四批：
    // 「免疫大於N的攻擊傷害」——持有印記期間受到指定類型傷害不超過 fixed，印記層數不消耗）。
    damage_cap_by_mark: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const comp = (st.event?.data?.damageComp || st.event?.data) as any;
      if (!comp) return false;
      const isIn = p.dir === 'in';
      if (isIn) { if (!comp.isIncoming) return false; }
      else { if (comp.isIncoming) return false; }
      if (isIn) {
        if (p.kind && comp.damageCategory !== (p.kind === '攻擊' ? 'skill_attack' : p.kind)) return false;
      } else {
        if (comp.damageCategory !== 'skill_attack') return false;
      }
      const capSide = isIn ? ctx.actor : ctx.targetSide;
      const marks = ((ctx as any).getMarks?.(capSide) || []) as any[];
      const mark = marks.find((m: any) => m.id === p.id);
      const held = Math.max(0, Number(mark?.count) || 0);
      if (!held) return false;
      const cap = isIn ? (p.fixed ?? 0) : held;
      if (!(cap > 0)) return false;
      comp.beforeFinalDamage ||= [];
      (comp.beforeFinalDamage as Array<() => void>).push(() => {
        const stage2 = Math.max(0, comp.base * (1 + (comp.increasePercent || 0)) * Math.max(0, 1 - (comp.decreasePercent || 0)) * (comp.multiplier ?? 1) - (comp.flatReduction || 0));
        const excess = Math.floor(stage2) - cap;
        // immune：「免疫大於N的傷害」＝超過門檻的該筆傷害整筆免疫（不是截成 N）。
        if (excess > 0 && isIn && p.immune === true) {
          comp.multiplier = 0;
          ctx.addLog?.('🚫 免疫大於 ' + cap + ' 點的傷害（本次 ' + Math.floor(stage2) + '）。', 'effect');
        } else if (excess > 0) {
          comp.multiplier = (comp.multiplier ?? 1) * Math.max(0, cap / Math.max(1, Math.floor(stage2)));
          ctx.addLog?.('🚫 ' + (isIn ? '受到傷害上限 ' + cap + ' 點生效！' : '印記點數上限 ' + cap + ' 點生效！'), 'effect');
          if (!isIn && p.deduct) {
            const next = Math.max(0, cap - p.deduct);
            const mark2 = (((ctx as any).getMarks?.(ctx.targetSide) || []) as any[]).find(m => m.id === p.id);
            if (mark2) (ctx as any).setMark?.({ ...mark2, count: next }, ctx.targetSide);
          }
        }
      });
      return true;
    },
    // 結算端：每點通用計數造成自身最大體力 ratio% 的指定類型傷害（計數可消耗）。
    backlash_percent: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const count = Number((ctx as any).getPlayerState?.(p.key)) || 0;
      if (count <= 0) return false;
      const amount = Math.floor((ctx.self?.maxHp || 0) * p.ratio) * count;
      if (amount <= 0) return false;
      if (p.consume) (ctx as any).setPlayerState?.(p.key, 0);
      ctx.addLog?.('💥 依 ' + count + ' 點計數反噬 ' + amount + ' 點' + p.type + '傷害！', 'effect');
      st.lastAmount = helpers.dealDamage(ctx, ctx.actor, amount, p.type, undefined, st);
      return true;
    },
    // 寫入先制封頂（引擎結算讀 oppPriorityCeiling；本行動結束由引擎重置清單統一清除）。
    opp_priority_ceiling: (ctx: BattleEventContext, p: any): boolean => {
      let value = p.value;
      if (p.perMark) {
        const marks = ((ctx as any).getMarks?.((p.perMark.side === 'opp' ? ctx.targetSide : ctx.actor)) || []) as any[];
        const mark = marks.find((m: any) => m.id === p.perMark.id);
        value = (Math.max(0, Number(mark?.count) || 0)) * p.perMark.mult;
      }
      if (!(Number.isFinite(value) && value >= 0)) return false;
      (ctx as any).setPlayerState?.('oppPriorityCeiling', value);
      return true;
    },
  };
}
