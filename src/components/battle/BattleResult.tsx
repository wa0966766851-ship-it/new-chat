import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Elf } from "../../types";
import { ElfAvatar } from "../SeerImages";
import { SOURCE_KIND_LABEL, type LedgerSummary, type Side, type ElfTally } from "../../battle/damageLedger";
import { outcomeView, kindSlices, KIND_COLOR, rankRows, topLabels, heroView, rankMvpSides, labelDisplay, niceScale, trendKind, type OutcomeView, type KindSlice } from "../../battle/resultView";
import { prefersReducedMotion } from "../../battle/introPlan";
import { formatBigNumber, formatFullNumber, safePct } from "../../utils/formatBigNumber";

const fmt = formatBigNumber, full = formatFullNumber;
/** 超過此量級不做線性 count-up（中間值無意義），直接淡入最終值。 */
const COUNT_UP_MAX = 1e9;

const SIDE_COLOR: Record<Side, string> = { p1: "#22d3ee", p2: "#fb7144" };
const SIDE_NAME: Record<Side, string> = { p1: "P1", p2: "P2" };

function useReduced() { return useMemo(() => prefersReducedMotion(), []); }

function useCountUp(target: number, enabled: boolean, ms = 900) {
  const [v, setV] = useState(enabled && Number.isFinite(target) && Math.abs(target) < COUNT_UP_MAX ? 0 : target);
  useEffect(() => {
    if (!enabled || typeof requestAnimationFrame === "undefined" || !Number.isFinite(target) || Math.abs(target) >= COUNT_UP_MAX) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const k = Math.max(0, Math.min(1, (now - t0) / ms)); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, ms]);
  return v;
}
function Num({ value, animate, className }: { value: number; animate: boolean; className?: string }) {
  const v = useCountUp(value, animate);
  const big = Math.abs(value) >= COUNT_UP_MAX;
  return <span className={`${className ?? ""}${big && animate ? " br-fadein" : ""}`.trim() || undefined} data-value={value} title={full(value)}>{fmt(v)}</span>;
}

function useWidth(initial = 520) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => { const width = el.clientWidth; if (width > 0) setW(width); };
    measure();
    if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect(); }
    window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure);
  }, []);
  return [ref, w] as const;
}

