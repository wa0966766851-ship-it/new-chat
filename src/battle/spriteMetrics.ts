/**
 * 立繪比例（單一來源）：依精靈體型決定「等效直徑」佔場地高度的比例（見 fitScale：可見面積加權，偏重高度）。
 * 以體型的對數線性內插，範圍 [MIN_SIZE_RATIO, MAX_SIZE_RATIO]；不再以硬封頂讓大型精靈全部相同。
 * 純體型曲線與戰鬥視覺校正分開：戰鬥使用 battleSpriteSizeRatio，首頁不套用戰鬥參考倍率。
 * 無效值（0、負數、哨兵值 ≥ 10000）使用中間值。
 */
export const MIN_SIZE_RATIO = 0.60;
export const MAX_SIZE_RATIO = 1.05;
export const SIZE_RATIO_FROM = 30;
export const SIZE_RATIO_TO = 1200;
export const DEFAULT_HEIGHT_RATIO = 0.80;
/** 1599×900 官方冰魄柯爾德參照：一般本體約480px；舊版約392px，補足約24%。不套用巨型。 */
export const BATTLE_SIZE_BOOST = 1.24;
export const BATTLE_GROUND_LIFT = 0.04;
export function battleSpriteSizeRatio(heightCm:number) { return spriteHeightRatio(heightCm) * BATTLE_SIZE_BOOST; }

export function spriteHeightRatio(heightCm: number): number {
  if (!Number.isFinite(heightCm) || heightCm <= 0 || heightCm >= 10000) return DEFAULT_HEIGHT_RATIO;
  const h = Math.min(SIZE_RATIO_TO, Math.max(SIZE_RATIO_FROM, heightCm));
  const t = Math.log(h / SIZE_RATIO_FROM) / Math.log(SIZE_RATIO_TO / SIZE_RATIO_FROM);
  return MIN_SIZE_RATIO + (MAX_SIZE_RATIO - MIN_SIZE_RATIO) * t;
}
/** 與 spriteHeightRatio 同義：語意上是等效直徑比例。 */
export const spriteSizeRatio = spriteHeightRatio;

/** 場地寬度對應的錨點與單側可用寬度比例；窄螢幕（手機）改用較寬的舞台。 */
export function spriteStageLayout(fieldWidth: number) {
  const narrow = fieldWidth < 640;
  return { anchorFrac: narrow ? 0.25 : 0.22, widthFrac: narrow ? 0.46 : 0.40 };
}

/** 單側可見框（任意同一座標系，px）。 */
export interface VisibleBox { left: number; right: number; top: number; bottom: number }

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
export function placeSprite(box: OpaqueBox, stageW: number, stageH: number, ratio: number, maxWidthFrac = 1, mirrored = false, sizing: 'height' | 'area' | 'colossal' = 'height') {
  const visH = Math.max(1, box.bottom - box.top), visW = Math.max(1, box.right - box.left);
  let s: number;
  if (sizing === 'area') s = fitScale(box, stageW, stageH, ratio, MAX_HEIGHT_FRAC, maxWidthFrac);
  else {
    s = (stageH * ratio) / visH;
    const widthLimit=stageW*maxWidthFrac*(sizing==='colossal'?3:1);
    if (visW * s > widthLimit) s = widthLimit / visW;
  }
  const cx = mirrored ? box.w - (box.left + box.right) / 2 : (box.left + box.right) / 2;
  return { width: box.w * s, height: box.h * s, offsetX: -cx * s, offsetBottom: -(box.h - box.bottom) * s, visibleTop: (box.h - box.top) * s - (box.h - box.bottom) * s, scale: s };
}

export const MAX_HEIGHT_FRAC = 0.98;
/**
 * 以可見面積定尺寸：等效直徑 = 場地高 × ratio；再以高、寬雙上限做「有序壓縮」。
 * 做法：u＝目前尺寸占該圖可容納上限的比例（與 ratio 成正比）。u 超過 knee 後，把 [knee, 最大體型的 u] 線性壓進 [knee, 1]：
 * 最大體型剛好貼上限、其下嚴格遞增（不是硬夾，也不會漸近飽和），大型精靈之間仍有可辨大小差。
 */
export const AREA_HEIGHT_WEIGHT = 0.65;
/** 等效直徑：可見高、寬的加權幾何平均（高度權重 0.65）。純面積(0.5)會讓寬扁／瘦高圖頂線差太多；偏重高度使同體型精靈頂線較近。 */
export function equivalentDiameter(visW: number, visH: number): number {
  return Math.pow(Math.max(1, visH), AREA_HEIGHT_WEIGHT) * Math.pow(Math.max(1, visW), 1 - AREA_HEIGHT_WEIGHT);
}
export function fitScale(box: OpaqueBox, stageW: number, stageH: number, ratio: number, maxHeightFrac = MAX_HEIGHT_FRAC, maxWidthFrac = 1, knee = 0.75): number {
  const visH = Math.max(1, box.bottom - box.top), visW = Math.max(1, box.right - box.left);
  const d = equivalentDiameter(visW, visH);
  const s0 = (stageH * ratio) / d;
  const perRatio = (stageH * Math.max(visH / (stageH * maxHeightFrac), visW / (stageW * maxWidthFrac))) / d;
  const u = ratio * perRatio, uTop = MAX_SIZE_RATIO * perRatio;
  if (u <= knee || uTop <= 1) return s0;
  const compressed = Math.min(1, knee + (1 - knee) * (u - knee) / (uTop - knee));
  return s0 * compressed / u;
}

/**
 * 新版首頁立繪：靜態圖以 object-fit（contain／cover）置中放進容器；回傳其「不透明部分」在容器內的矩形（容器座標，px）。
 * 動態立繪播放器以這個矩形的寬高與腳底、水平中心定位，才會與靜態圖大小一致、落在同一腳底線上
 * （原先直接填滿整個容器，會比靜態圖大、位置偏下，切換時跳動）。
 */
export function homeStaticVisibleRect(box: OpaqueBox, containerW: number, containerH: number, fit: 'contain' | 'cover' = 'contain') {
  const natW = Math.max(1, box.w), natH = Math.max(1, box.h);
  const s = fit === 'cover' ? Math.max(containerW / natW, containerH / natH) : Math.min(containerW / natW, containerH / natH);
  const ox = (containerW - natW * s) / 2, oy = (containerH - natH * s) / 2;
  const left = Math.max(0, ox + box.left * s), right = Math.min(containerW, ox + box.right * s);
  const top = Math.max(0, oy + box.top * s), bottom = Math.min(containerH, oy + box.bottom * s);
  const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
  return { left, right, top, bottom, width, height, centerX: (left + right) / 2, bottomOffset: containerH - bottom };
}
