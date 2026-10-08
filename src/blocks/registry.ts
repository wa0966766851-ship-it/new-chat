// 積木程式快取與戰鬥接點
import type { Program, Trigger } from "./model";
import type { BattleEventContext } from "../effects/types";
import { EffectTiming } from "../effects/types";
import { parseSkill, parseSoulMark, matchCond } from "./parse";
import { CUSTOM } from "./custom";
import { eventTriggers, runSideTimers, runSkillProgram, runSoulProgram, runAct, passiveEvade, runHolderMarks, setSoulProgramProvider, findBlockTimer, evalCond, statusTriggers, settleNoDmgFollowUps, surviveAt1 } from "./runtime";
import { isSkillDamageType } from "../battle/damageSemantics";
export { blockStatusGuard } from "./runtime";
import { SKILL_MODE, SOUL_MODE } from "./specs";
import { BoundedCache } from '../utils/boundedCache';
import { acquiredEffectContext } from '../battle/acquiredEffectContext';

const skillCache = new BoundedCache<string, Program>(1024);
setSoulProgramProvider((elf) => getSoulProgram(elf));
const soulCache = new BoundedCache<string, Program>(128);

export function getSkillProgram(skill: { name: string; description?: string }): Program {
  const key = skill.name + "\u0000" + (skill.description || "");
  let p = skillCache.get(key);
  if (!p) { p = parseSkill(skill.name, skill.description || ""); skillCache.set(key, p); }
  return p;
}

/** 魂印描述（不含命運之輪段） */
export function soulText(elf: any): string {
  return String(elf?.soulMark?.description || "").split(/\n\s*\n?【命運之輪/)[0];
}
export function getSoulProgram(elf: any): Program {
  const text = soulText(elf);
  const key = (elf?.name || "") + "\u0000" + text;
  let p = soulCache.get(key);
  if (!p) { p = parseSoulMark(elf?.soulMark?.name || "魂印", text); soulCache.set(key, p); }
  return p;
}

/** 技能積木執行模式：handler＝專屬程式、blocks＝全部積木、number[]＝專屬程式＋指定子句積木 */
export function skillMode(name: string, hasHandler: boolean): "handler" | "blocks" | number[] {
  const m = SKILL_MODE[name];
  if (m) return m;
  return hasHandler ? "handler" : "blocks";
}

/** 技能效果（使用時／傷害結算後） */
export function runSkillBlocks(ctx: BattleEventContext, phase: "use" | "after_hit" | "on_invalid", hasHandler: boolean): { unparsedLines: string[] } {
  const sk = ctx.skill;
  if (!sk) return { unparsedLines: [] };
  const mode = skillMode(sk.name, hasHandler);
  if (mode === "handler") return { unparsedLines: [] };
  const prog = getSkillProgram(sk);
  runSkillProgram(ctx, prog, phase, Array.isArray(mode) ? mode : undefined);
  // 未解析的子句交回舊的通用文字執行器
  const unparsedLines = mode === "blocks" ? prog.clauses.filter(c => !c.parsed && c.trig === phase).map(c => c.raw) : [];
  return { unparsedLines };
}

const ACTIVE_ONLY = new Set<string>([EffectTiming.ROUND_START, EffectTiming.ROUND_END, EffectTiming.BATTLE_PHASE_END]);

/** 魂印事件：側邊持續效果 + 精靈魂印積木（依 SOUL_MODE） */
export function runBlockEvent(ctx: BattleEventContext, event: string, data: any, elf: any): boolean {
  if (event === EffectTiming.ON_ENTRANCE) runBenchOnOppEntrance(ctx);
  recordBattleFacts(ctx, event, data);
  const trigs = eventTriggers(ctx, event, data);
  if (!trigs.length) return false;
  const active = (ctx.actor === "p1" ? ctx.activeP1 : ctx.activeP2) as any;
  const isActive = !!elf && !!active && (elf === active || (elf.battleId && elf.battleId === active.battleId) || elf.name === active.name);
  if (event === EffectTiming.ROUND_START && !isActive && elf && elf.currentHp > 0) {
    // 「存活於背包內或在場」：場下也觸發
    const mode = SOUL_MODE[String(elf.id)] ?? SOUL_MODE[elf.name];
    if (mode) runSoulProgram(ctx, getSoulProgram(elf), ["team_round_start"], data, Array.isArray(mode) ? mode : undefined);
    return false;
  }
  if (ACTIVE_ONLY.has(event) && !isActive) return false;
  if (isActive) { runSideTimers(ctx, trigs, data); runHolderMarks(ctx, trigs, data, event === EffectTiming.ROUND_END); }
  if (event === EffectTiming.FATAL_RESIST) {
    const timers = ctx.actor === "p1" ? ctx.p1Timers : ctx.p2Timers;
    const rb = findBlockTimer(timers, b => b.rebirth);
    if (rb) { ctx.consumeTimer?.(ctx.actor, rb.id); ctx.applyHeal(ctx.actor, (ctx.self as any).maxHp); ctx.addLog(`✨ 【${ctx.self?.name}】重生了！`, "effect"); return true; }
    const t = findBlockTimer(timers, b => b.survive);
    if (t) { surviveAt1(ctx); ctx.addLog(`💀 【${ctx.self?.name}】強制存活，保留 1 點體力！`, "effect"); return true; }
  }
  return emitSoul(ctx, trigs, data, elf, isActive || event === EffectTiming.FATAL_RESIST);
}

