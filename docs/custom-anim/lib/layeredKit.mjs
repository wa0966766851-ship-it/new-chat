// 分層動畫規格共用工具（2026-11-22）：緩動、關鍵影格、色彩變換、姿勢零件載入、借用光效登記。
// 各精靈規格（docs/custom-anim/<id>.layered.mjs）只寫自己的動作時間軸。

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const E = {lin: t => t, io: t => t * t * (3 - 2 * t), out: t => 1 - (1 - t) ** 3, in: t => t ** 3,
  back: t => { const s = 1.7; return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2; }};
/** key(f, [[f0,v0],[f1,v1,'out'],…])：分段關鍵影格，數值或陣列皆可。 */
export function key(f, keys) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e = 'io'] = keys[i], [f0, v0] = keys[i - 1];
    if (f <= f1) { const t = E[e]((f - f0) / Math.max(1e-6, f1 - f0)); return Array.isArray(v0) ? v0.map((x, j) => x + (v1[j] - x) * t) : v0 + (v1 - v0) * t; }
  }
  return keys[keys.length - 1][1];
}
/** 單峰：f0 淡入、peak 達頂、f1 淡出。 */
export const bump = (f, f0, peak, f1) => f < f0 || f > f1 ? 0 : f <= peak ? E.out((f - f0) / Math.max(1, peak - f0)) : 1 - E.in((f - peak) / Math.max(1, f1 - peak));
export const wave = (f, period, phase = 0) => Math.sin((f / period + phase) * Math.PI * 2);
/** 命中震動：逐格遞減的左右位移。 */
export const shake = (f, start, amp, len = 7) => f < start || f >= start + len ? 0 : amp * (1 - (f - start) / len) * ((f - start) % 2 ? -1 : 1);
export const at = (p, d = [0, 0]) => [p[0] + d[0], p[1] + d[1]];

// Flash 式色彩變換（m＝乘色、t＝加色）
export const WHITE = {m: [0, 0, 0], t: [1, 1, 1]};
export const HALF_WHITE = {m: [.45, .45, .45], t: [.55, .55, .5]};
export const glow = (k, c) => ({m: [1, 1, 1], t: c.map(v => v * k)});
export const ghostTint = c => ({m: [.14, .14, .14], t: c});

/** 官方 4930 帝皇鎧甲的借用光效零件（來源見 borrowed-fx/ppets_4930/provenance.json）。 */
export const FX_DIR = 'docs/custom-anim/borrowed-fx/ppets_4930/';
export const FX_IDS = ['star_flare', 'gold_sword', 'ring_swirl', 'sparks_a', 'sparks_b', 'burst_gold', 'rays_fan', 'glint_star', 'bolt_a', 'bolt_b',
  'slash_orange', 'streak_h', 'slash_cross', 'slash_burst', 'flare_h', 'pillar_a', 'pillar_b', 'star_white', 'fireball', 'shock_bowl'];

/**
 * 從舊正式版備份（docs/custom-anim/pose-source/<id>/）載入姿勢零件：
 * - 每個姿勢的本體圖（buv＋世界框 c、出手點 muzzle）
 * - 該姿勢首格的附加網格格（g，例如上半身、披風、浮游砲），各自成為可獨立擺動的零件；
 *   與本體同區域的重複格（舊版布料形變用）略過。
 * 回傳 {src, parts, pose(id) → {rest, muzzle, cells:[partId…]}}。
 */
