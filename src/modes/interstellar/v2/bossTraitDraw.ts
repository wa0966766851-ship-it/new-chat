/**
 * 星蝕回廊：夢魘／王座的原廠 BOSS 特性抽取。
 * 規則（數值與分級見 docs/星蝕迴廊改版設計_20261017.md「BOSS 特性」）：
 *  - 只有夢魘（elite）與王座（boss）抽取；一般遭遇不帶特性。章末首領另外照舊掛「神話」（不佔特性名額）。
 *  - 強度分 s ＝ (章 − 1) + ⌊N／6⌋（0–8）。
 *  - 數量：夢魘 1 + [s≥4]；王座 1 + [s≥2] + [s≥5]；上限 3。王座的隨行精靈少 1 條（至少 0）。
 *  - 威脅分級上限：夢魘 min(3, 1+⌊s／2⌋)；王座 min(4, 1+⌊s／2⌋)。分級 4（格擋、復甦…）只在王座且 s≥6。
 *  - 參數等級 ⌊s／2⌋（0–3）：取各特性 lv 表；固定點數類（貪婪、鋒銳、生命汲取）再乘固定值倍率 √depthMul（敵我同曲線）。
 *  - 使用獨立的種子亂數（局種子＋章＋節點＋nonce），不消耗主亂數流，既有種子的地圖與遭遇不變。
 */
import { Dice } from "./rng";
import { deriveSeed } from "./seed";
import { BOSS_TRAITS, BOSS_TRAIT_BY_ID, type BossTraitSpec } from "../../../data/bossTraits";

/** 數值為固定點數、需乘固定值倍率的特性 */
const FIXED_VALUE = new Set(["greed", "sharp", "drain"]);
/** 不會抽到的特性：神話（首領固定持有，不佔特性名額） */
const EXCLUDED = new Set(["myth"]);
const BOSS_EXCLUDED = new Set(["immune"]);

export const traitScore = (act: number, nLevel: number): number => Math.max(0, act - 1) + Math.floor(Math.max(0, nLevel) / 6);
export function traitCount(kind: "combat" | "elite" | "boss", s: number, escort = false): number {
  if (kind === "combat") return 0;
  const n = kind === "elite" ? 1 + (s >= 4 ? 1 : 0) : 1 + (s >= 2 ? 1 : 0) + (s >= 5 ? 1 : 0);
  return Math.max(0, Math.min(3, n - (escort ? 1 : 0)));
}
export function maxTier(kind: "combat" | "elite" | "boss", s: number): number {
  if (kind === "combat") return 0;
  const t = 1 + Math.floor(s / 2);
  return kind === "elite" ? Math.min(3, t) : s >= 6 ? 4 : Math.min(3, t);
}
export function traitParams(id: string, s: number, fixedMul = 1): BossTraitSpec {
  const def = BOSS_TRAIT_BY_ID[id], lvl = Math.min(3, Math.floor(s / 2));
  const x = def.lv ? def.lv[lvl] : def.def.x;
  const spec: BossTraitSpec = { id };
  if (x !== undefined) spec.x = FIXED_VALUE.has(id) ? Math.round(x * fixedMul) : x;
  if (def.def.y !== undefined) spec.y = def.def.y;
  if (def.def.s !== undefined) spec.s = def.def.s;
  return spec;
}
/** 抽取一隻敵人的特性；`d` 應為獨立擲骰器。 */
export function drawBossTraits(d: Dice, kind: "combat" | "elite" | "boss", act: number, nLevel: number, fixedMul = 1, escort = false): BossTraitSpec[] {
  const s = traitScore(act, nLevel), n = traitCount(kind, s, escort), cap = maxTier(kind, s);
  if (!n) return [];
  const pool = BOSS_TRAITS.filter(t => !EXCLUDED.has(t.id) && !(kind === "boss" && BOSS_EXCLUDED.has(t.id)) && t.tier <= cap);
  return d.sample(pool, n).map(t => traitParams(t.id, s, fixedMul));
}
/** 遭遇專用的獨立擲骰器：同局同章同節點同 nonce 必得同結果。 */
export const traitDice = (seed: number, act: number, at: string | null | undefined, nonce: number, idx: number): Dice => new Dice(deriveSeed(seed, "boss-trait", act, at ?? "-", nonce, idx), 0);
