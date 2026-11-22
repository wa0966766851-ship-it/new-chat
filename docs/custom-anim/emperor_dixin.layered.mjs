// 人皇·帝辛 分層動畫試作（2026-11-22）。
// 本體：既有已驗收的 6 張姿勢圖（舊正式版備份 docs/custom-anim/pose-source/emperor_dixin/atlas.png）。
// 光效：借用官方 4930 帝皇鎧甲 的加算光效零件（docs/custom-anim/borrowed-fx/ppets_4930，來源見 provenance.json）。
// 動作：每格由「本體＋殘影＋前後光效」多個零件拼成，用動畫手法而非換圖撐起動感：
//   預備（後仰蓄力）→ 拖影衝刺（橙色殘影＋拉伸）→ 命中閃白＋停頓＋震動 → 收招回彈。
// 座標：世界單位（px／pixelsPerUnit），y 向上；角色面向左（前方＝-x）。

import {idleField} from './lib/layeredKit.mjs';

const FX = 'docs/custom-anim/borrowed-fx/ppets_4930/';
/** 待機形變場：腳底固定、上身呼吸與擺動、衣襬外緣波動（見 layeredKit.idleField）。 */
const FIELD = {foot: .55, top: 7.66, cx: 4.8, halfW: 2.4};
const FX_PARTS = ['star_flare', 'gold_sword', 'ring_swirl', 'sparks_a', 'sparks_b', 'burst_gold', 'rays_fan', 'glint_star', 'bolt_a', 'bolt_b',
  'slash_orange', 'streak_h', 'slash_cross', 'slash_burst', 'flare_h', 'pillar_a', 'pillar_b', 'star_white', 'fireball', 'shock_bowl'];

// ── 緩動與關鍵影格 ──────────────────────────────
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const E = {lin: t => t, io: t => t * t * (3 - 2 * t), out: t => 1 - (1 - t) ** 3, in: t => t ** 3,
  back: t => { const s = 1.7; return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2; }};
/** key(f, [[f0,v0],[f1,v1,'out'],…])：分段關鍵影格，數值或陣列皆可。 */
function key(f, keys) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e = 'io'] = keys[i], [f0, v0] = keys[i - 1];
    if (f <= f1) { const t = E[e]((f - f0) / Math.max(1e-6, f1 - f0)); return Array.isArray(v0) ? v0.map((x, j) => x + (v1[j] - x) * t) : v0 + (v1 - v0) * t; }
  }
  return keys[keys.length - 1][1];
}
/** 單峰：a 在 f0 淡入、peak 達頂、f1 淡出。 */
const bump = (f, f0, peak, f1) => f < f0 || f > f1 ? 0 : f <= peak ? E.out((f - f0) / Math.max(1, peak - f0)) : 1 - E.in((f - peak) / Math.max(1, f1 - peak));
const wave = (f, period, phase = 0) => Math.sin((f / period + phase) * Math.PI * 2);
/** 命中震動：逐格遞減的左右位移。 */
const shake = (f, start, amp, len = 7) => f < start || f >= start + len ? 0 : amp * (1 - (f - start) / len) * ((f - start) % 2 ? -1 : 1);

// ── 色彩變換（官方同款 Flash color transform）──────
const WHITE = {m: [0, 0, 0], t: [1, 1, 1]};
const HALF_WHITE = {m: [.45, .45, .45], t: [.55, .55, .5]};
const GOLD_GLOW = (k) => ({m: [1, 1, 1], t: [.18 * k, .12 * k, 0]});
const BRIGHT = {t: [.3, .22, .08]};
const ORANGE_GHOST = {m: [.13, .13, .13], t: [1, .55, .12]};
const PURPLE_GHOST = {m: [.15, .1, .2], t: [.62, .25, 1]};
const PURPLE = [0.78, 0.42, 1];

