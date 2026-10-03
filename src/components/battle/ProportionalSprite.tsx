import React from "react";
import { motion } from "motion/react";
import type { Elf } from "../../types";
import { ElfAvatar } from "../SeerImages";
import { opaqueBoxFromPixels, placeSprite, spriteHeightRatio, type OpaqueBox } from "../../battle/spriteMetrics";

const boxCache = new Map<string, OpaqueBox>();

function measure(img: HTMLImageElement): OpaqueBox {
  const src = img.currentSrc || img.src;
  const hit = boxCache.get(src);
  if (hit) return hit;
  const natW = img.naturalWidth, natH = img.naturalHeight;
  let box: OpaqueBox = { w: natW, h: natH, left: 0, top: 0, right: natW, bottom: natH };
  try {
    const scale = Math.min(1, 256 / Math.max(natW, natH));
    const sw = Math.max(1, Math.round(natW * scale)), sh = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sw; canvas.height = sh;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (g) {
      g.drawImage(img, 0, 0, sw, sh);
      box = opaqueBoxFromPixels(g.getImageData(0, 0, sw, sh).data, sw, sh, sw / natW, natW, natH);
    }
  } catch { /* 跨來源圖片無法讀像素：以整張圖計 */ }
  boxCache.set(src, box);
  return box;
}

/**
 * 依身高比例擺放的戰鬥立繪：量測圖片實際不透明區域，讓可見部分高度＝場地高 × 身高比例，腳底貼地、水平置中於錨點。
 * overlay 取得可見高度（px），用來把受擊數字、技能名放在立繪上方。
 */
interface ProportionalSpriteProps {
  elf: Elf; side: "p1" | "p2"; anchorX: number; stageW: number; stageH: number;
  anim: any; dead: boolean; opacity: number;
  overlay: (visibleHeight: number) => React.ReactNode;
}
export const ProportionalSprite: React.FC<ProportionalSpriteProps> = ({ elf, side, anchorX, stageW, stageH, anim, dead, opacity, overlay }) => {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [m, setM] = React.useState<{ src: string; box: OpaqueBox; mirrored: boolean } | null>(null);
  const [fallback, setFallback] = React.useState(false);

  // 量測：圖片載入後量一次；圖片來源改變（備援鏈切換）時才重量。不輪詢，避免戰鬥中持續耗用。
  React.useEffect(() => {
    let alive = true;
    const root = wrap.current; if (!root) return;
    const check = () => {
      if (!alive) return;
      const img = root.querySelector("img");
      if (!img) return;
      const done = () => {
        if (!alive || !img.naturalWidth) return;
        const src = img.currentSrc || img.src;
        const mirrored = /scaleX\(-1\)/.test(img.style.transform || "");
        setFallback(false);
        setM(prev => prev && prev.src === src && prev.mirrored === mirrored ? prev : { src, box: measure(img), mirrored });
      };
      if (img.complete) done(); else img.addEventListener("load", done, { once: true });
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
    const t = setTimeout(() => { if (alive && !root.querySelector("img")) setFallback(true); }, 1200);
    return () => { alive = false; mo.disconnect(); clearTimeout(t); };
  }, [elf.battleId, elf.id]);

  const ratio = spriteHeightRatio(Number(elf.height));
  const place = m && stageH > 0 ? placeSprite(m.box, stageW, stageH, ratio, 1, m.mirrored) : null;
  const fbSize = Math.min(stageW, stageH * 0.45);
  const style: React.CSSProperties = place
    ? { position: "absolute", left: place.offsetX, bottom: place.offsetBottom, width: place.width, height: place.height }
    : { position: "absolute", left: -fbSize / 2, bottom: 0, width: fbSize, height: fbSize, opacity: fallback ? 1 : 0 };
  const visible = place ? (m!.box.bottom - m!.box.top) * place.scale : fbSize;

  return (
    <div className="absolute bottom-0 pointer-events-none" style={{ left: anchorX, opacity, display: opacity === 0 ? "none" : undefined }} data-sprite-side={side} data-sprite-ratio={ratio.toFixed(2)}>
      <motion.div ref={wrap} animate={anim} transition={{ duration: 0.35 }} style={style}
        className={`${dead ? "opacity-30 grayscale" : ""} will-change-transform`}>
        <ElfAvatar elf={elf} kind="body" battleSide={side} className="w-full h-full object-fill"
          fallbackClassName="w-full h-full rounded-full overflow-hidden ring-2 ring-white/15 flex items-center justify-center text-5xl font-black text-slate-200 bg-black/20" />
      </motion.div>
      <div className="absolute left-1/2 -translate-x-1/2 w-40 h-4 rounded-[50%] bg-black/35 blur-md -z-10" style={{ bottom: -6 }} />
      {overlay(visible)}
    </div>
  );
};
