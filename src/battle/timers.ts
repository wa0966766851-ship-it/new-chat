import type { EffectSource } from "../types";

/* ────────────────────────────────────────────────────────────
 * 1. 分類定義(依戰鬥百科)
 * ──────────────────────────────────────────────────────────── */

/**
 * 計時器種類。
 *
 * - `turn_effect`  「回合類效果」:由**技能效果**附加、以**回合**為計數的**未命名**效果。
 *                   ★ 唯一能被「消除回合類效果」清除、且會被「處於回合類效果」響應的種類。
 * - `round_counter`「其他回合記數效果」:由魂印/機制/道具等技能以外手段附加的回合計數。
 *                   不可被「消除回合類效果」清除 —— 這是魂印效果不再被誤清的關鍵。
 * - `use_counter`  「次數類效果」:以**次數**為計數(如「下 2 次攻擊」「消耗 1 次次數」)。
 *                   舊模型只有 `duration` 一個欄位,回合與次數混用 —— 本種類補上該缺口。
 */
export type TimerKind = "turn_effect" | "round_counter" | "use_counter";

/** 計時器遞減的時機。`never` = 只能被主動消耗(次數類常用)。 */
export type TickAt = "round_end" | "action_end" | "never";

export interface Timer {
  scope?: "elf" | "team";
  ownerBattleId?: string;
  persistsOffField?: boolean;
  /** 內部唯一 id(同 id 再次附加時依 stackRule 處理) */
  id: string;
  /** 顯示名稱。`turn_effect` 依定義為「未命名」,此處僅供 UI/log 用,不參與判定。 */
  name: string;
  kind: TimerKind;
  /** 來源。turn_effect 依定義恆為 'skill';其餘種類用來追溯。 */
  source: EffectSource;
  /** 剩餘回合數 or 次數 */
  remaining: number;
  tickAt: TickAt;
  /**
   * 後手補償待決標記。
   * 依定義:回合類效果在**後出手**附加、且**當回合無法直接觸發收益**時,回合數 +1。
   * 附加時若條件成立則設為 true,並於當回合的 tick 略過一次(見 tickTimers)。
   */
  lateMoverPending?: boolean;
  /** 同 id 重複附加時的行為 */
  stackRule?: "refresh" | "extend" | "stack" | "ignore";
  layers?: number;
  /** 效果本身的參數(與計時器分離:計時器只管命,payload 管效) */
  payload?: Record<string, any>;
  /** UI 顯示用的短標籤 (如 "封", "盾") */
  displayChar?: string;
  /** 詳細說明文字 */
  description?: string;
}

/* ────────────────────────────────────────────────────────────
 * 2. 附加(含後手補償規則)
 * ──────────────────────────────────────────────────────────── */

export interface AddContext {
  /** 附加者本回合是否為後出手 */
  isLateMover: boolean;
  /**
   * 本回合是否已經無法從此效果獲得收益。
   * 例:後手才掛「受到傷害減半」,但本回合的傷害已經結算完 → true。
   * 由呼叫端依效果性質判定(引擎最清楚時序),預設 true 較安全(偏向補償)。
   */
  benefitAlreadyMissed?: boolean;
}

/**
 * 附加一個計時器。回傳新陣列(不可變,安全用於 reducer)。
 *
 * 後手補償只適用於 `turn_effect` 且以回合計數 —— `use_counter` 不適用(次數不會因回合流逝而損失)。
 */
