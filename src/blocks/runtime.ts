import { addDamageReduction, multiplyDamageReduction } from '../battle/damageReduction';
import { queueActionDamageModifier, queueActionPowerMultiplier } from '../battle/actionDamageModifiers';
import { queueHpDrain } from '../battle/hpDrain';
import { bypassesAttackDefense } from '../battle/attackDefense';
import { isSkillDamageType, isNonTrueDamageType } from '../battle/damageSemantics';
import { matchesDamageTypes } from '../effects/damageChoices';
// 積木執行器：把 Program（parse.ts 產生）在戰鬥中執行。
import type { Act, Clause, Cond, Program, Stmt, Trigger } from "./model";
import type { BattleEventContext } from "../effects/types";
import { EffectTiming } from "../effects/types";
import { prdPercent } from "../utils/prd";
import { executeTemplateEffect } from "../effects/templateEngine";
import { STAT_KEYS, matchCond } from "./parse";
const matchCondText = (t?: string) => { const c = t ? matchCond(String(t).replace(/^[，,\s]*(?:若)?/, "")) : null; return c && c.c !== "text" ? c : null; };
import { CUSTOM } from "./custom";
import { getTypeMatchup } from "../utils/statCalculator";
import { statusChanceBlocked } from '../battle/statusChanceRules';
import { settleDamageAbsorption } from '../battle/damageSemantics';
import { StatusRegistry } from '../effects/statusRegistry';
import { canonicalStatusName } from '../effects/statusIdentity';
import { removeStatusEffect } from '../utils/battleHelpers';

type S = "p1" | "p2";
export interface RunState {
  last: boolean | null; // 上一個動作是否成功（消除成功／觸發）
  lastAmount: number; // 上一個動作的數值（等量）
  lastStmt?: Stmt;
  prevOp?: string;
  survived?: boolean;
  lastDealt?: number;
  maxHpBeforeChange?: Partial<Record<S, number>>;
  conditionSnapshots?: Map<string, boolean | undefined>;
  event?: { trig: Trigger; data?: any };
  /** 本次事件中已執行句子的成敗（「任一項未觸發」） */
  history?: boolean[];
  historyTrig?: Trigger;
  /** 下一句以「附加後對手體力未減少」為條件：延後到實際扣血結算（OPPONENT_DAMAGE.hpReduced） */
  deferNoDmg?: Stmt;
  deferred?: Set<Stmt>;
}

const DYNAMIC_CONDS = new Set(["success", "triggered", "fail", "kill", "nokill", "dmg_cmp", "last_no_dmg", "invalid", "weak"]);
const condKey = (c: Cond) => `${c.c}:${JSON.stringify(c.p || {})}`;
function snapshotConditions(ctx: BattleEventContext, clauses: Clause[], st: RunState) {
  st.conditionSnapshots ||= new Map();
  for (const clause of clauses) {
    for (const c of [...(clause.cond || []), ...clause.body.flatMap(s => s.cond || [])]) {
      if (!DYNAMIC_CONDS.has(c.c) && !st.conditionSnapshots.has(condKey(c))) st.conditionSnapshots.set(condKey(c), evalCond(ctx, c, st));
    }
  }
}
const evalEventCond = (ctx: BattleEventContext, c: Cond, st: RunState) => {
  const key = condKey(c);
  return (st.conditionSnapshots?.has(key) ? st.conditionSnapshots.get(key) : evalCond(ctx, c, st)) === true;
};

export const DEFAULT_STATUS_TURNS = 3; // 異常未特別定義回合數時預設 3 回合
const STATUS_DURATION: Record<string, number> = { 中毒: 3, 燒傷: 3, 寄生: 3, 凍傷: 3, 衰弱: 3, 流血: 3 };
const sideOf = (ctx: BattleEventContext, w: string): S => (w === "self" ? ctx.actor : ctx.targetSide);
const elfOf = (ctx: BattleEventContext, side: S): any => (side === "p1" ? ctx.activeP1 : ctx.activeP2);
const idOf = (e: any) => String(e?.battleId || e?.id || "");
/** 同一回合內讀取場上最新精靈（ctx.activeP1/P2 是建立 ctx 當下的快照） */
export function liveElf(ctx: BattleEventContext, side: S): any {
  const base = elfOf(ctx, side) || (side === ctx.targetSide ? ctx.target : side === ctx.actor ? ctx.self : undefined);
  if (!base) return base;
  return (ctx.getFullTeam?.(side) || []).find((e: any) => idOf(e) === idOf(base)) || base;
}
const chance = (ctx: BattleEventContext, tag: string, pct: number) => pct >= 100 || prdPercent(`${ctx.actor}:${ctx.self?.id}:${ctx.skill?.name ?? "soul"}:blk:${tag}`, pct);

const hasAbn = (ctx: BattleEventContext, elf: any) => Object.values(ctx.getStatuses ? ctx.getStatuses(elf) : {}).some((v: any) => (v as number) > 0);
const hasStage = (elf: any, up: boolean) => Object.values(elf?.statStages || {}).some((v: any) => typeof v === "number" && (up ? v > 0 : v < 0));

function resetStages(ctx: BattleEventContext, side: S, pick: (v: number) => boolean): boolean {
  const elf = elfOf(ctx, side);
  const stages: Record<string, number> = { ...(elf?.statStages || {}) };
  let changed = false;
  for (const k in stages) if (typeof stages[k] === "number" && pick(stages[k])) { stages[k] = 0; changed = true; }
  if (changed) ctx.updateElf(side, { statStages: stages as any });
  return changed;
}

function cmp(a: number, op: string, b: number): boolean {
  if (/不高於|不大於/.test(op)) return a <= b;
  if (/不低於|不小於/.test(op)) return a >= b;
  if (/高於|大於/.test(op)) return a > b;
  if (/低於|小於/.test(op)) return a < b;
  return false;
}

// ───────── 條件 ─────────
export function evalCond(ctx: BattleEventContext, c: Cond, st: RunState): boolean | undefined {
  const p = c.p || {};
  const self: any = ctx.self, opp: any = ctx.target;
  const pick = (w: string) => (w === "self" ? self : opp);
  switch (c.c) {
    case "first": return ctx.goesFirst === true || ctx.moveIndex === 0;
    case "last": return !(ctx.goesFirst === true || ctx.moveIndex === 0);
    case "success": case "triggered": return st.last === true;
    case "fail": return st.last === false;
    case "kill": return (opp?.currentHp ?? 1) <= 0;
    case "nokill": return (opp?.currentHp ?? 1) > 0;
    case "has_status": {
      const sides = p.side === "both" ? [self, opp] : [pick(p.side)];
      return sides.some(e => ((ctx.getStatuses(e) || {})[p.status] || 0) > 0);
    }
    case "abnormal": {
      const r = p.side === "any" ? hasAbn(ctx, self) || hasAbn(ctx, opp) : hasAbn(ctx, pick(p.side));
      return p.neg ? !r : r;
    }
    case "stage": { const r = hasStage(pick(p.side), p.kind === "up"); return p.neg ? !r : r; }
    case "hp_ratio": { const e = pick(p.side); return cmp(e.currentHp, p.op, e.maxHp * p.ratio); }
    case "hp_cmp": { const a = pick(p.side), b = p.side === "self" ? opp : self; return cmp(a.currentHp, p.op, b.currentHp); }
    case "shield": { const e = pick(p.side); const r = ((e?.shield || 0) + (e?.barrier || 0)) > 0; return p.neg ? !r : r; }
    case "hp_full": { const e = pick(p.side); return !!e && e.currentHp >= e.maxHp; }
    case "no_skill_dmg": return ctx.getPlayerState(p.kind === "攻擊" ? "blkAttackDmgTakenRound" : "blkSkillDmgTakenRound") !== (ctx.roundNumber ?? 0);
    case "invalid": return st.event?.trig === "on_invalid" || st.event?.trig === "self_invalid";
    case "weak": {
      const reg = ctx.getPlayerState("blkLastTypeMult");
      const m = typeof reg === "number" ? reg : getTypeMatchup(ctx.skill?.type || "", opp?.type || "");
      return m > 0 && m < 1;
    }
    case "text": { const re = matchCondText(p.text); return re ? evalCond(ctx, re, st) : false; }
    case "pp_full": { const sk = ctx.skill; return !!sk && (sk.pp ?? 0) >= (sk.maxPp ?? sk.pp ?? 0); }
    case "dmg_cmp": return cmp(st.event?.data?.dealt ?? ctx.getPlayerState("blkLastHitDamage") ?? 0, p.op, p.v);
    case "event_status": return (p.statuses || []).includes(st.event?.data?.status);
    case "type_is": return String((p.side === "self" ? self : opp)?.type || "").includes(p.type);
    case "enemy": return getTypeMatchup(opp?.type || "", self?.type || "") >= 2;
    case "self_enemy": return getTypeMatchup(self?.type || "", opp?.type || "") >= 2;
    case "crit": return !!ctx.getPlayerState("blkLastCrit");
    case "last_no_dmg": return st.lastDealt === 0;
    case "has_mark": return (ctx.getMarks(p.side === "self" ? ctx.actor : ctx.targetSide) || []).some((m: any) => (m.name === p.name || m.id === `blk_${p.name}`) && (m.count || 0) > 0);
    default: return undefined;
  }
}

