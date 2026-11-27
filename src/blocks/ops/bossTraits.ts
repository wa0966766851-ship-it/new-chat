import { reportFatalResult } from '../../battle/fatalHold';
import {instantKillChance} from '../../battle/instantKillChance';
import {instantKillImmune} from '../../battle/instantKillImmunity';
// 原廠 BOSS 特性（BWIKI「赛尔号PVE概论」==BOSS特性==）的通用效果實作。
// 特性＝異常資料庫的 BOSS_ONLY 狀態（src/effects/bossTraitStatuses.ts，資料 src/data/bossTraits.ts）；
// 這裡只讀「持有者身上有哪些特性狀態」與參數（狀態實例 metadata.params，缺值用預設），不認精靈、不分 P1／P2。
// 讀取端：引擎在既有時點各加一行通用呼叫（triggerSuitEffect／triggerRelicEffect、BEFORE_DAMAGE、BEFORE_STATUS_APPLY、
// AFTER_DAMAGE、先制判定、閃避、技能無效、致命抵抗、瞬殺攔截）；其餘細節都在本檔。
import type { BattleEventContext } from "../../effects/types";
import { EffectTiming } from "../../effects/types";
import { BOSS_TRAIT_BY_STATUS, BOSS_TRAIT_BY_ID, BOSS_TRAIT_PREFIX, attachBossTraits, type BossTraitDef, type BossTraitParams, type BossTraitSpec } from "../../data/bossTraits";
export { attachBossTraits };
import { BOSS_TRAIT_POWER } from "../../effects/bossTraitStatuses";
import { addDamageReduction } from "../../battle/damageReduction";
import { isSkillDamageType } from "../../battle/damageSemantics";
import { prdChance } from "../../utils/prd";
import { applyKitPpOperation } from "../../effects/ppOperations";

export type TraitParams = BossTraitParams;
export type TraitSpec = BossTraitSpec;
interface Held { key: string; def?: BossTraitDef; p: TraitParams }

const STATS = ["atk", "def", "spatk", "spdef", "speed"] as const;
const POWER_HEAL_RATE = 30; // 「力量」造成傷害回血：原文未寫比例，保守取 30%（與吸血預設相同）
const POWER_TURNS = 3;
const MAX_HP_CAP = 99_999_999;

const alive = (e: any) => (e?.currentHp ?? 0) > 0;
const idOf = (e: any) => String(e?.battleId || e?.id || "");

/** 持有者身上有效的特性（直接掃 effects／battleStatuses，沒有特性時近乎零成本）。 */
export function bossTraitsOf(elf: any): Held[] {
  if (!elf) return [];
  const out: Held[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    if (seen.has(name)) return; seen.add(name);
    if (name === BOSS_TRAIT_POWER) { out.push({ key: "power", p: {} }); return; }
    const def = BOSS_TRAIT_BY_STATUS[name];
    if (!def || def.conf === "existing") return;
    const eff = (elf.effects || []).find((e: any) => e?.id === name);
    out.push({ key: def.id, def, p: { ...def.def, ...(eff?.metadata?.params || {}) } });
  };
  for (const e of elf.effects || []) if (e?.id?.startsWith?.(BOSS_TRAIT_PREFIX) && Number(e.duration) > 0) add(e.id);
  const bs = elf.battleStatuses;
  if (bs) for (const k of Object.keys(bs)) if (k.startsWith(BOSS_TRAIT_PREFIX) && Number(bs[k]) > 0) add(k);
  return out;
}
export const hasBossTrait = (elf: any, id: string) => bossTraitsOf(elf).some(t => t.key === id);

