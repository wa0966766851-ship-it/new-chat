import { ring, rule, brush, sparkle, blade, stamp, hatch, cross, rng, TAU, PAPER_PALETTE } from "../../../design/sketchStroke";
import type { DestinyRank } from "../../../utils/destinyGacha";
import type { DraftPhase } from "../useDestinyDraft";

export const C = PAPER_PALETTE;

/** 章節：與 DraftPhase 一一對應（01 輪盤為過場，不可手動前往）。 */
export const CHAPTERS: readonly { key: DraftPhase; no: string; name: string }[] = [
  { key: "intro", no: "00", name: "序章" },
  { key: "pulling", no: "01", name: "輪盤" },
  { key: "reveal", no: "02", name: "圖版" },
  { key: "ban", no: "03", name: "禁選" },
  { key: "pick", no: "04", name: "編隊" },
];

/** FNV-1a：把字串轉成 rng 種子（同一張卡每次畫出來一樣）。 */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 分級視覺：顏色＋字母＋章造型＋外框樣式，四者並用（不靠顏色單獨區分）。 */
export const RANK_VIS: Record<DestinyRank, { color: string; letter: DestinyRank; shape: "star" | "diamond" | "circle" | "square"; name: string; frame: "double" | "solid" | "dashed" | "folded" }> = {
  S: { color: C.warm, letter: "S", shape: "star", name: "真神", frame: "double" },
  A: { color: C.cobalt, letter: "A", shape: "diamond", name: "主力", frame: "solid" },
  B: { color: C.pale, letter: "B", shape: "circle", name: "常規", frame: "dashed" },
  C: { color: C.ink, letter: "C", shape: "square", name: "攔截", frame: "folded" },
};

export interface CardArt { frame: string[]; fold?: string; hatch?: string; ringD: string; ticks: string }
const artCache = new Map<string, CardArt>();
/** 卡面手繪線稿（viewBox 0 0 120 160）；以 (seed, rank) 為鍵快取，翻牌前後不抖。 */
export function cardArt(seed: number, rank: DestinyRank): CardArt {
  const key = `${seed}|${rank}`;
  const hit = artCache.get(key);
  if (hit) return hit;
  const w = 120, h = 160, o = 3;
  const frame = [
    rule(o, o, w - o, o, seed + 1, { ext: 2, bow: 0.004 }), rule(w - o, o, w - o, h - o, seed + 2, { ext: 2, bow: 0.004 }),
    rule(w - o, h - o, o, h - o, seed + 3, { ext: 2, bow: 0.004 }), rule(o, h - o, o, o, seed + 4, { ext: 2, bow: 0.004 }),
  ];
  const art: CardArt = {
    frame,
    fold: rank === "C" ? `M${w - o} ${h - o - 18} L${w - o - 18} ${h - o} L${w - o - 18} ${h - o - 18} Z` : undefined,
    hatch: rank === "C" ? hatch(o + 2, h - 44, w - 2 * o - 4, 40, 7, seed + 9) : undefined,
    ringD: ring(w / 2, 82, 40, seed + 5, { amp: 0.01 }),
    ticks: sparkle(w - 14, 16, 7, 4, seed + 6),
  };
  if (artCache.size > 400) artCache.clear();
  artCache.set(key, art);
  return art;
}

/** 分級章（viewBox -12 -12 24 24）。 */
export function sealPaths(rank: DestinyRank, seed = 11): { outline: string; extra?: string } {
  switch (rank) {
    case "S": return { outline: sparkle(0, 0, 11, 9, seed), extra: ring(0, 0, 6.5, seed + 1, { amp: 0.02 }) };
    case "A": return { outline: "M0 -10.5 L10.5 0 L0 10.5 L-10.5 0 Z" };
    case "B": return { outline: ring(0, 0, 9.5, seed + 2, { amp: 0.015 }) };
    case "C": return { outline: stamp(-9, -9, 18, 18, seed + 3), extra: hatch(-9, -9, 18, 18, 5, seed + 4) };
  }
}

/** 封印叉（viewBox 0 0 100 100）。 */
export function sealCross(seed: number): string { return cross(50, 50, 38, seed); }

export { ring, rule, brush, blade, sparkle, rng, TAU };

export function prefersReducedMotion(): boolean {
  try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}