// ───────── 傷害分類 ─────────
/** kind：攻擊＝攻擊技能公式傷害；技能＝技能傷害（攻擊＋X系技能傷害）；非真實；空＝全部 */
export function compMatchesKind(comp: any, kind?: string): boolean {
  const scopes: Record<string, string> = { 攻擊: 'attack', 技能: 'skill', 非真實: 'non_true', 固定: 'fixed', 百分比: 'percent', 真實: 'true' };
  return kind ? !!scopes[kind] && matchesDamageTypes([scopes[kind]], comp.damageCategory) : true;
}

// ───────── 動作 ─────────
type OpFn = (ctx: BattleEventContext, p: any, st: RunState) => boolean | void;

function applyStatus(ctx: BattleEventContext, side: S, status: string, turns?: number): boolean {
  const r = ctx.applyStatusWithImmunityCheck(side, status, turns ?? STATUS_DURATION[status] ?? DEFAULT_STATUS_TURNS);
  if (r.success) ctx.addLog(`💫 【${elfOf(ctx, side)?.name}】陷入了【${status}】！`, "status");
  return !!r.success;
}

const RT_TYPE: Record<string, string> = { 真實: "true", 固定: "fixed", 百分比: "percent", 技能: "skill_attribute" };
/** 造成傷害：回傳實際結算量（引擎回傳的最終傷害；0 就是 0，不以名目值代替）。
 *  st.lastDealt＝扣除護盾／護罩吸收後的預估扣血量（「對手體力未減少」）。 */
function dealDamage(ctx: BattleEventContext, side: S, amt: number, type: string, elem?: string, st?: RunState): number {
  const before = liveElf(ctx, side);
  if (st?.deferNoDmg) registerNoDmgFollowUp(ctx, side, type, st);
  const r = dealDamage0(ctx, side, amt, type, elem);
  if (st) st.lastDealt = Math.min(Math.max(0, before?.currentHp ?? r), settleDamageAbsorption(r, RT_TYPE[type] as any || "percent", before?.shield || 0, before?.barrier || 0).amount);
  return r;
}
function dealDamage0(ctx: BattleEventContext, side: S, amt: number, type: string, elem?: string): number {
  amt = Math.max(0, Math.floor(amt));
  if (amt <= 0) return 0;
  const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  if (type === "真實") return num(ctx.applyTrueDamage(side, amt, "真實傷害"));
  if (type === "固定") return num(ctx.applyFixedDamage(side, amt, "固定傷害"));
  if (type === "技能") return num(ctx.applySkillTypeDamage(side, amt, `${elem || ""}系技能傷害`, { elem, node: "attack_damage" }));
  return num(ctx.applyPinkDamage(side, amt, "百分比傷害", undefined, undefined, "percent"));
}

/** 實際恢復量（預估）：禁療為 0；不超過已損失體力；扣除印記的恢復減少 */
export function actualHeal(ctx: BattleEventContext, side: S, amt: number): number {
  const e = liveElf(ctx, side);
  if (!e || amt <= 0) return 0;
  const own = side === ctx.actor ? ctx.getPlayerState : ctx.getOpponentState;
  const other = side === ctx.actor ? ctx.getOpponentState : ctx.getPlayerState;
  if ((own(`noHealTurns`) || 0) > 0 || (own(`${side}_noHealTurns`) || 0) > 0 || (other(`${side}_noHealTurns`) || 0) > 0 || (other("oppSealHealTurns") || 0) > 0) return 0;
  let mult = 1;
  for (const mk of (ctx.getMarks?.(side) || []) as any[]) { const hr = mk.effects?.blkHealReduce; if (hr) mult = Math.max(0, mult - hr * (mk.effects?.blkHealPerStack ? mk.count : 1)); }
  return Math.max(0, Math.min(Math.floor(amt * mult), (e.maxHp || 0) - (e.currentHp || 0)));
}
function heal(ctx: BattleEventContext, side: S, amt: number): number {
  const real = actualHeal(ctx, side, Math.floor(amt));
  ctx.applyHeal(side, Math.floor(amt));
  return real;
}

/** 「附加後若對手體力未減少則…」：以實際扣血結算（OPPONENT_DAMAGE 的 hpReduced）判定 */
function registerNoDmgFollowUp(ctx: BattleEventContext, side: S, type: string, st: RunState) {
  const stmt = st.deferNoDmg!; st.deferNoDmg = undefined; (st.deferred ||= new Set()).add(stmt);
  const list = [...(ctx.getPlayerState("blkNoDmgPending") || [])].filter((x: any) => x.round === (ctx.roundNumber ?? 0));
  list.push({ round: ctx.roundNumber ?? 0, side, type: RT_TYPE[type] || "percent", body: [{ ...stmt, cond: (stmt.cond || []).filter(c => c.c !== "last_no_dmg") }] });
  ctx.setPlayerState("blkNoDmgPending", list);
}
/** 我方造成的傷害結算後（OPPONENT_DAMAGE）：檢查待決的「體力未減少」追加 */
export function settleNoDmgFollowUps(ctx: BattleEventContext, data: any) {
  const list: any[] = ctx.getPlayerState("blkNoDmgPending") || [];
  if (!list.length || !data) return;
  const dt = String(data.damageType || data.rawDamageType || "");
  const idx = list.findIndex(x => x.side === data.targetSide && (dt === x.type || (x.type === "skill_attribute" && /skill/.test(dt)) || (x.type === "true" && /true|absorb/.test(dt))));
  if (idx < 0) return;
  const [hit] = list.splice(idx, 1);
  ctx.setPlayerState("blkNoDmgPending", list);
  if ((data.hpReduced ?? 1) > 0) return;
  runStmts(ctx, hit.body, { last: null, lastAmount: 0 });
}

/** 回合類效果的登錄狀態鍵：以 turn_effect 計時器鏡像，「消除回合類效果」時一併歸零並算消除成功 */
function mirrorTurn(ctx: BattleEventContext, side: S, name: string, turns: number, keys: string[]) {
  if (!(turns > 0) || turns >= 99) return;
  ctx.addTimerTo(side, {
    id: `blk_${side}_${ctx.skill?.name || ctx.self?.name || "src"}_${name}_mirror`, name, kind: "turn_effect", source: "skill" as any,
    remaining: turns, tickAt: "round_end", stackRule: "refresh", displayChar: name[0], description: name,
    payload: { mirrorRegistryKeys: keys, block: { mirror: true, owner: side, src: ctx.skill?.name || ctx.self?.name } },
  } as any, false);
}
const isSkillCtx = (st: RunState) => !st.event || st.event.trig === "use" || st.event.trig === "after_hit" || st.event.trig === "on_invalid";
/** 技能附加且以回合計數 → 回合類效果；魂印附加的不可被消除 */
function setTurnKey(ctx: BattleEventContext, side: S, st: RunState, name: string, kv: Record<string, any>, turnsKey: string) {
  const set = side === ctx.actor ? ctx.setPlayerState : ctx.setOpponentState;
  for (const [k, v] of Object.entries(kv)) set(k, v);
  if (isSkillCtx(st)) mirrorTurn(ctx, side, name, Number(kv[turnsKey]) || 0, Object.keys(kv).filter(k => typeof kv[k] === "number" || typeof kv[k] === "boolean"));
}

// ───────── 異常免疫（分類） ─────────
const CLS_CAT: Record<string, string> = { 控制類: "CONTROL", 弱化類: "WEAKENING" };
export function statusInClass(status: string, cls: string): boolean {
  if (!cls) return true;
  const e = StatusRegistry[canonicalStatusName(status)] || StatusRegistry[status];
  const cats: string[] = (e?.categories || []) as any;
  if (cls === "非附屬類") return !cats.some(c => c === "AUXILIARY" || c === "BOSS_ONLY" || c === "NO_EFFECT");
  return cats.includes(CLS_CAT[cls]);
}
/** 引擎附加異常前查詢：積木「N回合內免疫(並反彈)X類異常」→ "reflect" | "immune" | null */
export function blockStatusGuard(timers: any[] | undefined, elf: any, status: string): "reflect" | "immune" | null {
  let res: "reflect" | "immune" | null = null;
  for (const t of timers || []) {
    const g = t.payload?.block?.statusGuard;
    if (!g || (t.remaining ?? 0) <= 0 || t.pendingActivation) continue;
    if (t.ownerBattleId && elf && t.ownerBattleId !== (elf.battleId || elf.id)) continue;
    if (!statusInClass(status, g.cls)) continue;
    if (g.reflect) return "reflect";
    res = "immune";
  }
  return res;
}