export function addTimer(list: Timer[], timer: Timer, ctx?: AddContext): Timer[] {
  const t: Timer = { ...timer };
  if (t.layers === undefined) {
    t.layers = 1;
  }

  // 依定義:僅「回合類效果」在後出手且當回合無法觸發收益時 +1
  if (
    t.kind === "turn_effect" &&
    t.tickAt !== "never" &&
    ctx?.isLateMover &&
    (ctx.benefitAlreadyMissed ?? true)
  ) {
    t.lateMoverPending = true;
  }

  const idx = list.findIndex(x => x.id === t.id);
  if (idx === -1) return [...list, t];

  const old = list[idx];
  const next = [...list];
  switch (t.stackRule ?? old.stackRule ?? "refresh") {
    case "ignore":
      return list;
    case "extend":
      next[idx] = { ...old, remaining: old.remaining + t.remaining, lateMoverPending: t.lateMoverPending };
      return next;
    case "stack": {
      const currentLayers = old.layers || 1;
      const maxLayers = t.payload?.maxLayers || old.payload?.maxLayers || 5;
      next[idx] = {
        ...old,
        ...t,
        layers: Math.min(maxLayers, currentLayers + 1),
        remaining: Math.max(old.remaining, t.remaining),
        lateMoverPending: t.lateMoverPending
      };
      return next;
    }
    case "refresh":
    default:
      next[idx] = { ...old, ...t, remaining: Math.max(old.remaining, t.remaining) };
      return next;
  }
}

/* ────────────────────────────────────────────────────────────
 * 3. 遞減 / 消耗
 * ──────────────────────────────────────────────────────────── */

/**
 * 在指定時機遞減計時器,並移除歸零者。
 * 帶 `lateMoverPending` 的計時器本次略過遞減,並清除該標記(補償只給一次)。
 */
export function tickTimers(
  list: Timer[],
  at: Exclude<TickAt, "never">,
  onTickEffect?: (timer: Timer) => void
): Timer[] {
  const out: Timer[] = [];
  for (const t of list) {
    if (t.tickAt !== at) { out.push(t); continue; }
    if (t.lateMoverPending) { out.push({ ...t, lateMoverPending: false }); continue; }
    
    if (onTickEffect) {
      onTickEffect(t);
    }

    const remaining = t.remaining - 1;
    if (remaining > 0) out.push({ ...t, remaining });
  }
  return out;
}

/** 消耗一次「次數類效果」。回傳 [新陣列, 是否成功消耗]。 */
export function consumeUse(list: Timer[], id: string): [Timer[], boolean] {
  const idx = list.findIndex(t => t.id === id && t.kind === "use_counter");
  if (idx === -1) return [list, false];
  const t = list[idx];
  const remaining = t.remaining - 1;
  const next = [...list];
  if (remaining > 0) next[idx] = { ...t, remaining };
  else next.splice(idx, 1);
  return [next, true];
}

/* ────────────────────────────────────────────────────────────
 * 4. 消除與查詢 —— 這裡就是分類存在的理由(唯一消費者)
 * ──────────────────────────────────────────────────────────── */

/**
 * 「消除回合類效果」。
 * ★ 只清除 kind === 'turn_effect' —— 魂印/機制/道具賦予的計時器一律保留。
 * 回傳 [新陣列, 實際清除數]。呼叫端應依「清除數 > 0」判定成功,不要無條件回傳 true。
 *
 * 依你的定義:確認到回合類效果時,連同計時器與效果一併消除 —— 因為兩者同在一個 Timer 物件裡,
 * 移除即同時移除,不會再出現「計時器沒了效果還在」的殘留。
 */
export function clearTurnEffects(list: Timer[]): [Timer[], number] {
  const kept = list.filter(t => t.kind !== "turn_effect");
  return [kept, list.length - kept.length];
}

/** 「處於回合類效果」的響應判定。 */
export function hasTurnEffect(list: Timer[]): boolean {
  return list.some(t => t.kind === "turn_effect");
}

export function countTurnEffects(list: Timer[]): number {
  return list.filter(t => t.kind === "turn_effect").length;
}

export function getTimer(list: Timer[], id: string): Timer | undefined {
  return list.find(t => t.id === id);
}

export function hasTimer(list: Timer[], id: string): boolean {
  return list.some(t => t.id === id);
}

/** 取得某計時器的剩餘值;不存在則 0(取代舊有 getPlayerState(key) 回傳 undefined 的隱患)。 */
export function remainingOf(list: Timer[], id: string): number {
  return list.find(t => t.id === id)?.remaining ?? 0;
}

/** 依種類篩選(UI 分區顯示用)。 */
export function timersOfKind(list: Timer[], kind: TimerKind): Timer[] {
  return list.filter(t => t.kind === kind);
}

