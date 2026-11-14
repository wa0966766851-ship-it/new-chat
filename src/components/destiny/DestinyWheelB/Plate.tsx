import React, { useMemo } from "react";
import { rule, ring } from "./bModel";
import { Ink } from "./Ink";
import { C, hashSeed } from "./bModel";

/**
 * 圖版框（拾光行記 FIG 圖版）：手繪外框＋四角十字、左上 FIG 編號、右上英文標、左下色票、右下條碼、框外構造線註記。
 * 取代原本的方框面板；內容（卡片網格）原樣放進來。
 */
export function Plate({ fig, en, title, right, children, testid, tone = "a", className }: {
  fig: string; en: string; title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; testid?: string;
  tone?: "a" | "b"; className?: string;
}) {
  const seed = hashSeed(fig + en);
  const frame = useMemo(() => [
    rule(0, 0, 1000, 0, seed + 1, { ext: 4, bow: 0.002 }), rule(1000, 0, 1000, 1000, seed + 2, { ext: 4, bow: 0.002 }),
    rule(1000, 1000, 0, 1000, seed + 3, { ext: 4, bow: 0.002 }), rule(0, 1000, 0, 0, seed + 4, { ext: 4, bow: 0.002 }),
  ], [seed]);
  return (
    <section className={`dwb-plate dwb-plate--${tone}${className ? ` ${className}` : ""}`} data-testid={testid} aria-label={typeof title === "string" ? title : en}>
      <svg className="dwb-plate-frame" viewBox="-8 -8 1016 1016" preserveAspectRatio="none" aria-hidden="true">
        {frame.map((d, i) => <Ink key={i} d={d} color={tone === "b" ? C.paper : C.ink} width={1.1} />)}
      </svg>
      <header className="dwb-plate-head">
        <div className="dwb-plate-fig"><b>{fig}</b><i>{en}</i></div>
        <h3>{title}</h3>
        <div className="dwb-plate-right">{right}</div>
      </header>
      <div className="dwb-plate-body">{children}</div>
      <footer className="dwb-plate-foot" aria-hidden="true">
        <span className="dwb-swatch"><i style={{ background: C.cobalt }} /><i style={{ background: C.ink }} /><i style={{ background: C.warm, opacity: 0.55 }} /></span>
        <span className="dwb-barcode">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ width: ((seed >> (i % 24)) & 1) + 1 }} />)}</span>
      </footer>
      <small className="dwb-plate-cap" aria-hidden="true">構造線 · CONSTRUCTION</small>
    </section>
  );
}

/** 章節標頭：置中小標（中文／英文·PLATE n/5）＋巨大淡色英文浮水印＋右側動作。 */
export function ChapterHead({ no, name, en, count, actions, hint }: { no: string; name: string; en: string; count?: React.ReactNode; actions?: React.ReactNode; hint?: string }) {
  const r = useMemo(() => ring(0, 0, 46, hashSeed(en), { amp: 0.03 }), [en]);
  return (
    <div className="dwb-chead" title={hint}>
      <span className="dwb-watermark" aria-hidden="true">{en}</span>
      <div className="dwb-chead-mid">
        <svg className="dwb-chead-ring" viewBox="-60 -60 120 120" aria-hidden="true"><Ink d={r} color={C.cobalt} width={1} /></svg>
        <small>{name} · {en} · PLATE {no} / 04</small>
        <h2><em>{no}</em>{name}</h2>
        {count && <p className="dwb-chead-count">{count}</p>}
      </div>
      {actions && <div className="dwb-chead-actions">{actions}</div>}
    </div>
  );
}

/** 票根式主要按鈕（拾光行記「單程 · ONE WAY」車票）。 */
export function TicketButton({ label, sub, onClick, disabled, testid, go }: { label: string; sub: string; onClick: () => void; disabled?: boolean; testid?: string; go?: boolean }) {
  return (
    <button type="button" className={`dwb-ticket${go ? " dwb-ticket--go" : ""}`} data-testid={testid} disabled={disabled} onClick={onClick}>
      <span className="dwb-ticket-sub">{sub}</span><span className="dwb-ticket-label">{label}</span><span className="dwb-ticket-no" aria-hidden="true">▸</span>
    </button>
  );
}
