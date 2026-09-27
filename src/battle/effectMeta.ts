// src/battle/effectMeta.ts
// 命名統一 + 讓 unifiedRegistry(1,155 行 / 126 條目)真正派上用場。
//
// 問題(已驗證):
//   1. TURN_EFFECT_REGISTRY 的鍵全是 "p1DeepSeaTurns"(p1 黏在字串裡),而 v4 的實際狀態鍵是
//      "DeepSeaTurns"(side 已在 p1RegistryState / p2RegistryState 的命名空間外層)
//      → 126 個鍵與實際狀態「零直接命中」。
//   2. 126 個鍵全部只有 p1 版本、p1/p2 成對數為 0 —— 這份 registry 是照舊架構(p1X/p2X 鏡像
//      useState)寫的,v4 換成 side 命名空間後整份失效。
//   3. getEffectMetadata 沒有任何呼叫端 → 整個檔案是孤兒。
//
// 本檔的做法:【不改寫那 1,155 行】,改為載入時正規化(零風險),並把它接成 timers.ts 的
// 中繼資料來源。這樣分類就有了消費者,不會變成第三份死資料。

import { TURN_EFFECT_REGISTRY, type UnifiedTurnEffect } from "../effects/unifiedRegistry";
import type { EffectSource } from "../types";
import { type Timer, type TimerKind, turnEffect, roundCounter } from "./timers";

/* ────────────────────────────────────────────────────────────
 * 1. 命名正規化 —— 唯一的正典鍵格式
 * ──────────────────────────────────────────────────────────── */

/**
 * 把任意來源的鍵正規化成正典鍵(canonical key)。
 * 規則:去掉開頭的 p1/p2 前綴。side 一律由外層命名空間表達,不進鍵名。
 *
 *   "p1DeepSeaTurns" → "DeepSeaTurns"
 *   "DeepSeaTurns"   → "DeepSeaTurns"
 */
export function canonicalKey(key: string): string {
  return key.replace(/^p[12]/, "");
}

/** 正規化後的中繼資料表(建置時算一次)。 */
export const EFFECT_META: Record<string, UnifiedTurnEffect> = (() => {
  const out: Record<string, UnifiedTurnEffect> = {};
  for (const [rawKey, meta] of Object.entries(TURN_EFFECT_REGISTRY)) {
    const k = canonicalKey(rawKey);
    // 同名衝突理論上不存在(已驗證 126 鍵去前綴後唯一);真遇到則保留先出現者並警告。
    if (out[k]) {
      if (typeof console !== "undefined") console.warn(`[effectMeta] 鍵衝突,已忽略: ${rawKey} → ${k}`);
      continue;
    }
    out[k] = { ...meta, key: k };
  }
  return out;
})();

/** 取得效果中繼資料(接受正典鍵或舊的 p1/p2 前綴鍵)。 */
export function getEffectMeta(key: string): UnifiedTurnEffect | undefined {
  return EFFECT_META[canonicalKey(key)];
}

export function hasEffectMeta(key: string): boolean {
  return canonicalKey(key) in EFFECT_META;
}

/* ────────────────────────────────────────────────────────────
 * 2. 中繼資料 → 計時器分類
 * ──────────────────────────────────────────────────────────── */

/**
 * 把 registry 的 (source, isClearable) 映射到 timers.ts 的 TimerKind。
 *
 * 依戰鬥百科定義,「回合類效果」= 由技能效果附加 + 以回合計數 + 未命名。
 * 因此判定是【兩個條件同時成立】:source === 'skill' 且 isClearable。
 * 其餘一律 round_counter(魂印/機制/道具賦予)→ 不會被「消除回合類效果」誤清。
 *
 * ⚠️ registry 沒有「次數類」的概念(舊模型只有 duration),所以本函式不會回傳 use_counter。
 *    次數類效果請在 registry 端明確標記後再擴充這裡,不要用猜的。
 */
export function toTimerKind(meta: UnifiedTurnEffect): TimerKind {
  if (meta.source === "skill" && meta.isClearable) return "turn_effect";
  return "round_counter";
}

/** 依中繼資料建立計時器。找不到中繼資料時回退為不可清除的 round_counter(保守:不誤清)。 */
export function makeTimerFromMeta(
  key: string,
  remaining: number,
  opts?: { source?: EffectSource; payload?: Record<string, any>; isLateMover?: boolean }
): Timer {
  const k = canonicalKey(key);
  const meta = EFFECT_META[k];

  if (!meta) {
    // 保守回退:未知效果不標成 turn_effect,避免被「消除回合類效果」誤清。
    return roundCounter(k, k, remaining, opts?.source ?? "mechanic");
  }

  const tickAt = meta.tickOnRoundEnd ? "round_end" : meta.tickOnActionEnd ? "action_end" : "never";
  const kind = toTimerKind(meta);

  if (kind === "turn_effect") {
    return turnEffect(k, meta.name, remaining, { tickAt: tickAt as any, payload: opts?.payload });
  }
  return roundCounter(k, meta.name, remaining, opts?.source ?? meta.source, {
    tickAt: tickAt as any,
    payload: opts?.payload,
  });
}

/* ────────────────────────────────────────────────────────────
 * 3. 舊狀態遷移 —— 把扁平的 registryState 轉成 Timer[]
 * ──────────────────────────────────────────────────────────── */

/**
 * 把 v4 現有的扁平狀態 `{ DeepSeaTurns: 3, DodgeTurns: 5, marsShieldActive: true }`
 * 轉成 Timer[](只轉數值 > 0 的計時器;布林旗標與非計時器欄位原樣留在 rest)。
 *
 * 用途:漸進遷移 —— 舊 registry 仍可用 setPlayerState 寫,tick / clear 走新系統。
 *
 * @returns { timers, rest } rest 為未被視為計時器的殘餘欄位(呼叫端自行保留)
 */
export function migrateFlatState(
  state: Record<string, any>
): { timers: Timer[]; rest: Record<string, any> } {
  const timers: Timer[] = [];
  const rest: Record<string, any> = {};

  for (const [rawKey, value] of Object.entries(state ?? {})) {
    const k = canonicalKey(rawKey);
    const isCounterLike = typeof value === "number" && value > 0 && /Turns$|Count$|Stacks$/.test(k);
    if (isCounterLike && hasEffectMeta(k)) {
      timers.push(makeTimerFromMeta(k, value));
    } else {
      rest[k] = value;
    }
  }
  return { timers, rest };
}

/* ────────────────────────────────────────────────────────────
 * 4. 診斷 —— 讓「命名不一致」在 CI 就被抓到,而不是等實戰出錯
 * ──────────────────────────────────────────────────────────── */

export interface MetaAudit {
  /** registry 有、但沒有任何程式寫入的鍵(可能是死中繼資料) */
  metaWithoutState: string[];
  /** 程式有寫入、但 registry 沒有中繼資料的鍵(會走保守回退,可能該補) */
  stateWithoutMeta: string[];
}

/**
 * 對照「registry 中繼資料」與「實際用到的狀態鍵」。
 * 供 scripts/wiring.cjs 或單元測試呼叫,把命名漂移擋在 commit 前。
 *
 * @param usedStateKeys 由掃描 setPlayerState/getPlayerState 得到的鍵集合
 */
export function auditMeta(usedStateKeys: string[]): MetaAudit {
  const used = new Set(usedStateKeys.map(canonicalKey));
  const meta = new Set(Object.keys(EFFECT_META));
  return {
    metaWithoutState: [...meta].filter(k => !used.has(k)).sort(),
    stateWithoutMeta: [...used].filter(k => !meta.has(k)).sort(),
  };
}
