// 5030 聖靈邁爾斯 聖魂印通用件（DSH 20261018 第十三批；下輪接線）。
// incoming_halve_per_mark{id}：受到非真實傷害時按印記層數「逐次減半」（0.5^count）——
//   八荒「每次受到非真實傷害時減半1次，每有最大體力10%額外減半1次」的乘性讀取端。
//   與印記線性減傷（markDamageReduction＝base＋ratio×count）不同：乘性逐次半減無法線性表達。
// repeat_body{from,key,cap,body}：依 lastAmount（或指定計數計數鍵）執行 body N 次——
//   天佑「已損失體力每有最大體力10%則額外執行1次」的迴圈端（每輪結算：heal 10%＋等量百分比傷害）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { multiplyDamageReduction } from '../../battle/damageReduction';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const HOLY_MILES_ACTION_FIELDS: Record<string, readonly string[]> = {
  damage_multiplier_steps: ['base', 'kind'],
  incoming_halve_per_mark: ['id'],
  repeat_body: ['from', 'key', 'cap', 'body'],
  // 登場時快照（體力＋各技能PP）／下場時還原為登場時狀態。
  entry_state_snapshot: [],
  entry_state_restore: [],
  // 被擊敗時：死亡傷害來源受到等同於自身被擊敗時所受技能傷害×ratio 的真實傷害（trig='defeated' 專用；場下可觸發）。
  death_source_reflect: ['ratio'],
  // 以 st.lastAmount 直接設定印記層數（回合開始八荒「1＋每10%體力」等階梯型層數）。
  resource_mark_set: ['id', 'name', 'displayChar', 'unit', 'side', 'scope', 'persistsOffField', 'description', 'fromLastAmount'],
  // 技能傷害保底：base × 2^doubles（doubles 讀 st.lastAmount 或指定鍵）；技能無效時再翻倍1次。
  damage_floor_steps: ['base', 'doublesFrom', 'perStep', 'invalidExtraDouble', 'invalidTimerId'],
};

export function holyMilesActionIssue(op: string, p: any, nested?: (body: any[], trig: string) => string | null, trig?: string): string | null {
  if (op === 'damage_multiplier_steps') return Number.isFinite(p.base) && p.base >= 1 && p.base <= 10 && ['攻擊', '技能'].includes(p.kind) ? null : '階梯倍率需1至10基數及技能範圍';
  if (op === 'incoming_halve_per_mark') {
    if (typeof p.id !== 'string' || !p.id || p.id.length > 200) return '逐次減半需明確印記ID';
    return null;
  }
  if (op === 'entry_state_snapshot' || op === 'entry_state_restore') return null;
  if (op === 'resource_mark_set') {
    if (typeof p.id !== 'string' || !p.id || p.id.length > 200) return '印記設定需明確ID';
    if (!['self', 'opp'].includes(p.side) || !['elf', 'team'].includes(p.scope)) return '印記設定需明確持有者與作用域';
    if (typeof p.persistsOffField !== 'boolean') return '印記設定需明確保留規則';
    if (!['層', '道', '點', '篇', '枚', '株', '回合'].includes(p.unit)) return '印記設定需明確單位';
    return null;
  }
  if (op === 'damage_floor_steps') {
    if (!(p.base > 0) || p.base > 100000) return '傷害保底需正基數';
    if (!['lastAmount', 'counter'].includes(p.doublesFrom || 'lastAmount')) return '保底翻倍次數需來自 lastAmount 或 counter';
    if (p.perStep !== undefined && (!(p.perStep >= 1) || p.perStep > 100)) return '每階翻倍倍率需1至100';
    return null;
  }
  if (op === 'death_source_reflect') {
    if (!(p.ratio > 0) || p.ratio > 10) return '死亡反饋需正比例（至多10倍）';
    if (trig !== 'defeated') return '死亡反饋需在被擊敗節點執行';
    return null;
  }
  if (op === 'repeat_body') {
    if (p.from !== undefined && !['lastAmount', 'counter'].includes(p.from)) return '迴圈次數來源需為 lastAmount 或 counter';
    if (p.from === 'counter' && (typeof p.key !== 'string' || !p.key)) return '計數迴圈需明確鍵名';
    if (!Number.isInteger(p.cap ?? 20) || (p.cap ?? 20) < 1 || (p.cap ?? 20) > 100) return '迴圈上限需1至100整數';
    if (!Array.isArray(p.body) || !p.body.length) return '迴圈需非空主體';
    if (nested) { const issue = nested(p.body, 'round_end'); if (issue) return '迴圈主體：' + issue; }
    return null;
  }
  return null;
}

const entryKey = (id: string) => `blkEntryState:${id}`;
/** ON_ENTRANCE／ON_SWITCH_OUT 的 ctx 可能尚未繫結新精靈——沿用 rosterStats 的 fallback 鏈。 */
const resolveSelf = (ctx: BattleEventContext): any =>
  (ctx as any).self ?? (ctx as any).effectEventData?.elf ?? (ctx as any).effectEventData?.incomingElf
  ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);