export const OPS: Record<string, OpFn> = {
  noop: () => true,
  note: () => true,
  status: (ctx, p, st) => {
    const sides: S[] = p.side === "both" ? [ctx.targetSide, ctx.actor] : [sideOf(ctx, p.side)];
    let ok = false;
    if (statusChanceBlocked(ctx, p.chance ?? 100) || !chance(ctx, `st:${p.status}`, p.chance ?? 100)) return false;
    for (const s of sides) ok = applyStatus(ctx, s, p.status, p.turns) || ok;
    return ok;
  },
  status_chance_turns: (ctx, p, st) => OPS.status(ctx, p, st),
  status_seq: (ctx, p) => { if (p.chance != null && (statusChanceBlocked(ctx, p.chance) || !chance(ctx, `seq:${p.list}`, p.chance))) return false; let any = false; for (const s of p.list) any = applyStatus(ctx, ctx.targetSide, s) || any; return any; },
  status_random: (ctx, p) => {
    const pool = p.cls === "控制類" ? ["麻痺", "害怕", "疲憊", "石化", "睡眠"] : p.cls === "弱化類" ? ["中毒", "燒傷", "凍傷", "衰弱", "流血", "混亂"] : ["麻痺", "害怕", "疲憊", "中毒", "燒傷", "凍傷", "衰弱", "混亂"];
    const r = ctx.rng || Math.random; const picked = new Set<string>();
    while (picked.size < Math.min(p.count, pool.length)) picked.add(pool[Math.floor(r() * pool.length)]);
    let any = false; picked.forEach(s => { any = applyStatus(ctx, ctx.targetSide, s) || any; }); return any;
  },
  cure_status: (ctx, p) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false;
    for (const s of sides) { const e = elfOf(ctx, s); if (hasAbn(ctx, e)) { ctx.updateElf(s, { effects: [], battleStatuses: {}, battleStatus: "normal", battleStatusDuration: 0 } as any); any = true; } }
    if (any) ctx.addLog(`🌿 解除了異常狀態！`, "status");
    return any;
  },
  convert_status: (ctx, p) => {
    const side = sideOf(ctx, p.side); const e = liveElf(ctx, side);
    if (!hasAbn(ctx, e)) return false;
    ctx.updateElf(side, { effects: [], battleStatuses: {}, battleStatus: "normal", battleStatusDuration: 0 } as any);
    return applyStatus(ctx, side, p.status);
  },
  immune_status_count: (ctx, p) => { ctx.setPlayerState(p.reflect ? "blkReflectStatusCount" : "blkImmuneStatusCount", (ctx.getPlayerState(p.reflect ? "blkReflectStatusCount" : "blkImmuneStatusCount") || 0) + p.count); ctx.addLog(`🛡️ 免疫${p.reflect ? "並反彈" : ""}下 ${p.count} 次異常狀態！`, "effect"); return true; },
  immune_status_turns: (ctx, p, st) => {
    if (p.cls) {
      // 分類免疫（控制類／弱化類／非附屬類）：引擎附加異常前以 blockStatusGuard 依分類判定
      addBlockTimer(ctx, ctx.actor, `免疫${p.reflect ? "並反彈" : ""}${p.cls}異常`, p.turns, "turns", { statusGuard: { cls: p.cls, reflect: !!p.reflect } }, false, isSkillCtx(st) ? "turn_effect" : "round_counter");
    } else {
      const key = p.reflect ? "reflectStatusTurns" : "immuneStatusTurns";
      setTurnKey(ctx, ctx.actor, st, `免疫${p.reflect ? "並反彈" : ""}異常`, { [key]: Math.max(p.turns, ctx.getPlayerState(key) || 0) }, key);
    }
    ctx.addLog(`🛡️ ${p.turns} 回合內免疫${p.reflect ? "並反彈" : ""}${p.cls || ""}異常狀態！`, "effect"); return true;
  },
  immune_status_perm: (ctx) => { ctx.setPlayerState("immuneStatusTurns", 999); return true; },
  immune_statdown_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.actor, st, "免疫能力下降", { immuneStatDownTurns: p.turns }, "immuneStatDownTurns"); return true; },

  stat_clear: (ctx, p, st) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false;
    for (const s of sides) any = resetStages(ctx, s, v => (p.kind === "up" ? v > 0 : p.kind === "down" ? v < 0 : v !== 0)) || any;
    if (any) ctx.addLog(`🧹 消除了能力${p.kind === "up" ? "提升" : p.kind === "down" ? "下降" : "變化"}狀態！`, "status");
    return any;
  },
  stat_steal: (ctx, p) => {
    const opp: any = ctx.target; const gains: Record<string, number> = {}; let any = false;
    for (const k in (opp.statStages || {})) { const v = opp.statStages[k]; if (typeof v === "number" && v > 0) { gains[k] = v * (p.double ? 2 : 1); any = true; } }
    if (!any) return false;
    ctx.applyStatChange(ctx.actor, gains);
    if (p.mode === "吸取") resetStages(ctx, ctx.targetSide, v => v > 0);
    return true;
  },
  stat_reverse: (ctx, p) => {
    const side = sideOf(ctx, p.side); const e = elfOf(ctx, side);
    const stages: Record<string, number> = { ...(e?.statStages || {}) }; let any = false;
    for (const k in stages) { const v = stages[k]; if (typeof v === "number" && (p.kind === "down" ? v < 0 : v > 0)) { stages[k] = -v; any = true; } }
    if (any) ctx.updateElf(side, { statStages: stages as any });
    return any;
  },
  stat_transfer: (ctx) => { executeTemplateEffect("0056", [], ctx); return true; },
  stat: (ctx, p) => {
    if (!chance(ctx, `stat:${p.stats}`, p.chance ?? 100)) return false;
    const apply = (side: "self" | "opp" | "both" | "auto", stats: string[], v: number) => {
      const who = side === "auto" ? (v > 0 ? "self" : "opp") : side;
      const sides: S[] = who === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, who)];
      const ch: Record<string, number> = {};
      for (const s of stats) for (const k of STAT_KEYS[s] || []) ch[k] = v;
      for (const s of sides) ctx.applyStatChange(s, ch);
    };
    apply(p.side, p.stats, p.v);
    if (p.stats2) apply(p.side2, p.stats2, p.v2);
    return true;
  },

  heal: (ctx, p, st) => { const side = sideOf(ctx, p.side); const e = liveElf(ctx, side); const amt = Math.floor(e.maxHp * p.ratio); const real = heal(ctx, side, amt); st.lastAmount = real; ctx.addLog(`💚 恢復了 ${real} 點體力！`, "heal"); return real > 0; },
  heal_flat: (ctx, p, st) => { st.lastAmount = heal(ctx, ctx.actor, p.amount); return st.lastAmount > 0; },
  heal_equal: (ctx, _p, st) => {
    // 「傷害提升X%並恢復等量體力」：等量＝本次攻擊傷害（只含攻擊傷害）
    if (st.prevOp === "boost") {
      ctx.setPlayerState("vampireRatio", 1);
      ctx.setPlayerState("vampireDamageTypesThisAction", ["attack"]);
      return true;
    }
    if (!st.lastAmount) return false; const real = heal(ctx, ctx.actor, st.lastAmount); st.lastAmount = real; return real > 0;
  },
  dmg_from_last: (ctx, p, st) => { if (!st.lastAmount) return false; st.lastAmount = dealDamage(ctx, ctx.targetSide, st.lastAmount * p.ratio, p.type, p.elem, st); return true; },
  vampire: (ctx, p, st) => {
    // 傷害結算後（afterHit 句）：等量＝實際攻擊傷害×比例
    if (st.event?.trig === "after_hit") { st.lastAmount = Math.floor((ctx.getPlayerState("blkLastHitDamage") || 0) * p.ratio); return st.lastAmount > 0; }
    ctx.setPlayerState("vampireRatio", p.ratio); ctx.setPlayerState("vampireDamageTypesThisAction", [p.kind === "攻擊" ? "attack" : "skill"]); return true; },
  maxhp: (ctx, p, st) => {
    const side = sideOf(ctx, p.side); const e = elfOf(ctx, side);
    st.maxHpBeforeChange ||= {};
    st.maxHpBeforeChange[side] ??= e.maxHp;
    const newMax = Math.max(1, Math.floor(e.maxHp * (1 + p.ratio)));
    ctx.updateElf(side, { maxHp: newMax, currentHp: Math.min(e.currentHp, newMax) } as any);
    ctx.addLog(`❤️ 【${e.name}】體力上限變為 ${newMax}！`, "effect");
    return true;
  },
  dmg: (ctx, p, st) => {
    if (p.flat != null) {
      if (p.both) { dealDamage(ctx, ctx.actor, p.flat, p.type); }
      st.lastAmount = dealDamage(ctx, ctx.targetSide, p.flat, p.type, p.elem, st); return true;
    }
    const base = elfOf(ctx, sideOf(ctx, p.of));
    if (p.base === "護盾值") { const sv = base?.shield || 0; if (sv <= 0) return false; st.lastAmount = dealDamage(ctx, ctx.targetSide, sv * p.ratio, p.type, undefined, st); return true; }
    let v = p.base === "當前體力" ? base.currentHp : p.base === "已損失體力" ? base.maxHp - base.currentHp : base.maxHp;
    if (String(p.base).startsWith("stat:")) {
      const cs = base.calculatedStats || {}; const key: Record<string, string[]> = { 攻擊和特攻: ["atk", "spatk"], 攻擊: ["atk"], 特攻: ["spatk"], 防禦: ["def"], 特防: ["spdef"], 速度: ["speed"] };
      v = (key[p.base.slice(5)] || []).reduce((a, k) => a + (cs[k] || 0), 0);
    }
    st.lastAmount = dealDamage(ctx, ctx.targetSide, v * p.ratio, p.type, undefined, st);
    return true;
  },
  dmg_equal: (ctx, p, st) => { if (!st.lastAmount) return false; st.lastAmount = dealDamage(ctx, ctx.targetSide, st.lastAmount, p.type, undefined, st); return true; },
  drain: (ctx, p, st) => {
    const t: any = liveElf(ctx, ctx.targetSide);
    const amt = p.flat != null ? p.flat : p.cur ? Math.floor(t.currentHp * p.ratioCur) : Math.floor(t.maxHp * p.ratio);
    const kind = p.true ? "true" : p.flat != null ? "fixed" : "percent";
    if (st.deferNoDmg) registerNoDmgFollowUp(ctx, ctx.targetSide, kind === "true" ? "真實" : kind === "fixed" ? "固定" : "百分比", st);
    st.lastAmount = queueHpDrain(ctx, ctx.targetSide, amt, kind); st.lastDealt = st.lastAmount;
    return st.lastAmount > 0;
  },
  mercy: (ctx) => { ctx.setPlayerState("mercyThisAction", true); return true; },
  boost: (ctx, p, st) => {
    const comp = st.event?.data?.damageComp || (st.event?.data?.base != null ? st.event.data : null);
    if (p.power && comp) return false; // 威力需在公式前處理，不能當傷害倍率。
    if (p.power) { queueActionPowerMultiplier(ctx, p.mult); return true; }
    if (comp) { if (comp.isIncoming || !compMatchesKind(comp, p.kind || "攻擊")) return false; comp.increasePercent += p.mult - 1; return true; }
    if (st.event?.trig === "passive") return false;
    return queueActionDamageModifier(ctx, p.mult, p.kind || "攻擊");
  },
  no_resist: (ctx) => { ctx.setPlayerState("noResistedThisAction", true); return true; },
  crit_now: (ctx) => { ctx.setPlayerState("nextTurnCrit", true); return true; },
  crit_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `必定致命`, p.turns + (p.now ? 0 : 1), "turns", { crit: true }); return true; },
  crit_uses: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `必定致命`, p.uses, "uses", { crit: true, attackOnly: true }); return true; },
  dmg_taken_x2: (ctx, p, st) => { setTurnKey(ctx, ctx.targetSide, st, "受到傷害翻倍", { damageTakenBoostTurns: p.turns + 1 }, "damageTakenBoostTurns"); return true; },
  dmg_cap_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.actor, st, `受傷上限${p.cap}`, { incomingSkillDmgCapTurns: p.turns, incomingSkillDmgCap: p.cap }, "incomingSkillDmgCapTurns"); return true; },
  dmg_mod_turns: (ctx, p) => {
    if (p.chance != null && !chance(ctx, 'dmg_mod_turns', p.chance)) return false;
    const owner = p.side === "opp" ? ctx.targetSide : ctx.actor;
    const turns = p.turns;
    if (p.dir === "in") addBlockTimer(ctx, owner, `受傷-${p.reduce * 100}%`, turns, "turns", { dmgIn: -p.reduce, kind: p.kind }, !!p.next);
    else if (p.dir === "taken") addBlockTimer(ctx, owner, `受傷+${p.boost * 100}%`, turns, "turns", { dmgIn: p.boost, kind: p.kind }, !!p.next);
    else addBlockTimer(ctx, owner, `增傷+${p.boost * 100}%`, turns, "turns", { dmgOut: p.boost, kind: p.kind }, !!p.next);
    return true;
  },
  boost_turns_x2: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `威力翻倍`, p.turns + 1, "turns", { dmgOutMult: 2, kind: "攻擊" }); return true; },
  dmg_mod_uses: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `增傷+${p.boost * 100}%`, p.uses, "uses", { dmgOut: p.boost, kind: p.kind }); return true; },
  dmg_mod: (ctx, p, st) => {
    const comp = st.event?.data?.damageComp || (st.event?.data?.base != null ? st.event.data : null);
    if (!comp) return false;
    if (!compMatchesKind(comp, p.kind)) return false;
    if (p.dir === "in" && comp.isIncoming) addDamageReduction(comp, p.reduce, p.dir !== "out_reduce");
    else if (p.dir === "in_boost" && comp.isIncoming) comp.increasePercent += p.boost;
    else if (p.dir === "out" && !comp.isIncoming) comp.increasePercent += p.boost;
    else if (p.dir === "out_reduce" && !comp.isIncoming) addDamageReduction(comp, p.reduce, p.dir !== "out_reduce");
    else return false;
    return true;
  },
  prio_turns: (ctx, p, st) => {
    // 對手先制變化：獨立計時器，不覆寫對手自身的 priorityBoost*（對手自己的先制提升仍保留）
    if (p.side === "opp") addBlockTimer(ctx, ctx.targetSide, `先制${p.v}`, p.turns, "turns", { prio: p.v, attackOnly: !!p.attackOnly, prioTurns: true }, true, isSkillCtx(st) ? "turn_effect" : "round_counter");
    else setTurnKey(ctx, ctx.actor, st, `先制+${p.v}`, { priorityBoostTurns: p.turns + 1, priorityBoostValue: p.v, priorityBoostAttackOnly: !!p.attackOnly }, "priorityBoostTurns");
    ctx.addLog(`⚡ 下 ${p.turns} 回合${p.side === "opp" ? "對手" : ""}先制 ${p.v > 0 ? "+" : ""}${p.v}！`, "effect");
    return true;
  },
  prio_next: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `先制+${p.v}`, p.uses, "uses", { prio: p.v, attackOnly: !!p.attackOnly }); return true; },
  first_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `必定先手`, p.turns + 1, "turns", { first: true }); return true; },
  immune_attack_count: (ctx, p) => { ctx.setPlayerState("blockAttackCount", (ctx.getPlayerState("blockAttackCount") || 0) + p.count); ctx.addLog(`🛡️ 免疫下 ${p.count} 次受到的攻擊！`, "effect"); return true; },
  immune_attack_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.actor, st, "免疫攻擊", { immuneAttackTurns: Math.max(p.turns, ctx.getPlayerState("immuneAttackTurns") || 0) }, "immuneAttackTurns"); ctx.addLog(`🛡️ ${p.turns} 回合內免疫受到的攻擊！`, "effect"); return true; },
  block_attack: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `抵擋攻擊`, p.count, "uses", { blockAttack: true }); ctx.addLog(`🛡️ 抵擋下 ${p.count} 次攻擊傷害！`, "effect"); return true; },
  invalid_next: (ctx, p) => { addBlockTimer(ctx, ctx.targetSide, `技能無效`, p.uses, "uses", { invalid: p.kind || "all" }); ctx.addLog(`🚫 對手下 ${p.uses} 次${p.kind}技能無效！`, "effect"); return true; },
  invalid_turns: (ctx, p, st) => {
    if (p.kind !== "屬性") setTurnKey(ctx, ctx.targetSide, st, "攻擊技能無效", { attackSkillInvalidTurns: Math.max(p.turns, ctx.getOpponentState("attackSkillInvalidTurns") || 0) }, "attackSkillInvalidTurns");
    if (p.kind !== "攻擊") setTurnKey(ctx, ctx.targetSide, st, "屬性技能無效", { utilitySkillInvalidTurns: Math.max(p.turns, ctx.getOpponentState("utilitySkillInvalidTurns") || 0) }, "utilitySkillInvalidTurns");
    ctx.addLog(`🚫 ${p.turns} 回合內對手${p.kind}技能無效！`, "effect");
    return true;
  },
  add_invalid_turns: (ctx, p) => { addBlockTimer(ctx, ctx.targetSide, `附加失效`, p.turns, "turns", { addInvalid: p.kind || "all" }); return true; },
  add_invalid_next: (ctx, p) => { addBlockTimer(ctx, ctx.targetSide, `附加失效`, p.uses, "uses", { addInvalid: p.kind || "all" }); return true; },
  no_switch: (ctx, p, st) => { setTurnKey(ctx, ctx.targetSide, st, "無法切換", { noSwitchTurns: Math.max(p.turns + (p.next ? 1 : 0), ctx.getOpponentState("noSwitchTurns") || 0) }, "noSwitchTurns"); ctx.addLog(`⛓️ ${p.turns} 回合內對手無法主動切換精靈！`, "effect"); return true; },
  no_heal: (ctx, p, st) => { setTurnKey(ctx, ctx.targetSide, st, "禁療", { [`${ctx.targetSide}_noHealTurns`]: p.turns + (p.next ? 1 : 0) }, `${ctx.targetSide}_noHealTurns`); ctx.setOpponentState(`${ctx.targetSide}_noHealReason`, `【${ctx.skill?.name || "效果"}】禁療`); return true; },
  clear_turn: (ctx, p) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false; for (const s of sides) any = ctx.clearTurnEffectsOf(s) || any;
    if (any) ctx.addLog(`🧹 消除了回合類效果！`, "effect");
    return any;
  },
  clear_shield: (ctx, p) => {
    const sides: S[] = p.side === "both" ? [ctx.actor, ctx.targetSide] : [sideOf(ctx, p.side)];
    let any = false; for (const s of sides) { const e = elfOf(ctx, s); if ((e?.shield || 0) > 0) { ctx.updateElf(s, { shield: 0 } as any); any = true; } }
    return any;
  },
  shield: (ctx, p, st) => { const amt = Math.max(0, Math.floor(p.flat ?? ctx.self.maxHp * p.ratio)); ctx.applyShield(ctx.actor, amt); st.lastAmount = amt; return amt > 0; },
  pp_zero: (ctx, p) => {
    const skills = (ctx.target.skills || []).map((sk: any) => (!p.kind || (p.kind === "屬性" ? sk.category === "屬性" : sk.category !== "屬性")) ? { ...sk, pp: 0 } : sk);
    ctx.updateElf(ctx.targetSide, { skills }); ctx.addLog(`⚡ 對手${p.kind}技能 PP 歸零！`, "effect"); return true;
  },
  pp_zero_all: (ctx) => {
    for (const s of [ctx.actor, ctx.targetSide] as S[]) { const e = elfOf(ctx, s); ctx.updateElf(s, { skills: (e.skills || []).map((k: any) => ({ ...k, pp: 0 })) }); }
    return true;
  },
  pp_zero_random: (ctx, p) => {
    // 通用語義：隨機 N 個「不同」技能（去重）。與盾碎同歸 custom 的「N 次獨立隨機、可重複」不同。
    // 保留 Set 去重，避免訣別之二等「隨機2」變成可能只中1個。
    const idx = (ctx.target.skills || []).map((sk: any, i: number) => ({ sk, i })).filter((x: any) => (x.sk.pp || 0) > 0);
    const r = ctx.rng || Math.random; const pick = new Set<number>();
    let guard = 0;
    while (pick.size < Math.min(p.count, idx.length) && guard++ < 64) pick.add(idx[Math.floor(r() * idx.length)].i);
    ctx.updateElf(ctx.targetSide, { skills: (ctx.target.skills || []).map((sk: any, i: number) => pick.has(i) ? { ...sk, pp: 0 } : sk) });
    return pick.size > 0;
  },
  pp_drain: (ctx, p) => { executeTemplateEffect("0030", [p.v], ctx); if (p.steal) executeTemplateEffect("0051", [p.v], ctx); return true; },
  pp_restore: (ctx, p) => {
    if (p.v >= 99) { ctx.updateElf(ctx.actor, { skills: (ctx.self.skills || []).map((k: any) => ({ ...k, pp: k.maxPp ?? k.pp })) }); return true; }
    executeTemplateEffect("0051", [p.v], ctx); return true;
  },
  ignore: (ctx, p) => {
    // 攻擊免疫／免疫：無視攻擊免疫（attackImmunity 讀 ignoreAttackImmunityThisAction，本次行動結束時重置）
    const key: Record<string, string> = { 傷害限制: "blkIgnoreLimit", 抵擋傷害: "blkIgnoreBlock", 護盾: "blkIgnoreShield", 正先制: "blkIgnorePrio", 能力提升: "ignoreOppBuffThisAction", 攻擊免疫: "ignoreAttackImmunityThisAction", 免疫攻擊: "ignoreAttackImmunityThisAction", 免疫: "ignoreAttackImmunityThisAction" };
    if (!key[p.what]) return false;
    ctx.setPlayerState(key[p.what], true);
    return true;
  },
  ignore_def_turns: (ctx, p, st) => {
    // 引擎讀取 ignoreDef25Turns（固定忽略雙防25%）；其他比例寫入 ignoreDefPercentTurns/Value（目前引擎無讀取者，已列入報告）
    const turns = p.turns + 1;
    if (Math.abs(p.ratio - 0.25) < 1e-9) setTurnKey(ctx, ctx.actor, st, "忽略雙防25%", { ignoreDef25Turns: turns }, "ignoreDef25Turns");
    else setTurnKey(ctx, ctx.actor, st, `忽略雙防${Math.round(p.ratio * 100)}%`, { ignoreDefPercentTurns: turns, ignoreDefPercentValue: p.ratio }, "ignoreDefPercentTurns");
    ctx.addLog(`🗡️ 下 ${p.turns} 回合攻擊忽略對手${p.stat} ${Math.round(p.ratio * 100)}%！`, "effect");
    return true;
  },
  per_statdown_bonus: (ctx, p, st) => {
    const opp: any = ctx.target;
    const k = Object.values(opp?.statStages || {}).filter((v: any) => typeof v === "number" && v < 0).length;
    if (!k) return false;
    const baseline = st.maxHpBeforeChange?.[ctx.targetSide] ?? opp.maxHp;
    const newMax = Math.max(1, Math.floor(opp.maxHp - baseline * p.ratio * k));
    ctx.updateElf(ctx.targetSide, { maxHp: newMax, currentHp: Math.min(opp.currentHp, newMax) } as any);
    const key = `${ctx.targetSide}_noHealTurns`;
    ctx.setOpponentState(key, (ctx.getOpponentState(key) || 0) + p.turns * k);
    ctx.addLog(`⛓️ 對手處於 ${k} 種能力下降：體力上限再減少 ${Math.round(p.ratio * k * 100)}%，禁療回合 +${p.turns * k}！`, "effect");
    return true;
  },
  attack_inflict_turns: (ctx, p, st) => { ctx.setPlayerState("attackInflictStatus", p.status); setTurnKey(ctx, ctx.actor, st, `攻擊必定${p.status}`, { attackInflictStatusTurns: p.turns + 1 }, "attackInflictStatusTurns"); return true; },
  survive: (ctx, _p, st) => {
    // 致命傷害時：抵抗本次致命傷害並保留1點體力；非致死情境不動體力
    if (st.event?.trig === "fatal") { surviveAt1(ctx); st.survived = true; return true; }
    return false;
  },
  bench_entrance_status: (ctx, p) => {
    // ctx 為登場方
    if (statusChanceBlocked(ctx, p.chance) || !chance(ctx, `bench:${p.status}`, p.chance)) return false;
    const r = ctx.applyStatusWithImmunityCheck(ctx.actor, p.status, STATUS_DURATION[p.status] ?? DEFAULT_STATUS_TURNS);
    if (r.success) ctx.addLog(`💫 【${ctx.self?.name}】登場時陷入了【${p.status}】！`, "status");
    return r.success;
  },
  at_round_end: (ctx, p) => { addBlockTimer(ctx, ctx.actor, "回合結束", 1, "uses", { trig: "round_end", body: p.body, once: true }); return true; },
  stat_steal_random: (ctx, p) => {
    const keys = ["atk", "def", "spatk", "spdef", "speed", "accuracy"]; const r = ctx.rng || Math.random; const pick = new Set<string>();
    while (pick.size < Math.min(p.count, keys.length)) pick.add(keys[Math.floor(r() * keys.length)]);
    const down: Record<string, number> = {}, up: Record<string, number> = {};
    pick.forEach(k => { down[k] = -p.v; up[k] = p.v; });
    ctx.applyStatChange(ctx.targetSide, down); ctx.applyStatChange(ctx.actor, up); return true;
  },
  pp_cost_mult: (ctx, p) => { addBlockTimer(ctx, ctx.targetSide, `PP消耗×${p.mult}`, p.turns, "turns", { ppMult: p.mult, kind: p.kind }); return true; },
  dmg_to_heal_turns: (ctx, p) => {
    // 下回合：pendingActivation（本回合不生效，回合結束啟用、下回合結束到期）
    if (p.next) addBlockTimer(ctx, ctx.actor, "下回合傷害轉體力", 1, "turns", { absorbToHeal: true }, true);
    else OPS.absorb_now(ctx, {}, { last: null, lastAmount: 0 });
    return true;
  },
  absorb_now: (ctx) => { addBlockTimer(ctx, ctx.actor, "傷害轉體力", 1, "turns", { absorbToHeal: true }); return true; },
  atk_sum_calc: (ctx) => { ctx.setPlayerState("blkAtkSpatkSum", true); return true; },
  custom: (ctx, p, st) => { const d = CUSTOM[p.key]; return d ? d.run(ctx, st as any) !== false : false; },
  evade: () => true,
  attack_extra_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `攻擊附加${p.type}傷害`, p.turns + 1, "turns", { trig: "self_after_attack", body: [{ acts: [{ op: "dmg", p: { flat: p.flat, type: p.type }, label: "" }] }] }); return true; },
  evade_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `閃避${p.chance}%`, p.turns, "turns", { evade: p.chance, kind: p.kind }); return true; },
  survive_turns: (ctx, p) => { addBlockTimer(ctx, ctx.actor, `死亡時保留1體力`, p.turns, "turns", { survive: true }); return true; },
  no_pos_prio_turns: (ctx, p, st) => { setTurnKey(ctx, ctx.targetSide, st, "正先制失效", { blkNoPosPrioTurns: p.turns + 1 }, "blkNoPosPrioTurns"); return true; }, // 常駐閃避：由命中判定讀取（passiveEvadeChance）
  consume_hp_all: (ctx) => { ctx.adjustHp(ctx.actor, -ctx.self.currentHp); return true; },
  mark: (ctx, p) => {
    const side = sideOf(ctx, p.side);
    const id = `blk_${p.name}`;
    const cur = (ctx.getMarks(side) || []).find((m: any) => m.id === id)?.count || 0;
    ctx.setMark({ id, name: p.name, count: cur + p.count, displayChar: p.name[0] } as any, side);
    return true;
  },
  mark_turns: (ctx, p) => {
    const side = sideOf(ctx, p.side);
    const def = markDefClauses(ctx.self, p.name);
    const eff: Record<string, any> = { blkDef: ctx.self?.name, blkTurns: p.turns };
    for (const c of def) for (const b of c.body) for (const a of b.acts) {
      if (a.op === "heal_reduce") eff.blkHealReduce = a.p.ratio;
      if (a.op === "holder_invalid") eff.blkInvalid = a.p.kind || "all";
      if (a.op === "mark_duration" && !p.turns) eff.blkTurns = a.p.turns;
    }
    ctx.setMark({
      id: `blk_${p.name}`,
      name: p.name,
      count: 1,
      displayChar: p.name[0],
      description: def.map(c => c.raw.replace(/^>\s*/, "")).join("\n"),
      unit: "回合",
      remainingRounds: p.turns,
      clearable: false,
      triggerNode: "round_end",
      polarity: "negative",
      effects: eff,
    } as any, side);
    ctx.addLog(`🔖 為【${elfOf(ctx, side)?.name}】附加 ${p.turns} 回合的【${p.name}】！`, "effect");
    return true;
  },
  dmg_of_event: (ctx, p, st) => {
    const base = Number(st.event?.data?.damage ?? st.event?.data?.amount ?? 0);
    if (base <= 0) return false;
    st.lastAmount = dealDamage(ctx, ctx.actor, base * p.ratio, p.type, undefined, st);
    ctx.addLog(`🔖 【${ctx.self?.name}】受到印記追加的 ${st.lastAmount} 點${p.type}傷害！`, "damage");
    return true;
  },
  heal_reduce: () => true,
  holder_invalid: () => true,
  mark_duration: () => true,
  heal_opp_equal: (ctx, _p, st) => { if (!st.lastAmount) return false; const real = heal(ctx, ctx.targetSide, st.lastAmount); return real > 0; },
  pp_restore_opp: (ctx, p) => {
    const e: any = ctx.target;
    ctx.updateElf(ctx.targetSide, { skills: (e.skills || []).map((k: any) => ({ ...k, pp: p.v >= 99 ? (k.maxPp ?? k.pp) : Math.min(k.maxPp ?? 99, (k.pp || 0) + p.v) })) });
    return true;
  },
  mark_remove: (ctx, p) => { ctx.clearMark(`blk_${p.name}`, ctx.actor); ctx.addLog(`🔖 【${p.name}】消失了！`, "effect"); return true; },
  double_prev: (ctx, _p, st) => { if (st.lastStmt) for (const a of st.lastStmt.acts) runAct(ctx, a, st); return true; },
  timed: (ctx, p) => {
    const turns = p.turns + (p.from === "next" ? 1 : 0);
    addBlockTimer(ctx, ctx.actor, (p.label || "持續效果"), turns, "turns", { trig: p.trig, body: p.body });
    return true;
  },
};

