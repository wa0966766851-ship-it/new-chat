import { DISPLAY_RANK_RULES, type DisplayRankSource } from "./elfDisplayRank";
import type { DestinyElfInstance, DestinyRank } from "./destinyGacha";

export const DESTINY_RANKS: readonly DestinyRank[] = ["S", "A", "B", "C"];

export const DESTINY_RANK_LABEL: Record<DestinyRank, { short: string; title: string }> = {
  S: { short: "S 級", title: "S級·真神" },
  A: { short: "A 級", title: "A級·主力" },
  B: { short: "B 級", title: "B級·常規" },
  C: { short: "C 級", title: "C級·攔截特化" },
};

export interface RankStats { total: number; counts: Record<DestinyRank, number>; pct: Record<DestinyRank, string> }

/** 卡池分級統計（S／A／B／C 四項相加恆等於總數）。 */
export function rankStats(pool: readonly Pick<DestinyElfInstance, "destinyRank">[]): RankStats {
  const counts: Record<DestinyRank, number> = { S: 0, A: 0, B: 0, C: 0 };
  for (const e of pool) counts[e.destinyRank]++;
  const total = pool.length;
  const pct = Object.fromEntries(DESTINY_RANKS.map(r => [r, total ? ((counts[r] / total) * 100).toFixed(1) : "0.0"])) as Record<DestinyRank, string>;
  return { total, counts, pct };
}

/** 該級判定規則文字：由 DISPLAY_RANK_RULES 即時產生，名單與門檻改動時文字同步。 */
export function describeRankRule(rank: DestinyRank): string {
  const R = DISPLAY_RANK_RULES;
  const join = (xs: readonly string[]) => xs.join("、");
  switch (rank) {
    case "C": return `C：文本含「${R.cTextLabel}」，或名稱屬 ${join(R.cNames)}；優先於其他規則。非六界神王的 C 級綁定一種命運攔截。`;
    case "S": return `S：資料已預設 S，或名稱屬 ${join(R.sNames)}。`;
    case "A": return `A：資料已預設 A，或名稱屬 ${join(R.aNames)}；其餘未列名者種族值總和 ≥ ${R.aTotalThreshold}。`;
    case "B": return `B：資料已預設 B，或名稱屬 ${join(R.bNames)}；其餘未列名者種族值總和 < ${R.aTotalThreshold}。`;
  }
}

export function describeAllRankRules(): string {
  return DESTINY_RANKS.map(describeRankRule).join("\n");
}

export const RANK_SOURCE_LABEL: Record<DisplayRankSource, string> = {
  "text-c": "文本標記", "name-c": "名單 C", preset: "資料預設", "name-s": "名單 S",
  "name-a": "名單 A", "name-b": "名單 B", "total-a": "種族值總和", "total-b": "種族值總和",
};
