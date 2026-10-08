import { hiddenFromViewer } from "../battle/viewerPerspective";
import React, { useEffect, useState } from "react";
import type { Elf } from "../types";
import { appearanceElf } from "../battle/illusion";
import { IMAGE_COPY_EVENT } from "./ImageCopyMenu";
import { shouldMirrorBattleSprite, hasRenderableElfImagePath, getSeerIndex, loadSeerIndex, onSeerIndexLoaded, petImageUrls, splitTypes, typeIconUrls, isNoneType } from "../battle/seerAssets";

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
export function ChainImage({ urls, fallback, className, style, alt, sourceStyle }: {
  sourceStyle?: (src: string) => React.CSSProperties; urls: string[]; fallback?: React.ReactNode; className?: string; style?: React.CSSProperties; alt?: string;
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
      style={{ ...style, ...sourceStyle?.(src) }}
      onContextMenu={event => {
        event.preventDefault(); event.stopPropagation();
        window.dispatchEvent(new CustomEvent(IMAGE_COPY_EVENT, { detail: {
          src: event.currentTarget.src, name: alt || "圖片", x: event.clientX, y: event.clientY,
        } }));
      }}
      onError={() => { failed.add(src); refresh(n => n + 1); }}
    />
  );
}

export function ElfAvatar({ elf, battleSide, kind = "head", className, fallbackClassName, style }: {
  elf: Elf; battleSide?: "p1" | "p2"; kind?: "head" | "body"; className?: string; fallbackClassName?: string; style?: React.CSSProperties;
}) {
  const ready = useSeerIndexReady();
  const concealed = hiddenFromViewer(elf, battleSide);
  // 所有呼叫端一致使用幻化外觀，不能讓原本自訂path蓋過目標圖片。
  // 戰鬥身分與隱匿仍屬於原持有者；只替換圖片、朝向及素材呈現方式。
  elf = appearanceElf(elf);
  const own = elf.path && /^(\/|https?:|data:)/.test(elf.path) ? [elf.path] : [];
  const urls = ready ? [...own, ...petImageUrls(elf as any, kind)] : own;
  const fb = (
    <div className={fallbackClassName || "w-full h-full flex items-center justify-center text-2xl font-black text-slate-200"}>
      {concealed ? "?" : ((elf as any).badge || elf.soulMark?.badgeChar || (elf.name || "?").slice(-1))}
    </div>
  );
  if (concealed) {
    // 身份隱藏期間只載入共用鬼影，不能使用真實立繪或頭像當備用圖。
    if (kind === "body") return (
      <ChainImage urls={["/elf-art/unknown_myth_ghost_body.png"]} fallback={fb} alt="未知精靈"
        className={className || "w-full h-full object-contain"} style={style} />
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
    return <ChainImage urls={urls} fallback={headFb} className={className} style={{ ...sceneMask, ...style }} sourceStyle={battleSide ? src => ({ transform: shouldMirrorBattleSprite(elf.name, battleSide, hasRenderableElfImagePath(elf.path) && src === elf.path, src) ? "scaleX(-1)" : undefined }) : undefined} alt={elf.name} />;
  }
  const isOtherworldRey = elf.name === "異境神霆·雷伊";
  const portraitMask = isOtherworldRey ? {
    WebkitMaskImage: "radial-gradient(circle at 50% 48%, #000 82%, transparent 100%)",
    maskImage: "radial-gradient(circle at 50% 48%, #000 82%, transparent 100%)",
    objectPosition: "50% 44%",
  } as React.CSSProperties : undefined;
  return <ChainImage urls={urls} fallback={fb} className={`${className || ""} ${isOtherworldRey ? "rounded-full" : ""}`} style={{ ...portraitMask, ...style }}
    sourceStyle={src => src === "/elf-art/emperor_dixin_body.png" ? { objectPosition: "50% 4%", transform: "scale(2.5)", transformOrigin: "50% 8%" } : {}}
    alt={elf.name} />;
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