/** 積木條件需要的戰鬥事實：本次攻擊實際傷害、當回合是否受到技能／攻擊傷害、待決的「體力未減少」追加 */
function recordBattleFacts(ctx: BattleEventContext, event: string, data: any) {
  if (event === EffectTiming.AFTER_ATTACK_HIT && data && (data.hitIndex ?? 0) === 0) ctx.setPlayerState("blkLastHitDamage", Number(data.totalDamage ?? data.damage ?? 0));
  if (event === EffectTiming.OPPONENT_DAMAGE) settleNoDmgFollowUps(ctx, data);
  if (event === EffectTiming.ON_DAMAGED && data && (!data.targetSide || data.targetSide === ctx.actor) && (data.amount ?? 0) > 0 && isSkillDamageType(String(data.damageType || ""))) {
    ctx.setPlayerState("blkSkillDmgTakenRound", ctx.roundNumber ?? 0);
    if (!data.typedSkill) ctx.setPlayerState("blkAttackDmgTakenRound", ctx.roundNumber ?? 0);
  }
}

function emitSoul(ctx: BattleEventContext, trigs: Trigger[], data: any, elf: any, isActive: boolean): boolean {
  if (!elf || !isActive) return false;
  const mode = SOUL_MODE[String(elf.id)] ?? SOUL_MODE[elf.name];
  if (!mode) return false;
  return runSoulProgram(ctx, getSoulProgram(elf), trigs, data, Array.isArray(mode) ? mode : undefined);
}

/** 幻化取得的魂印以目標資料ID選模式，但結算持有者仍是ctx.self。
 * 不能再呼叫runBlockEvent：側邊timer／印記已由原持有者結算一次。 */
export function runCopiedSoulEvent(ctx: BattleEventContext, event: string, data: any, source: any): boolean {
  return emitSoul(ctx, eventTriggers(ctx, event, data), data, source, true);
}

function emitCurrentSouls(ctx: BattleEventContext, trigs: Trigger[], data: any): void {
  emitSoul(ctx, trigs, data, ctx.self, true);
  const source = ctx.self?.illusion?.target;
  if (source) emitSoul(acquiredEffectContext(ctx), trigs, data, source, true);
}

/** 「自身位於背包時：對方切換登場…」：登場方 ctx，檢查對方背包內（非在場、存活）精靈 */
function runBenchOnOppEntrance(ctx: BattleEventContext) {
  // 「切換登場」：戰鬥開始時的首發登場不算（尚未發生過任何換人）。
  if (!ctx.getPlayerState?.("previousActiveElfId")) return;
  const other = ctx.actor === "p1" ? "p2" : "p1";
  const team: any[] = (ctx.getFullTeam ? ctx.getFullTeam(other) : []) || [];
  const active = (other === "p1" ? ctx.activeP1 : ctx.activeP2) as any;
  for (const e of team) {
    if (!e || e.currentHp <= 0 || e === active || (e.battleId && e.battleId === active?.battleId)) continue;
    const mode = SOUL_MODE[String(e.id)] ?? SOUL_MODE[e.name];
    if (!mode) continue;
    const prog = getSoulProgram(e);
    for (const c of prog.clauses) {
      if (c.trig !== "bench" || !c.parsed) continue;
      for (const b of c.body) for (const a of b.acts) if (a.op === "bench_entrance_status") runAct(ctx, a, { last: null, lastAmount: 0 });
    }
  }
}

