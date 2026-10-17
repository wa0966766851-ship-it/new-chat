/**
 * 星蝕回廊：星晶招募／進階、限定招募券（招募令）、層數曲線與固定值縮放。純函式，無 React／引擎依賴。
 * 規則與數值見 docs/星蝕迴廊改版設計_20261017.md 第 3、7 節。
 */
import type { Elf } from "../../../types";

export type Tier = "low" | "mid" | "high" | "apex";
export const TIER_ORDER: Tier[] = ["low", "mid", "high", "apex"];
export const TIER_TEXT: Record<Tier, string> = { low: "Ⅰ 微光", mid: "Ⅱ 燭火", high: "Ⅲ 烈焰", apex: "Ⅳ 恆星" };
export const tierRank = (t: Tier) => TIER_ORDER.indexOf(t);

/* ───────── 招募令 ───────── */
/**
 * kind: any＝任意；types＝限屬性。
 * match: has＝精靈屬性包含全部所列屬性（複合屬性也算）；exact＝屬性恰為所列（雙屬性）；either＝含其中任一。
 */
export interface RecruitToken {
  id: string;
  kind: "any" | "types";
  types: string[];
  match: "has" | "exact" | "either";
  /** 可招募的強度上限（含）；缺省不限 */
  tier?: Tier;
  /** 重複招募令：只能用在已持有的精靈 */
  repeat?: boolean;
}
export type TokenSpec = Omit<RecruitToken, "id">;

/** 精靈屬性集合：「火.水」→ ["火","水"] */
export const elfTypes = (e: Pick<Elf, "type">): string[] => String(e.type ?? "").split(/[.．·・/／＋+\s]+/).map(s => s.trim()).filter(Boolean);

export function tokenMatches(t: RecruitToken, elf: Pick<Elf, "type">): boolean {
  if (t.kind === "any") return true;
  const ts = elfTypes(elf);
  if (t.match === "exact") return ts.length === t.types.length && t.types.every(x => ts.includes(x));
  if (t.match === "either") return t.types.some(x => ts.includes(x));
  return t.types.every(x => ts.includes(x));
}
export function tokenLabel(t: RecruitToken): string {
  if (t.repeat) return "重複招募令";
  if (t.kind === "any") return "任意招募令";
  if (t.match === "exact") return `${t.types.join("/")}雙屬性招募令`;
  if (t.match === "either") return `${t.types.join("或")}招募令`;
  return `${t.types.join("/")}系招募令`;
}
export const tokenHint = (t: RecruitToken): string => {
  const cap = t.tier ? `；強度至多${TIER_TEXT[t.tier]}` : "";
  if (t.repeat) return "免費進階一次：對已持有的精靈，全能力 +40%（至多 3 層），或戰鬥 PP 與上限 ×2（只能一次）";
  if (t.kind === "any") return `免費招募一次：任選一隻精靈${cap}`;
  if (t.match === "exact") return `免費招募一次：屬性恰為 ${t.types.join("＋")} 的精靈${cap}`;
  if (t.match === "either") return `免費招募一次：屬性含 ${t.types.join(" 或 ")} 的精靈${cap}`;
  return `免費招募一次：屬性含 ${t.types.join("＋")} 的精靈（複合屬性也算）${cap}`;
};
/** 介面上的一行簡述（完整說明放 tooltip：tokenHint） */
export const tokenBrief = (t: RecruitToken): string => {
  const cap = t.tier && !t.repeat ? `至多${TIER_TEXT[t.tier]}` : "";
  const what = t.repeat ? "免費進階一次" : "免費招募・" + (t.kind === "any" ? "任選" : t.match === "exact" ? "屬性恰為此兩者" : t.match === "either" ? "含任一屬性" : "含此屬性（含複合）");
  return [what, cap].filter(Boolean).join("・");
};
/** 同款令合併顯示用的鍵 */
export const tokenGroupKey = (t: RecruitToken) => [t.kind, t.match, [...t.types].sort().join("+"), t.tier ?? "", t.repeat ? "r" : ""].join("|");

/* ───────── 星晶經濟：招募與進階價格、來源、掉落率 ───────── */
/** 招募：基價 2 星晶，每用星晶招募一次 +1，每兩章 +1，高階 +1、頂階 +2（持令免費，且不推高價格）。 */
export const RECRUIT_BASE_PRICE = 2;
export const TIER_SURCHARGE: Record<Tier, number> = { low: 0, mid: 0, high: 1, apex: 2 };
export const recruitPriceOf = (recruited: number, act: number, tier: Tier): number =>
  RECRUIT_BASE_PRICE + Math.max(0, Math.floor(recruited) || 0) + Math.floor((Math.max(1, act) - 1) / 2) + TIER_SURCHARGE[tier];