// ───────── 小工具
const chance = (c: BattleEventContext, id: string, pct = 100) => prdChance(`${c.actor}:bt:${id}`, Math.max(0, Math.min(100, Number(pct))) / 100);
const note = (c: BattleEventContext, def: BossTraitDef | undefined, text: string) => c.addLog(`👑 【${def?.name ?? "力量"}】${text}`, "effect");
const randomStats = (c: BattleEventContext, n: number): string[] => {
  const pool = [...STATS] as string[], rng = c.rng ?? Math.random, out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
};
const positives = (elf: any): Record<string, number> => Object.fromEntries(STATS.filter(k => Number(elf?.statStages?.[k]) > 0).map(k => [k, Number(elf.statStages[k])]));
const damageComp = (data: any) => data?.damageComp ?? (data && "damageCategory" in data ? data : undefined);
/** 消除對手全部能力提升；回傳被消除的量（已套用「能力提升無法被消除」等保護）。 */
function clearBoosts(c: BattleEventContext): Record<string, number> {
  const gains = positives(c.target);
  if (!Object.keys(gains).length) return {};
  const stages: any = { ...(c.target.statStages || {}) };
  for (const k of Object.keys(gains)) stages[k] = 0;
  c.updateElf(c.targetSide, { statStages: stages });
  const after = c.getFullTeam?.(c.targetSide)?.find(e => idOf(e) === idOf(c.target)) ?? c.target;
  const removed: Record<string, number> = {};
  for (const [k, v] of Object.entries(gains)) { const left = Math.max(0, Number(after.statStages?.[k]) || 0); if (v - left > 0) removed[k] = v - left; }
  return removed;
}
const stealBoosts = (c: BattleEventContext, def: BossTraitDef | undefined): boolean => {
  const gains = clearBoosts(c);
  if (!Object.keys(gains).length) return false;
  c.applyStatChange(c.actor, gains);
  note(c, def, `吞噬了對手的能力提升（${Object.entries(gains).map(([k, v]) => `${k}+${v}`).join("、")}）。`);
  return true;
};
function applyHealSafe(c: BattleEventContext, n: number) { if (n > 0 && alive(c.self)) c.applyHeal(c.actor, Math.floor(n)); }

type Handler = (c: BattleEventContext, ev: EffectTiming, data: any, p: TraitParams, def?: BossTraitDef) => void;
const num = (v: number | undefined, d = 0) => (Number.isFinite(v) ? (v as number) : d);