/** 技能使用／使用後（引擎直接呼叫，雙方各一次） */
export function emitSkillUse(actorCtx: BattleEventContext, oppCtx: BattleEventContext, skill: any, after: boolean) {
  const cat = skill?.category;
  const kind = cat === "屬性" ? "status" : "attack";
  const selfT = (after ? [`self_after_skill`, `self_after_${kind}`, ...(cat === "物理" ? ["self_after_physical"] : cat === "特殊" ? ["self_after_special"] : [])] : [`self_skill`, `self_${kind}`]) as Trigger[];
  const oppT = (after ? [`opp_after_skill`, `opp_after_${kind}`] : [`opp_skill`, `opp_${kind}`]) as Trigger[];
  const data = { skill };
  runSideTimers(actorCtx, selfT, data);
  emitCurrentSouls(actorCtx, selfT, data);
  runSideTimers(oppCtx, oppT, data);
  emitCurrentSouls(oppCtx, oppT, data);
}

/** 魂印完全改由積木執行（不跑手寫 handler） */
export function isSoulBlocksOnly(elf: any): boolean {
  return (SOUL_MODE[String(elf?.id)] ?? SOUL_MODE[elf?.name]) === "blocks";
}

/** 常駐閃避（僅限登記為積木魂印的精靈） */
export function soulPassiveEvade(elf: any, skill: any): number {
  if (!elf) return 0;
  // 沿用正式命中入口既有的max優先規則，不擅自把多個閃避百分比相加。
  return Math.max(...[elf, elf.illusion?.target].filter(Boolean).map(source =>
    (SOUL_MODE[String(source.id)] ?? SOUL_MODE[source.name]) ? passiveEvade(getSoulProgram(source), skill) : 0));
}

/** 積木模式（覆寫手寫程式）的技能：條件式先制「…時先制+N」 */
export function blockCondPriority(skill: any, self: any, opp: any, getStatuses: (e: any) => Record<string, number>): number {
  if (!skill || SKILL_MODE[skill.name] !== "blocks") return 0;
  const prog = getSkillProgram(skill);
  const ctxLike: any = { self, target: opp, getStatuses, getPlayerState: () => undefined, getMarks: () => [], actor: "p1", targetSide: "p2", skill };
  let bonus = 0;
  for (const c of prog.clauses) for (const b of c.body) {
    for (const a of b.acts) {
      if (a.op === "custom" && CUSTOM[a.p.key]?.prio) { bonus += CUSTOM[a.p.key].prio!(self, opp); continue; }
      const m = a.op === "noop" && String(a.p.tag || "").match(/^(.+?時)?(?:額外)?先制\s*([+＋-])\s*(\d+)/);
      if (!m || !m[1]) continue;
      const cond = b.cond?.[0] || matchCond(m[1].replace(/時$/, ""));
      if (cond && evalCond(ctxLike, cond, { last: null, lastAmount: 0 }) === true) bonus += (m[2] === "-" ? -1 : 1) * Number(m[3]);
    }
  }
  return bonus;
}

/** 積木技能：條件式「…時先制+N且必定命中」→ 條件成立時本次視為必中（引擎於命中判定前轉換技能） */
export function blockSkillTransform(ctx: BattleEventContext, skill: any): any {
  if (!skill || skill.isSureHit || SKILL_MODE[skill.name] !== "blocks") return skill;
  const prog = getSkillProgram(skill);
  for (const c of prog.clauses) for (const b of c.body) for (const a of b.acts) {
    const m = a.op === "noop" && String(a.p.tag || "").match(/^(.+?時)?.*且必定命中/);
    if (!m) continue;
    const cond = b.cond?.[0] || (m[1] ? matchCond(m[1].replace(/時$/, "")) : null);
    if (!cond || evalCond(ctx, cond, { last: null, lastAmount: 0 }) === true) return { ...skill, isSureHit: true };
  }
  return skill;
}

/** 異常附加成功後（由 applyStatusWithImmunityCheck 呼叫；雙方各自的 ctx） */
export function emitStatusApplied(ctxs: [BattleEventContext, BattleEventContext], data: { side: string; status: string; duration: number }) {
  for (const c of ctxs) {
    const trigs = statusTriggers(c, data);
    emitCurrentSouls(c, trigs, data);
  }
}

/** 自身技能無效（含未命中）時：側邊持續效果 */
export function emitSelfInvalid(ctx: BattleEventContext) { runSideTimers(ctx, ["self_invalid" as Trigger], {}); }
