/**
 * 星蝕回廊 N0–N18 進階難度。逐階疊加：N 階的效果＝N0..N 全部效果相加。
 * 每階只有一條「主效果」，數值見 docs/星蝕迴廊改版設計_20261017.md。
 */
export const MAX_N = 18;
export interface NEffects {
  /** 敵方攻防速等能力加成（加法，0.05＝+5%） */
  enemyStat: number; /** 敵方體力加成 */ enemyHp: number;
  startBeans: number; startShards: number; startPotions: number;
  lineupSlots: number; benchSlots: number;
  shopMult: number; restHealMult: number; eclipsePerMove: number;
  affixBonus: number; rewardChoice: number;
  perksOff: boolean; startCurse: boolean; noRevive: boolean;
}
export const N_NEUTRAL: NEffects = { enemyStat: 0, enemyHp: 0, startBeans: 0, startShards: 0, startPotions: 0, lineupSlots: 0, benchSlots: 0, shopMult: 1, restHealMult: 1, eclipsePerMove: 0, affixBonus: 0, rewardChoice: 0, perksOff: false, startCurse: false, noRevive: false };
export interface NLevelDef { n: number; text: string; apply: (e: NEffects) => NEffects }
const add = (k: keyof NEffects, v: number) => (e: NEffects): NEffects => ({ ...e, [k]: (e[k] as number) + v });
const mul = (k: keyof NEffects, v: number) => (e: NEffects): NEffects => ({ ...e, [k]: (e[k] as number) * v });
const flag = (k: keyof NEffects) => (e: NEffects): NEffects => ({ ...e, [k]: true });
export const N_LEVELS: NLevelDef[] = [
  { n: 1, text: "敵方能力 +5%", apply: add("enemyStat", .05) },
  { n: 2, text: "起始賽爾豆 −20", apply: add("startBeans", -20) },
  { n: 3, text: "禁用名額 −1；敵方體力 +5%", apply: add("enemyHp", .05) },
  { n: 4, text: "敵方體力 +10%", apply: add("enemyHp", .10) },
  { n: 5, text: "起始星晶 −1", apply: add("startShards", -1) },
  { n: 6, text: "禁用名額 −1；商店價格 +10%", apply: mul("shopMult", 1.1) },
  { n: 7, text: "敵方能力 +5%", apply: add("enemyStat", .05) },
  { n: 8, text: "起始藥劑 −1", apply: add("startPotions", -1) },
  { n: 9, text: "禁用名額 −1；待命格 −1", apply: add("benchSlots", -1) },
  { n: 10, text: "夢魘與王座多 1 個詞綴", apply: add("affixBonus", 1) },
  { n: 11, text: "遺物獎勵選項 −1", apply: add("rewardChoice", -1) },
  { n: 12, text: "禁用名額 −1；套裝回廊特權失效", apply: flag("perksOff") },
  { n: 13, text: "敵方能力 +5%、體力 +10%", apply: e => ({ ...e, enemyStat: e.enemyStat + .05, enemyHp: e.enemyHp + .10 }) },
  { n: 14, text: "星爐修復 ×0.75", apply: mul("restHealMult", .75) },
  { n: 15, text: "禁用名額 −1；出戰格 −1", apply: add("lineupSlots", -1) },
  { n: 16, text: "每步蝕度 +1", apply: add("eclipsePerMove", 1) },
  { n: 17, text: "開局即被一件詛咒纏上", apply: flag("startCurse") },
  { n: 18, text: "禁用名額歸零；敵方能力 +10%、體力 +20%；首領後陣亡者不再復甦", apply: e => ({ ...flag("noRevive")(e), enemyStat: e.enemyStat + .10, enemyHp: e.enemyHp + .20 }) },
];
export const clampN = (n: unknown): number => { const v = Math.floor(Number(n)); return Number.isFinite(v) ? Math.max(0, Math.min(MAX_N, v)) : 0; };
export function nEffects(n: number): NEffects {
  let e = { ...N_NEUTRAL };
  for (const l of N_LEVELS) if (l.n <= clampN(n)) e = l.apply(e);
  return e;
}
/** 禁用名額：N0 為 6，每 3 階 −1，N18 為 0。 */
export const banCap = (n: number): number => Math.max(0, 6 - Math.floor(clampN(n) / 3));
export const nLabel = (n: number) => `N${clampN(n)}`;