export default async function makeSpec({readPng, readJson}) {
  const src = readJson('docs/custom-anim/pose-source/emperor_dixin/manifest.json');
  const atlasFile = 'docs/custom-anim/pose-source/emperor_dixin/atlas.png', atlas = readPng(atlasFile);
  const ppu = src.pixelsPerUnit, [, canvasH] = src.canvas;
  // 各姿勢的圖集格與世界框取自已驗收的正式 manifest（姿勢圖本身不重畫）。
  const poses = {};
  const fp = src.production.framePoses;
  for (const [name, seq] of Object.entries(src.sequences)) seq.quads.forEach((q, i) => {
    const id = fp[name][i];
    if (!poses[id] && q.buv && q.c) poses[id] = {buv: q.buv, c: q.c, muzzle: q.anchors?.muzzle};
  });
  const BODY = {idle: 'idleSashBase', ant: 'anticipation', step: 'step', melee: 'melee', cast: 'cast', hurt: 'hurt'};
  const parts = [];
  for (const [short, id] of Object.entries(BODY)) {
    const p = poses[id], [u0, v0, u1, v1] = p.buv, W = atlas.width, H = atlas.height;
    const rect = [Math.round(u0 * W), Math.round(v0 * H), Math.round((u1 - u0) * W), Math.round((v1 - v0) * H)];
    parts.push({id: short, kind: 'body', image: atlas, source: atlasFile + '#' + id, rect, scale: .72,
      rest: [p.c[0], p.c[1], p.c[2], p.c[5]], anchors: p.muzzle ? {muzzle: [p.muzzle[0] / ppu, (canvasH - p.muzzle[1]) / ppu]} : {}});
  }
  for (const id of FX_PARTS) {
    const image = readPng(FX + id + '.png');
    parts.push({id, kind: 'fx', image, source: FX + id + '.png', rect: [0, 0, image.width, image.height], scale: id === 'star_flare' ? .62 : .85});
  }

  // ── 場景定位（世界座標，取自姿勢圖格線量測）──
  const PIVOT = [4.8, .55];
  const P = {idleOrb: [6.4, 6.05], idleTip: [2.55, 1.5], idleHilt: [3.3, 3.95], crown: [4.95, 7.35],
    castTip: [2.55, 7.5], castOrb: [5.65, 6.1], meleeTip: [.7, 3.05], meleeHilt: [2.8, 3.0], chest: [4.85, 4.6]};
  const SWORD_BASE = 150; // gold_sword 圖中劍尖指向（度，y 向上）

  const body = (part, o = {}) => ({part, ...o});
  const fx = (part, x, y, w, o = {}) => ({part, x, y, w, ...o});
  /** 殘影：同一姿勢、拉在後方，上色後依序變淡。 */
  const ghosts = (part, base, step, n, color, alpha = [.5, .3, .15]) =>
    Array.from({length: n}, (_, i) => body(part, {...base, dx: (base.dx ?? 0) + step[0] * (n - i), dy: (base.dy ?? 0) + step[1] * (n - i), a: alpha[n - 1 - i] ?? .1, ...color}));
  const at = (p, d = [0, 0]) => [p[0] + d[0], p[1] + d[1]];

  // ── 待機：呼吸、腳下金環、掌中寶珠、冠頂閃光、劍身流光、上升金屑 ──
  const standby = Array.from({length: 96}, (_, f) => {
    const br = wave(f, 48);
    const L = [
      fx('ring_swirl', 4.8, .86, 3.6, {sy: .2, rot: f * 1.2, a: .3 + .08 * wave(f, 96), m: [1, .82, .45]}),
      fx('sparks_a', 4.9, 2.2 + 3.2 * ((f % 96) / 96), 2.4, {a: .5 * bump(f % 96, 0, 30, 95), m: [1, .8, .35]}),
      fx('sparks_b', 4.6, 2.2 + 3.2 * (((f + 48) % 96) / 96), 2.0, {a: .45 * bump((f + 48) % 96, 0, 30, 95), m: PURPLE}),
      body('idle', {warp: idleField(FIELD, f / 96)}),
      fx('glint_star', ...P.idleOrb, 1.0 + .15 * wave(f, 24), {rot: f * 3, a: .5 + .25 * (wave(f, 24) * .5 + .5)}),
      fx('burst_gold', ...P.idleOrb, .9, {rot: -f * 2, a: .25 + .1 * wave(f, 32)}),
      fx('star_white', ...P.crown, .2 + .55 * bump(f, 40, 46, 56), {rot: f * 6, a: bump(f, 40, 46, 56)}),
    ];
    // 劍身流光：沿劍刃由護手掃到劍尖
    const s = clamp((f - 66) / 12), sweep = at(P.idleHilt, [(P.idleTip[0] - P.idleHilt[0]) * s, (P.idleTip[1] - P.idleHilt[1]) * s]);
    if (f >= 66 && f <= 80) L.push(fx('flare_h', ...sweep, 1.1, {rot: -107, a: bump(f, 66, 71, 80)}));
    return L;
  });

  // ── 物攻（刺擊）：44 格，命中 24 ──
  const attack = Array.from({length: 44}, (_, f) => {
    const L = [];
    if (f <= 5) L.push(body('idle', {sy: key(f, [[0, 1], [5, .985]]), sx: key(f, [[0, 1], [5, 1.01]])}));
    else if (f <= 12) {
      const k = key(f, [[6, 0], [12, 1, 'out']]);
      L.push(body('ant', {dx: .28 * k, rot: -4 * k, sx: 1 + .03 * k, sy: 1 - .035 * k, ...(f >= 10 ? GOLD_GLOW(bump(f, 9, 11, 13)) : {})}));
      L.push(fx('glint_star', ...at(P.idleTip, [-1.2, 1.35]), .25 + .9 * k, {rot: f * 12, a: .4 + .6 * k}));
    } else if (f <= 14) {
      const base = {dx: f === 13 ? -.2 : -.45, sx: 1.08, sy: .97};
      L.push(fx('streak_h', 6.3, 2.9, 3.6, {a: .55, m: [1, .7, .3]}));
      L.push(...ghosts('step', base, [.38, 0], 3, ORANGE_GHOST));
      L.push(body('step', base));
    } else if (f <= 23) {
      const dx = key(f, [[15, -.6], [23, -1.45, 'out']]);
      if (f <= 18) L.push(...ghosts('melee', {dx}, [.3, 0], 18 - f + 1, ORANGE_GHOST, [.4, .25, .12, .06]));
      L.push(fx('streak_h', 3.2 + dx, 3.05, 4.2, {a: .7 * bump(f, 14, 16, 23), m: [1, .75, .35]}));
      L.push(body('melee', {dx}));
      L.push(fx('slash_orange', ...at(P.meleeTip, [dx, 0]), .6 + .12 * (f - 15), {rot: 180, a: bump(f, 18, 23, 24)}));
    } else {
      // 命中：閃白 → 停頓 → 收招
      const dx = f <= 30 ? -1.5 : key(f, [[30, -1.5], [34, -.5, 'out'], [43, 0]]);
      const sh = shake(f, 24, .14);
      const pose = f <= 31 ? 'melee' : f <= 36 ? 'step' : f <= 40 ? 'ant' : 'idle';
      const tip = at(P.meleeTip, [-1.5 + sh, 0]);
      const flash = f === 24 ? WHITE : f === 25 ? HALF_WHITE : {};
      if (f >= 24 && f <= 33) L.push(fx('ring_swirl', ...tip, 1.4 + (f - 24) * .8, {sy: .5, rot: (f - 24) * 12, a: .9 * (1 - (f - 24) / 10), ...BRIGHT}));
      if (pose === 'step' && f <= 34) L.push(...ghosts('step', {dx: dx + sh}, [-.25, 0], 1, ORANGE_GHOST, [.35]));
      L.push(body(pose, {dx: dx + sh, ...(pose === 'idle' ? {sy: key(f, [[41, .985], [43, 1]])} : {}), ...flash}));
      if (f <= 34) {
        L.push(fx('star_flare', ...tip, 3.2 + 5 * E.out(clamp((f - 24) / 3)), {rot: (f - 24) * 4, a: 1 - E.in(clamp((f - 24) / 9))}));
        L.push(fx('burst_gold', ...tip, 3.8, {rot: -(f - 24) * 9, a: bump(f, 24, 25, 32)}));
        L.push(fx('slash_burst', ...at(tip, [-.2, 0]), 3.2 + .16 * (f - 24), {rot: 160, a: bump(f, 24, 25, 31)}));
        L.push(fx('flare_h', ...tip, 5.5 * (1 - .06 * (f - 24)), {a: bump(f, 24, 24, 29)}));
        L.push(fx('shock_bowl', ...at(tip, [-.4, 0]), 2.2 + .4 * (f - 24), {rot: -90, a: bump(f, 24, 26, 33)}));
        if (f >= 26 && f <= 30) L.push(fx(f % 2 ? 'bolt_a' : 'bolt_b', ...at(tip, [.3, .3]), 1.1, {rot: 20 * (f % 3 - 1), a: .85}));
        if (f >= 25) L.push(fx('sparks_b', ...at(tip, [-.4, .2 + .05 * (f - 25)]), 3.4, {a: bump(f, 25, 27, 34)}));
      }
    }
    return L;
  });

  // ── 特攻（劍雨）：40 格，命中 22；舉劍召來五柄金劍，斜射前方 ──
  const swords = [[-.2, 9.0, 0], [1.1, 8.6, 3], [2.4, 9.3, 6], [3.6, 8.8, 9], [-1.4, 8.4, 12]];
  const sa = Array.from({length: 40}, (_, f) => {
    const L = [];
    const raise = key(f, [[0, 0], [8, 1, 'out'], [30, 1], [39, 0]]);
    L.push(fx('rays_fan', 4.6, 7.4, 5.2, {a: .8 * bump(f, 6, 12, 30), ...BRIGHT}));
    L.push(fx('ring_swirl', 4.8, .86, 3.6 + 1.6 * raise, {sy: .2, rot: f * 4, a: .8 * raise, ...BRIGHT}));
    L.push(body(f < 4 || f > 35 ? 'idle' : 'cast', {dy: .12 * raise, ...(f >= 8 && f <= 20 ? GOLD_GLOW(.6 + .4 * wave(f, 6)) : {})}));
    L.push(fx('glint_star', ...P.castTip, .5 + 1.4 * bump(f, 6, 10, 18), {rot: f * 10, a: bump(f, 6, 10, 18)}));
    L.push(fx('burst_gold', ...P.castOrb, 1.2, {rot: f * 5, a: .6 * bump(f, 4, 10, 24)}));
    for (const [sx, sy, delay] of swords) {
      const appear = 6 + delay / 2, launch = 16 + delay / 3, land = 22 + delay / 4;
      if (f < appear || f > land + 6) continue;
      const tx = sx - 3.4, ty = .7; // 落點：前方地面
      const t = clamp((f - launch) / Math.max(1, land - launch));
      const x = sx + (tx - sx) * E.in(t), y = sy + (ty - sy) * E.in(t);
      const dir = Math.atan2(ty - sy, tx - sx) * 180 / Math.PI;
      if (f <= land) {
        L.push(fx('gold_sword', x, y, 2.0, {rot: dir - SWORD_BASE, a: clamp((f - appear) / 3)}));
        if (f > launch) L.push(fx('streak_h', x + Math.cos(dir * Math.PI / 180) * -1.4, y + Math.sin(dir * Math.PI / 180) * -1.4, 2.6, {rot: dir, a: .6}));
        if (f < launch) L.push(fx('glint_star', x, y, .5 + .3 * wave(f, 4), {a: .7}));
      } else {
        const k = (f - land) / 6;
        L.push(fx('slash_burst', tx, ty + .3, 1.6 + 1.2 * k, {rot: 20, a: 1 - k}));
        L.push(fx('burst_gold', tx, ty + .2, 1.4 + k, {rot: f * 8, a: 1 - k}));
      }
    }
    return L;
  });

  // ── 第五／大招（人皇裁天）：64 格，命中 42 ──
  const ultimate = Array.from({length: 64}, (_, f) => {
    const L = [];
    const charge = key(f, [[0, 0], [14, 1, 'out'], [28, 1], [32, 0]]);
    // 背後金柱升起
    for (const [x, delay, part] of [[1.6, 0, 'pillar_a'], [8.0, 2, 'pillar_b'], [2.8, 4, 'pillar_b'], [6.8, 6, 'pillar_a']]) {
      const h = key(f, [[delay, 0], [delay + 10, 1, 'out'], [30, 1], [36, 0]]);
      if (h > .01) L.push(fx(part, x, .5 + 3.4 * h, 1.7, {sy: 2.2 * h, a: .95 * h, ...BRIGHT}));
    }
    L.push(fx('ring_swirl', 4.8, .86, 3.4 + 2.2 * charge, {sy: .22, rot: f * 6, a: .9 * charge, ...BRIGHT}));
    L.push(fx('rays_fan', 4.8, 7.4, 6, {a: .9 * bump(f, 8, 16, 30), ...BRIGHT}));
    if (f <= 28) {
      L.push(body('cast', {dy: .18 * charge, ...GOLD_GLOW(.4 + .6 * charge * (wave(f, 5) * .5 + .5))}));
      L.push(fx('star_flare', ...P.castTip, .6 + 2.6 * bump(f, 10, 18, 28), {rot: f * 5, a: bump(f, 10, 18, 28)}));
      if (f >= 14) L.push(fx(f % 2 ? 'bolt_a' : 'bolt_b', ...at(P.castTip, [.2, -.8]), 1.2, {rot: 30 * (f % 3 - 1), a: .8}));
      // 三柄金劍環繞
      for (let i = 0; i < 3; i++) {
        const ang = f * 8 + i * 120, r = 1.9, cx = 4.8 + Math.cos(ang * Math.PI / 180) * r, cy = 5.4 + Math.sin(ang * Math.PI / 180) * r * .45;
        L.push(fx('gold_sword', cx, cy, 1.5, {rot: ang + 90 - SWORD_BASE, a: clamp((f - 6) / 6) * (f > 24 ? 1 - (f - 24) / 4 : 1)}));
      }
    } else if (f <= 33) {
      const base = {dx: key(f, [[29, .3], [33, -.5]]), rot: key(f, [[29, -5], [33, 0]]), sx: 1.06};
      L.push(...ghosts(f < 31 ? 'ant' : 'step', base, [.42, .05], 3, PURPLE_GHOST));
      L.push(body(f < 31 ? 'ant' : 'step', base));
    } else if (f <= 41) {
      const dx = key(f, [[34, -.8], [41, -1.7, 'out']]);
      L.push(...ghosts('melee', {dx}, [.36, 0], Math.max(1, 4 - (f - 34) / 2) | 0, ORANGE_GHOST, [.45, .3, .15, .08]));
      L.push(fx('streak_h', 3.0 + dx, 3.05, 5.2, {a: .8, m: [1, .75, .35]}));
      L.push(body('melee', {dx}));
      for (let i = 0; i < 3; i++) L.push(fx('gold_sword', ...at(P.meleeTip, [dx + .6 + i * .5, .5 - i * .5]), 1.4, {rot: 180 - SWORD_BASE, a: .8}));
    } else {
      const sh = shake(f, 42, .22, 9), tip = at(P.meleeTip, [-1.75 + sh, 0]);
      const dx = f <= 50 ? -1.75 : key(f, [[50, -1.75], [55, -.6, 'out'], [63, 0]]);
      const pose = f <= 51 ? 'melee' : f <= 56 ? 'step' : f <= 59 ? 'ant' : 'idle';
      if (f <= 56) L.push(fx('ring_swirl', ...tip, 2 + (f - 42) * .9, {sy: .55, rot: (f - 42) * 10, a: .95 * (1 - (f - 42) / 15), ...BRIGHT}));
      if (f <= 52) L.push(fx('fireball', ...at(tip, [-.3, .4]), 2.6 + .25 * (f - 42), {a: bump(f, 42, 44, 52)}));
      L.push(body(pose, {dx: dx + sh, ...(f === 42 ? WHITE : f === 43 ? HALF_WHITE : f <= 47 ? GOLD_GLOW(.6) : {})}));
      if (f <= 54) {
        L.push(fx('star_flare', ...tip, 3 + 4 * E.out(clamp((f - 42) / 4)), {rot: (f - 42) * 3, a: 1 - E.in(clamp((f - 42) / 12))}));
        L.push(fx('star_white', ...tip, 2.6, {rot: -(f - 42) * 6, a: bump(f, 42, 42, 48)}));
        L.push(fx('shock_bowl', ...at(tip, [-.5, 0]), 2 + .35 * (f - 42), {rot: -90, a: bump(f, 42, 44, 52)}));
        L.push(fx('slash_cross', ...tip, 2.6, {rot: 15, a: bump(f, 43, 45, 51)}));
        if (f >= 44 && f <= 50) L.push(fx(f % 2 ? 'bolt_b' : 'bolt_a', ...at(tip, [.4, .6]), 1.6, {rot: 25 * (f % 3 - 1), a: .9}));
        L.push(fx('sparks_a', ...at(tip, [-.3, .4 + .06 * (f - 42)]), 3, {a: bump(f, 43, 46, 54)}));
      }
    }
    return L;
  });

  // ── 屬性（人皇御宇：金光自地升起）：40 格 ──
  const cp = Array.from({length: 40}, (_, f) => {
    const L = [];
    const up = key(f, [[0, 0], [10, 1, 'out'], [30, 1], [39, 0]]);
    L.push(fx('ring_swirl', 4.8, .86, 3 + 2.8 * up, {sy: .22, rot: -f * 5, a: .9 * up, ...BRIGHT}));
    for (const [x, d, part] of [[1.8, 0, 'pillar_b'], [7.8, 3, 'pillar_a'], [2.9, 6, 'pillar_a'], [6.7, 9, 'pillar_b']]) {
      const h = key(f, [[d, 0], [d + 8, 1, 'out'], [32, 1], [39, 0]]);
      if (h > .01) L.push(fx(part, x, .5 + 3.2 * h, 1.5, {sy: 2.1 * h, a: .9 * h, ...BRIGHT}));
    }
    L.push(fx('sparks_a', 4.8, 1.5 + 4 * (f / 39), 3.2, {a: .7 * bump(f, 4, 14, 39)}));
    L.push(body(f < 3 || f > 36 ? 'idle' : 'cast', {dy: .1 * up, ...GOLD_GLOW(up * (.5 + .5 * wave(f, 8)))}));
    L.push(fx('burst_gold', ...P.castOrb, 1.2 + .6 * bump(f, 14, 18, 26), {rot: f * 6, a: .9 * bump(f, 8, 18, 30)}));
    L.push(fx('star_white', ...P.castOrb, 2.2, {rot: f * 4, a: bump(f, 17, 18, 24)}));
    L.push(fx('rays_fan', 4.8, 7.4, 5.4, {a: .85 * bump(f, 12, 18, 34), ...BRIGHT}));
    return L;
  });

  // ── 額外行動：32 格；快速追斬（十字斬） ──
  const extra = Array.from({length: 32}, (_, f) => {
    const L = [];
    if (f <= 5) L.push(body('ant', {dx: .2 * E.out(f / 5), rot: -3 * E.out(f / 5)}));
    else if (f <= 13) {
      const dx = key(f, [[6, -.3], [13, -1.3, 'out']]);
      L.push(...ghosts('melee', {dx}, [.35, 0], 3, PURPLE_GHOST));
      L.push(body('melee', {dx}));
    } else {
      const sh = shake(f, 14, .1, 6), dx = f <= 19 ? -1.3 : key(f, [[19, -1.3], [26, 0, 'out']]);
      const tip = at(P.meleeTip, [-1.3 + sh, 0]);
      L.push(body(f <= 20 ? 'melee' : f <= 25 ? 'step' : 'idle', {dx: dx + sh, ...(f === 14 ? WHITE : f === 15 ? HALF_WHITE : {})}));
      if (f <= 22) {
        L.push(fx('slash_cross', ...tip, 2.4, {rot: 10, a: bump(f, 14, 15, 22)}));
        L.push(fx('flare_h', ...tip, 4, {rot: 35, a: bump(f, 14, 14, 19)}));
        L.push(fx('flare_h', ...tip, 4, {rot: -35, a: bump(f, 15, 15, 20)}));
        L.push(fx('glint_star', ...tip, 1.6, {rot: f * 15, a: bump(f, 14, 16, 22)}));
      }
    }
    return L;
  });

  // ── 受擊：12 格；閃紅白、被擊退後回穩 ──
  const hited = Array.from({length: 12}, (_, f) => {
    const k = key(f, [[0, 0], [3, 1, 'out'], [11, 0]]);
    return [
      body('hurt', {dx: .3 * k, rot: -3 * k, ...(f <= 1 ? {m: [1, .55, .55], t: [.55, .12, .12]} : {})}),
      ...(f <= 6 ? [fx('slash_cross', ...P.chest, 1.4, {rot: 30, a: bump(f, 0, 1, 6), m: [1, .7, .7]})] : []),
    ];
  });

  return {
    id: 'emperor_dixin', elfId: src.elfId, elfName: src.elfName, fps: 24, facing: src.facing,
    presentation: {...src.presentation, fxSheets: undefined, ambient: false, bakedFx: true}, physicalMotion: src.physicalMotion,
    canvas: src.canvas, pixelsPerUnit: ppu, pivot: PIVOT, restPart: 'idle', parts, maxAtlasSide: 4096,
    notes: ['光效零件借自官方 4930 帝皇鎧甲（加算層），本體為既有 6 張已驗收姿勢圖', '動作：預備、拖影、命中閃白、停頓、震動、收招回彈'],
    sequences: {
      standby: {frames: standby, loop: true},
      attack: {frames: attack, hits: [24], events: {launch: 13, recover: 34}},
      sa: {frames: sa, hits: [22], events: {launch: 16, recover: 30}},
      ultimate: {frames: ultimate, hits: [42], events: {launch: 33, recover: 55}},
      cp: {frames: cp},
      extra: {frames: extra},
      hited: {frames: hited},
    },
  };
}