// ───────── 各特性（鍵＝BossTraitDef.id；power＝覺醒的「力量」）
const H: Record<string, Handler> = {
  swift: (_c, ev, d, p) => { if (ev === EffectTiming.MODIFY_PRIORITY && d?.priorityComp) d.priorityComp.bonus += num(p.x); },
  // 疾行：必定先手＝先制 +6 並無視對手的先制效果（forcedFirst）；免疫瞬殺見 bossTraitBlocksInstantKill。不涉及任何異常狀態。
  rush: (_c, ev, d) => { if (ev === EffectTiming.MODIFY_PRIORITY && d?.priorityComp) { d.priorityComp.bonus += 6; d.priorityComp.forcedFirst = true; } },
  amp: (_c, ev, d, p) => { const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d); if (comp && !comp.isIncoming && isSkillDamageType(comp.damageCategory)) comp.increasePercent += num(p.x) / 100; },
  guard: (_c, ev, d, p) => { const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d); if (comp?.isIncoming && comp.damageCategory !== "true") addDamageReduction(comp, num(p.x) / 100); },
  weakpoint: (c, ev, d, p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (comp && !comp.isIncoming && comp.damageCategory === "skill_attack" && chance(c, "weakpoint", p.x)) { comp.multiplier *= num(p.y, 2); note(c, def, `命中要害！本次傷害 ×${num(p.y, 2)}。`); }
  },
  block: (c, ev, d, p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    // 類型：A＝物攻格擋、B＝特攻格擋、AB＝兩者（擴展；舊存檔預設）
    const kinds = p.v === "A" ? ["物理"] : p.v === "B" ? ["特殊"] : ["物理", "特殊"];
    if (comp?.isIncoming && comp.damageCategory === "skill_attack" && kinds.includes(String(comp.skillCategory)) && chance(c, "block", p.x)) { comp.incomingDamageCancellation = "block"; comp.multiplier = 0; note(c, def, "擋下了這次攻擊傷害！"); }
  },
  vigilance: (c, ev, d, p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (!comp?.isIncoming || comp.damageCategory !== "skill_attack") return;
    if (Number(c.getOpponentState?.("actionPriorityThisTurn")) > 0) return; // 對手用了先制技能：吃得到傷害
    if (chance(c, "vigilance", p.x)) { comp.multiplier = 0; note(c, def, "對手不是先制技能，傷害被戒備擋下！"); }
  },
  clearturn: (c, ev, d, _p, def) => { if (ev === EffectTiming.AFTER_ACTION && !d?.isIncoming && alive(c.self) && c.clearTurnEffectsOf(c.targetSide)) note(c, def, "消除了對手的回合類效果。"); },
  fortitude: (c, ev, d, _p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (comp?.isIncoming && (comp.damageCategory === "fixed" || comp.damageCategory === "percent")) { comp.multiplier = 0; note(c, def, "免疫了固定／百分比傷害。"); }
  },
  // 免傷：依「最終傷害點數」判定（A＝免疫低於 X 點、B＝免疫大於 X 點）；真實傷害除外。
  immune: (c, ev, d, p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (!comp?.isIncoming || comp.damageCategory === "true") return;
    const x = num(p.x), above = p.v === "B";
    (comp.conditionalImmunities ||= []).push((amount: number) => {
      if (above ? amount <= x : amount >= x) return false;
      note(c, def, `免疫了${above ? "大於" : "低於"} ${x} 點的傷害（${Math.floor(amount)}）。`); return true;
    });
  },
  // 威力免傷（擴展）：以對手攻擊技能的威力判定。
  powerguard: (c, ev, d, p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (!comp?.isIncoming || comp.damageCategory !== "skill_attack") return;
    const power = Number(c.opponentSkill?.power);
    if (Number.isFinite(power) && power < num(p.x)) { comp.multiplier = 0; note(c, def, `對手技能威力 ${power} 低於 ${num(p.x)}，免疫傷害。`); }
  },
  // 免疫反彈致命：受到致命一擊的攻擊傷害時免疫，並把該次傷害反彈給攻擊者（真實傷害，不會再被反彈）。
  critreflect: (c, ev, d, _p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (!comp?.isIncoming || comp.damageCategory !== "skill_attack" || !comp.isCrit) return;
    (comp.conditionalImmunities ||= []).push((amount: number) => {
      const n = Math.floor(amount);
      note(c, def, `免疫並反彈致命一擊（${n}）！`);
      if (n > 0 && alive(c.target)) c.applyTrueDamage(c.targetSide, n, "免疫反彈致命");
      return true;
    });
  },
  // 先手免傷：自身本回合先出手，當回合免疫受到的攻擊傷害。先後手以「自身出手流程開始時對手是否已出手」判定。
  firstguard: (c, ev, d, _p, def) => {
    if (ev === EffectTiming.OPPONENT_ACTION) { c.setPlayerState("bt:oppActedRound", c.roundNumber); return; }
    if (ev === EffectTiming.BEFORE_ACTION) { if (c.getPlayerState("bt:oppActedRound") !== c.roundNumber) c.setPlayerState("bt:firstRound", c.roundNumber); return; }
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (comp?.isIncoming && comp.damageCategory === "skill_attack" && c.getPlayerState("bt:firstRound") === c.roundNumber) { comp.multiplier = 0; note(c, def, "本回合先出手，免疫攻擊傷害！"); }
  },
  thorns: (c, ev, d, p, def) => {
    if (ev !== EffectTiming.AFTER_DAMAGE || !d?.isIncoming || !isSkillDamageType(String(d.damageType)) || !d.attackerSide) return;
    const n = Math.floor(Number(d.hpReduced) * num(p.x) / 100);
    if (n > 0) { note(c, def, `反彈 ${n} 點真實傷害。`); c.applyTrueDamage(d.attackerSide, n, "反傷"); }
  },
  evolve: (c, ev, d, _p, def) => {
    if (ev === EffectTiming.AFTER_ACTION && !d?.isIncoming && alive(c.self)) { c.applyStatChange(c.actor, Object.fromEntries(STATS.map(k => [k, 1]))); note(c, def, "全能力等級 +1。"); }
  },
  corrupt: (c, ev, d, _p, def) => {
    if (ev === EffectTiming.AFTER_ACTION && d?.isIncoming && alive(c.self)) { c.applyStatChange(c.targetSide, Object.fromEntries(STATS.map(k => [k, -1]))); note(c, def, "對手全能力等級 −1。"); }
  },
  empower: (c, ev, _d, p, def) => {
    if (ev !== EffectTiming.ROUND_START || !alive(c.self)) return;
    const pick = randomStats(c, num(p.x, 2)); c.applyStatChange(c.targetSide, Object.fromEntries(pick.map(k => [k, -num(p.y, 1)])));
    note(c, def, `對手 ${pick.join("、")} 等級 −${num(p.y, 1)}。`);
  },
  weaken: (c, ev, _d, p, def) => {
    if (ev !== EffectTiming.ROUND_START || !alive(c.self)) return;
    const y = num(p.y, 1), pick = randomStats(c, num(p.x, 2));
    const res = c.applyStatChange(c.targetSide, Object.fromEntries(pick.map(k => [k, -y])));
    const gain = Object.fromEntries(Object.entries(res.applied).filter(([, v]) => v < 0).map(([k, v]) => [k, -v]));
    if (Object.keys(gain).length) { c.applyStatChange(c.actor, gain); note(c, def, `吸取了對手的能力（${Object.keys(gain).join("、")}）。`); }
  },
  dispel: (c, ev, d, _p, def) => {
    if (ev === EffectTiming.AFTER_ACTION && d?.isIncoming && alive(c.self) && Object.keys(clearBoosts(c)).length) note(c, def, "消除了對手的能力提升。");
  },
  devour: (c, ev, d, _p, def) => { if (ev === EffectTiming.AFTER_DAMAGE && !d?.isIncoming && String(d?.damageType) === "skill_attack" && alive(c.self)) stealBoosts(c, def); },
  envy: (c, ev, d, _p, def) => {
    if (ev === EffectTiming.BEFORE_DAMAGE) {
      const comp = damageComp(d);
      if (comp && !comp.isIncoming && isSkillDamageType(comp.damageCategory) && c.hasTurnEffectOn(c.targetSide)) { comp.increasePercent += 1; note(c, def, "對手處於回合類效果，傷害 +100%。"); }
      return;
    }
    const isOppMove = ev === EffectTiming.OPPONENT_ACTION || ev === EffectTiming.ROUND_START || (ev === EffectTiming.AFTER_ACTION && d?.isIncoming);
    if (!isOppMove || !alive(c.self)) return;
    const up = positives(c.target); if (!Object.keys(up).length) return;
    c.applyStatChange(c.targetSide, Object.fromEntries(Object.entries(up).map(([k, v]) => [k, -2 * v])));
    note(c, def, "對手的能力提升被視為能力下降。");
  },
  greed: (c, ev, _d, p, def) => {
    // 回合結束：吸取對手 X 點體力（原廠時點；2026-11-15 由回合開始移至回合結束）
    if (ev === EffectTiming.ROUND_END && alive(c.self) && alive(c.target)) {
      const n = Math.floor(num(p.x));
      if (n > 0) { c.applyFixedDamage(c.targetSide, n, "貪婪", { unscaled: true }); applyHealSafe(c, n); note(c, def, `吸取 ${n} 點體力。`); }
      return;
    }
    if (ev !== EffectTiming.ROUND_START || !alive(c.self)) return;
    if (!stealBoosts(c, def)) {
      const pick = randomStats(c, 3), res = c.applyStatChange(c.targetSide, Object.fromEntries(pick.map(k => [k, -2])));
      const gain = Object.fromEntries(Object.entries(res.applied).filter(([, v]) => v < 0).map(([k, v]) => [k, -v]));
      if (Object.keys(gain).length) { c.applyStatChange(c.actor, gain); note(c, def, "對手沒有能力提升，改為隨機 3 項能力 −2 並加給自己。"); }
    }
  },
  harden: (c, ev, d, p, def) => {
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (comp?.isIncoming && comp.damageCategory === "skill_attack" && !comp.isCrit && chance(c, "harden", p.x)) { comp.incomingDamageCancellation = "block"; comp.multiplier = 0; note(c, def, "不是致命一擊，攻擊被抵擋！"); }
  },
  recover: (c, ev, d, _p, def) => {
    if (ev === EffectTiming.AFTER_DAMAGE && d?.isIncoming && d.isCrit && isSkillDamageType(String(d.damageType))) c.setPlayerState("bt:recoverRound", c.roundNumber);
    if (ev === EffectTiming.ROUND_END && alive(c.self) && c.getPlayerState("bt:recoverRound") === c.roundNumber) {
      c.setPlayerState("bt:recoverRound", 0);
      if (c.self.currentHp < c.self.maxHp) { applyHealSafe(c, c.self.maxHp - c.self.currentHp); note(c, def, "本回合受到致命一擊，恢復全部體力！"); }
    }
  },
  lock: (c, ev, _d, p) => { if (ev === EffectTiming.ON_ENTRANCE && c.self.critValue !== p.x && Number.isFinite(p.x)) c.updateElf(c.actor, { critValue: p.x } as any); },
  instakill: (c, ev, d, p, def) => {
    if (ev !== EffectTiming.AFTER_DAMAGE || !d?.isIncoming || !d.isCrit || !isSkillDamageType(String(d.damageType)) || !d.attackerSide) return;
    const foe: any = c.target;
    if (!alive(foe) || !instantKillChance(c, "boss:instakill", num(p.x,100), d.attackerSide)) return;
    note(c, def, `受到致命一擊，對手體力歸 0！`);
    c.applyInstantKill?.(d.attackerSide, "秒殺");
  },
  awaken: (c, ev, _d, p, def) => {
    if (ev !== EffectTiming.ROUND_END || !alive(c.self) || c.self.currentHp >= c.self.maxHp * num(p.x, 30) / 100 || bossTraitsOf(c.self).some(t => t.key === "power")) return;
    if (c.applyStatusWithImmunityCheck(c.actor, BOSS_TRAIT_POWER, POWER_TURNS)?.success) note(c, def, `體力低於 ${num(p.x, 30)}%，獲得 ${POWER_TURNS} 回合「力量」！`);
  },
  power: (c, ev, d) => {
    if (ev === EffectTiming.BEFORE_ACTION) { c.setPlayerState("nextTurnCrit", true); c.setPlayerState("ignoreOppBuffThisAction", true); }
    if (ev === EffectTiming.AFTER_ACTION && !d?.isIncoming && alive(c.self)) c.clearTurnEffectsOf(c.targetSide);
    if (ev === EffectTiming.AFTER_DAMAGE && !d?.isIncoming && String(d?.damageType) === "skill_attack") applyHealSafe(c, Number(d.hpReduced) * POWER_HEAL_RATE / 100);
  },
  sharp: (c, ev, _d, p, def) => {
    if (ev === EffectTiming.ROUND_END && alive(c.self) && alive(c.target)) { note(c, def, `附加 ${num(p.x)} 點固定傷害。`); c.applyFixedDamage(c.targetSide, num(p.x), "鋒銳", { unscaled: true }); }
  },
  vampire: (c, ev, d, p, def) => {
    if (ev !== EffectTiming.AFTER_DAMAGE || d?.isIncoming || String(d?.damageType) !== "skill_attack") return;
    const n = Math.floor(Number(d.hpReduced) * num(p.x) / 100);
    if (n > 0 && alive(c.self)) { applyHealSafe(c, n); note(c, def, `恢復 ${n} 點體力。`); }
  },
  drain: (c, ev, _d, p, def) => {
    if (ev !== EffectTiming.ROUND_END || !alive(c.self) || !alive(c.target)) return;
    const n = Math.min(Math.floor(num(p.x)), c.target.currentHp);
    if (n > 0) { c.applyTrueDamage(c.targetSide, n, "生命汲取"); applyHealSafe(c, n); note(c, def, `汲取 ${n} 點體力。`); }
  },
  mend: (c, ev, _d, p, def) => {
    if (ev !== EffectTiming.ROUND_END || !alive(c.self) || c.self.currentHp >= c.self.maxHp) return;
    if (p.v === "B") { applyHealSafe(c, num(p.x)); note(c, def, `恢復 ${num(p.x)} 點體力。`); } // B＝定點恢復
    else { applyHealSafe(c, c.self.maxHp / Math.max(1, num(p.x, 10))); note(c, def, `恢復 1/${num(p.x, 10)} 最大體力。`); }
  },
  // 暴食：回合開始加體力上限、回合結束恢復已損失體力（原廠時點；2026-11-15 拆開）
  gluttony: (c, ev, _d, p, def) => {
    if (!alive(c.self)) return;
    if (ev === EffectTiming.ROUND_START) {
      const max = c.self.maxHp, next = Math.min(MAX_HP_CAP, Math.floor(max * (1 + num(p.x, 10) / 100)));
      if (next > max) { c.updateElf(c.actor, { maxHp: next, calculatedStats: { ...c.self.calculatedStats, hp: next } } as any); note(c, def, `體力上限 +${num(p.x, 10)}%。`); }
    }
    if (ev === EffectTiming.ROUND_END) {
      const lost = c.self.maxHp - c.self.currentHp;
      if (lost > 0) { applyHealSafe(c, lost * num(p.y, 30) / 100); note(c, def, `恢復已損失體力的 ${num(p.y, 30)}%。`); }
    }
  },
  // 侵染：回合開始雙方體力恢復效果各 −X%（累計）；減為 0 之前，自身攻擊傷害 +100% 並附加 Y 點固定傷害。
  infect: (c, ev, d, p, def) => {
    const step = Math.max(0, num(p.x, 10)) / 100, level = Number(c.getPlayerState("bt:infect")) || 0;
    if (ev === EffectTiming.ROUND_START && alive(c.self) && level * step < 1) {
      const next = level + 1, cut = Math.min(1, next * step);
      c.setPlayerState("bt:infect", next);
      for (const side of [c.actor, c.targetSide] as const) c.addTimerTo(side, { id: `boss-infect:${c.actor}`, name: "侵染", description: `體力恢復效果減少 ${Math.round(cut * 100)}%。`,
        kind: "round_counter", source: "soulmark", remaining: 999, tickAt: "never", stackRule: "replace", scope: "team", persistsOffField: true, clearable: false,
        payload: { recoveryReductionPercent: cut } } as any, false);
      note(c, def, `雙方體力恢復效果減少至 ${Math.round((1 - cut) * 100)}%。`);
      return;
    }
    if (level * step >= 1) return; // 恢復效果已減為 0：增傷與固傷結束
    const comp = ev === EffectTiming.BEFORE_DAMAGE && damageComp(d);
    if (comp && !comp.isIncoming && comp.damageCategory === "skill_attack") comp.increasePercent += 1;
    if (ev === EffectTiming.AFTER_DAMAGE && !d?.isIncoming && String(d?.damageType) === "skill_attack" && alive(c.self) && alive(c.target)) c.applyFixedDamage(c.targetSide, num(p.y, 300), "侵染", { unscaled: true });
  },
  reducepp: (c, ev, d, p, def) => {
    if (ev !== EffectTiming.AFTER_DAMAGE || d?.isIncoming || String(d?.damageType) !== "skill_attack" || !chance(c, "reducepp", p.x)) return;
    const live = (c.target.skills || []).filter((s: any) => s.pp > 0);
    const rng = c.rng ?? Math.random, pool = [...live], chosen: any[] = [];
    for (let i = 0; i < num(p.y, 1) && pool.length; i++) chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    if (chosen.length) { applyKitPpOperation(c, c.targetSide, "zero", 0, s => chosen.some(x => x === s || x.name === s.name)); note(c, def, `對手 ${chosen.map(s => s.name).join("、")} 的 PP 歸零。`); }
  },
  inflict: (c, ev, d, p, def) => {
    if (ev !== EffectTiming.AFTER_DAMAGE || d?.isIncoming || String(d?.damageType) !== "skill_attack" || !alive(c.target) || !chance(c, "inflict", p.x)) return;
    const s = p.s || "麻痺";
    if (c.applyStatusWithImmunityCheck(c.targetSide, s, 2)?.success) note(c, def, `令對手陷入「${s}」2 回合。`);
  },
  typeswap: (c, ev, _d, _p, def) => {
    if (ev !== EffectTiming.ON_ENTRANCE && ev !== EffectTiming.ROUND_START) return;
    const me: any = c.self, foe: any = c.target;
    if (!alive(me) || !alive(foe)) return;
    if (c.getPlayerState("bt:typeswap") === `${idOf(me)}|${idOf(foe)}`) return;
    const meType = me.originalType || me.type, foeType = foe.originalType || foe.type;
    c.updateElf(c.actor, { type: foeType, originalType: meType, typeChangedUntilSwitch: true } as any);
    c.updateElf(c.targetSide, { type: meType, originalType: foeType, typeChangedUntilSwitch: true } as any);
    c.setPlayerState("bt:typeswap", `${idOf(me)}|${idOf(foe)}`);
    note(c, def, `與【${foe.name}】互換屬性（${meType} ⇄ ${foeType}）。`);
  },
};

