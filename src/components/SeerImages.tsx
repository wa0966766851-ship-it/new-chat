import { hiddenFromViewer } from "../battle/viewerPerspective";
import { useBattleViewMode } from "../battle/viewerMode";
import React, { useEffect, useState } from "react";
import type { Elf, Skill } from "../types";
import { skillDisplayType } from '../utils/skillPresentation';
import { appearanceElf } from "../battle/illusionPresentation";
import {selectedElfSkin} from '../data/elfSkins';
import { IMAGE_COPY_EVENT } from "./ImageCopyMenu";
import {readImageRetryMode,IMAGE_RETRY_EVENT,IMAGE_RETRY_SETTINGS_EVENT} from '../utils/imageRetrySettings';
import { shouldMirrorBattleSprite, hasRenderableElfImagePath, getSeerIndex, loadSeerIndex, onSeerIndexLoaded, petImageUrls, splitTypes, typeIconUrls, isNoneType } from "../battle/seerAssets";

/**
 * 已知失敗的網址（避免重複請求）。
 *
 * 2026-10-29 修正：原本這是模組層級的永久 Set —— 一旦某張圖在載入途中失敗
 * （例如 dev server 剛啟動、Vite 還在轉檔、或網路一瞬中斷），該網址就永遠
 * 不再重試，造成「精靈圖片經常無法顯示」，即使檔案其實存在。
 *
 * 改成「有時效的失敗紀錄」：同一網址失敗後 8 秒內不再重試，之後自動放行。
 * 自動模式在視窗重新聚焦或網路恢復時也可重試；手動與停用模式不自動清空。
 */
const failed = new Map<string, number>();
const FAIL_RETRY_MS = 8000;
function hasFailed(url: string): boolean {
  const at = failed.get(url);
  if (at === undefined) return false;
  if (readImageRetryMode() !== 'auto' || Date.now() - at < FAIL_RETRY_MS) return true;
  failed.delete(url);
  return false;
}
function markFailed(url: string): void { failed.set(url, Date.now()); }
if (typeof window !== "undefined") {
  const clear = () => { if(readImageRetryMode() !== 'auto') return; failed.clear(); window.dispatchEvent(new Event(IMAGE_RETRY_EVENT)); };
  window.addEventListener("focus", clear);
  window.addEventListener("online", clear);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) clear(); });
}

function useSeerIndexReady() {
  const [ready, setReady] = useState(!!getSeerIndex());
  useEffect(() => {
    if (ready) return;
    let alive=true,timer:ReturnType<typeof setTimeout>|undefined;
    const off = onSeerIndexLoaded(() => setReady(true));
    const attempt=()=>{clearTimeout(timer);loadSeerIndex().then(()=>{if(alive)setReady(true);}).catch(()=>{if(alive&&readImageRetryMode()==='auto')timer=setTimeout(attempt,FAIL_RETRY_MS);});};
    const retry=()=>{if(readImageRetryMode()==='auto')attempt();};
    attempt();window.addEventListener(IMAGE_RETRY_SETTINGS_EVENT,retry);window.addEventListener(IMAGE_RETRY_EVENT,retry);
    return ()=>{alive=false;clearTimeout(timer);off();window.removeEventListener(IMAGE_RETRY_SETTINGS_EVENT,retry);window.removeEventListener(IMAGE_RETRY_EVENT,retry);};
  }, [ready]);
  return ready;
}

/** 依序嘗試多個網址，全部失敗時顯示 fallback */
export function ChainImage({ urls, fallback, className, style, alt, sourceStyle }: {
  sourceStyle?: (src: string) => React.CSSProperties; urls: string[]; fallback?: React.ReactNode; className?: string; style?: React.CSSProperties; alt?: string;
}) {
  const [, refresh] = useState(0);
  const src = urls.find(u => !hasFailed(u));
  const identity = urls.join('\n');
  const mode = readImageRetryMode();
  const retryOwn = (event: React.MouseEvent) => {
    if(mode === 'off' || !urls.some(u => failed.has(u))) return;
    event.preventDefault(); event.stopPropagation(); urls.forEach(u => failed.delete(u)); refresh(n => n + 1);
  };
  useEffect(() => {
    // 即使目前已落到備用圖，也要主動喚醒；只讓 Map 過期不會讓 React 重畫。
    const retry = () => refresh(n => n + 1);
    window.addEventListener(IMAGE_RETRY_EVENT, retry);
    window.addEventListener(IMAGE_RETRY_SETTINGS_EVENT, retry);
    window.addEventListener('storage', retry);
    const blocked = urls.map(u => failed.get(u)).filter((n): n is number => n !== undefined);
    const timer = mode === 'auto' && blocked.length ? setTimeout(retry, Math.max(250, Math.min(...blocked) + FAIL_RETRY_MS - Date.now() + 50)) : undefined;
    return () => { window.removeEventListener(IMAGE_RETRY_EVENT, retry); window.removeEventListener(IMAGE_RETRY_SETTINGS_EVENT,retry);window.removeEventListener('storage',retry);clearTimeout(timer); };
  });
  if (!src) return <span style={{display:'contents',pointerEvents:mode !== 'off' && urls.length ? 'auto' : undefined,cursor:mode !== 'off' && urls.length ? 'pointer' : undefined}} onClickCapture={retryOwn} title={mode !== 'off' && urls.length ? '點圖片重試載入' : undefined}>{fallback ?? null}</span>;
  return (
    <img
      key={identity + src}
      src={src}
      data-elf-placeholder={src.includes('/unknown_myth_ghost_') ? 'true' : undefined}
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
      onError={() => { markFailed(src); refresh(n => n + 1); }}
      onLoad={() => { failed.delete(src); }}
      onClickCapture={retryOwn}
    />
  );
}

