import React from "react";

/**
 * 手遊 UI 元件 — 不是「模擬器面板」，是「遊戲介面」
 *
 * 差別在哪：
 *   模擬器 → 標籤、參數、表格、灰底細框。
 *   手遊   → 大圓角、飽和色塊、發光、徽章、資源條、斜切、角色為主體。
 *
 * 這裡的元件全部以「玩家一眼掃過就知道是什麼」為目標，
 * 不用讀小字、不用找按鈕。
 */

/** 資源膠囊：體力 / 鑽石 / 金幣 */
export function ResourcePill({
  icon, value, max, tone = "var(--p-accent)", plus,
}: {
  icon: React.ReactNode;
  value: number | string;
  max?: number;
  tone?: string;
  plus?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 pl-1 pr-2 py-1"
      style={{
        // 2026-10-22：去掉膠囊底框（使用者要求「不要大框裝小按鈕」）
        textShadow: "0 1px 4px rgba(0,0,0,0.9)",
      }}
    >
      <span className="flex items-center justify-center shrink-0" style={{ color: tone }}>
        {icon}
      </span>
      <span className="text-[10.5px] font-bold font-mono tabular-nums leading-none" style={{ color: "#F1F5F9" }}>
        {value}
        {max !== undefined && <span className="opacity-50">/{max}</span>}
      </span>
      {plus && (
        <span
          className="flex items-center justify-center shrink-0 text-[11px] font-black leading-none"
          style={{ width: 13, height: 13, borderRadius: 999, background: tone, color: "#03121B" }}
        >
          +
        </span>
      )}
    </div>
  );
}