/** 通用派發：持有者有特性時，依事件呼叫對應處理器。ctx 可傳工廠，沒特性時不建構。 */
export function runBossTraitEffects(owner: any, ctx: BattleEventContext | (() => BattleEventContext), event: EffectTiming, data?: any): void {
  if (!owner || !alive(owner)) return;
  const held = bossTraitsOf(owner);
  if (!held.length) return;
  const c = typeof ctx === "function" ? ctx() : ctx;
  for (const t of held) H[t.key]?.(c, event, data, t.p, t.def);
}

// ───────── 引擎讀取端（各一行呼叫）
/** 致盲：回傳受方的額外閃避百分比。 */
export function bossTraitEvade(defender: any): number {
  let ev = 0;
  for (const t of bossTraitsOf(defender)) if (t.key === "blind") ev = Math.max(ev, num(t.p.x));
  return ev;
}
export interface BossTraitInvalidation {
  /** 對手本次技能無法造成技能傷害（僅攻擊技能） */
  noSkillDamage: boolean;
  /** 對手本次技能的附加效果失效 */
  addEffectsInvalid: true;
  /** 整個技能無效（封魔 B 型，擴展）：由引擎走既有的技能無效流程 */
  wholeSkill?: true;
  /** 戰鬥紀錄用原因 */
  reason: string;
}
/**
 * 封魔／技能無效：受方的特性令來襲技能失效（含機率判定，每次呼叫擲一次）。
 * 2026-11-15 用語與判定：不再是「整招無效」。
 *  - 屬性技能（封魔）→ 屬性技能附加效果失效。
 *  - 攻擊技能（技能無效）→ 無法造成技能傷害且技能附加效果失效。
 * 技能無效的類型：A＝一般；B＝龍威型（對手釋放先制技能時）；C＝後手無效（對手攻擊技能後出手時）。
 */
