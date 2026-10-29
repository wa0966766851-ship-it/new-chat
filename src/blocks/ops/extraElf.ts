// 額外精靈／無序系通用件（legacyWrapped 拆解；組 3：5007 濁、5014 燦、5022、5023）。本檔由組 3 擁有。
// 目前收錄（隨各份定義遷移逐步擴充，契約欄位與執行端同檔，避免觸碰共用檔）：
//  · drain_by_pp_state：雙方技能依「PP 為滿／不為滿」逐個獨立吸取（固定傷害，未減少體力則該次改汲取＝真實傷害）。
//  · deferred_action_damage_sum：排入一次額外行動；行動中不造成傷害，行動結束時以各次攻擊「按屬性克制」的總和
//    對敵方每隻精靈各結算一次技能傷害（在場走正式傷害管線一次、場下直接扣除；場下被擊殺者消逝並轉化能力值）。
import type { BattleEventContext } from '../../effects/types';
import { queueHpDrain } from '../../battle/hpDrain';
import { getTypeMatchup } from '../../utils/statCalculator';
import { getMaxPp } from '../../utils/battleHelpers';

type OpFn = (ctx: BattleEventContext, p: any, st: any) => boolean | void;
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const isObj = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const dead = (e: any) => !e || !!e.isVanished || (e.currentHp ?? 0) <= 0;

/** 契約欄位（登記於 sequenceContract）。 */
export const EXTRA_ELF_ACTION_FIELDS: Record<string, readonly string[]> = {
  drain_by_pp_state: ['state', 'flat', 'sides'],
  deferred_action_damage_sum: ['flat', 'types', 'convertRatio', 'convertMode'],
};

/** 契約補充檢查；回傳 null 代表通過。 */
export function extraElfActionIssue(op: string, p: any): string | null {
  if (!isObj(p)) return '額外精靈通用件參數需為物件';
  if (op === 'drain_by_pp_state') {
    if (!['full', 'notFull'].includes(p.state)) return '依PP狀態吸取需指定「為滿／不為滿」';
    if (!Number.isSafeInteger(p.flat) || p.flat < 1 || p.flat > 100000) return '依PP狀態吸取需1至100000的整數點數';
    if (p.sides !== undefined && (!Array.isArray(p.sides) || !p.sides.length || p.sides.some((s: any) => !['self', 'opp'].includes(s)) || new Set(p.sides).size !== p.sides.length)) return '依PP狀態吸取的範圍只能是自身／對手';
    return null;
  }
  if (op === 'deferred_action_damage_sum') {
    if (!Number.isSafeInteger(p.flat) || p.flat < 1 || p.flat > 100000) return '延後總和傷害需1至100000的整數單次傷害';
    if (!Array.isArray(p.types) || p.types.length < 1 || p.types.length > 12 || p.types.some((t: any) => typeof t !== 'string' || !t || t.length > 20)) return '延後總和傷害需1至12個攻擊屬性';
    if (p.convertRatio !== undefined && !(typeof p.convertRatio === 'number' && p.convertRatio > 0 && p.convertRatio <= 1)) return '擊殺轉化比例需大於0、不超過1';
    if (p.convertMode !== undefined && !['per_stat'].includes(p.convertMode)) return '擊殺轉化模式未接通';
    return null;
  }
  return null;
}

/** 執行端（併入 runtime 的 OPS）。 */
export function extraElfOperations(): Record<string, OpFn> {
  return {
    // 雙方每有 1 個技能 PP 為滿／不為滿：吸取對手 1 次 flat 點（固定傷害＋等量恢復；每次獨立）。
    // 吸取後對手體力未減少（護盾／護罩吸收、滿足免疫等）→ 該次改為汲取 flat 點（真實傷害＋等量恢復）。
    drain_by_pp_state: (ctx, p, st) => {
      const sides: ('self' | 'opp')[] = p.sides ?? ['self', 'opp'];
      const elves = sides.map(s => s === 'self' ? ctx.self : ctx.target);
      let count = 0;
      for (const e of elves) for (const s of (e?.skills || [])) {
        if (s.pp === undefined) continue;
        const full = s.pp >= getMaxPp(s, e);
        if ((p.state === 'full') === full) count++;
      }
      let total = 0;
      for (let i = 0; i < count; i++) {
        // 結算回執在效果佇列處理時才回呼；「吸取後體力未減少」只認實際扣血（護盾／護罩吸收量不算）。
        total += queueHpDrain(ctx, ctx.targetSide, p.flat, 'fixed', '吸取', {
          onSettled: (r: any) => { if (!(r?.hpLost > 0)) queueHpDrain(ctx, ctx.targetSide, p.flat, 'true', '吸取未減少·汲取'); },
        } as any);
      }
      st.lastAmount = total;
      return count > 0;
    },
    // 6 次額外行動的延後總和結算（原文：額外行動期間不會造成傷害，直到行動結束時對方所有精靈受到各次行動造成的傷害總和）。
    deferred_action_damage_sum: (ctx, p) => {
      const ownerId = idOf(ctx.self);
      if (typeof ctx.queueExtraAction !== 'function') return false;
      const label = `終焉·六花斬 ×${p.types.length}`;
      ctx.queueExtraAction(ctx.actor, { label, run: (c: BattleEventContext) => {
        if (idOf(c.self) !== ownerId || dead(c.self)) return 0;
        const opp = c.actor === 'p1' ? 'p2' : 'p1';
        const sumFor = (elf: any) => (p.types as string[]).reduce((a, t) => a + Math.floor(p.flat * getTypeMatchup(t, elf.type)), 0);
        const active: any = opp === 'p1' ? c.activeP1 : c.activeP2;
        let dealt = 0;
        // 在場：總和只進正式傷害管線一次（克制已含在各次的數值內，不重複乘）。
        if (active && !dead(active)) {
          dealt += Number(c.applySkillTypeDamage(opp, sumFor(active), `${label}·總和`, { elem: p.types[0], category: 'skill_extra_action', node: 'extra_action', applyTypeMatchup: false }) || 0);
        }
        // 場下（含已隱匿者不波及）：直接扣除總和；被擊殺者消逝並轉化能力值。
        for (const m of (c.getFullTeam(opp) || []) as any[]) {
          if (!m || idOf(m) === idOf(active) || dead(m) || m.isConcealed) continue;
          const loss = sumFor(m);
          const hp = Math.max(0, m.currentHp - loss);
          c.updateAnyElf(opp, idOf(m), { currentHp: hp } as any);
          c.addLog(`🌑 【終焉·六花斬】：場下【${m.name}】受到 ${loss} 點技能傷害！`, 'damage');
          if (hp <= 0) {
            c.vanishElf(opp, m);
            if (p.convertRatio) {
              const cs: any = (c.self as any).calculatedStats || {};
              const ms: any = m.calculatedStats || {};
              const next: any = { ...cs };
              for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed']) next[k] = (cs[k] || 0) + Math.floor((ms[k] || 0) * p.convertRatio);
              c.updateElf(c.actor, { calculatedStats: next } as any);
              c.addLog(`🌑 【終焉】：【${m.name}】消逝，其能力值 ${Math.round(p.convertRatio * 100)}% 轉化給自身！`, 'effect');
            }
          }
        }
        return dealt;
      } });
      return true;
    },
  };
}
