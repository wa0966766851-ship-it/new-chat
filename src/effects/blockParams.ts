// 積木（Blockly）輸出的參數 → effectRunner ATOMS 參數
// 積木詞條 codeId 直接是原子名稱，執行時不再重新解析 customText。
import type { KitEntry } from "./effectSystem.schema";

export type RunnableAtom = { atom: string; params: Record<string, any>; target: "self" | "opponent" };

const STAT_KEY: Record<string, string> = { spAtk: "spatk", spDef: "spdef", spatk: "spatk", spdef: "spdef", atk: "atk", def: "def", speed: "speed", accuracy: "accuracy" };

/** 預設目標：對手（傷害／異常／扣PP等）或自身（恢復／護盾等） */
const SELF_DEFAULT = new Set(["heal", "shield", "maxhp_change", "cure_status", "stat_change", "rebirth", "immune", "extra_action", "vanish", "priority", "accuracy", "crit", "pierce", "damage_multiplier", "damage_reduce", "turn_effect_apply", "condition_gate"]);

export function normalizeBlockAtom(atom: string, raw: Record<string, any> = {}): RunnableAtom {
  const p: Record<string, any> = { ...raw };
  let target: "self" | "opponent" = raw.target === "self" || raw.target === "opponent" ? raw.target : (SELF_DEFAULT.has(atom) ? "self" : "opponent");
  switch (atom) {
    case "extra_damage":
      p.dmgType = raw.dmgType || raw.damageType || "fixed";
      if (p.dmgType === "percent") p.ratio = raw.ratio ?? (Number(raw.amount) || 0) / 100;
      break;
    case "heal":
      if (raw.mode === "percent") { p.ratio = raw.ratio ?? (Number(raw.amount) || 0) / 100; p.amount = 0; }
      break;
    case "damage_reflect":
      p.ratio = raw.ratio ?? Number(raw.percent ?? 50) / 100;
      break;
    case "maxhp_change":
      if (raw.mode === "reduce") p.amount = -Math.abs(Number(raw.amount) || 0);
      break;
    case "stat_change": {
      const v = Number(raw.stages ?? raw.value ?? 1);
      if (raw.stat === "all") { p.all = v; delete p.stat; }
      else if (raw.stat) { p.stat = STAT_KEY[raw.stat] || raw.stat; p.value = v; }
      break;
    }
    case "clear_stat":
      p.type = raw.type || (raw.statType === "boost" ? "buff" : raw.statType === "drop" ? "debuff" : "all");
      break;
    case "pp_op":
      p.op = raw.op || (raw.mode === "recover" ? "add" : raw.mode === "drain" ? "drain" : "reduce");
      break;
    case "priority":
      p.bonus = Number(raw.bonus ?? raw.level ?? 1);
      break;
    case "accuracy":
      if (raw.mode === "boost" || raw.mode === "drop") {
        return { atom: "stat_change", params: { stat: "accuracy", value: raw.mode === "boost" ? 1 : -1 }, target: raw.mode === "boost" ? "self" : "opponent" };
      }
      if (raw.mode === 'evade') p.evade = true;
      else p.alwaysHit = true;
      break;
    case "turn_effect_apply":
      p.polarity = raw.polarity || (target === "self" ? "POSITIVE" : "NEGATIVE");
      break;
    case "rebirth":
      p.turns = Number(raw.turns ?? 2);
      break;
  }
  delete p.target;
  return { atom, params: p, target };
}

/** 積木詞條（codeId 為原子名）→ 可執行原子；非積木詞條回傳 null */
export function blockEntryToAtom(entry: KitEntry, atoms: Record<string, unknown>): RunnableAtom | null {
  if (!entry || !entry.codeId || entry.codeId === "custom" || !atoms[entry.codeId]) return null;
  const n = normalizeBlockAtom(entry.codeId, entry.params || {});
  if (n.atom === "turn_effect_apply" && !Array.isArray(n.params.wrapItems) && Array.isArray(n.params.wraps)) {
    // 各包裝原子共用 wrapParams：逐一正規化後合併
    let merged: Record<string, any> = { ...(n.params.wrapParams || {}) };
    for (const w of n.params.wraps) merged = { ...merged, ...normalizeBlockAtom(w, n.params.wrapParams || {}).params };
    n.params.wrapParams = merged;
  }
  if (n.atom === "condition_gate" && n.params.inner) {
    const inner = normalizeBlockAtom(n.params.inner, { ...(n.params.innerParams || {}),
      ...(n.params.innerTarget !== undefined ? { target: n.params.innerTarget } : {}) });
    n.params.inner = inner.atom;
    n.params.innerParams = inner.params;
    n.params.innerTarget = inner.target;
  }
  return n;
}
