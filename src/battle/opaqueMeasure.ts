import { opaqueBoxFromPixels, type OpaqueBox } from "./spriteMetrics";

/** 量測已載入圖片的不透明區域（以原圖像素計）；戰鬥立繪與新版首頁動態立繪共用，確保兩者對同一張圖得到同一個可見框。 */
const boxCache = new Map<string, OpaqueBox>();

export function measureOpaqueBox(img: HTMLImageElement): OpaqueBox {
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
