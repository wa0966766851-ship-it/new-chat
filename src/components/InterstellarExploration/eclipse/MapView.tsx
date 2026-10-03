import React from "react";
import type { RunV2 } from "../../../modes/interstellar/v2/engine";
import { currentNode, movesFrom, nodeLabel } from "../../../modes/interstellar/v2/engine";
import type { MapNode } from "../../../modes/interstellar/v2/map";

const W = 1000, H = 560;
const px = (n: MapNode) => ({ x: n.x / 100 * W, y: n.y / 100 * H });
const RING: Record<string, string> = {
  combat: "#cfc6b0", elite: "#e0475f", boss: "#fbbf24", event: "#a78bfa", mystery: "#a78bfa",
  shop: "#d9b45a", rest: "#4fd1c5", treasure: "#f6e2a0", altar: "#e0475f",
};

export default function MapView({ run, onMove }: { run: RunV2; onMove: (id: string) => void }) {
  const cur = currentNode(run);
  const moves = new Set(movesFrom(run).map(n => n.id));
  const [hover, setHover] = React.useState<string | null>(null);
  const byId = new Map(run.map.nodes.map(n => [n.id, n]));
  const fogCol = cur.col + 3;
  const bossCol = Math.max(...run.map.nodes.map(n => n.col));
  const dense = bossCol > 12;
  const hovered = hover ? byId.get(hover) : null;
  const hoveredLabel = hovered ? nodeLabel(run, hovered) : null;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img" aria-label="星蝕回廊地圖">
        <defs>
          <radialGradient id="ecl-node-fill" cx="50%" cy="35%"><stop offset="0%" stopColor="#2a2038" /><stop offset="100%" stopColor="#09070d" /></radialGradient>
          <linearGradient id="ecl-fog" x1="0" x2="1"><stop offset="0" stopColor="#07060c" stopOpacity="0" /><stop offset="1" stopColor="#07060c" stopOpacity=".85" /></linearGradient>
          <filter id="ecl-glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* 星座連線 */}
        {run.map.nodes.flatMap(n => n.next.map(t => {
          const a = px(n), b = px(byId.get(t)!);
          const walked = n.visited && byId.get(t)?.visited;
          const live = n.id === cur.id && moves.has(t);
          return <line key={`${n.id}>${t}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={walked ? "#f6e2a0" : live ? "#d9b45a" : "#6b5a3a"} strokeWidth={walked ? 2.4 : live ? 1.8 : 1}
            strokeDasharray={walked ? undefined : "3 7"} opacity={walked ? .9 : live ? .9 : .45} />;
        }))}

        {/* 迷霧：較遠的欄位 */}


        {run.map.nodes.map(n => {
          const { x, y } = px(n);
          const label = nodeLabel(run, n);
          const reachable = moves.has(n.id);
          const isCur = n.id === cur.id;
          const fogged = n.col > fogCol && n.kind !== "boss";
          const color = RING[label.kind] ?? "#cfc6b0";
          const r = n.kind === "boss" ? 34 : n.col === 0 ? 15 : dense ? 15 : 17;
          return (
            <g key={n.id} transform={`translate(${x} ${y})`}><g className={`ecl-node ${reachable ? "ecl-node-reachable" : ""}`}
              onClick={reachable ? () => onMove(n.id) : undefined} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(h => h === n.id ? null : h)}
              role={reachable ? "button" : undefined} aria-label={reachable ? `前往${label.name}` : label.name} data-node={n.id} data-kind={label.kind}>
              {reachable && <circle r={r + 9} fill="none" stroke={color} strokeWidth="1.5" className="ecl-pulse" />}
              {n.kind === "boss" ? (
                <g filter="url(#ecl-glow)">
                  <g className="ecl-spin">
                    <circle r={r + 12} fill="none" stroke="#fbbf24" strokeWidth=".8" strokeDasharray="2 6" opacity=".7" />
                    {Array.from({ length: 12 }).map((_, i) => <line key={i} x1="0" y1={-(r + 16)} x2="0" y2={-(r + 22)} stroke="#fbbf24" strokeWidth="1" transform={`rotate(${i * 30})`} opacity=".7" />)}
                  </g>
                  <circle r={r} fill="#0b0705" stroke="#fbbf24" strokeWidth="2" />
                  <path d={`M${-r * .7} 0 Q 0 ${-r * .6} ${r * .7} 0 Q 0 ${r * .6} ${-r * .7} 0 Z`} fill="#2a0a0f" stroke="#e0475f" strokeWidth="1.5" />
                  <circle r={r * .22} fill="#e0475f" className="ecl-flicker" />
                </g>
              ) : (
                <>
                  <circle r={r} fill="url(#ecl-node-fill)" stroke={color} strokeWidth={isCur ? 3 : 1.6} opacity={fogged ? .35 : n.visited && !isCur ? .55 : 1} />
                  <circle r={r - 4} fill="none" stroke={color} strokeWidth=".6" opacity={fogged ? .2 : .5} />
                  {!fogged && <text textAnchor="middle" dominantBaseline="central" fontSize={(label.kind === "mystery" ? 19 : 16) * (dense ? .88 : 1)} fill={color}
                    style={{ fontFamily: "var(--ecl-serif)", fontWeight: 900 }} opacity={n.visited && !isCur ? .55 : 1}>{label.glyph}</text>}
                  {isCur && <circle r={r + 5} fill="none" stroke="#f6e2a0" strokeWidth="1.2" strokeDasharray="1 4" className="ecl-spin" />}
                </>
              )}
            </g></g>
          );
        })}
      </svg>

      {hovered && hoveredLabel && (
        <div className="absolute pointer-events-none ecl-frame px-3 py-2 text-xs z-10"
          style={{ left: `clamp(0px, calc(${hovered.x}% - 70px), calc(100% - 160px))`, top: `calc(${hovered.y}% + 32px)`, width: 160 }}>
          <div className="font-black ecl-gilt text-sm">{hovered.col > fogCol && hovered.kind !== "boss" ? "迷霧" : hoveredLabel.name}</div>
          <div className="ecl-muted">{hovered.col > fogCol && hovered.kind !== "boss" ? "太遠了，看不清楚。" : hoveredLabel.hint}</div>
          {moves.has(hovered.id) && <div className="mt-1 text-[10px] ecl-roman" style={{ color: "var(--ecl-gold-hi)" }}>點擊前往</div>}
        </div>
      )}
    </div>
  );
}
