import React, { useEffect, useRef, useState } from "react";
import type { Elf } from "../../types";
import { ElfAvatar, TypeIcon } from "../SeerImages";
import { hiddenFromViewer } from "../../battle/viewerPerspective";
import { appearanceElf } from "../../battle/illusion";
import type { IntroPlan } from "../../battle/introPlan";

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({ left: (i * 37 + 11) % 100, delay: ((i * 53) % 100) / 100 * 1.6, dur: 1.2 + ((i * 29) % 10) / 10 }));

function Side({ elf, side }: { elf: Elf; side: "p1" | "p2" }) {
  // 立繪長寬比不同時，窄螢幕上寬圖會顯得小：依圖片比例放大（上限 1.45），讓雙方視覺份量接近。
  const [fit, setFit] = useState(1);
  const hidden = hiddenFromViewer(elf, side);
  const shown = appearanceElf(elf);
  return (
    <section className={`bi-side bi-side-${side === "p1" ? 1 : 2}`} data-side={side}>
      <div className="bi-sprite">
        <div className="bi-ground" />
        <div className="bi-art" style={{ ["--bi-fit" as any]: fit }}
          onLoadCapture={event => { const img = event.target as HTMLImageElement; if (img.naturalWidth > 0 && img.naturalHeight > 0) setFit(Math.min(1.45, Math.max(1, Math.pow(img.naturalWidth / img.naturalHeight, .7)))); }}>
          <ElfAvatar elf={elf} battleSide={side} kind="body" className="bi-img"
            fallbackClassName="bi-fb" />
        </div>
      </div>
      <div className="bi-plate">
        <span className="ic">{hidden ? null : <TypeIcon type={shown.type} size={30} />}</span>
        <span>
          <span className="who">{side.toUpperCase()}</span>
          <span className="nm" data-testid={`intro-name-${side}`}>{hidden ? "？？？" : shown.name}</span>
        </span>
      </div>
    </section>
  );
}

/** 入戰動畫：純展示。結束（含跳過）時呼叫 onDone 一次；不碰引擎。 */
export function BattleIntro({ p1, p2, format, plan, onDone }: {
  p1: Elf; p2: Elf; format: string; plan: IntroPlan; onDone: () => void;
}) {
  const [skipping, setSkipping] = useState(false);
  const doneRef = useRef(false);
  const skipRef = useRef<() => void>(() => {});
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  const finish = () => { if (!doneRef.current) { doneRef.current = true; doneCb.current(); } };

  useEffect(() => {
    const timer = setTimeout(finish, plan.ms);
    return () => clearTimeout(timer);
  }, [plan.ms]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const skip = (event?: Event) => {
      event?.stopPropagation();
      if (doneRef.current || timer) return;
      setSkipping(true);
      timer = setTimeout(finish, 170);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta") return; event.preventDefault(); skip(event); };
    window.addEventListener("keydown", onKey, true);
    skipRef.current = () => skip();
    return () => { window.removeEventListener("keydown", onKey, true); skipRef.current = () => {}; if (timer) clearTimeout(timer); };
  }, []);

  const seamPoints = "59,0 54.5,18 57.5,22 50.5,48 53.5,52 47,78 49.5,81 41,100";
  return (
    <div className="bi-root" data-testid="battle-intro" data-variant={plan.variant} data-skipping={skipping} role="presentation"
      onPointerDown={event => { event.stopPropagation(); skipRef.current(); }}>
      <div className="bi-bg" />
      <div className="bi-shake">
        <div className="bi-half bi-half-1" />
        <div className="bi-half bi-half-2" />
        <svg className="bi-seam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline className="glow" points={seamPoints} pathLength={1} style={{ strokeWidth: 1.1 }} />
          <polyline className="core" points={seamPoints} pathLength={1} style={{ strokeWidth: .3 }} />
        </svg>
        <div className="bi-parts" aria-hidden>
          {PARTICLES.map((p, i) => <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />)}
        </div>
        <div className="bi-vsfade">
          <Side elf={p1} side="p1" />
          <Side elf={p2} side="p2" />
          <div className="bi-vs" aria-hidden>
            <i className="ring" /><i className="ring r2" />
            <svg viewBox="0 0 200 200">
              <defs>
                <linearGradient id="bi-vs-l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a5f3fc" /><stop offset="1" stopColor="#0891b2" /></linearGradient>
                <linearGradient id="bi-vs-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fed7aa" /><stop offset="1" stopColor="#ea580c" /></linearGradient>
                <clipPath id="bi-clip-l"><polygon points="0,0 104,0 92,200 0,200" /></clipPath>
                <clipPath id="bi-clip-r"><polygon points="104,0 200,0 200,200 92,200" /></clipPath>
                <filter id="bi-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {/* 斜切光刃 */}
              <polygon points="20,150 150,10 158,18 28,160" fill="url(#bi-vs-l)" opacity=".9" filter="url(#bi-glow)" />
              <polygon points="42,190 176,48 182,56 50,198" fill="url(#bi-vs-r)" opacity=".9" filter="url(#bi-glow)" />
              {/* 閃電 */}
              <polygon points="118,6 78,92 104,92 82,194 140,84 112,84" fill="#fff" opacity=".95" filter="url(#bi-glow)" />
              <g filter="url(#bi-glow)" fontFamily="'Space Grotesk', 'Noto Sans TC', sans-serif" fontWeight="900" fontStyle="italic" fontSize="112" textAnchor="middle">
                <text x="100" y="128" fill="#020617" stroke="#020617" strokeWidth="14" strokeLinejoin="round">VS</text>
                <g clipPath="url(#bi-clip-l)"><text x="100" y="128" fill="url(#bi-vs-l)" stroke="#e0f2fe" strokeWidth="2">VS</text></g>
                <g clipPath="url(#bi-clip-r)"><text x="100" y="128" fill="url(#bi-vs-r)" stroke="#fff7ed" strokeWidth="2">VS</text></g>
              </g>
            </svg>
          </div>
        </div>
        <div className="bi-format"><span className="d" /><b data-testid="intro-format">{format}</b><span className="d" /></div>
      </div>
      <div className="bi-start" aria-hidden><span className="en">BATTLE START</span><span className="zh">戰鬥開始</span></div>
      <div className="bi-flash" aria-hidden />
      <div className="bi-scan" aria-hidden />
      <div className="bi-skiptip" aria-hidden>SKIP</div>
    </div>
  );
}
