import { opaqueBoxFromPixels, type OpaqueBox } from "./spriteMetrics";

/** 量測已載入圖片的不透明區域（以原圖像素計）；戰鬥立繪與新版首頁動態立繪共用，確保兩者對同一張圖得到同一個可見框。 */
const boxCache = new Map<string, OpaqueBox>();

export interface OpaqueMeasure { box: OpaqueBox; /** false＝量不到像素（尚未解碼／跨來源／無 canvas），box 只是整張圖的備援，且不會被快取。 */ measured: boolean }

export function measureOpaqueBoxResult(img: HTMLImageElement): OpaqueMeasure {
  const src = img.currentSrc || img.src;
  const hit = boxCache.get(src);
  if (hit) return { box: hit, measured: true };
  const natW = img.naturalWidth, natH = img.naturalHeight;
  let box: OpaqueBox = { w: natW, h: natH, left: 0, top: 0, right: natW, bottom: natH };
  let measured = false;
  try {
    const scale = Math.min(1, 256 / Math.max(natW, natH));
    const sw = Math.max(1, Math.round(natW * scale)), sh = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sw; canvas.height = sh;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (g && natW > 0 && natH > 0) {
      g.drawImage(img, 0, 0, sw, sh);
      box = opaqueBoxFromPixels(g.getImageData(0, 0, sw, sh).data, sw, sh, sw / natW, natW, natH);
      measured = true;
    }
  } catch { /* 跨來源圖片無法讀像素：以整張圖計，但不快取，下次仍會重試 */ }
  // 失敗（整張圖備援）不可快取：否則一次暫時性失敗會讓同一網址永遠使用錯誤的可見框。
  if (measured) boxCache.set(src, box);
  return { box, measured };
}

export function measureOpaqueBox(img: HTMLImageElement): OpaqueBox {
  return measureOpaqueBoxResult(img).box;
}