export function bossTraitInvalidates(defender: any, side: "p1" | "p2", skill: any, when: { attackerSecond?: boolean; attackerPriority?: number } = {}): BossTraitInvalidation | null {
  if (!skill || !alive(defender)) return null;
  const isStatusSkill = skill.category === "屬性";
  for (const t of bossTraitsOf(defender)) {
    if (t.key === "sealmagic" && isStatusSkill && prdChance(`${side}:bt:sealmagic`, num(t.p.x) / 100))
      return t.p.v === "B"
        ? { noSkillDamage: false, addEffectsInvalid: true, wholeSkill: true, reason: "【特性·封魔】" }
        : { noSkillDamage: false, addEffectsInvalid: true, reason: "【特性·封魔】屬性技能附加效果失效" };
    if (t.key !== "nullify") continue;
    const v = t.p.v || "A";
    if (v === "B" ? !(Number(when.attackerPriority) > 0) : isStatusSkill) continue; // B：先制技能（含屬性）；A／C：只管攻擊技能
    if (v === "C" && !when.attackerSecond) continue;
    if (!prdChance(`${side}:bt:nullify`, num(t.p.x) / 100)) continue;
    const label = v === "B" ? "先制無效" : v === "C" ? "後手無效" : "技能無效";
    return isStatusSkill
      ? { noSkillDamage: false, addEffectsInvalid: true, reason: `【特性·${label}】屬性技能附加效果失效` }
      : { noSkillDamage: true, addEffectsInvalid: true, reason: `【特性·${label}】無法造成技能傷害且技能附加效果失效` };
  }
  return null;
}
/** 疾行：免疫瞬殺。統一入口在 src/battle/instantKillImmunity.ts（結算與 AI 共用），此處保留舊名供既有呼叫端使用。 */
export const bossTraitBlocksInstantKill = (target: any): boolean => instantKillImmune(target);
/** 復甦：致命傷害時恢復全部體力，次數用完即移除；沿用「星佑」的致命抵抗介面（修改 ctx.self 後回傳 true）。 */
export function checkBossTraitFatalResist(ctx: BattleEventContext): boolean {
  const self: any = ctx.self;
  const eff = (self?.effects || []).find((e: any) => e?.id === BOSS_TRAIT_BY_ID.revive.status && Number(e.duration) > 0);
  const left = Number(eff?.stacks) || 0;
  if (!eff || left <= 0) return false;
  reportFatalResult(ctx, 'rebirth');
  self.currentHp = self.maxHp;
  if (left - 1 > 0) self.effects = self.effects.map((e: any) => (e === eff ? { ...e, stacks: left - 1 } : e));
  else {
    self.effects = self.effects.filter((e: any) => e !== eff);
    if (self.battleStatuses) { self.battleStatuses = { ...self.battleStatuses }; delete self.battleStatuses[eff.id]; }
  }
  ctx.addLog(`👑 【復甦】：體力歸零時恢復全部體力！（剩餘 ${left - 1} 次）`, "effect");
  return true;
}