export function holyMilesOperations(helpers: { runStmts: (ctx: BattleEventContext, body: any[], st: RunState) => void }) {
  return {
    damage_multiplier_steps: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const steps = Math.min(20, Math.max(0, Math.floor(st.lastAmount)));
      ctx.addTimerTo(ctx.actor, { id: `block_step_multiplier:${idOf(ctx.self)}`, name: '本回合階梯傷害倍率', kind: 'round_counter', source: 'soulmark', remaining: 1, tickAt: 'round_end',
        payload: { block: { dmgOutMult: Math.pow(p.base, steps), kind: p.kind } } }, false);
      return true;
    },
    // 登場時快照：目前體力＋各技能 PP（個體鍵；重複登場覆寫為新的登場狀態）。
    entry_state_snapshot: (ctx: BattleEventContext): boolean => {
      const self = resolveSelf(ctx);
      if (!self) return false;
      ctx.setPlayerState(entryKey(idOf(self)), {
        hp: Number(self.currentHp) || 0,
        pp: (self.skills || []).map((s: any) => ({ name: s.name, pp: Number(s.pp) || 0 })),
      });
      return true;
    },
    // 下場時還原：體力（夾回目前上限）與各技能 PP 重置為登場時快照。無快照＝不動。
    entry_state_restore: (ctx: BattleEventContext): boolean => {
      const self = resolveSelf(ctx);
      if (!self) return false;
      const snap = ctx.getPlayerState(entryKey(idOf(self)));
      if (!snap) return false;
      const byName = new Map<string, number>((snap.pp || []).map((x: any) => [x.name, x.pp] as [string, number]));
      const skills = (self.skills || []).map((s: any) => byName.has(s.name)
        ? { ...s, pp: byName.get(s.name), ...(s.currentPp !== undefined ? { currentPp: byName.get(s.name) } : {}) } : s);
      ctx.updateElf(ctx.actor, { currentHp: Math.max(1, Math.min(Number(self.maxHp) || snap.hp, snap.hp)), skills } as any);
      ctx.addLog?.(`🔁 【${self.name}】下場：體力與PP重置為登場時狀態。`, 'effect');
      return true;
    },
    // 常駐查詢（before_damage/incoming）：依印記層數把本次非真實傷害乘 0.5^count（逐次減半）。
    incoming_halve_per_mark: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const comp = (st.event?.data?.damageComp || st.event?.data) as any;
      if (!comp || !comp.isIncoming) return false;
      if (comp.damageCategory === 'true' || comp.pure || comp.noReduction) return false;
      const marks = ((ctx as any).getMarks?.(ctx.actor) || []) as any[];
      const mark = marks.find((m: any) => m.id === p.id);
      const count = Math.max(0, Math.min(20, Number(mark?.count) || 0));
      if (count <= 0) return false;
      multiplyDamageReduction(comp, Math.pow(0.5, count));
      return true;
    },
    // 以 lastAmount 設定印記層數（階梯型層數：八荒「1＋每10%體力」）。
    resource_mark_set: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const n = Math.max(0, Math.floor(Number(st.lastAmount) || 0));
      const cap = p.cap ?? 100;
      const count = Math.min(cap, n);
      const side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const add = (ctx as any).addMark ?? (ctx as any).setMark;
      if (!add) return false;
      add({ id: p.id, name: p.name, displayChar: p.displayChar, unit: p.unit, scope: p.scope, persistsOffField: p.persistsOffField, description: p.description, count }, side);
      return true;
    },
    // 技能傷害保底：base × 2^doubles（doubles＝lastAmount）；技能無效時再翻倍1次（預掛計時器）。
    damage_floor_steps: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const comp = (st.event?.data?.damageComp || st.event?.data) as any;
      if (!comp || comp.isIncoming) return false;
      if (comp.damageCategory !== 'skill_attack') return false;
      const doubles = Math.max(0, Math.floor(Number(st.lastAmount) || 0));
      const per = p.perStep ?? 2;
      const floor = Math.floor(p.base * Math.pow(per, doubles));
      comp.floor = Math.max(comp.floor || 0, floor);
      if (comp.base <= floor) comp.pure = true;
      // 正常命中：消耗預掛的無效重結算 timer，避免殘留到下回合誤觸。
      try { (ctx as any).consumeTimer?.(ctx.actor, 'blk_' + ctx.actor + '_' + (p.invalidTimerId || 'floor_invalid')); } catch { /* 隔離 ctx 無 timer，略過 */ }
      return true;
    },
    // 迴圈端：N＝lastAmount（或計數鍵值），依序執行 body N 次（每次以獨立 st 快照跑，lastAmount 於每輪後保留供 heal_equal 等讀取）。
    repeat_body: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const n = p.from === 'counter'
        ? Math.max(0, Math.floor(Number(ctx.getPlayerState?.(p.key)) || 0))
        : Math.max(0, Math.floor(Number(st.lastAmount) || 0));
      const cap = p.cap ?? 20;
      const times = Math.min(cap, n);
      if (times <= 0) return false;
      for (let i = 0; i < times; i++) helpers.runStmts(ctx, p.body, st);
      return true;
    },
  };
}