/** 強制存活：本次致命傷害改為保留 1 點體力 */
export function surviveAt1(ctx: BattleEventContext) {
  ctx.updateElf(ctx.actor, { currentHp: 1 } as any);
}

// ───────── 持續效果（回合類，可被消除） ─────────
export function addBlockTimer(ctx: BattleEventContext, side: S, name: string, n: number, mode: "turns" | "uses", payload: Record<string, any>, pendingActivation = false, kind?: "turn_effect" | "round_counter") {
  ctx.addTimerTo(side, {
    // 同來源同效果重複附加時刷新回合數（不疊加）
    id: `blk_${side}_${ctx.skill?.name || ctx.self?.name || "src"}_${name}_${payload.trig || ""}`,
    name,
    kind: mode === "uses" ? "use_counter" : (kind || "turn_effect"),
    source: "skill" as any,
    remaining: n,
    pendingActivation,
    tickAt: mode === "uses" ? "never" : "round_end",
    payload: { block: { ...payload, owner: side, src: ctx.skill?.name || ctx.self?.name } },
    description: name,
  } as any, ctx.moveIndex === 1);
}

/** 「效果翻倍」：把數值參數加倍 */
function doubled(op: string, p: any): any {
  const q = { ...p };
  if (op === "boost") q.mult = 1 + (p.mult - 1) * 2;
  if (op === "stat") { q.v = p.v * 2; if (p.v2 != null) q.v2 = p.v2 * 2; }
  for (const k of ["ratio", "ratioCur", "flat", "amount", "reduce", "boost", "count"]) if (typeof p[k] === "number") q[k] = p[k] * 2;
  return q;
}