// ───────── Kit／積木 op：授予特性（精靈編輯器、其他模式也能用同一套）
export const BOSS_TRAIT_ACTION_FIELDS = { boss_trait: ["side", "id", "x", "y", "s", "v", "turns"] } as const;
export function bossTraitActionIssue(op: string, p: any): string | null {
  if (!(op in BOSS_TRAIT_ACTION_FIELDS)) return null;
  const def = BOSS_TRAIT_BY_ID[p?.id];
  if (!def || def.conf === "existing") return "BOSS 特性需指定資料表內的特性 id（神話請用既有狀態）";
  if (!["self", "opp"].includes(p.side)) return "BOSS 特性需指定自身或對手";
  for (const k of ["x", "y"] as const) if (p[k] !== undefined && !(Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 1e9)) return "BOSS 特性參數需為非負有限數";
  if (p.s !== undefined && (typeof p.s !== "string" || !p.s || p.s.length > 20)) return "BOSS 特性異常名稱需為短文字";
  if (p.v !== undefined && !def.variants?.some(v => v.key === p.v)) return "BOSS 特性類型需為該特性已定義的類型";
  if (p.turns !== undefined && !(Number.isInteger(p.turns) && p.turns >= 1 && p.turns <= 98)) return "開啟回合數需為 1–98 回合";
  return null;
}
export function bossTraitOperations() {
  return {
    boss_trait: (ctx: BattleEventContext, p: { side: "self" | "opp"; id: string } & TraitParams): boolean => {
      const side = p.side === "opp" ? ctx.targetSide : ctx.actor;
      const target: any = side === ctx.actor ? ctx.self : ctx.target;
      if (!target || bossTraitActionIssue("boss_trait", p)) return false;
      const next = attachBossTraits(target, [{ id: p.id, x: p.x, y: p.y, s: p.s, v: (p as any).v, turns: (p as any).turns }]);
      ctx.updateElf(side, { effects: next.effects, battleStatuses: next.battleStatuses, ...((next as any).critValue !== target.critValue ? { critValue: (next as any).critValue } : {}) } as any);
      return true;
    },
  };
}
