/**
 * PaperDestinyBackdrop.tsx — 命運之輪「紙本」主題的 Canvas 背景層
 *
 * 2026-10-29：P3 第三步。移植自「拾光行記」的手繪筆法（見 design/sketchStroke.ts）。
 *
 * 設計原則：
 * 1. 純裝飾層，pointer-events: none，絕不吃掉任何點擊
 * 2. 不影響既有 DOM 與流程（抽卡、禁選、選角全部照舊）
 * 3. 用 requestAnimationFrame 做慢速自轉與視差；reduced-motion 時停掉動畫
 * 4. 尺寸用 ResizeObserver + devicePixelRatio，避免模糊
 *
 * 畫的內容：
 * - 半調網點底（中心密、外圍疏）
 * - 三層手繪圓環（外環慢速自轉、中環反向、內環帶光刃）
 * - 放射細線（12 道，對應 12 連抽）
 * - 星芒碎片（緩慢漂浮）
 */

import React from "react";
import { ring, rule, blade, sparkle, makeHalftone, rng, TAU, PAPER_PALETTE } from "../design/sketchStroke";

export interface PaperDestinyBackdropProps {
  /** 目前階段：intro / pulling / reveal / ban / pick / ready，用於改變圓環速度 */
  phase?: string;
  /** 已揭示的張數（0-12），驅動放射線亮起 */
  revealed?: number;
  /** 總張數，預設 12 */
  total?: number;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function PaperDestinyBackdrop({ phase = "intro", revealed = 0, total = 12 }: PaperDestinyBackdropProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number>(0);
  const startRef = React.useRef<number>(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    let halftone: HTMLCanvasElement | null = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 網點尺寸取畫面短邊，太大會很慢
      const size = Math.min(520, Math.max(240, Math.round(Math.min(w, h) * 0.9)));
      halftone = makeHalftone(size, 11, 20261029, PAPER_PALETTE.pale, PAPER_PALETTE.paper, dpr);
    };

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const reduced = prefersReducedMotion();
    // 各階段的自轉速度（弧度/秒）
    const speedFor = (p: string) => p === "pulling" ? 0.42 : p === "reveal" ? 0.26 : p === "ban" ? 0.16 : p === "pick" ? 0.20 : 0.10;

    const draw = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = (now - startRef.current) / 1000;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.36;

      // ── 底：紙白 + 網點
      ctx.fillStyle = PAPER_PALETTE.paper;
      ctx.fillRect(0, 0, w, h);
      if (halftone) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.drawImage(halftone, cx - halftone.width / (2 * dpr), cy - halftone.height / (2 * dpr), halftone.width / dpr, halftone.height / dpr);
        ctx.restore();
      }

      const spin = reduced ? 0 : t * speedFor(phase);

      // ── 放射細線（12 道，已揭示的亮起來）
      ctx.save();
      for (let i = 0; i < total; i++) {
        const a = (i / total) * TAU + spin * 0.35;
        const inner = R * 1.06, outer = R * 1.42;
        const lit = i < revealed;
        ctx.strokeStyle = lit ? PAPER_PALETTE.warm : PAPER_PALETTE.pale;
        ctx.globalAlpha = lit ? 0.9 : 0.32;
        ctx.lineWidth = lit ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        ctx.stroke();
      }
      ctx.restore();

      // ── 三層手繪圓環
      const rings: { r: number; seed: number; rot: number; width: number; alpha: number; color: string }[] = [
        { r: R * 1.00, seed: 3301, rot: spin * 1.0, width: 2.2, alpha: 0.85, color: PAPER_PALETTE.cobalt },
        { r: R * 0.74, seed: 7717, rot: -spin * 0.7, width: 1.6, alpha: 0.62, color: PAPER_PALETTE.ink },
        { r: R * 0.46, seed: 9109, rot: spin * 1.4, width: 1.3, alpha: 0.48, color: PAPER_PALETTE.pale },
      ];
      for (const rg of rings) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rg.rot);
        ctx.globalAlpha = rg.alpha;
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = rg.width;
        ctx.lineCap = "round";
        ctx.stroke(new Path2D(ring(0, 0, rg.r, rg.seed)));
        ctx.restore();
      }

      // ── 中心光刃（pulling 階段明顯）
      const bladePulse = phase === "pulling" ? 0.65 + Math.sin(t * 6) * 0.35 : 0.35;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = bladePulse;
      ctx.fillStyle = PAPER_PALETTE.warm;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + spin * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fill(new Path2D(blade(R * 0.22, 0, R * 0.20, 0, R * 0.035)));
        ctx.restore();
      }
      ctx.restore();

      // ── 十字標線（圖紙感）
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = PAPER_PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.stroke(new Path2D(rule(cx - R * 1.55, cy, cx - R * 1.15, cy, 555)));
      ctx.stroke(new Path2D(rule(cx + R * 1.15, cy, cx + R * 1.55, cy, 556)));
      ctx.stroke(new Path2D(rule(cx, cy - R * 1.55, cx, cy - R * 1.15, 557)));
      ctx.stroke(new Path2D(rule(cx, cy + R * 1.15, cx, cy + R * 1.55, 558)));
      ctx.restore();

      // ── 星芒碎片（慢速漂浮）
      const Rr = rng(4242);
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = PAPER_PALETTE.cobalt;
      ctx.lineWidth = 0.9;
      for (let i = 0; i < 7; i++) {
        const bx = Rr() * w;
        const by = Rr() * h;
        const drift = reduced ? 0 : Math.sin(t * 0.5 + i) * 6;
        ctx.stroke(new Path2D(sparkle(bx, by + drift, 7 + Rr() * 5, 5, 100 + i)));
      }
      ctx.restore();

      if (!reduced) rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
    };
  }, [phase, revealed, total]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
