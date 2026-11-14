/**
 * 命運之輪「命運配裝」（2026-11-07）：套裝／目鏡／稱號／戰鬥火焰的抽選。
 * - 套裝、目鏡、稱號：雙方各抽候選（雙方不重複），各選一件。
 * - 火焰：四種中各抽 2 種供選一（雙方可同種）。
 * - AI（PVE 的 P2）依簡單價值挑選；玩家預設選第一個候選，可改。
 */
import { SUIT_CATALOG, EYEWEAR_CATALOG, type SuitDefinition } from "../data/suitsAndEyewears";
import { TITLE_CATALOG, type TitleDefinition } from "../data/titles";
import { BATTLE_FLAMES, FLAME_BY_ID, type FlameId } from "../data/battleFlames";

export interface LoadoutOptions { suits: string[]; eyewears: string[]; titles: string[]; flames: FlameId[] }
export interface Loadout { suit: string; eyewear: string; title: string; flame: FlameId }
export const LOADOUT_COUNTS = { suits: 3, eyewears: 2, titles: 3, flames: 2 } as const;

function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** 從 ids 抽出兩組不重疊的候選（數量不足時平均分配）。 */
function splitDraw(ids: string[], n: number, rng: () => number): [string[], string[]] {
  const s = shuffle(ids, rng);
  const each = Math.min(n, Math.floor(s.length / 2));
  return [s.slice(0, each), s.slice(each, each * 2)];
}

/** 雙方候選：套裝／目鏡／稱號互不重複，火焰各自抽。 */
export function drawLoadoutOptions(rng: () => number = Math.random): { p1: LoadoutOptions; p2: LoadoutOptions } {
  const [s1, s2] = splitDraw(Object.keys(SUIT_CATALOG), LOADOUT_COUNTS.suits, rng);
  const [e1, e2] = splitDraw(Object.keys(EYEWEAR_CATALOG), LOADOUT_COUNTS.eyewears, rng);
  const [t1, t2] = splitDraw(Object.keys(TITLE_CATALOG), LOADOUT_COUNTS.titles, rng);
  const flames = () => shuffle(BATTLE_FLAMES.map(f => f.id), rng).slice(0, LOADOUT_COUNTS.flames);
  return { p1: { suits: s1, eyewears: e1, titles: t1, flames: flames() }, p2: { suits: s2, eyewears: e2, titles: t2, flames: flames() } };
}

export const defaultLoadout = (o: LoadoutOptions): Loadout => ({ suit: o.suits[0] ?? "", eyewear: o.eyewears[0] ?? "", title: o.titles[0] ?? "", flame: o.flames[0] ?? "flame_purple" });

const sumStats = (s?: Partial<Record<string, number>>) => Object.values(s || {}).reduce<number>((a, v) => a + (Number(v) || 0), 0);
/** 粗估價值：固定加成（點數）＋百分比加成（約 6 點／1%）＋增減傷倍率。只用於 AI 挑選，不影響戰鬥。 */
export function suitValue(s: SuitDefinition | undefined): number {
  if (!s) return 0;
  const e = s.effects || {};
  return sumStats(s.statBonus) + sumStats(s.percentBonus) * 6 + sumStats(s.oppStatDebuff) * -1 + sumStats(s.oppPercentDebuff) * -6
    + ((e.damageDealtMultiplier ?? 1) - 1) * 900 + (1 - (e.damageTakenMultiplier ?? 1)) * 900 + (e.critRateBonus ?? 0) * 600
    + (e.healPercentOnTurnEnd ?? 0) * 2500 + (e.starterShield ?? 0) * 0.4 + (e.hasCustomHandler ? 120 : 0);
}
export function titleValue(t: TitleDefinition | undefined): number {
  if (!t) return 0;
  const e = t.effects || {};
  return sumStats(t.statBonus) + (t.critBonus ?? 0) * 400 + ((e.damageDealtMultiplier ?? 1) - 1) * 900 + (e.fixedDamageOnSkillHit ?? 0) * 0.5
    + (e.battleStartItems?.length ? 40 : 0);
}
const FLAME_VALUE: Record<FlameId, number> = { flame_purple: 3, flame_gold: 2.9, flame_green: 2.6, flame_blue: 2.4 };

/** AI 選配裝：各類取價值最高者。 */
export function aiChooseLoadout(o: LoadoutOptions): Loadout {
  const best = <T,>(ids: T[], v: (id: T) => number) => [...ids].sort((a, b) => v(b) - v(a))[0];
  return {
    suit: best(o.suits, id => suitValue(SUIT_CATALOG[id])) ?? "",
    eyewear: best(o.eyewears, id => sumStats(EYEWEAR_CATALOG[id]?.statBonus)) ?? "",
    title: best(o.titles, id => titleValue(TITLE_CATALOG[id])) ?? "",
    flame: best(o.flames, id => FLAME_VALUE[id] ?? 0) ?? "flame_purple",
  };
}

/** 顯示用：名稱、說明（tooltip）、火焰顏色。 */
export function loadoutLabel(key: keyof Loadout, id: string): { name: string; desc: string; color?: string } {
  if (key === "suit") return { name: SUIT_CATALOG[id]?.name ?? id, desc: SUIT_CATALOG[id]?.description ?? "" };
  if (key === "eyewear") return { name: EYEWEAR_CATALOG[id]?.name ?? id, desc: EYEWEAR_CATALOG[id]?.description ?? "" };
  if (key === "title") return { name: TITLE_CATALOG[id]?.name ?? id, desc: TITLE_CATALOG[id]?.description ?? "" };
  const f = FLAME_BY_ID[id];
  return { name: f?.name ?? id, desc: f ? `${f.effect}（${f.original}）` : "", color: f?.color };
}