export function runAct(ctx: BattleEventContext, a: Act, st: RunState, dbl = false): boolean {
  const fn = OPS[a.op];
  if (!fn) return false;
  let p = a.p;
  // 每次使用額外附加（最高）
  if (p.rampInc != null) {
    const key = p.rampStreak ? `blkStreak:${ctx.skill?.name}` : `blkUses:${ctx.skill?.name}`;
    const uses = Math.max(0, (ctx.getPlayerState(key) || 1) - 1);
    const field = p.flat != null ? "flat" : p.mult != null ? "mult" : "ratio";
    const inc = field === "flat" ? p.rampInc : p.rampInc / 100;
    let v = (p[field] || 0) + inc * uses;
    if (p.rampCap != null) v = Math.min(v, field === "flat" ? p.rampCap : (field === "mult" ? 1 + p.rampCap / 100 : p.rampCap / 100));
    p = { ...p, [field]: v };
  }
  if (p.chanceX2If && p.chance != null && evalCond(ctx, p.chanceX2If, st) === true) p = { ...p, chance: Math.min(100, p.chance * 2) };
  if (dbl) p = doubled(a.op, p);
  if (p.chance != null && p.chance < 100 && a.op === "boost" && !chance(ctx, `boost:${a.label}`, p.chance)) return false;
  try { const r = fn(ctx, p, st); return r !== false; } catch (e) { console.error("[blocks]", a.op, e); return false; }
}

