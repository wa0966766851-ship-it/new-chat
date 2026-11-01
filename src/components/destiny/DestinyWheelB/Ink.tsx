import React from "react";
import { inkLayers, type InkOptions } from "../../../design/sketchStroke";
import { C, RANK_VIS, sealPaths } from "./bModel";
import type { DestinyRank } from "../../../utils/destinyGacha";

/** 套印描線：同一條線偏移 (1.15, 0.95)px 再描一遍、透明度 ×0.4（拾光行記 ink()）。 */
export function Ink({ d, ...o }: { d: string; key?: string | number } & InkOptions) {
  return (
    <g>
      {inkLayers(d, o).map((l, i) => (
        <path key={i} d={l.d} fill="none" stroke={l.color} strokeWidth={l.width} strokeOpacity={l.alpha} strokeDasharray={l.dash}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          transform={l.dx || l.dy ? `translate(${l.dx} ${l.dy})` : undefined} />
      ))}
    </g>
  );
}

/** 分級章：造型＋字母＋顏色（S 星芒、A 菱形、B 圓、C 方章加斜線底紋）。 */
export function RankSeal({ rank, size = 30, seed = 11, className }: { rank: DestinyRank; size?: number; seed?: number; className?: string }) {
  const v = RANK_VIS[rank], p = sealPaths(rank, seed);
  const filled = rank === "S" || rank === "A" || rank === "C";
  return (
    <svg className={className} width={size} height={size} viewBox="-13 -13 26 26" role="img" aria-label={`${rank} 級`} data-testid={`b-rank-${rank}`} data-rank-seal={rank}>
      {rank === "S" ? <path d={p.outline} fill="none" stroke={v.color} strokeWidth={1.6} strokeLinecap="round" />
        : <path d={p.outline} fill={filled ? v.color : C.paper} stroke={v.color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />}
      {rank === "S" && <path d={p.extra} fill={v.color} stroke={v.color} strokeWidth={1} />}
      {rank === "C" && p.extra && <path d={p.extra} fill="none" stroke={C.paper} strokeWidth={0.8} strokeOpacity={0.55} />}
      <text x="0" y="0.5" textAnchor="middle" dominantBaseline="central" fontSize={rank === "S" ? 9.5 : 11} fontWeight={700}
        fill={rank === "S" ? C.paper : filled ? C.paper : C.ink} fontFamily='"Noto Serif TC","Songti TC",serif'>{v.letter}</text>
    </svg>
  );
}
