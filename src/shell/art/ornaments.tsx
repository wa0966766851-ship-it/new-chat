import React from "react";

/**
 * Aegis 裝飾元件 — 全部程式繪製（SVG），無外部圖檔
 *
 * 視覺語言：
 *   工業科幻 + 檔案藍圖感。細髮絲線、切角、刻度尺、軌道弧。
 *   不是霓虹賽博，也不是圓潤的 iOS 卡片——刻意保留「機械製圖」的硬邊。
 *   賽爾號的元素保留在「能量／屬性／星軌」的意象，但重新繪製，不沿用舊 UI。
 */

const HAIR = 1;

/** 切角矩形：左上與右下切角，像終末地的面板 */
export function CutPanel({
  children, className, style, accent, corner = 14,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  accent?: boolean;
  corner?: number;
}) {
  const clip = `polygon(${corner}px 0, 100% 0, 100% calc(100% - ${corner}px), calc(100% - ${corner}px) 100%, 0 100%, 0 ${corner}px)`;
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: accent
            ? "color-mix(in srgb, var(--p-accent) 10%, var(--p-panel))"
            : "var(--p-panel)",
          clipPath: clip,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: accent ? "var(--p-accent)" : "var(--p-line)",
          clipPath: clip,
          opacity: accent ? 0.55 : 1,
          maskImage: `linear-gradient(#000 0 0), linear-gradient(#000 0 0)`,
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: HAIR,
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

/** 角標：四個 L 形括號，框住一個區域 */
export function CornerBrackets({ size = 12, inset = 0, color = "var(--p-accent)", opacity = 0.7 }) {
  const s: React.CSSProperties = { position: "absolute", width: size, height: size, borderColor: color, opacity, pointerEvents: "none" };
  return (
    <>
      <span style={{ ...s, top: inset, left: inset, borderTop: `${HAIR}px solid`, borderLeft: `${HAIR}px solid` }} />
      <span style={{ ...s, top: inset, right: inset, borderTop: `${HAIR}px solid`, borderRight: `${HAIR}px solid` }} />
      <span style={{ ...s, bottom: inset, left: inset, borderBottom: `${HAIR}px solid`, borderLeft: `${HAIR}px solid` }} />
      <span style={{ ...s, bottom: inset, right: inset, borderBottom: `${HAIR}px solid`, borderRight: `${HAIR}px solid` }} />
    </>
  );
}

/** 軌道弧：同心圓 + 刻度 + 一個亮弧，像終末地的圓盤 */
export function OrbitalRing({
  size = 260, rings = 3, accent = "var(--p-accent)", opacity = 0.5, spin = true,
}: {
  size?: number;
  rings?: number;
  accent?: string;
  opacity?: number;
  spin?: boolean;
}) {
  const c = size / 2;
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ opacity, pointerEvents: "none" }}
      aria-hidden
    >
      {Array.from({ length: rings }, (_, i) => {
        const r = c - 8 - i * (c / (rings + 1.6));
        return <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={accent} strokeWidth={i === 0 ? 1 : 0.6} opacity={0.55 - i * 0.12} />;
      })}
      {/* 外圈刻度 */}
      <g style={spin ? { transformOrigin: `${c}px ${c}px`, animation: "aegisSpin 48s linear infinite" } : undefined}>
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const long = i % 6 === 0;
          const r1 = c - 2;
          const r2 = c - (long ? 12 : 6);
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1}
              x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2}
              stroke={accent} strokeWidth={long ? 1 : 0.5} opacity={long ? 0.7 : 0.35}
            />
          );
        })}
      </g>
      {/* 亮弧 */}
      <circle
        cx={c} cy={c} r={c - 20}
        fill="none" stroke={accent} strokeWidth={2}
        strokeDasharray={`${c * 0.55} ${c * 6}`}
        strokeLinecap="round"
        style={{ transformOrigin: `${c}px ${c}px`, animation: "aegisSpin 22s linear infinite reverse" }}
      />
      <style>{`@keyframes aegisSpin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

/** 十字準星：終末地那種細線 + 中心點 */
export function Crosshair({ size = 18, color = "var(--p-accent)", opacity = 0.5 }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }} aria-hidden>
      <line x1={c} y1={0} x2={c} y2={size} stroke={color} strokeWidth={0.6} />
      <line x1={0} y1={c} x2={size} y2={c} stroke={color} strokeWidth={0.6} />
      <circle cx={c} cy={c} r={c * 0.42} fill="none" stroke={color} strokeWidth={0.6} />
    </svg>
  );
}

/** 刻度尺：橫向短線，當區塊之間的技術分隔 */
export function TickRuler({ count = 24, color = "var(--p-line)", height = 6 }) {
  return (
    <div className="flex items-end gap-[3px] w-full" aria-hidden style={{ height }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: i % 5 === 0 ? height : height * 0.5,
            background: color,
            opacity: i % 5 === 0 ? 0.9 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

/** 斜切標籤：// SECTION 這種技術標註 */
export function TechLabel({ children, color = "var(--p-mute)" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-mono tracking-[0.22em] uppercase select-none"
      style={{ color }}
    >
      <span style={{ width: 6, height: 1, background: color, opacity: 0.8 }} />
      {children}
    </span>
  );
}

/** 噪點 / 掃描線疊層：讓畫面有「材質」而不是純色 */
export function GrainOverlay({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        mixBlendMode: "overlay",
      }}
    />
  );
}

/** 斜線紋理：45° 細線，用在次要區塊 */
export function HatchOverlay({ opacity = 0.12, gap = 6 }: { opacity?: number; gap?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        opacity,
        backgroundImage: `repeating-linear-gradient(45deg, var(--p-line) 0 1px, transparent 1px ${gap}px)`,
      }}
    />
  );
}

/** 能量脈衝：賽爾號的「屬性」意象，但畫成幾何 */
export function EnergyPulse({ size = 120, color = "var(--p-accent)", opacity = 0.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ opacity }} aria-hidden>
      <g stroke={color} fill="none" strokeWidth={0.8}>
        <path d="M60 8 L104 34 L104 86 L60 112 L16 86 L16 34 Z" opacity={0.35} />
        <path d="M60 22 L92 40 L92 80 L60 98 L28 80 L28 40 Z" opacity={0.55} />
        <path d="M60 40 L76 49 L76 71 L60 80 L44 71 L44 49 Z" opacity={0.9} />
      </g>
      <circle cx={60} cy={60} r={5} fill={color} opacity={0.9} />
    </svg>
  );
}