export function runStmts(ctx: BattleEventContext, body: Stmt[], st: RunState, opts: { afterHitOnly?: boolean } = {}) {
  // 先判定「…時效果翻倍」這類使用前狀態的條件
  const pre = new Map<Stmt, boolean>();
  for (const s of body) if (s.pre && s.cond) pre.set(s, s.cond.every(c => evalCond(ctx, c, st) === true));
  // 同一觸發句內的狀態條件以句子開始時為準。否則「低體力時回血並弱化」會在回血後
  // 重新判斷成 false，錯誤跳過同一句後半效果。依賴前一動作結果的條件仍即時計算。
  if (!st.conditionSnapshots) {
    st.conditionSnapshots = new Map();
    for (const s of body) for (const c of s.cond || []) if (!DYNAMIC_CONDS.has(c.c)) st.conditionSnapshots.set(condKey(c), evalCond(ctx, c, st));
  }
  // 「…時效果翻倍」看使用前的狀態
  const dblMap = new Map<Act, boolean>();
  for (const s of body) for (const a of s.acts) if (a.p?.x2If) dblMap.set(a, evalCond(ctx, a.p.x2If, st) === true);
  for (let i = 0; i < body.length; i++) {
    const s = body[i];
    // 傷害結算後才執行的句子（afterHit）：使用時略過；結算後只跑這些句子
    if (opts.afterHitOnly ? !s.afterHit && !s.acts.some(a => a.op === "vampire") : s.afterHit && st.event?.trig !== "after_hit") continue;
    if (pre.has(s)) { if (pre.get(s)) for (const a of s.acts) runAct(ctx, a, st); continue; }
    if (s.chain === "success" && st.last !== true) continue;
    if (s.chain === "fail" && st.last !== false) continue;
    if (s.chain === "any_fail" && !(st.history || []).some(x => x === false)) continue;
    if (s.cond && s.cond.length) {
      // 「附加後對手體力未減少」：延後到實際扣血結算時判定（由上一句的傷害登記）
      if (st.deferred?.has(s)) continue;
      const ok = s.cond.every(c => s.live ? evalCond(ctx, c, st) === true : evalEventCond(ctx, c, st));
      if (!ok) { if (s.elseActs) for (const a of s.elseActs) runAct(ctx, a, st); continue; }
    }
    const next = body[i + 1];
    if (next?.cond?.some(c => c.c === "last_no_dmg") && !next.chain) st.deferNoDmg = next;
    let any: boolean | null = null;
    for (const a of s.acts) {
      if (a.op === "double_prev") { runAct(ctx, a, st); continue; }
      const r = runAct(ctx, a, st, dblMap.get(a) === true);
      st.prevOp = a.op;
      if (a.op !== "noop" && a.op !== "note") any = (any ?? false) || r;
    }
    if (any !== null) { st.last = any; (st.history ||= []).push(any); }
    if (!s.acts.every(a => a.op === "double_prev")) st.lastStmt = s;
    // 未登記（本句沒有造成傷害）時，下一句改為即時判定
    st.deferNoDmg = undefined;
  }
}