export function ElfAvatar({ elf, battleSide, kind = "head", className, fallbackClassName, style }: {
  elf: Elf; battleSide?: "p1" | "p2"; kind?: "head" | "body"; className?: string; fallbackClassName?: string; style?: React.CSSProperties;
}) {
  const ready = useSeerIndexReady();
  const concealed = hiddenFromViewer(elf, battleSide, useBattleViewMode());
  // 所有呼叫端一致使用幻化外觀，不能讓原本自訂path蓋過目標圖片。
  // 戰鬥身分與隱匿仍屬於原持有者；只替換圖片、朝向及素材呈現方式。
  elf = appearanceElf(elf);
  const own = elf.path && /^(\/|https?:|data:)/.test(elf.path) ? [elf.path] : [];
  const skin=selectedElfSkin(elf);
  const skinUrl=skin&&(kind==='body'?skin.body:skin.head||skin.body);
  const urls = [...(skinUrl?[skinUrl]:[]),...own,...(ready?petImageUrls(elf as any, kind):[])].filter((u,i,a)=>a.indexOf(u)===i);
  /*
    預設佔位圖（2026-10-22 使用者要求「調整預設圖片比例」）：
      無圖精靈（例：鎮世龍魂・龍之治癒，索引查不到 ID）會顯示單一漢字徽記。
      原本用固定 text-2xl（24px），在小格子裡溢出、在大格子裡太小。
      cqw 寫法又需要 container-type，呼叫端沒設所以無效（這是「龍之治癒比例異常」的根因）。
    改用 SVG viewBox：
      viewBox="0 0 100 100" 讓文字永遠按容器等比縮放，
      不需要 container query，任何尺寸的格子都填得剛剛好。
  */
  const badgeChar = concealed ? "?" : ((elf as any).badge || elf.soulMark?.badgeChar || (elf.name || "?").slice(-1));
  /*
    2026-10-22（使用者回報「龍之治癒的頭像讓整體變形」）：
      沒有頭像/立繪的精靈（索引查不到 ID，例：鎮世龍魂・龍之治癒）
      之前 head 模式落到「單一漢字徽記」，body 模式用 1184x1328 的縱向全身圖硬塞，
      兩者都讓格子比例失調。
    修法：
      head → 用從全身圖切出的正方形 unknown_myth_ghost_head.png（256x256）
      body → 維持原全身圖（body 場景本來就要全身）
  */
  const fb = (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className={fallbackClassName || "w-full h-full"}
      style={{ display: "block" }}
      role="img"
      aria-label={concealed ? "未知精靈" : (elf.name || "未知精靈")}
    >
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="52"
        fontWeight="900"
        fill="#e2e8f0"
        opacity="0.9"
      >
        {badgeChar}
      </text>
    </svg>
  );
  /*
    2026-10-22（使用者回報「龍之治癒的頭像讓整體變形」）：
      沒有頭像/立繪的精靈（索引查不到 ID，例：鎮世龍魂・龍之治癒）
      head 模式改用從全身圖切出的正方形 ghost 頭像，不再用漢字徽記。
  */
  const ghostHead = (
    <ChainImage
      urls={["/elf-art/unknown_myth_ghost_head.png"]}
      fallback={fb}
      alt={concealed ? "未知精靈" : (elf.name || "未知精靈")}
      className={className || "w-full h-full object-cover"}
      style={style}
    />
  );
  if (concealed) {
    // 身份隱藏期間只載入共用鬼影，不能使用真實立繪或頭像當備用圖。
    if (kind === "body") return (
      <ChainImage urls={["/elf-art/unknown_myth_ghost_body.png"]} fallback={fb} alt="未知精靈"
        className={className || "w-full h-full object-contain"} style={style} />
    );
    return ghostHead;
  }
  if (kind === "body") {
    // 沒有全身圖：使用共用未知精靈的完整立繪。
    const headFb = <ChainImage urls={["/elf-art/unknown_myth_ghost_body.png"]} fallback={fb} className={className || "w-full h-full object-contain"} style={style} alt={elf.name || "未知精靈"} />;
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
  if (!urls.length && !ready) return ghostHead;
  if (!urls.length) return ghostHead;
  return <ChainImage urls={urls} fallback={ghostHead} className={`${className || ""} ${isOtherworldRey ? "rounded-full" : ""}`} style={{ ...portraitMask, ...style }}
    sourceStyle={src => skinUrl&&src===skinUrl ? {objectFit:'cover',objectPosition:skin?.portrait?.position||'50% 50%',...(skin?.portrait?.scale?{transform:`scale(${skin.portrait.scale})`,transformOrigin:skin.portrait.origin||'50% 50%'}:{})} : src === "/elf-art/emperor_dixin_body.png" ? { objectPosition: "50% 4%", transform: "scale(2.5)", transformOrigin: "50% 8%" } : {}}
    alt={elf.name} />;
}

/** 技能圖標依技能分類投影；屬性技能不沿用舊資料中的攻擊系別。 */
export function SkillTypeIcon({skill,...props}:{skill:Pick<Skill,'type'|'category'>;size?:number;className?:string;showLabelWhenMissing?:boolean}) {
  return <TypeIcon {...props} type={skillDisplayType(skill)} />;
}
/** 精靈／系別圖標：官方組合 → 「系」資料夾 → 單屬性並排 → 文字。 */
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