/** 原創徽章（純 SVG）：勝利＝金＋青，敗北＝暗紅＋灰藍，平手＝雙色對半。 */
export function ResultBadge({ tone }: { tone: OutcomeView["tone"] }) {
  const win = tone === "win", lose = tone === "lose";
  const a = win ? "#fde68a" : lose ? "#fca5a5" : "#bae6fd", b = win ? "#d97706" : lose ? "#7f1d1d" : "#0e7490";
  const rim = win ? "#fcd34d" : lose ? "#b91c1c" : "#94a3b8", glow = win ? "#22d3ee" : lose ? "#ef4444" : "#fb7144";
  return (
    <svg className="br-badge" viewBox="0 0 160 160" role="img" aria-label={win ? "勝利徽章" : lose ? "敗北徽章" : "平手徽章"}>
      <defs>
        <linearGradient id={`bb-g-${tone}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        <radialGradient id={`bb-h-${tone}`} cx=".5" cy=".4" r=".7"><stop offset="0" stopColor={win ? "#0e3a4a" : lose ? "#2a0c12" : "#0f2433"} /><stop offset="1" stopColor="#020617" /></radialGradient>
        <filter id={`bb-f-${tone}`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx="80" cy="80" r="74" fill="none" stroke={glow} strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 7" className="br-spin" />
      <g filter={`url(#bb-f-${tone})`} opacity={lose ? .8 : 1}>
        {/* 翼 */}
        <polygon points="22,62 4,44 10,78 26,92 36,84" fill={`url(#bb-g-${tone})`} opacity=".9" />
        <polygon points="26,92 10,100 28,112 44,104" fill={`url(#bb-g-${tone})`} opacity=".7" />
        <polygon points="138,62 156,44 150,78 134,92 124,84" fill={`url(#bb-g-${tone})`} opacity={lose ? .45 : .9} />
        <polygon points="134,92 150,100 132,112 116,104" fill={`url(#bb-g-${tone})`} opacity={lose ? .35 : .7} />
      </g>
      <polygon points="80,14 128,42 128,100 80,132 32,100 32,42" fill={`url(#bb-h-${tone})`} stroke={rim} strokeWidth="4" strokeLinejoin="round" />
      <polygon points="80,26 118,48 118,94 80,120 42,94 42,48" fill="none" stroke={glow} strokeOpacity=".55" strokeWidth="1.5" />
      {/* 交叉光刃 */}
      <g transform="translate(80 72)">
        <polygon points="-3,-40 3,-40 5,22 0,32 -5,22" fill={`url(#bb-g-${tone})`} transform="rotate(42)" />
        <polygon points="-3,-40 3,-40 5,22 0,32 -5,22" fill={`url(#bb-g-${tone})`} transform={lose ? "rotate(-42) translate(0 6)" : "rotate(-42)"} opacity={lose ? .55 : 1} />
        {tone === "draw" ? <rect x="-9" y="-9" width="18" height="18" transform="rotate(45)" fill="#e0f2fe" /> : <polygon points="0,-13 4,-4 13,-4 6,2 9,11 0,6 -9,11 -6,2 -13,-4 -4,-4" fill={win ? "#fff7d6" : "#fecaca"} />}
      </g>
      {lose && <polyline points="86,16 76,40 90,58 74,80 88,104 80,132" fill="none" stroke="#020617" strokeWidth="3" strokeLinejoin="round" />}
      {lose && <polyline points="86,16 76,40 90,58 74,80 88,104 80,132" fill="none" stroke="#ef4444" strokeOpacity=".7" strokeWidth="1" strokeLinejoin="round" />}
      {tone === "draw" && <line x1="80" y1="14" x2="80" y2="132" stroke="#fb7144" strokeWidth="3" />}
      <polygon points="80,136 92,148 80,158 68,148" fill={rim} />
    </svg>
  );
}

/* ───────── 圖表 ───────── */
function Donut({ side, slices, total, animate }: { side: Side; slices: KindSlice[]; total: number; animate: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const [ready, setReady] = useState(!animate);
  useEffect(() => { if (!animate) return; const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, [animate]);
  const cur = slices.find(s => s.kind === active) ?? null;
  const centerVal = cur ? cur.value : total, centerTxt = fmt(centerVal);
  const centerPx = Math.max(10, Math.min(21, 74 / (Math.max(centerTxt.length, 1) * 0.62)));
  let acc = 0;
  const gap = slices.length > 1 ? 0.9 : 0;
  return (
    <div className="br-donut-card" data-side={side} data-testid={`donut-${side}`} data-empty={total <= 0}>
      <div className="br-card-h"><i style={{ background: SIDE_COLOR[side] }} />{SIDE_NAME[side]} 輸出來源{total <= 0 && <span className="br-none" data-testid={`donut-none-${side}`}><svg viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3.6 12.4 12.4 3.6" stroke="currentColor" strokeWidth="1.4" /></svg>本局無輸出</span>}</div>
      {total <= 0 ? null : (
        <div className="br-donut-body">
          <div className="br-donut" onMouseLeave={() => setActive(null)}>
            <svg viewBox="0 0 42 42" role="img" aria-label={`${SIDE_NAME[side]} 輸出來源占比`}>
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="5.5" />
              {slices.map(s => {
                const len = Math.max(0.4, s.pct - gap), off = 25 - acc; acc += s.pct;
                return <circle key={s.kind} cx="21" cy="21" r="15.9155" fill="none" stroke={KIND_COLOR[s.kind]} strokeWidth={active === s.kind ? 7 : 5.5}
                  strokeDasharray={ready ? `${len} ${100 - len}` : `0 100`} strokeDashoffset={off} className="br-seg" data-kind={s.kind} data-pct={s.pct.toFixed(2)}
                  opacity={active && active !== s.kind ? .35 : 1} tabIndex={0} role="button" aria-label={`${s.label} ${full(s.value)}（${s.pct.toFixed(1)}%）`}
                  onMouseEnter={() => setActive(s.kind)} onFocus={() => setActive(s.kind)} onBlur={() => setActive(null)} onClick={() => setActive(a => a === s.kind ? null : s.kind)}>
                  <title>{`${s.label} ${full(s.value)}（${s.pct.toFixed(1)}%）`}</title>
                </circle>;
              })}
            </svg>
            <div className="br-donut-c" aria-live="polite">
              <small>{cur ? cur.label : "總輸出"}</small>
              <b data-testid={`donut-center-${side}`} title={full(centerVal)} style={{ fontSize: `${centerPx}px` }}>{centerTxt}</b>
              <small>{cur ? `${cur.pct.toFixed(1)}%` : "100%"}</small>
            </div>
          </div>
          <ul className="br-legend">
            {slices.map(s => (
              <li key={s.kind} data-kind={s.kind} data-active={active === s.kind} onMouseEnter={() => setActive(s.kind)} onMouseLeave={() => setActive(null)} onClick={() => setActive(a => a === s.kind ? null : s.kind)}>
                <i style={{ background: KIND_COLOR[s.kind] }} /><span>{s.label}</span><b title={full(s.value)}>{fmt(s.value)}</b><em>{s.pct.toFixed(1)}%</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RankList({ summary, teams, mvpSides, sideNames, mvpText, animate }: { summary: LedgerSummary; teams: Record<Side, Elf[]>; mvpSides: Side[]; sideNames: Record<Side, string>; mvpText: Record<Side, string>; animate: boolean }) {
  const [metric, setMetric] = useState<"dealt" | "taken">("dealt");
  const rows = useMemo(() => rankRows(summary, metric, mvpSides), [summary, metric, mvpSides]);
  const [ready, setReady] = useState(!animate);
  useEffect(() => { if (!animate) return; const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, [animate]);
  const find = (e: ElfTally) => teams[e.side].find(x => (x.battleId || x.id) === e.battleId);
  return (
    <div className="br-card" data-testid="rank-card">
      <div className="br-card-h">精靈排行
        <span className="br-seg-ctl" role="group" aria-label="排行指標">
          {([["dealt", "輸出"], ["taken", "承受"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={metric === k} onClick={() => setMetric(k)}>{l}</button>)}
        </span>
      </div>
      {(["p1", "p2"] as const).map(side => (
        <div key={side} className="br-rank-side" data-side={side} data-testid={`rank-group-${side}`} style={{ ["--side" as any]: SIDE_COLOR[side] }}>
          <div className="br-rank-tag"><b>{SIDE_NAME[side]}</b>{sideNames[side] && <span>{sideNames[side]}</span>}</div>
          {rows[side].length === 0 ? <p className="br-empty">無紀錄</p> : rows[side].map(r => {
            const elf = find(r);
            return (
              <div key={r.battleId || r.name} className="br-rank-row" data-testid={`rank-${side}`} data-value={r.value} data-mvp={r.mvp}>
                <span className="br-av" style={{ borderColor: SIDE_COLOR[side] }}>{elf ? <ElfAvatar elf={elf} battleSide={side} kind="head" className="w-full h-full object-cover" /> : <b>{r.name.slice(-1)}</b>}</span>
                <span className="br-rank-main">
                  <span className="br-rank-name"><span>{r.name}</span>{r.mvp && <em className="br-mvp" title="己方輸出最高">{mvpText[side]}</em>}</span>
                  <span className="br-bar"><i style={{ width: ready ? `${r.pct}%` : "0%", background: SIDE_COLOR[side] }} /></span>
                </span>
                <b className="br-rank-v" title={full(r.value)}>{fmt(r.value)}</b>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TopSkills({ summary, teams, animate }: { summary: LedgerSummary; teams: Record<Side, Elf[]>; animate: boolean }) {
  const list = topLabels(summary, 5);
  const max = Math.max(1, ...list.map(l => l.total));
  const [ready, setReady] = useState(!animate);
  useEffect(() => { if (!animate) return; const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, [animate]);
  return (
    <div className="br-card" data-testid="top-skills">
      <div className="br-card-h">技能貢獻 Top 5</div>
      {list.length === 0 ? <p className="br-empty">無紀錄</p> : list.map((l, i) => {
        const src = teams[l.side].find(x => (x.battleId || x.id) === l.sourceBattleId) ?? teams[l.side].find(x => x.name === l.sourceName);
        const d = labelDisplay(l, src);
        return (
        <div key={`${l.side}|${l.kind}|${l.label}`} className="br-skill-row" data-testid="top-skill" data-total={l.total} data-label={d.text} title={`${SIDE_NAME[l.side]}・${SOURCE_KIND_LABEL[l.kind]}・${d.tip}・${l.hits} 次`}>
          <span className="br-skill-n">{i + 1}</span>
          <span className="br-rank-main">
            <span className="br-rank-name"><span>{d.text}</span><em className="br-chip" style={{ color: KIND_COLOR[l.kind], borderColor: KIND_COLOR[l.kind] }}>{SOURCE_KIND_LABEL[l.kind]}</em></span>
            <span className="br-bar"><i style={{ width: ready ? `${safePct(l.total, max)}%` : "0%", background: SIDE_COLOR[l.side] }} /></span>
          </span>
          <b className="br-rank-v" title={full(l.total)}>{fmt(l.total)}</b>
        </div>
      );})}
    </div>
  );
}

function TrendChart({ summary, animate }: { summary: LedgerSummary; animate: boolean }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const data = summary.perTurn;
  const n = data.length;
  const mode = trendKind(n);
  const h = 168, padR = 12, padT = 16, padB = 22;
  const max = Math.max(0, ...data.flatMap(d => [d.p1, d.p2]).filter(Number.isFinite));
  const scale = useMemo(() => niceScale(max), [max]);
  const tickTxt = (t: number) => formatBigNumber(t, { sig: 3 });
  const padL = Math.max(46, Math.max(...scale.ticks.map(t => tickTxt(t).length)) * 6.2 + 12);
  const innerW = Math.max(1, width - padL - padR);
  const y = (v: number) => padT + (1 - Math.min(1, Math.max(0, Number.isFinite(v) ? v / scale.max : 1))) * (h - padT - padB);
  const gw = innerW / Math.max(1, n);
  const x = (i: number) => padL + (mode === "bars" ? gw * (i + .5) : n <= 1 ? innerW / 2 : i / (n - 1) * innerW);
  const line = (k: Side) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(" ");
  const area = (k: Side) => n ? `${line(k)} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";
  const ticks = mode === "bars" || n <= 8 ? data.map((_, i) => i) : [0, ...Array.from({ length: 4 }, (_, j) => Math.round((j + 1) * (n - 1) / 5)), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const barW = Math.min(44, gw * .3);
  const valTxt = (v: number) => formatBigNumber(v, { sig: barW < 34 ? 3 : 4 });
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / Math.max(1, r.width) * innerW;
    setHover(mode === "bars" ? Math.max(0, Math.min(n - 1, Math.floor(px / gw))) : n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(px / innerW * (n - 1)))));
  };
  const hd = hover !== null ? data[hover] : null;
  return (
    <div className="br-card" data-testid="trend-card">
      <div className="br-card-h">回合走勢<span className="br-keys"><i style={{ background: SIDE_COLOR.p1 }} />P1<i style={{ background: SIDE_COLOR.p2 }} />P2</span></div>
      <div ref={ref} className="br-trend" onMouseLeave={() => setHover(null)}>
        {n === 0 ? <p className="br-empty">無傷害紀錄</p> : (
          <svg width={width} height={h} role="img" aria-label="每回合雙方輸出" data-testid="trend-svg" data-points={n} data-mode={mode} data-ymax={scale.max}>
            {scale.ticks.map(t => <g key={t}><line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(148,163,184,.35)" : "rgba(148,163,184,.14)"} /><text x={padL - 6} y={y(t) + 3} textAnchor="end" className="br-ax" data-testid="trend-ytick">{tickTxt(t)}</text><title>{full(t)}</title></g>)}
            {ticks.map(i => <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="br-ax">{data[i].turn}</text>)}
            {mode === "bars" ? data.map((d, i) => (["p1", "p2"] as const).map((k, j) => {
              const bx = x(i) + (j ? 2 : -barW - 2), bh = Math.max(d[k] > 0 ? 2 : 0, y(0) - y(d[k]));
              return <g key={`${i}${k}`} data-testid={`trend-bar-${k}`} data-value={d[k]}>
                <rect x={bx} y={y(0) - bh} width={barW} height={bh} fill={SIDE_COLOR[k]} opacity={hover === null || hover === i ? 1 : .45} className={animate ? "br-grow" : undefined} style={{ transformOrigin: `${bx}px ${y(0)}px` }} />
                {d[k] > 0 && <text x={bx + barW / 2} y={y(0) - bh - 4} textAnchor="middle" className="br-ax br-val">{valTxt(d[k])}</text>}
                <title>{full(d[k])}</title>
              </g>;
            })) : (["p1", "p2"] as const).map(k => <g key={k}>
              <path d={area(k)} fill={SIDE_COLOR[k]} opacity=".1" />
              <path d={line(k)} fill="none" stroke={SIDE_COLOR[k]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className={animate ? "br-draw" : undefined} data-testid={`trend-${k}`} />
            </g>)}
            {mode === "line" && hover !== null && hd && <g pointerEvents="none"><line x1={x(hover)} x2={x(hover)} y1={padT} y2={h - padB} stroke="rgba(226,232,240,.4)" />
              {(["p1", "p2"] as const).map(k => <circle key={k} cx={x(hover)} cy={y(hd[k])} r="4" fill={SIDE_COLOR[k]} stroke="#020617" strokeWidth="2" />)}</g>}
            <rect x={padL} y={padT} width={innerW} height={h - padT - padB} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
          </svg>
        )}
        {hd && <div className="br-tip" style={{ left: Math.min(Math.max(x(hover!), 70), width - 70) }} data-testid="trend-tip"><b>第 {hd.turn} 回合</b><span style={{ color: SIDE_COLOR.p1 }}>P1 <span title={full(hd.p1)}>{fmt(hd.p1)}</span></span><span style={{ color: SIDE_COLOR.p2 }}>P2 <span title={full(hd.p2)}>{fmt(hd.p2)}</span></span></div>}
      </div>
    </div>
  );
}

function Tile({ label, tip, children, testid, pp, chars = 6 }: { label: string; tip: string; children: React.ReactNode; testid: string; pp?: boolean; chars?: number }) {
  return <div className="br-tile" title={tip} data-testid={testid}><small><span>{label}</span>{pp && <em className="br-pp" data-testid={`${testid}-pp`}><b className="p1">P1</b>/<b className="p2">P2</b></em>}</small><div style={{ ["--chars" as any]: chars }}>{children}</div></div>;
}
const len2 = (a: number, b: number) => fmt(a).length + fmt(b).length + 3;
const Split = ({ a, b, animate }: { a: number; b: number; animate: boolean }) => (
  <span className="br-split"><Num value={a} animate={animate} className="p1" /><i>/</i><Num value={b} animate={animate} className="p2" /></span>
);

export interface BattleResultProps {
  winner: "p1" | "p2" | "draw";
  battleMode: "PVE" | "PVP" | string;
  summary: LedgerSummary;
  p1Team: Elf[]; p2Team: Elf[];
  format: string;
  onRestart: () => void;
  onHome: () => void;
}

/** 普通對戰結算：全螢幕可捲動面板。數字全部來自傷害帳本彙總。 */
export function BattleResult({ winner, battleMode, summary, p1Team, p2Team, format, onRestart, onHome }: BattleResultProps) {
  const view = useMemo(() => outcomeView(winner, battleMode), [winner, battleMode]);
  const reduced = useReduced();
  const animate = !reduced;
  const [collapsed, setCollapsed] = useState(false);
  const teams = { p1: p1Team, p2: p2Team };
  const hv = useMemo(() => heroView(summary, view, { p1: p1Team }), [summary, view, p1Team]);
  const mvpSides = rankMvpSides(view);
  const pve = battleMode === "PVE";
  const sideNames: Record<Side, string> = pve ? { p1: "我方", p2: "對手" } : { p1: "", p2: "" };
  const mvpText: Record<Side, string> = { p1: view.tone === "lose" ? "最佳" : "MVP", p2: "MVP" };
  const slices = { p1: kindSlices(summary, "p1"), p2: kindSlices(summary, "p2") };
  const shield = summary.absorbed.p1.shield + summary.absorbed.p2.shield, barrier = summary.absorbed.p1.barrier + summary.absorbed.p2.barrier;
  const mh = summary.maxHit;
  const total = summary.totalDealt.p1 + summary.totalDealt.p2;

  const fallbackMvp = useMemo<ElfTally | null>(() => {
    if (hv.primary.length) return null;
    const side = view.winnerSide ?? "p1"; const team = teams[side];
    const e = team.find(x => (x.currentHp ?? 0) > 0) ?? team[0];
    return e ? { side, battleId: e.battleId || e.id, name: e.name, dealt: 0, taken: 0 } : null;
  }, [hv, view]);
  const heroes = hv.primary.length ? hv.primary : fallbackMvp ? [fallbackMvp] : [];
  const heroSide: Side = heroes[0]?.side ?? "p2";
  const elfOf = (t: ElfTally) => teams[t.side].find(x => (x.battleId || x.id) === t.battleId) ?? teams[t.side].find(x => x.name === t.name);

  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialogRef.current; if (!d || collapsed) return;
    try { d.showModal?.(); } catch { /* 已開啟 */ }
    if (!d.hasAttribute("open")) d.setAttribute("open", "");
    return () => { try { d.close?.(); } catch { /* 略過 */ } };
  }, [collapsed]);

  if (collapsed) return (
    <div className="br-mini" data-testid="battle-result-mini" data-tone={view.tone}>
      <b>{view.zh}</b>
      <button type="button" onClick={() => setCollapsed(false)} autoFocus>返回結算</button>
      <button type="button" onClick={onRestart}>重來</button>
      <button type="button" onClick={onHome}>回到首頁</button>
    </div>
  );

  return (
    <dialog ref={dialogRef} className="br-root" onCancel={e => e.preventDefault()} aria-labelledby="battle-result-title" data-testid="battle-result" data-tone={view.tone} data-outcome={view.outcome} data-animate={animate}>
      <div className="br-scroll">
        <div className="br-wrap">
          <header className="br-hero" data-art={heroSide === "p1" ? "left" : "right"}>
            <div className="br-bands" aria-hidden><i /><i /><i /></div>
            <div className="br-hero-text">
              <ResultBadge tone={view.tone} />
              <div>
                <p className="br-kicker">{format}<span>·</span>{battleMode === "PVE" ? "對戰 AI" : "雙人同屏"}<span>·</span>{summary.turns} 回合</p>
                <h2 id="battle-result-title" className="br-title" data-testid="result-title"><span className="en">{view.en}</span><span className="zh" data-testid="result-zh">{view.zh}</span></h2>
                {heroes.length > 0 && <p className="br-mvpline" data-testid="hero-mvp">
                  <em>{hv.primaryLabel}</em>{heroes.map(h => h.name).join(" / ")}{heroes[0].dealt > 0 && <b title={heroes.map(h => full(h.dealt)).join(" / ")}>{heroes.map(h => fmt(h.dealt)).join(" / ")}</b>}
                </p>}
                {hv.opponentMvp && <p className="br-oppline" data-testid="opp-mvp"><span>對手 MVP</span>{hv.opponentMvp.name}<b title={full(hv.opponentMvp.dealt)}>{fmt(hv.opponentMvp.dealt)}</b></p>}
              </div>
            </div>
            <div className="br-hero-art" data-count={heroes.length}>
              {heroes.map(h => { const elf = elfOf(h); return elf ? (
                <div key={h.side + h.battleId} className="br-hero-sprite" data-side={h.side} data-testid={`hero-sprite-${h.side}`}>
                  <ElfAvatar elf={elf} battleSide={h.side} kind="body" className="br-hero-img" fallbackClassName="br-hero-fb" />
                </div>) : null; })}
            </div>
          </header>

          <section className="br-tiles" aria-label="關鍵數字">
            <Tile testid="tile-turns" label="回合數" tip="本局進行的回合數"><Num value={summary.turns} animate={animate} /></Tile>
            <Tile pp chars={len2(summary.totalDealt.p1, summary.totalDealt.p2)} testid="tile-dealt" label="總輸出" tip="雙方實際造成的體力損失（P1 / P2）；不含被護盾、屏障吸收的量"><Split a={summary.totalDealt.p1} b={summary.totalDealt.p2} animate={animate} /></Tile>
            <Tile chars={mh ? fmt(mh.hpLost).length : 1} testid="tile-maxhit" label="最大單擊" tip={mh ? `${SIDE_NAME[mh.sourceSide]}・${mh.sourceName}・${mh.sourceLabel}（第 ${mh.turn} 回合）` : "無"}>
              {mh ? <><Num value={mh.hpLost} animate={animate} className={mh.sourceSide} /><small className="br-sub">{mh.sourceName}・{mh.sourceLabel}</small></> : <span>—</span>}
            </Tile>
            <Tile pp chars={len2(summary.crits.p1, summary.crits.p2)} testid="tile-crit" label="暴擊" tip="暴擊次數（P1 / P2）"><Split a={summary.crits.p1} b={summary.crits.p2} animate={animate} /></Tile>
            <Tile chars={fmt(shield + barrier).length} testid="tile-absorb" label="護盾／屏障吸收" tip={`護盾 ${full(shield)}，屏障 ${full(barrier)}`}><Num value={shield + barrier} animate={animate} /></Tile>
            <Tile pp chars={len2(summary.heal.p1, summary.heal.p2)} testid="tile-heal" label="總治療" tip="雙方恢復體力的總量（P1 / P2）"><Split a={summary.heal.p1} b={summary.heal.p2} animate={animate} /></Tile>
          </section>

          <section className="br-grid">
            <div className="br-span br-donuts" data-solo={(summary.totalDealt.p1 <= 0) !== (summary.totalDealt.p2 <= 0)} data-testid="donuts">
              <Donut side="p1" slices={slices.p1} total={summary.totalDealt.p1} animate={animate} />
              <Donut side="p2" slices={slices.p2} total={summary.totalDealt.p2} animate={animate} />
            </div>
            <RankList summary={summary} teams={teams} mvpSides={mvpSides} sideNames={sideNames} mvpText={mvpText} animate={animate} />
            <TopSkills summary={summary} teams={teams} animate={animate} />
            <div className="br-span"><TrendChart summary={summary} animate={animate} /></div>
          </section>
          <p className="br-foot" title="輸出＝實際扣除的體力；被護盾、屏障吸收與自傷不計入">總輸出 <b title={full(total)}>{fmt(total)}</b></p>
        </div>
      </div>
      <footer className="br-actions">
        <button type="button" className="primary" autoFocus onClick={onRestart} title="以原本的陣容與首發開始新的一局">重來</button>
        <button type="button" onClick={onHome}>回到首頁</button>
        <button type="button" className="ghost" onClick={() => setCollapsed(true)} title="收起面板，查看最後的戰場">查看戰場</button>
      </footer>
    </dialog>
  );
}