/* ────────────────────────────────────────────────────────────
 * 5. 建構捷徑(讓 registry 少寫樣板、也少寫錯)
 * ──────────────────────────────────────────────────────────── */

/** 建立「回合類效果」(source 依定義固定為 skill)。 */
export const turnEffect = (
  id: string, name: string, rounds: number,
  opts?: Partial<Pick<Timer, "tickAt" | "stackRule" | "payload" | "displayChar" | "description">>
): Timer => ({
  id, name, kind: "turn_effect", source: "skill",
  remaining: rounds, tickAt: opts?.tickAt ?? "round_end",
  stackRule: opts?.stackRule ?? "refresh", payload: opts?.payload,
  displayChar: opts?.displayChar, description: opts?.description
});

/** 建立「其他回合記數效果」(魂印/機制/道具)。 */
export const roundCounter = (
  id: string, name: string, rounds: number, source: EffectSource,
  opts?: Partial<Pick<Timer, "tickAt" | "stackRule" | "payload" | "displayChar" | "description">>
): Timer => ({
  id, name, kind: "round_counter", source,
  remaining: rounds, tickAt: opts?.tickAt ?? "round_end",
  stackRule: opts?.stackRule ?? "refresh", payload: opts?.payload,
  displayChar: opts?.displayChar, description: opts?.description
});

/** 建立「次數類效果」。預設 tickAt='never' —— 只能被 consumeUse 消耗,不隨回合流失。 */
export const useCounter = (
  id: string, name: string, uses: number, source: EffectSource,
  opts?: Partial<Pick<Timer, "stackRule" | "payload" | "displayChar" | "description">>
): Timer => ({
  id, name, kind: "use_counter", source,
  remaining: uses, tickAt: "never",
  stackRule: opts?.stackRule ?? "extend", payload: opts?.payload,
  displayChar: opts?.displayChar, description: opts?.description
});

export function getScaledParam(timer: Timer, paramName: string, defaultValue: number): number {
  const base = Number(timer.payload?.params?.[paramName] !== undefined ? timer.payload.params[paramName] : (timer.payload?.[paramName] !== undefined ? timer.payload[paramName] : defaultValue));
  const layers = timer.layers || 1;
  
  const tiers = timer.payload?.params?.tiers?.[paramName] || timer.payload?.tiers?.[paramName];
  if (Array.isArray(tiers)) {
    return tiers[layers] !== undefined ? tiers[layers] : (tiers[tiers.length - 1] || base);
  }
  
  const perLayerKey = `${paramName}PerLayer`;
  const snakePerLayerKey = `${paramName}_per_layer`;
  const perLayer = Number(
    timer.payload?.params?.[perLayerKey] !== undefined ? timer.payload.params[perLayerKey] : (
      timer.payload?.params?.[snakePerLayerKey] !== undefined ? timer.payload.params[snakePerLayerKey] : (
        timer.payload?.[perLayerKey] !== undefined ? timer.payload[perLayerKey] : (
          timer.payload?.[snakePerLayerKey] !== undefined ? timer.payload[snakePerLayerKey] : 0
        )
      )
    )
  );
  
  if (!isNaN(perLayer) && perLayer !== 0) {
    const val = base + (layers - 1) * perLayer;
    const maxKey = `max${paramName.charAt(0).toUpperCase() + paramName.slice(1)}`;
    const snakeMaxKey = `max_${paramName}`;
    const maxVal = Number(
      timer.payload?.params?.[maxKey] !== undefined ? timer.payload.params[maxKey] : (
        timer.payload?.params?.[snakeMaxKey] !== undefined ? timer.payload.params[snakeMaxKey] : (
          timer.payload?.[maxKey] !== undefined ? timer.payload[maxKey] : (
            timer.payload?.[snakeMaxKey] !== undefined ? timer.payload[snakeMaxKey] : NaN
          )
        )
      )
    );
    if (!isNaN(maxVal)) {
      return Math.min(maxVal, val);
    }
    return val;
  }
  
  return base;
}