/** 每個子句重設數值類狀態（等量／上一數值不可跨子句洩漏）；成敗鏈與「任一項」歷史保留 */
export function runClause(ctx: BattleEventContext, c: Clause, st: RunState, opts: { afterHitOnly?: boolean } = {}): boolean {
  if (c.cond && !c.cond.every(x => evalEventCond(ctx, x, st))) return false;
  st.lastAmount = 0; st.lastDealt = undefined; st.prevOp = undefined; st.lastStmt = undefined; st.deferNoDmg = undefined; st.deferred = undefined;
  if (st.historyTrig !== c.trig) { st.history = []; st.historyTrig = c.trig; }
  runStmts(ctx, c.body, st, opts);
  return true;
}

/** 技能：使用時 / 傷害結算後 */
export function runSkillProgram(ctx: BattleEventContext, prog: Program, phase: "use" | "after_hit" | "on_invalid", only?: number[]) {
  const st: RunState = { last: null, lastAmount: 0, event: phase === "use" ? undefined : { trig: phase } };
  snapshotConditions(ctx, prog.clauses.filter((c, i) => (!only || only.includes(i)) && c.trig === phase && c.parsed), st);
  if (phase === "use") ctx.setPlayerState("blkLastHitDamage", 0);
  if (phase === "use" && ctx.skill?.name) {
    const nm = ctx.skill.name;
    ctx.setPlayerState(`blkUses:${nm}`, (ctx.getPlayerState(`blkUses:${nm}`) || 0) + 1);
    const streak = ctx.getPlayerState("blkLastSkill") === nm ? (ctx.getPlayerState(`blkStreak:${nm}`) || 0) + 1 : 1;
    ctx.setPlayerState(`blkStreak:${nm}`, streak); ctx.setPlayerState("blkLastSkill", nm);
  }
  prog.clauses.forEach((c, i) => {
    if (only && !only.includes(i)) return;
    if (!c.parsed) return;
    if (c.marker === "■" && ctx.self.isInherentInvalid) return;
    if (c.trig === phase) { runClause(ctx, c, st); return; }
    if (c.trig !== "use") return;
    // 使用時子句中的「傷害結算後」句（等量＝實際傷害）
    if (phase === "after_hit" && c.body.some(b => b.afterHit)) { runClause(ctx, c, st, { afterHitOnly: true }); return; }
    // 使用時子句中「技能無效時…」句：只在技能無效時執行該句
    if (phase === "on_invalid" && c.body.some(b => b.cond?.some(x => x.c === "invalid"))) {
      runClause(ctx, { ...c, body: c.body.filter(b => b.cond?.some(x => x.c === "invalid")) }, st);
    }
  });
}

// ───────── 事件 → 觸發時點 ─────────
export function eventTriggers(ctx: BattleEventContext, ev: string, data: any): Trigger[] {
  switch (ev) {
    case EffectTiming.ROUND_START: return ["round_start", "team_round_start"];
    case EffectTiming.ROUND_END: return ["round_end"];
    case EffectTiming.BATTLE_PHASE_END: return ["phase_end"];
    case EffectTiming.EXTRA_ACTION_START: return ["extra_action_start"];
    case EffectTiming.EXTRA_ACTION_END: return ["extra_action_end"];
    case EffectTiming.ON_ENTRANCE: {
      // 戰鬥開始＝本方首發登場（尚未換過人），每方只觸發一次
      if (!ctx.getPlayerState?.("previousActiveElfId") && !ctx.getPlayerState?.("blkBattleStartFired")) { ctx.setPlayerState("blkBattleStartFired", true); return ["battle_start", "entrance"]; }
      return ["entrance"];
    }
    case EffectTiming.DEATH_NODE_1: return ["defeated"];
    case EffectTiming.ON_KILL: return ["kill"];
    case EffectTiming.ON_SWITCH_OUT: return ["switch_out"];
    case EffectTiming.FATAL_RESIST: return ["fatal"];
    case EffectTiming.ON_DAMAGED: {
      if (data?.targetSide && data.targetSide !== ctx.actor) return [];
      const t = String(data?.damageType || "");
      const out: Trigger[] = ["damaged"];
      if (/skill|attack/.test(t)) out.push("damaged_skill", ...(data?.typedSkill ? [] : ["damaged_attack"] as Trigger[]), "damaged_nontrue");
      else if (/true/.test(t)) out.push("damaged_true");
      else if (/fixed/.test(t)) out.push("damaged_fixed", "damaged_nontrue");
      else if (/percent|pink/.test(t)) out.push("damaged_percent", "damaged_nontrue");
      return out;
    }
    case EffectTiming.BEFORE_DAMAGE: {
      const comp = data?.damageComp || data;
      if (!comp || typeof comp !== "object" || comp.base == null) return [];
      const skill = isSkillDamageType(comp.damageCategory);
      const atk = comp.damageCategory === "skill_attack" && !comp.isTypedSkill;
      if (comp.isIncoming) return ["passive", "incoming", ...(skill ? ["incoming_skill"] as Trigger[] : []), ...(atk ? ["incoming_attack"] as Trigger[] : []), ...(isNonTrueDamageType(comp.damageCategory) ? ["incoming_nontrue"] as Trigger[] : [])];
      return ["passive", "outgoing", ...(skill ? ["outgoing_skill"] as Trigger[] : []), ...(atk ? ["outgoing_attack"] as Trigger[] : [])];
    }
    default: return [];
  }
}

