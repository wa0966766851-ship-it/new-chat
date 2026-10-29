import React from "react";
import { haptic } from "../haptics";

/**
 * 立繪比例設定（使用者要求 2026-10-22：「角色比例也改成可以調整」）
 *
 * 存 localStorage，重新整理後保留。
 * 三個參數：
 *   scale  1.0 ~ 1.8   角色大小
 *   offsetY -30 ~ +30  上下位置（%），負值往上
 *   fit    contain / cover  滿版或完整
 */
export interface HeroLayout { scale: number; offsetX?: number; offsetY: number; fit: "contain" | "cover"; }

const HERO_LAYOUT_KEY = "seer_aegis_hero_layout";
const DEFAULT_LAYOUT: HeroLayout = { scale: 1, offsetX: 0, offsetY: 0, fit: "contain" };

export function readHeroLayout(): HeroLayout {
  try {
    const raw = localStorage.getItem(HERO_LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const p = JSON.parse(raw);
    return {
      scale: clamp(Number(p.scale) || 1, 0.8, 2),
      offsetX: clamp(Number(p.offsetX) || 0, -80, 80),
      offsetY: clamp(Number(p.offsetY) || 0, -80, 80),
      fit: p.fit === "cover" ? "cover" : "contain",
    };
  } catch { return DEFAULT_LAYOUT; }
}

export function writeHeroLayout(l: HeroLayout): void {
  try { localStorage.setItem(HERO_LAYOUT_KEY, JSON.stringify(l)); } catch { /* 無痕 */ }
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

/** 把 layout 轉成 img 的 style */
export function heroImageStyle(l: HeroLayout): React.CSSProperties {
  return {
    objectFit: l.fit,
    objectPosition: "center",
    transform: `translate(${l.offsetX ?? 0}%, ${l.offsetY}%) scale(${l.scale})`,
    transformOrigin: "center",
    filter: "drop-shadow(0 14px 34px rgba(0,0,0,0.7))",
    transition: "transform 160ms ease-out, object-position 160ms ease-out",
  };
}

/**
 * 比例調整面板
 *
 * 為什麼用滑桿而不是 +/- 按鈕：
 *   比例是連續值，按鈕要點很多次；滑桿一次到位。
 * 為什麼即時套用而不是「套用」按鈕：
 *   使用者要「看著調」，即時反饋才知道好不好看。
 */
export function HeroLayoutPanel({
  value, onChange, onClose,
}: {
  value: HeroLayout;
  onChange: (l: HeroLayout) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<HeroLayout>) => {
    const next = { ...value, ...patch };
    onChange(next);
    writeHeroLayout(next);
  };



  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" data-shell-drawer aria-label="立繪位置與大小">
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        className="relative p-3.5 flex flex-col gap-3"
        style={{
          background: "linear-gradient(180deg, #0B1620, #060D14)",
          borderTop: "1px solid var(--p-accent)",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black flex-1" style={{ color: "#F8FAFC" }}>立繪位置與大小</span>
          <button
            type="button"
            onClick={() => { haptic("light"); set(DEFAULT_LAYOUT); }}
            className="px-2 py-1 text-[9.5px] font-bold"
            style={{ borderRadius: 6, background: "rgba(255,255,255,0.08)", color: "#CBD5E1" }}
          >
            重設
          </button>
          <button type="button" onClick={onClose} className="p-1.5" style={{ borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
            <span className="text-[11px] font-bold" style={{ color: "#CBD5E1" }}>完成</span>
          </button>
        </div>

        <Row label="大小" hint={`${value.scale.toFixed(2)}×`}>
          <input
            type="range" min={0.8} max={2} step={0.02} value={value.scale}
            onChange={e => set({ scale: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </Row>

        <Row label="左右位置" hint={`${Math.round(value.offsetX ?? 0)}%`}>
          <input aria-label="左右位置" type="range" min={-80} max={80} step={1} value={value.offsetX ?? 0}
            onChange={e => set({ offsetX: Number(e.target.value) })} className="w-full accent-cyan-400" />
        </Row>

        <Row label="上下位置" hint={value.offsetY === 0 ? "置中" : `${value.offsetY > 0 ? "下" : "上"}移 ${Math.round(Math.abs(value.offsetY))}%`}>
          <input
            aria-label="上下位置" type="range" min={-80} max={80} step={1} value={value.offsetY}
            onChange={e => set({ offsetY: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </Row>

        <Row label="填滿方式">
          <div className="flex gap-1.5">
            {(["contain", "cover"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => set({ fit: f })}
                className="flex-1 py-1.5 text-[10px] font-bold active:scale-95 transition-transform"
                style={{
                  borderRadius: 7,
                  background: value.fit === f ? "var(--p-accent)" : "rgba(255,255,255,0.06)",
                  color: value.fit === f ? "#04121B" : "rgba(203,213,225,0.75)",
                }}
              >
                {f === "contain" ? "完整顯示" : "填滿裁切"}
              </button>
            ))}
          </div>
        </Row>
      </div>
    </div>
  );
}

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold" style={{ color: "#E2E8F0" }}>{label}</span>
        {hint && <span className="text-[8.5px] font-mono" style={{ color: "rgba(148,163,184,0.75)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