export function loadPoseSource({readPng, readJson}, id, scale) {
  const dir = `docs/custom-anim/pose-source/${id}/`;
  const src = readJson(dir + 'manifest.json'), atlasFile = dir + 'atlas.png', atlas = readPng(atlasFile);
  const ppu = src.pixelsPerUnit, [, canvasH] = src.canvas, W = atlas.width, H = atlas.height;
  const fp = src.production.framePoses, poses = {}, parts = [];
  const rectOf = ([u0, v0, u1, v1]) => [Math.round(u0 * W), Math.round(v0 * H), Math.round((u1 - u0) * W), Math.round((v1 - v0) * H)];
  const overlap = (a, b) => {
    const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    return w * h / Math.max(1e-9, (a[2] - a[0]) * (a[3] - a[1]));
  };
  for (const [name, seq] of Object.entries(src.sequences)) seq.quads.forEach((q, i) => {
    const pid = fp[name][i];
    if (poses[pid] || !q.buv || !q.c) return;
    const muzzle = q.anchors?.muzzle ? [q.anchors.muzzle[0] / ppu, (canvasH - q.anchors.muzzle[1]) / ppu] : undefined;
    parts.push({id: pid, kind: 'body', image: atlas, source: atlasFile + '#' + pid, rect: rectOf(q.buv), scale,
      rest: [q.c[0], q.c[1], q.c[2], q.c[5]], anchors: muzzle ? {muzzle} : {}});
    const cells = [];
    (q.g || []).forEach((cell, k) => {
      const uv = [cell.u[0], cell.u[1], cell.u[2], cell.u[5]];
      if (overlap(uv, q.buv) > .9) return;
      const cid = `${pid}.g${k}`;
      parts.push({id: cid, kind: 'body', image: atlas, source: atlasFile + '#' + cid, rect: rectOf(uv), scale, rest: [cell.p[0], cell.p[1], cell.p[2], cell.p[5]]});
      cells.push(cid);
    });
    poses[pid] = {rest: [q.c[0], q.c[1], q.c[2], q.c[5]], muzzle, cells};
  });
  return {src, parts, atlasFile, pose: pid => poses[pid] ?? (() => { throw Error('Unknown pose ' + pid); })()};
}

/** 借用光效零件；color 給定時換成該色系（見 compileLayeredAnimation 的 recolor）。 */
export function borrowFx(readPng, ids = FX_IDS, color, suffix = '') {
  return ids.map(id => {
    const image = readPng(FX_DIR + id + '.png');
    return {id: id + suffix, kind: 'fx', image, source: FX_DIR + id + '.png', rect: [0, 0, image.width, image.height], scale: id === 'star_flare' ? .62 : .8, ...(color ? {recolor: color} : {})};
  });
}

/** 姿勢＋其附加格的圖層組：base 先畫，格依原順序疊上；cellOps 可為各格另給變換（相對姿勢共用變換）。 */
export function poseLayers(kit, pid, o = {}, cellOps = {}) {
  const p = kit.pose(pid);
  return [{part: pid, ...o}, ...p.cells.map(cid => ({part: cid, ...o, ...(cellOps[cid.split('.')[1]] ? merge(o, cellOps[cid.split('.')[1]]) : {}), primary: false}))];
}
const merge = (a, b) => ({...a, ...b, dx: (a.dx ?? 0) + (b.dx ?? 0), dy: (a.dy ?? 0) + (b.dy ?? 0), rot: (a.rot ?? 0) + (b.rot ?? 0)});

/**
 * 待機的連續形變場（世界座標）：腳底固定，越往上動得越多；所有本體零件共用同一個場，接縫處位移一致不會分裂。
 * - 呼吸：上半身微微上提（垂直伸展）
 * - 擺動：整體以腳為支點左右輕擺（上方幅度大）
 * - 布料／髮：自下而上傳遞的小波，外緣（離中線遠）幅度較大
 * t 為 0..1 的循環相位（以序列長度為一個週期，首尾銜接）；amp 可整體縮放。
 */
export function idleField({foot, top, cx, halfW}, t, amp = 1) {
  const H = top - foot, TAU = Math.PI * 2;
  const breathe = Math.sin(TAU * t), sway = Math.sin(TAU * t + .8);
  return (x, y) => {
    const h = clamp((y - foot) / H), edge = clamp(Math.abs(x - cx) / halfW);
    const dy = amp * H * .007 * breathe * h ** 1.2;
    const dx = amp * H * (.006 * sway * h * h + .004 * Math.sin(TAU * (2 * t) - h * 5) * edge * (1 - .5 * h));
    return [dx, dy];
  };
}