/** 側邊持續效果（N回合內，X時Y）與傷害修正 */
export function runSideTimers(ctx: BattleEventContext, trigs: Trigger[], data: any) {
  const timers: any[] = (ctx.actor === "p1" ? ctx.p1Timers : ctx.p2Timers) || [];
  const comp = data?.damageComp || (data && data.base != null ? data : null);
  for (const t of timers) {
    const b = t.payload?.block;
    if (!b || t.pendingActivation || (t.remaining ?? 0) <= 0) continue;
    if (t.scope !== "team" && t.ownerBattleId && t.ownerBattleId !== (ctx.self.battleId || ctx.self.id)) continue;
    if (b.trig && trigs.includes(b.trig)) {
      const st: RunState = { last: null, lastAmount: 0, event: { trig: b.trig, data } };
      if (b.once || b.consumeOnFire) ctx.consumeTimer?.(ctx.actor, t.id);
      runStmts(ctx, b.body || [], st);
    }
    if (comp && (b.dmgIn != null || b.dmgOut != null || b.dmgOutMult != null)) {
      if (!compMatchesKind(comp, b.kind)) continue;
      if (comp.isIncoming && b.dmgIn != null) { if (b.dmgIn < 0) addDamageReduction(comp, -b.dmgIn); else comp.increasePercent += b.dmgIn; }
      if (t.kind === 'use_counter' && !b.trig && ((comp.isIncoming && b.dmgIn != null) || (!comp.isIncoming && (b.dmgOut != null || b.dmgOutMult != null)))) ctx.consumeTimer?.(ctx.actor, t.id);
      if (!comp.isIncoming && b.dmgOut != null) comp.increasePercent += b.dmgOut * (b.doubleIfAnyStatus && (hasAbn(ctx, ctx.self) || hasAbn(ctx, ctx.target)) ? 2 : 1);
      if (!comp.isIncoming && b.dmgOutMult != null) {
        // 「減半 n 次」：每次傷害都乘 dmgOutMult 的 n 次方（n 讀當下登錄值）。
        const powN = b.powRegistryKey ? Math.max(0, Number(ctx.getPlayerState(b.powRegistryKey) || 0)) : -1;
        if (powN > 0) {
          if (b.dmgOutMult < 1) multiplyDamageReduction(comp, b.dmgOutMult ** powN, false);
          else comp.multiplier *= b.dmgOutMult ** powN;
        }
        const limit = b.useLimitRegistryKey ? Number(ctx.getPlayerState(b.useLimitRegistryKey) || 0) : Infinity;
        if (powN < 0 && (b.usesConsumed || 0) < limit) {
          if (b.dmgOutMult < 1) multiplyDamageReduction(comp, b.dmgOutMult, false); else comp.multiplier *= b.dmgOutMult;
          if (b.useLimitRegistryKey) ctx.addTimerTo(ctx.actor, { ...t, payload: { ...t.payload, block: { ...b, usesConsumed: (b.usesConsumed || 0) + 1 } } }, false);
        }
      }
    }
    // 「直到上述異常結束前」：該異常提前解除即結束
    if (b.whileStatus && !((ctx.getStatuses(liveElf(ctx, b.whileStatus.side)) || {})[b.whileStatus.status] > 0)) { for (let k = 0; k < (t.remaining ?? 1); k++) ctx.consumeTimer?.(ctx.actor, t.id); continue; }
    if (comp && comp.isIncoming && b.blockSkillDmg && compMatchesKind(comp, "技能") && !bypassesAttackDefense(comp, 'block')) {
      const amt = Math.floor(comp.base * (1 + (comp.increasePercent || 0)) * (1 - (comp.decreasePercent || 0)) * (comp.multiplier ?? 1));
      comp.multiplier = 0;
      ctx.setPlayerState("blkBlockedBySoul", (ctx.getPlayerState("blkBlockedBySoul") || 0) + Math.max(0, amt));
      ctx.addLog(`🛡️ 抵擋了 ${amt} 點技能傷害！`, "effect");
    }
    if (comp && !comp.isIncoming && b.dmgOutReduce && (!b.kinds || b.kinds.includes(comp.damageCategory))) addDamageReduction(comp, b.dmgOutReduce, false);
    if (comp && comp.isIncoming && b.absorbToHeal && compMatchesKind(comp, b.kind) && !bypassesAttackDefense(comp, 'conversion')) {
      const amt = Math.floor(comp.base * (1 + (comp.increasePercent || 0)) * (1 - (comp.decreasePercent || 0)) * (comp.multiplier ?? 1));
      comp.multiplier = 0;
      if (amt > 0) { ctx.applyHeal(ctx.actor, amt); ctx.addLog(`💚 受到的傷害轉化為 ${amt} 點體力！`, "heal");
        if (t.kind === 'use_counter') ctx.consumeTimer?.(ctx.actor, t.id);
      }
    }
    if (comp && comp.isIncoming && b.blockAttack && compMatchesKind(comp, "攻擊") && !bypassesAttackDefense(comp, 'block')) {
      comp.multiplier = 0; ctx.consumeTimer?.(ctx.actor, t.id);
      ctx.addLog(`🛡️ 【抵擋】：抵擋了本次攻擊傷害！`, "effect");
    }
  }
}

/** 魂印程式：依事件觸發 */
const PASSIVE_OPS = new Set(["dmg_mod", "boost", "note", "noop"]);
export function runSoulProgram(ctx: BattleEventContext, prog: Program, trigs: Trigger[], data: any, only?: number[]): boolean {
  const st: RunState = { last: null, lastAmount: 0, event: { trig: trigs[0], data } };
  snapshotConditions(ctx, prog.clauses.filter((c, i) => (!only || only.includes(i)) && c.parsed && trigs.includes(c.trig)), st);
  const source = (ctx as any).illusionEffectKey;
  const onceKey = (i: number) => `blkOnce:${source ? `${source}:` : ''}${prog.title}:${i}`;
  prog.clauses.forEach((c, i) => {
    if (only && !only.includes(i)) return;
    if (!c.parsed || !trigs.includes(c.trig)) return;
    // 致命傷害：每場限一次（首次）——子句實際執行時即寫入旗標（不只存活子句）
    if (c.trig === "fatal") { if (ctx.getPlayerState(onceKey(i))) return; }
    if (c.trig === "passive" && !c.body.every(b => b.acts.every(a => PASSIVE_OPS.has(a.op)))) return;
    const ran = runClause(ctx, c, st);
    if (c.trig === "fatal" && ran) ctx.setPlayerState(onceKey(i), true);
  });
  return !!st.survived;
}

// ───────── 引擎查詢：技能流程中讀取持續效果 ─────────
export function findBlockTimer(timers: any[] | undefined, pred: (b: any) => boolean): any | undefined {
  return (timers || []).find(t => t.payload?.block && !t.payload.block.mirror && !t.pendingActivation && (t.remaining ?? 0) > 0 && pred(t.payload.block));
}

/** 常駐閃避機率（魂印積木 evade） */
export function passiveEvade(prog: Program | null, skill: any): number {
  if (!prog) return 0;
  for (const c of prog.clauses) for (const b of c.body) for (const a of b.acts) {
    if (a.op !== "evade" || !c.parsed) continue;
    if (a.p.kind === "攻擊" && skill?.category === "屬性") continue;
    return a.p.chance;
  }
  return 0;
}

// ───────── 印記定義（持有者視角） ─────────
let _soulProgramOf: ((elf: any) => Program) | null = null;
export function setSoulProgramProvider(fn: (elf: any) => Program) { _soulProgramOf = fn; }
export function markDefClauses(defElf: any, name: string): Clause[] {
  if (!defElf || !_soulProgramOf) return [];
  return _soulProgramOf(defElf).clauses.filter(c => c.markDef === name && c.marker !== "§");
}

/** 持有者事件：ctx.actor 為持有者方 */
export function runHolderMarks(ctx: BattleEventContext, trigs: Trigger[], data: any, isRoundEnd: boolean) {
  const side = ctx.actor;
  const marks: any[] = (ctx.getMarks(side) || []).filter((m: any) =>
    m.effects?.blkDef || m.effects?.hpAdjustmentMaxHpRatioPerStack,
  );
  if (!marks.length) return;
  const all = [...(ctx.getFullTeam?.("p1") || []), ...(ctx.getFullTeam?.("p2") || [])] as any[];
  const htrigs: Trigger[] = [];
  if (trigs.includes("damaged_attack")) htrigs.push("holder_damaged_attack");
  if (trigs.includes("damaged")) htrigs.push("holder_damaged");
  if (trigs.includes("passive")) htrigs.push("holder_passive");
  for (const mk of marks) {
    const defElf = all.find(e => e?.name === mk.effects.blkDef);
    if (htrigs.length && defElf) {
      for (const c of markDefClauses(defElf, mk.name)) {
        if (!c.parsed || !htrigs.includes(c.trig)) continue;
        if (c.trig === "holder_passive" && !c.body.every(b => b.acts.every(a => a.op === "dmg_mod" || PASSIVE_OPS.has(a.op) || a.op === "heal_reduce" || a.op === "holder_invalid" || a.op === "mark_duration"))) continue;
        runClause(ctx, c, { last: null, lastAmount: 0, event: { trig: c.trig, data } });
      }
    }
    if (isRoundEnd) {
      const ratio = Number(mk.effects?.hpAdjustmentMaxHpRatioPerStack || 0);
      if (ratio > 0 && mk.count > 0) {
        const amount = Math.floor(ctx.self.maxHp * ratio * mk.count);
        ctx.adjustHp(side, -amount);
        ctx.addLog(`👻 【${mk.name}】發作：${mk.count}${mk.unit || "層"}令【${ctx.self.name}】體力調整 -${amount}！`, "status");
      }
      if (Number.isFinite(mk.effects?.blkTurns)) {
        const left = mk.effects.blkTurns - 1;
        if (left <= 0) { ctx.clearMark(mk.id, side); ctx.addLog(`🔖 【${mk.name}】結束了。`, "info"); }
        else ctx.setMark({ ...mk, remainingRounds: left, effects: { ...mk.effects, blkTurns: left } }, side);
      }
    }
  }
}

/** 異常附加後（雙方）：status_received（受到者）與 any_status */
export function statusTriggers(ctx: BattleEventContext, data: { side: string; status: string }): Trigger[] {
  return data.side === ctx.actor ? ["status_received", "any_status"] : ["any_status"];
}