/** 玩家頭像 + 等級 + 經驗條 */
export function PlayerBadge({
  avatar, name, level, expPercent,
}: {
  avatar: React.ReactNode;
  name: string;
  level: number;
  expPercent?: number;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative shrink-0" style={{ width: 42, height: 42 }}>
        <div
          className="w-full h-full overflow-hidden"
          style={{
            borderRadius: 999,
            boxShadow: "0 0 0 2px rgba(56,189,248,0.55), 0 0 18px rgba(56,189,248,0.35)",
            background: "#0B141C",
          }}
        >
          {avatar}
        </div>
        {/* 2026-10-22：去掉 Lv 膠囊底（使用者要求「不要框」） */}
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black leading-none whitespace-nowrap"
          style={{
            color: "#7DD3FC",
            textShadow: "0 1px 4px rgba(0,0,0,0.95)",
          }}
        >
          Lv.{level}
        </span>
      </div>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="text-[12px] font-bold truncate leading-none" style={{ color: "#F8FAFC", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
          {name}
        </span>
        {expPercent !== undefined && <div className="h-[5px] w-full overflow-hidden" style={{ borderRadius: 999, background: "rgba(255,255,255,0.14)" }}>
          <div
            style={{
              width: `${Math.max(2, Math.min(100, expPercent ?? 0))}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg,#38BDF8,#A5F3FC)",
              boxShadow: "0 0 8px rgba(56,189,248,0.8)",
            }}
          />
        </div>}
      </div>
    </div>
  );
}

/** 徽章（紅點 / 數字） */
export function Badge({ count, tone = "#F43F5E" }: { count?: number; tone?: string }) {
  if (!count) return null;
  return (
    <span
      className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[8px] font-black leading-none"
      style={{
        minWidth: 15, height: 15, paddingInline: 3, borderRadius: 999,
        background: tone, color: "#fff",
        boxShadow: "0 0 0 1.5px rgba(4,10,16,0.95), 0 0 10px " + tone,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** 大型副本入口卡：整塊都是視覺，不是按鈕列表 */
export function OperationCard({
  title, subtitle, tag, art, tone, onClick, wide,
}: {
  title: string;
  subtitle: string;
  tag?: string;
  art?: React.ReactNode;
  tone: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden text-left active:scale-[0.97] transition-transform ${wide ? "col-span-2" : ""}`}
      style={{
        minHeight: wide ? 96 : 104,
        borderRadius: 16,
        background: `linear-gradient(150deg, color-mix(in srgb, ${tone} 34%, #071019) 0%, #06101A 72%)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 55%, transparent), 0 8px 24px -14px ${tone}`,
        transitionDuration: "160ms",
      }}
    >
      {/* 斜紋質感 */}
      <span aria-hidden className="absolute inset-0" style={{
        backgroundImage: "repeating-linear-gradient(120deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 9px)",
      }} />
      {/* 角落光 */}
      <span aria-hidden className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ background: tone, opacity: 0.18, filter: "blur(14px)" }} />

      {/* 角色／圖示 */}
      {art && <div className="absolute right-0 bottom-0 w-[52%] h-full pointer-events-none">{art}</div>}

      <div className="relative p-3 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between gap-1">
          <span className="text-[13.5px] font-black leading-tight" style={{ color: "#F8FAFC", textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>
            {title}
          </span>
          {tag && (
            <span
              className="shrink-0 px-1.5 py-0.5 text-[7.5px] font-black leading-none"
              style={{ borderRadius: 4, background: tone, color: "#03121B" }}
            >
              {tag}
            </span>
          )}
        </div>
        <span className="text-[9.5px] leading-tight max-w-[60%]" style={{ color: "color-mix(in srgb, #CBD5E1 82%, transparent)" }}>
          {subtitle}
        </span>
      </div>
    </button>
  );
}

/** 活動橫幅（可滑動） */
export function Banner({ title, subtitle, tone, badge, onClick }: {
  title: string; subtitle: string; tone: string; badge?: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full overflow-hidden text-left active:scale-[0.99] transition-transform shrink-0"
      style={{
        height: 78,
        borderRadius: 14,
        background: `linear-gradient(105deg, color-mix(in srgb, ${tone} 42%, #06101A) 0%, #050C14 68%)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 40%, transparent)`,
      }}
    >
      <span aria-hidden className="absolute right-0 top-0 h-full w-1/2" style={{
        background: `radial-gradient(ellipse at 80% 50%, color-mix(in srgb, ${tone} 55%, transparent), transparent 70%)`,
      }} />
      <div className="relative h-full flex flex-col justify-center gap-1 px-3.5">
        {badge && (
          <span className="self-start px-1.5 py-0.5 text-[7.5px] font-black leading-none"
            style={{ borderRadius: 3, background: tone, color: "#03121B" }}>
            {badge}
          </span>
        )}
        <span className="text-[13px] font-black leading-tight" style={{ color: "#F8FAFC" }}>{title}</span>
        <span className="text-[9.5px] leading-tight" style={{ color: "rgba(203,213,225,0.8)" }}>{subtitle}</span>
      </div>
    </button>
  );
}

/** 主行動大按鈕：手遊的「出擊」就該這麼大 */
export function PrimaryAction({
  label, sub, icon, tone, onClick, disabled,
}: {
  label: string; sub?: string; icon: React.ReactNode; tone: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative w-full active:scale-[0.975] transition-transform disabled:opacity-40 overflow-hidden"
      style={{
        height: 74,
        borderRadius: 18,
        background: `linear-gradient(120deg, color-mix(in srgb, ${tone} 62%, #04121C) 0%, ${tone} 58%, color-mix(in srgb, ${tone} 78%, #FFFFFF) 100%)`,
        boxShadow: `0 12px 34px -14px ${tone}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        transitionDuration: "150ms",
      }}
    >
      <span aria-hidden className="absolute inset-0" style={{
        backgroundImage: "repeating-linear-gradient(118deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 13px)",
        opacity: 0.55,
      }} />
      <span aria-hidden className="absolute inset-0" style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.28), transparent 42%)",
      }} />
      <span className="relative flex items-center justify-center gap-2.5" style={{ color: "#04121C" }}>
        {icon}
        <span className="text-[21px] font-black tracking-[0.08em]">{label}</span>
      </span>
      {sub && (
        <span className="absolute right-3.5 bottom-1.5 text-[8.5px] font-mono font-bold" style={{ color: "rgba(4,18,28,0.6)" }}>
          {sub}
        </span>
      )}
    </button>
  );
}

/** 進度條：圖鑑收集率這種 */
export function ProgressBar({ value, max, tone = "var(--p-accent)", label }: {
  value: number; max: number; tone?: string; label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <div className="flex justify-between text-[8.5px] font-mono" style={{ color: "var(--p-mute)" }}>
          <span>{label}</span>
          <span>{value}/{max}</span>
        </div>
      )}
      <div className="h-[6px] w-full overflow-hidden" style={{ borderRadius: 999, background: "rgba(255,255,255,0.12)" }}>
        <div style={{
          width: `${Math.max(1, pct)}%`, height: "100%", borderRadius: 999,
          background: `linear-gradient(90deg, color-mix(in srgb, ${tone} 70%, #000), ${tone})`,
          boxShadow: `0 0 10px ${tone}`,
        }} />
      </div>
    </div>
  );
}
