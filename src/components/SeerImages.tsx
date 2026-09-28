import React, { useEffect, useState } from "react";
import type { Elf } from "../types";
import { getSeerIndex, loadSeerIndex, onSeerIndexLoaded, petImageUrls, splitTypes, typeIconUrls, isNoneType } from "../battle/seerAssets";

// 已知失敗的網址（避免重複請求）
const failed = new Set<string>();

function useSeerIndexReady() {
  const [ready, setReady] = useState(!!getSeerIndex());
  useEffect(() => {
    if (ready) return;
    const off = onSeerIndexLoaded(() => setReady(true));
    loadSeerIndex().then(() => setReady(true)).catch(() => {});
    return off;
  }, [ready]);
  return ready;
}

/** 依序嘗試多個網址，全部失敗時顯示 fallback */
export function ChainImage({ urls, fallback, className, style, alt }: {
  urls: string[]; fallback?: React.ReactNode; className?: string; style?: React.CSSProperties; alt?: string;
}) {
  const [, refresh] = useState(0);
  const src = urls.find(u => !failed.has(u));
  if (!src) return <>{fallback ?? null}</>;
  return (
    <img
      src={src}
      alt={alt || ""}
      draggable={false}
      className={className}
      style={style}
      onError={() => { failed.add(src); refresh(n => n + 1); }}
    />
  );
}

export function ElfAvatar({ elf, kind = "head", className, fallbackClassName, style }: {
  elf: Elf; kind?: "head" | "body"; className?: string; fallbackClassName?: string; style?: React.CSSProperties;
}) {
  const ready = useSeerIndexReady();
  const concealed = !!elf.isConcealed;
  const own = elf.path && /^(\/|https?:|data:)/.test(elf.path) ? [elf.path] : [];
  const urls = ready ? [...own, ...petImageUrls(elf as any, kind)] : own;
  const fb = (
    <div className={fallbackClassName || "w-full h-full flex items-center justify-center text-2xl font-black text-slate-200"}>
      {concealed ? "?" : ((elf as any).badge || elf.soulMark?.badgeChar || (elf.name || "?").slice(-1))}
    </div>
  );
  if (concealed) {
    // 未知精靈：不顯示任何真實圖像
    if (kind === "body") return (
      <div className="w-40 h-40 rounded-full border-2 border-slate-500/60 bg-slate-900/70 flex items-center justify-center text-7xl font-black text-slate-300 shadow-[0_0_40px_rgba(148,163,184,0.25)]" title="未知精靈">?</div>
    );
    return fb;
  }
  if (kind === "body") {
    // 沒有全身圖：顯示圓形裁切的頭像（透明外框，不遮背景）
    const headFb = (
      <div className={fallbackClassName || "w-40 h-40 rounded-full overflow-hidden"}>
        <ChainImage urls={ready ? petImageUrls(elf as any, "head") : []} fallback={fb} className="w-full h-full object-cover rounded-full" alt={elf.name} />
      </div>
    );
    const sceneMask = elf.artPresentation === "scene" ? {
      WebkitMaskImage: "radial-gradient(ellipse 88% 92% at 50% 50%, #000 62%, rgba(0,0,0,.92) 76%, transparent 100%)",
      maskImage: "radial-gradient(ellipse 88% 92% at 50% 50%, #000 62%, rgba(0,0,0,.92) 76%, transparent 100%)",
    } as React.CSSProperties : undefined;
    return <ChainImage urls={urls} fallback={headFb} className={className} style={{ ...sceneMask, ...style }} alt={elf.name} />;
  }
  return <ChainImage urls={urls} fallback={fb} className={className} style={style} alt={elf.name} />;
}

/** 屬性圖標：官方組合 → 「系」資料夾 → 雙屬性並排單屬性圖標 → 文字 */
export function TypeIcon({ type, size = 22, className, showLabelWhenMissing = true }: {
  type: string; size?: number; className?: string; showLabelWhenMissing?: boolean;
}) {
  const ready = useSeerIndexReady();
  const parts = splitTypes(type);
  const label = parts.length ? parts.join("") + "系" : (type === "--" ? "無屬性" : type || "無屬性");
  const textFb = showLabelWhenMissing ? <span className="text-[10px] font-bold text-slate-300 px-1">{label}</span> : null;
  if (isNoneType(type)) {
    return <ChainImage urls={typeIconUrls(type)} fallback={textFb} className={className} style={{ height: size, width: "auto" }} alt="無屬性" />;
  }
  if (!ready || !parts.length) return <span className={className} title={label}>{textFb}</span>;
  const imgStyle = { height: size, width: "auto" } as React.CSSProperties;
  const sideBySide = parts.length > 1 ? (
    <span className="inline-flex items-center gap-0.5">
      {parts.map(p => (
        <React.Fragment key={p}><ChainImage urls={typeIconUrls(p)} style={{ height: Math.round(size * 0.85), width: "auto" }} fallback={<span className="text-[10px] font-bold text-slate-300">{p}</span>} /></React.Fragment>
      ))}
    </span>
  ) : textFb;
  return (
    <span className={`inline-flex items-center ${className || ""}`} title={label}>
      <ChainImage urls={typeIconUrls(type)} style={imgStyle} fallback={sideBySide} alt={label} />
    </span>
  );
}
