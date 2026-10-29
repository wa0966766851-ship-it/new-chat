/**
 * sketchStroke.ts — 手繪筆法模組
 *
 * 移植自「拾光行記 · GLEANERS OF LIGHT」模板（單檔 Canvas 2D，零依賴）。
 * 原作者的核心主張：全站沒有一條直接用 stroke() 畫的直線或完美圓。
 *
 * 原理：
 * - 圓環用「正弦波擾動半徑」+「收筆越過起點」模擬手繪抖動
 * - 標線用二次貝茲中段微拱、兩端衝出
 * - 筆刷輪廓兩端漸細（sin^0.62 剖面）
 *
 * 本檔只提供純函式（回傳 SVG path 字串或繪製指令），不持有任何狀態，
 * 因此可同時用在 SVG（<path d={sk.ring(...)}>）與 Canvas（new Path2D(d)）。
 *
 * 2026-10-29：為命運之輪「紙本」主題新增第三種視覺風格。
 */

export const TAU = Math.PI * 2;

/** 決定性亂數（同一 seed 永遠得到同一序列，保證每次重繪一致）。 */
export function rng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return function () {
    a ^= a << 13; a >>>= 0;
    a ^= a >> 17;
    a ^= a << 5; a >>>= 0;
    return (a >>> 0) / 4294967296;
  };
}

export function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
export function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
export function dist(ax: number, ay: number, bx: number, by: number): number { return Math.hypot(ax - bx, ay - by); }

export interface RingOptions { amp?: number; over?: number }

/** 會起伏、收筆越過起點的圓環。回傳 SVG path 的 d。 */
export function ring(cx: number, cy: number, r: number, seed: number, o: RingOptions = {}): string {
  const R = rng(seed);
  const a1 = (o.amp ?? 0.012) + R() * 0.006;
  const a2 = 0.004 + R() * 0.003;
  const f1 = 2 + Math.floor(R() * 3), f2 = 5 + Math.floor(R() * 4);
  const p1 = R() * TAU, p2 = R() * TAU, st = R() * TAU;
  const over = (o.over ?? 0.14) + R() * 0.10;
  const steps = Math.max(72, Math.round(r * 0.85));
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = st + t * (TAU + over);
    const rr = r * (1 + a1 * Math.sin(f1 * ang + p1) + a2 * Math.sin(f2 * ang + p2));
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d;
}

export interface RuleOptions { ext?: number; bow?: number }

/** 中段微拱、兩端衝出的標線。 */
export function rule(x1: number, y1: number, x2: number, y2: number, seed: number, o: RuleOptions = {}): string {
  const R = rng(seed);
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const ext = (o.ext ?? 3) + R() * 3;
  const bow = (R() * 2 - 1) * L * (o.bow ?? 0.008);
  const ax = x1 - ux * ext, ay = y1 - uy * ext;
  const bx = x2 + ux * ext, by = y2 + uy * ext;
  const mx = (x1 + x2) / 2 + nx * bow, my = (y1 + y2) / 2 + ny * bow;
  return `M${ax.toFixed(2)} ${ay.toFixed(2)} Q${mx.toFixed(2)} ${my.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`;
}

/** 兩端漸細的筆刷輪廓（pts 為中心線取樣點）。 */
export function brush(pts: [number, number][], w: number): string {
  if (pts.length < 2) return '';
  const L: [number, number][] = [], Rr: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const pr = pts[Math.max(0, i - 1)];
    const ne = pts[Math.min(pts.length - 1, i + 1)];
    let tx = ne[0] - pr[0], ty = ne[1] - pr[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;
    const t = i / (pts.length - 1);
    const hw = w * 0.5 * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.62);
    L.push([p[0] + nx * hw, p[1] + ny * hw]);
    Rr.push([p[0] - nx * hw, p[1] - ny * hw]);
  }
  let d = 'M' + L[0][0].toFixed(2) + ' ' + L[0][1].toFixed(2);
  for (let i = 1; i < L.length; i++) d += 'L' + L[i][0].toFixed(2) + ' ' + L[i][1].toFixed(2);
  for (let i = Rr.length - 1; i >= 0; i--) d += 'L' + Rr[i][0].toFixed(2) + ' ' + Rr[i][1].toFixed(2);
  return d + 'Z';
}

/** 光刃（兩端尖、中間最寬的柳葉形）。 */
export function blade(cx: number, cy: number, len: number, ang: number, wid: number): string {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const t1x = cx - dx * len, t1y = cy - dy * len;
  const t2x = cx + dx * len, t2y = cy + dy * len;
  return 'M' + t1x.toFixed(2) + ' ' + t1y.toFixed(2) +
    ' Q' + (cx + nx * wid).toFixed(2) + ' ' + (cy + ny * wid).toFixed(2) + ' ' + t2x.toFixed(2) + ' ' + t2y.toFixed(2) +
    ' Q' + (cx - nx * wid).toFixed(2) + ' ' + (cy - ny * wid).toFixed(2) + ' ' + t1x.toFixed(2) + ' ' + t1y.toFixed(2) + 'Z';
}

/** 星芒（n 條由中心射出的不等長線段）。 */
export function sparkle(cx: number, cy: number, r: number, n: number, seed: number): string {
  const R = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const l = r * (0.35 + R() * 0.65);
    d += 'M' + cx.toFixed(2) + ' ' + cy.toFixed(2) +
      ' L' + (cx + Math.cos(a) * l).toFixed(2) + ' ' + (cy + Math.sin(a) * l).toFixed(2) + ' ';
  }
  return d;
}

export interface HalftoneOptions { paperColor?: string; color?: string; step?: number }

/**
 * 半調網點（由中心向外漸小的圓點矩陣）。
 * 回傳 HTMLCanvasElement，可直接 drawImage 或轉 dataURL 當 CSS 背景。
 */
export function makeHalftone(
  size: number, step: number, seed: number, color: string, paperColor: string, dpr = 1,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  g.fillStyle = paperColor;
  g.fillRect(0, 0, size, size);
  const R = rng(seed);
  const r0 = size / 2;
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      const d = Math.hypot(x - r0, y - r0) / r0;
      if (d > 1) continue;
      const rr = step * 0.34 * (1 - d * 0.55);
      g.fillStyle = color;
      g.beginPath(); g.arc(x, y, Math.max(0.5, rr), 0, TAU); g.fill();
    }
  }
  void R; // seed 保留給未來加入抖動
  return c;
}

/** 拾光行記的原始色票（紙白 + 鈷藍 + 暖橘）。 */
export const PAPER_PALETTE = {
  paper: '#F2EDE4',
  ink: '#16307A',
  cobalt: '#1F4FD8',
  pale: '#7C9BE8',
  warm: '#E8622B',
} as const;
