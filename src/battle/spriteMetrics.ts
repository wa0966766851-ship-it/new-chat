/**
 * 立繪比例：依精靈身高決定「實際可見部分」的高度，佔場地高度的比例。
 * 身高以公分計；以對數內插，避免小精靈過小、巨型精靈頂天。
 * 無效值（0、負數、哨兵值 ≥ 10000）使用中間值。
 */
const HEIGHT_RATIO: [number, number][] = [
  [30, 0.40], [60, 0.48], [100, 0.56], [150, 0.63], [200, 0.69], [300, 0.79], [400, 0.87], [500, 0.93], [800, 0.98],
];
export const DEFAULT_HEIGHT_RATIO = 0.66;

export function spriteHeightRatio(heightCm: number): number {
  if (!Number.isFinite(heightCm) || heightCm <= 0 || heightCm >= 10000) return DEFAULT_HEIGHT_RATIO;
  const pts = HEIGHT_RATIO;
  if (heightCm <= pts[0][0]) return pts[0][1];
  if (heightCm >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [h1, r1] = pts[i - 1], [h2, r2] = pts[i];
    if (heightCm <= h2) {
      const t = (Math.log(heightCm) - Math.log(h1)) / (Math.log(h2) - Math.log(h1));
      return r1 + (r2 - r1) * t;
    }
  }
  return DEFAULT_HEIGHT_RATIO;
}

/** 圖片中實際不透明區域（以原圖像素計）。 */
export interface OpaqueBox { w: number; h: number; left: number; top: number; right: number; bottom: number }

/** 由 RGBA 資料找出不透明區域（alpha > threshold）。sample 為取樣後的寬高，scale 為取樣倍率。 */
export function opaqueBoxFromPixels(data: Uint8ClampedArray, sw: number, sh: number, scale: number, natW: number, natH: number, threshold = 16): OpaqueBox {
  let minX = sw, minY = sh, maxX = -1, maxY = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (data[(y * sw + x) * 4 + 3] > threshold) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return { w: natW, h: natH, left: 0, top: 0, right: natW, bottom: natH };
  const left = Math.max(0, Math.floor(minX / scale)), top = Math.max(0, Math.floor(minY / scale));
  const right = Math.min(natW, Math.ceil((maxX + 1) / scale)), bottom = Math.min(natH, Math.ceil((maxY + 1) / scale));
  return { w: natW, h: natH, left, top, right, bottom };
}

/**
 * 計算擺放：可見部分高度＝場地高 × 比例；寬度超過上限時等比縮小；腳底（可見部分底緣）貼地、可見部分水平置中。
 * 回傳 wrapper（整張圖）的尺寸與相對錨點的位移。
 */
export function placeSprite(box: OpaqueBox, stageW: number, stageH: number, ratio: number, maxWidthFrac = 1, mirrored = false) {
  const visH = Math.max(1, box.bottom - box.top), visW = Math.max(1, box.right - box.left);
  let s = (stageH * ratio) / visH;
  if (visW * s > stageW * maxWidthFrac) s = (stageW * maxWidthFrac) / visW;
  const cx = mirrored ? box.w - (box.left + box.right) / 2 : (box.left + box.right) / 2;
  return { width: box.w * s, height: box.h * s, offsetX: -cx * s, offsetBottom: -(box.h - box.bottom) * s, visibleTop: (box.h - box.top) * s - (box.h - box.bottom) * s, scale: s };
}