/** 進階（強化）：第 1…4 層分別花多少星晶；PP×2 一次 4。 */
export const ADVANCE_STAT_PRICES = [3, 5, 8, 12];
export const ADVANCE_PP_PRICE = 4;
export const advanceStatPrice = (layersDone: number): number => ADVANCE_STAT_PRICES[Math.min(Math.max(0, layersDone), ADVANCE_STAT_PRICES.length - 1)];
/** 星晶來源：一般戰鬥 20% 給 1；夢魘 1；首領 3；商店以賽爾豆購買（每顆底價 70）；事件與祭壇另有。 */
export const SHARD_INCOME = { combatChance: .2, combat: 1, elite: 1, boss: 3 } as const;
export const SHARD_SHOP_PRICE = 70;
/** 重複招募令掉落：不限章節、不綁開關，任何來源都有機率。N 等級每階 −3%（相對值，至少剩 40%）。 */
export type DropSource = "combat" | "elite" | "boss" | "shop" | "event" | "altar" | "treasure";
export const REPEAT_DROP: Record<DropSource, number> = { combat: .04, elite: .12, boss: .3, shop: .14, event: .06, altar: .15, treasure: .08 };
export const repeatDropMult = (n: number): number => Math.max(.4, 1 - .03 * Math.max(0, n));
export const repeatDropChance = (source: DropSource, n = 0): number => Math.round(REPEAT_DROP[source] * repeatDropMult(n) * 1000) / 1000;

/* ───────── 重複招募（進階） ───────── */
export const DUP_STAT_PER_LAYER = 0.4;
export const DUP_BASE_CAP = 3;
export interface DupInfo { /** 強化層數 */ stat: number; /** 已選擇 PP×2 */ pp: boolean }
export const dupOf = (e: Partial<Elf> | undefined | null): DupInfo => {
  const d = (e as any)?.dup;
  return { stat: Math.max(0, Math.floor(Number(d?.stat) || 0)), pp: !!d?.pp };
};
/** 全能力倍率（層數 × 40%） */
export const dupStatMul = (e: Partial<Elf>): number => 1 + DUP_STAT_PER_LAYER * dupOf(e).stat;
/** 進戰鬥時的 PP 倍增：只作用於 PP 上限大於 0 的技能；回傳新的戰鬥副本（不改存檔原值）。 */
export function applyDupPp(e: Elf): Elf {
  if (!dupOf(e).pp) return e;
  return { ...e, skills: e.skills.map(s => ((s.maxPp ?? s.pp) > 0 ? { ...s, pp: (s.pp ?? 0) * 2, maxPp: (s.maxPp ?? s.pp) * 2 } : s)) } as Elf;
}
/** 戰鬥結算：把加倍後的剩餘 PP 折回存檔值（上限不超過原上限）。 */
export function foldDupPp(saved: Elf, battlePp: number | undefined, fallback: number, maxPp: number | undefined): number {
  const raw = battlePp ?? fallback;
  if (!dupOf(saved).pp || !((maxPp ?? 0) > 0)) return raw;
  return Math.min(maxPp!, Math.ceil(raw / 2));
}

/* ───────── 層數曲線與固定值縮放 ───────── */
/** 層 L（1…72）＝(章−1)×12 + min(欄,12) */
export const depthOf = (act: number, col: number): number => Math.max(1, (Math.max(1, act) - 1) * 12 + Math.max(1, Math.min(12, col)));
/** 敵方深度倍率：100^((L−1)/71)，最終王座 ≈ ×100 */
export const depthMul = (L: number): number => Math.pow(100, (Math.max(1, Math.min(72, L)) - 1) / 71);
/** 固定值（護盾、固定傷害、藥劑回復）倍率：√depthMul，敵我雙方同一曲線 */
export const fixedMulAt = (L: number): number => Math.sqrt(depthMul(L));
export const roundMul = (x: number): number => Math.round(x * 1000) / 1000;
/** 戰鬥內以遺物參數形式傳遞固定值倍率（"fixed_mul:3.162"） */
export const FIXED_MUL_ID = "fixed_mul";
export const fixedMulEntry = (L: number): string => `${FIXED_MUL_ID}:${roundMul(fixedMulAt(L))}`;
export function fixedMulOf(relics: readonly string[] | undefined): number {
  for (const r of relics ?? []) if (r.startsWith(`${FIXED_MUL_ID}:`)) { const v = Number(r.slice(FIXED_MUL_ID.length + 1)); if (Number.isFinite(v) && v > 0) return v; }
  return 1;
}

/** 遺物商店底價（再乘商店係數）；詛咒不賣 */
export const RELIC_PRICE: Record<"common" | "rare" | "legendary" | "cursed" | "boss", number> = { common: 90, rare: 160, legendary: 260, cursed: 0, boss: 320 };
/**
 * 招募令（限定招募券）的賽爾豆底價（再乘商店係數）。限制越多越便宜：
 * 任意 240、重複（免費進階）260、單屬性 Ⅰ–Ⅱ 100／Ⅲ 150／Ⅳ 200、任一屬性 110、雙屬性 90。
 */
export function tokenBasePrice(t: TokenSpec): number {
  if (t.repeat) return 260;
  if (t.kind === "any") return 240;
  if (t.match === "exact") return 90;
  if (t.match === "either") return 110;
  return !t.tier || tierRank(t.tier) <= 1 ? 100 : t.tier === "high" ? 150 : 200;
}
