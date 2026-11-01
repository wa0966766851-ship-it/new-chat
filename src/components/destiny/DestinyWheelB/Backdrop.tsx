import React, { useEffect, useMemo, useState } from "react";
import { makeHalftone } from "../../../design/sketchStroke";
import { C, ring, rule, blade, sparkle, rng, TAU } from "./bModel";
import { Ink } from "./Ink";
import { DW } from "../../../design/sketchStroke";
import { isJsdom } from "../destinyViewPref";

const VW = 1600, VH = 900, CX = 800, CY = 450, R0 = 270;

/** 遠景線稿（固定 seed，只算一次）。 */
function buildFar() {
  const R = rng(7717);
  const bigD = ring(CX, CY, R0 * 2.35, 1201, { amp: 0.006, over: 0.05 });
  const rays = Array.from({ length: 72 }, (_, i) => {
    const a = R() * TAU, len = 0.30 + R() * 0.46;
    const r1 = R0 * 0.95, r2 = R0 * (0.95 + len);
    return rule(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1, CX + Math.cos(a) * r2, CY + Math.sin(a) * r2, 2000 + i, { ext: 2, bow: 0.004 });
  });
  return { bigD, rays };
}
function buildMid() {
  return Array.from({ length: 5 }, (_, i) => ring(CX, CY, R0 * (0.72 + i * 0.17), 900 + i * 37, { amp: 0.012 }));
}
function buildNear() {
  const R = rng(4711);
  const blades = Array.from({ length: 9 }, (_, i) => {
    const a = R() * TAU, r = R0 * (0.95 + R() * 0.55), len = 26 + R() * 44, w = 5 + R() * 9;
    return blade(CX + Math.cos(a) * r, CY + Math.sin(a) * r, len, a + Math.PI / 2, w);
  });
  const sparks = Array.from({ length: 5 }, (_, i) => {
    const a = R() * TAU, r = R0 * (0.9 + R() * 0.9);
    return sparkle(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 10 + R() * 8, 5, 600 + i * 13);
  });
  return { blades, sparks };
}
const FAR = buildFar(), MID = buildMid(), NEAR = buildNear();

/** 12 條主射線（對應 12 抽）。 */
const MAIN_RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * TAU - Math.PI / 2, r1 = R0 * 1.02, r2 = R0 * 1.62;
  return rule(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1, CX + Math.cos(a) * r2, CY + Math.sin(a) * r2, 3100 + i, { ext: 2, bow: 0.004 });
});

/**
 * 景深分層背景（L1 遠景 d≈0.2／L2 中景 d≈0.5／L3 近景 d≈1.0）。
 * 線寬走 DW(d)；指標視差只改 CSS 變數 --px/--py（父層設定），此元件本身不跑 rAF。
 * blueprint：圓盤褪成線框、射線虛線流動、浮現尺寸標注。
 */
export function Backdrop({ chapter, lit, blueprint, animated }: { chapter: string; lit: number; blueprint: boolean; animated: boolean }) {
  const [disc, setDisc] = useState<string | null>(null);
  useEffect(() => {
    if (isJsdom()) return;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = makeHalftone(520, 13, 4242, C.ink, C.cobalt, dpr);
      setDisc(c.toDataURL("image/png"));
    } catch { setDisc(null); /* 沒有 Canvas（測試或極舊環境）：圓盤改純線框 */ }
  }, []);
  const rays = useMemo(() => MAIN_RAYS, []);
  return (
    <div className={`dwb-bd dwb-bd--${chapter}${blueprint ? " dwb-bd--bp" : ""}${animated ? " dwb-bd--anim" : ""}`} aria-hidden="true" data-testid="b-backdrop">
      <svg key={chapter} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" className="dwb-bd-svg">
        <g className="dwb-layer dwb-layer--far">
          <Ink d={FAR.bigD} color={C.pale} width={DW(0.2)} alpha={0.45} />
          {FAR.rays.map((d, i) => <Ink key={i} d={d} color={C.pale} width={DW(0.25)} alpha={0.5} />)}
        </g>
        <g className="dwb-layer dwb-layer--mid">
          <g className="dwb-disc">
            {disc && !blueprint && (
              <>
                <clipPath id="dwb-disc-clip"><circle cx={CX} cy={CY} r={R0 * 0.98} /></clipPath>
                <image href={disc} x={CX - R0 * 0.98} y={CY - R0 * 0.98} width={R0 * 1.96} height={R0 * 1.96} clipPath="url(#dwb-disc-clip)" opacity={0.9} />
              </>
            )}
            {!blueprint && !disc && <circle cx={CX} cy={CY} r={R0 * 0.98} fill={C.cobalt} />}
            <Ink d={ring(CX, CY, R0 * 0.98, 1301, { amp: 0.008 })} color={blueprint ? C.cobalt : C.ink} width={DW(0.5)} alpha={0.8} />
          </g>
          {MID.map((d, i) => <Ink key={i} d={d} color={C.cobalt} width={DW(0.35 + i * 0.13)} alpha={0.42} />)}
          <g className="dwb-rays">
            {rays.map((d, i) => (
              <path key={i} d={d} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round"
                stroke={i < lit ? C.cobalt : C.pale} strokeWidth={i < lit ? DW(0.7) : DW(0.25)} strokeOpacity={i < lit ? 0.9 : 0.55}
                strokeDasharray={blueprint ? "3 9" : undefined} className={blueprint ? "dwb-flow" : undefined} />
            ))}
          </g>
          {blueprint && (
            <g className="dwb-dims" fontFamily="ui-monospace,Menlo,Consolas,monospace" fontSize="12" fill={C.cobalt}>
              <Ink d={rule(CX - R0, CY + R0 * 1.12, CX + R0, CY + R0 * 1.12, 8801, { ext: 6, bow: 0.002 })} color={C.cobalt} width={DW(0.5)} alpha={0.8} />
              <text x={CX} y={CY + R0 * 1.12 + 18} textAnchor="middle">{`Ø ${R0 * 2}`}</text>
              <Ink d={rule(CX + R0 * 1.25, CY - R0 * 0.98, CX + R0 * 1.25, CY + R0 * 0.98, 8802, { ext: 6, bow: 0.002 })} color={C.cobalt} width={DW(0.5)} alpha={0.8} />
              <text x={CX + R0 * 1.25 + 14} y={CY} dominantBaseline="central">{`H ${Math.round(R0 * 1.96)}`}</text>
            </g>
          )}
        </g>
        <g className="dwb-layer dwb-layer--near">
          {NEAR.blades.map((d, i) => <path key={i} d={d} fill={C.cobalt} fillOpacity={blueprint ? 0 : 0.2} stroke={C.cobalt} strokeWidth={DW(1.0)} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />)}
          {NEAR.sparks.map((d, i) => <Ink key={i} d={d} color={C.ink} width={DW(1.0)} alpha={0.6} />)}
        </g>
      </svg>
    </div>
  );
}
