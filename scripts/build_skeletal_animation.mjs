// 骨骼驅動的自製動作素材：改圖不動圖，靠網格蒙皮讓關節真的轉。
// 關鍵：光效錨定在「砲口」，砲口位置由骨骼矩陣算出，所以光束一定從砲管出來。
import fs from 'node:fs';

// 光效格縮放：0.5 → 面積 1/4。發光柔和，縮小幾乎無感。
const FX_SCALE = Number(process.env.FX_SCALE || 0.5);
// 本體格縮放：0.6 保留細節又能讓 182 格塞進一張圖集。
const BODY_SCALE = Number(process.env.BODY_SCALE || 0.6);

// ── 官方特效庫 ──────────────────────────────────────────────
// 從官方 .pet 圖集切出來的特效圖塊（scripts/extract_fx_library.mjs）。
// 程式化光效只能是「光暈／光束」這種通用形狀；魔法陣、星芒、光刃這些
// 細節畫不出來，直接複用官方素材並改色。
const FX_LIB_DIR = path.join("public", "elf-fx", "holyPuni");
const fxLib = (() => {
  const indexPath = path.join(FX_LIB_DIR, "index.json");
  if (!fs.existsSync(indexPath)) return [];
  const list = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  return list.map((it) => {
    const img = PNG.sync.read(fs.readFileSync(path.join(FX_LIB_DIR, it.name)));
    return { ...it, img };
  });
})();

/** 依名稱取官方特效圖塊。 */
function fxTile(name) {
  const t = fxLib.find((x) => x.name.startsWith(name));
  if (!t) throw new Error("找不到特效圖塊: " + name);
  return t;
}

/** 把官方特效圖塊染色：保留亮度，只換色相（預設偏藍，配合墜星）。 */
function tintFx(img, color, strength = 1) {
  const out = Buffer.alloc(img.width * img.height * 4);
  const [tr, tg, tb] = color;
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2], a = img.data[o + 3];
    // 用亮度當遮罩：原本金色的地方換成目標色，暗部保持
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const k = Math.pow(lum, 0.85) * strength;
    out[o]     = Math.min(255, tr * k + r * (1 - strength) * 0.5);
    out[o + 1] = Math.min(255, tg * k + g * (1 - strength) * 0.5);
    out[o + 2] = Math.min(255, tb * k + b * (1 - strength) * 0.5);
    out[o + 3] = a;
  }
  return { width: img.width, height: img.height, data: out };
}

import path from 'node:path';
import {PNG} from 'pngjs';
import {buildGrid, autoWeights, boneMatrices, skinVerts, rasterize} from './lib/meshWarp.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);

const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  charge: (t) => t * t * t,
  snap: (t) => 1 - Math.pow(1 - t, 4),
};
const lerp = (a, b, t) => a + (b - a) * t;

/** 從關鍵影格軌道取樣：track = [{t, v..., ease}] */
function sampleTrack(track, time) {
  if (!track || !track.length) return {};
  if (time <= track[0].t) return track[0];
  const last = track[track.length - 1];
  if (time >= last.t) return last;
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i], b = track[i + 1];
    if (time >= a.t && time <= b.t) {
      const span = b.t - a.t;
      const raw = span > 1e-9 ? (time - a.t) / span : 1;
      const e = (EASE[b.ease || 'inOut'] || EASE.inOut)(raw);
      const out = { t: time };
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (key === 't' || key === 'ease') continue;
        const av = a[key] ?? 0, bv = b[key] ?? 0;
        out[key] = lerp(av, bv, e);
      }
      return out;
    }
  }
  return last;
}

// ── 像素繪製（直接寫 RGBA，加法混色）─────────────────────
function blendAdd(data, w, h, x, y, r, g, b, a) {
  // 座標一律取整：小數座標會讓 y*w+x 算到別的像素（甚至別的列），
  // 顏色就濺到畫面無關的位置，看起來像隨機雜點。
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  const al = Math.min(1, a);
  data[i] = Math.min(255, data[i] + r * al);
  data[i + 1] = Math.min(255, data[i + 1] + g * al);
  data[i + 2] = Math.min(255, data[i + 2] + b * al);
  // alpha 用累加並夾在上限：加法圖層重疊處會更亮更實，但不會一次就變全不透明。
  data[i + 3] = Math.min(255, data[i + 3] + 255 * al * 0.85);
}

function drawGlow(data, w, h, cx, cy, radius, color, intensity) {
  if (radius <= 0 || intensity <= 0) return;
  const [r, g, b] = color;
  const x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(w - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(h - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      const f = Math.pow(1 - d, 2.2) * intensity;
      blendAdd(data, w, h, x, y, r, g, b, f);
    }
  }
}

/** 光束：從 (x0,y0) 沿 (dx,dy) 射出，長度 len、半寬 halfW。 */
function drawBeam(data, w, h, x0, y0, dx, dy, len, halfW, color, intensity, taper) {
  const [r, g, b] = color;
  const x1 = x0 + dx * len, y1 = y0 + dy * len;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - halfW - 4));
  const xb = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + halfW + 4));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - halfW - 4));
  const yb = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + halfW + 4));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const px = x - x0, py = y - y0;
      const along = px * dx + py * dy;
      if (along < 0 || along > len) continue;
      const perp = Math.abs(px * -dy + py * dx);
      const wAt = halfW * (taper ? Math.max(0.05, 1 - (along / len) * 0.75) : 1);
      if (perp > wAt) continue;
      const radial = Math.pow(1 - perp / wAt, 1.6);
      // 尾端淡出要慢：0.55 次方太陡，遠處幾乎看不到，光束會像「斷掉」。
      const fade = taper ? Math.pow(1 - along / len, 0.28) : 1;
      // 光束本體要夠亮才讀得出來；加法混合下係數 2.4 約等於滿白。
      blendAdd(data, w, h, x, y, r, g, b, radial * fade * intensity * 2.4);
    }
  }
}

/** 粒子：seed 決定，可重現。 */
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** 環形衝擊波：從中心擴散，越外越淡。 */
function drawShockwave(data, w, h, cx, cy, radius, thickness, color, intensity) {
  const [r, g, b] = color;
  const inner = Math.max(0, radius - thickness), outer = radius + thickness;
  const x0 = Math.max(0, Math.floor(cx - outer)), x1 = Math.min(w - 1, Math.ceil(cx + outer));
  const y0 = Math.max(0, Math.floor(cy - outer)), y1 = Math.min(h - 1, Math.ceil(cy + outer));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < inner || d > outer) continue;
      const t = 1 - Math.abs(d - radius) / thickness;
      blendAdd(data, w, h, x, y, r, g, b, Math.pow(t, 1.8) * intensity);
    }
  }
}

/** 電弧：從起點到終點的鋸齒折線，帶分岔。 */
function drawArc(data, w, h, x0, y0, x1, y1, segments, jitter, thickness, color, intensity, seed) {
  const rnd2 = rnd(seed);
  const [r, g, b] = color;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t;
    const off = (i === 0 || i === segments) ? 0 : (rnd2() - 0.5) * 2 * jitter;
    // 垂直於線段方向偏移
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    pts.push({ x: nx - (dy / L) * off, y: ny + (dx / L) * off });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1];
    const n = Math.ceil(Math.hypot(c.x - a.x, c.y - a.y));
    for (let s = 0; s <= n; s++) {
      const t = n ? s / n : 0;
      const px = a.x + (c.x - a.x) * t, py = a.y + (c.y - a.y) * t;
      // thickness 可能是小數（2.5）；直接用會產生小數座標，blendAdd 的索引就錯位，
      // 顏色會濺到畫面完全無關的位置。先取整再掃。
      const ti = Math.max(1, Math.round(thickness));
      for (let ox = -ti; ox <= ti; ox++) {
        for (let oy = -ti; oy <= ti; oy++) {
          const dd = Math.hypot(ox, oy);
          if (dd > ti) continue;
          blendAdd(data, w, h, Math.round(px) + ox, Math.round(py) + oy, r, g, b,
            (1 - dd / (thickness + 0.5)) * intensity);
        }
      }
    }
  }
}

/** 碎片：帶旋轉的短線段，模擬被打碎的能量塊。 */
function drawDebris(data, w, h, cx, cy, count, radius, len, color, intensity, seed) {
  const rnd2 = rnd(seed);
  const [r, g, b] = color;
  for (let i = 0; i < count; i++) {
    const ang = rnd2() * Math.PI * 2;
    const dist = radius * (0.2 + rnd2() * 0.9);
    const px = cx + Math.cos(ang) * dist, py = cy + Math.sin(ang) * dist;
    const dir = rnd2() * Math.PI * 2;
    const L = len * (0.4 + rnd2() * 0.9);
    const n = Math.max(2, Math.ceil(L));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const qx = px + Math.cos(dir) * L * t, qy = py + Math.sin(dir) * L * t;
      blendAdd(data, w, h, Math.round(qx), Math.round(qy), r, g, b, (1 - t) * intensity);
    }
  }
}

/** 放射狀光刺（命中爆閃）。 */
function drawBurst(data, w, h, cx, cy, inner, outer, count, color, intensity, seed) {
  const rnd2 = rnd(seed);
  const [r, g, b] = color;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rnd2() * 0.35;
    const L = outer * (0.55 + rnd2() * 0.6);
    const n = Math.ceil(L);
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const d = inner + (L - inner) * t;
      const px = cx + Math.cos(ang) * d, py = cy + Math.sin(ang) * d;
      const wdt = Math.max(0.5, 2.6 * (1 - t));
      for (let o = -Math.ceil(wdt); o <= Math.ceil(wdt); o++) {
        blendAdd(data, w, h, Math.round(px - Math.sin(ang) * o), Math.round(py + Math.cos(ang) * o),
          r, g, b, (1 - t) * intensity * (1 - Math.abs(o) / (wdt + 1)));
      }
    }
  }
}

/** 全畫面提亮（發射那一瞬的白閃）。 */
function flashScreen(data, w, h, color, amount) {
  if (amount <= 0) return;
  const [r, g, b] = color;
  for (let i = 0; i < w * h * 4; i += 4) {
    data[i] = Math.min(255, data[i] + r * amount);
    data[i + 1] = Math.min(255, data[i + 1] + g * amount);
    data[i + 2] = Math.min(255, data[i + 2] + b * amount);
    // 不要用 alpha 填滿整個畫面：那會讓 fx 層處處不透明、蓋掉背景與光束對比。
    if (amount > 0.02) data[i + 3] = Math.max(data[i + 3], Math.min(255, 255 * Math.min(1, amount * 0.5)));
  }
}

/** 圓環（炮管充能環，沿光束軸排列）。 */
function drawRings(data, w, h, cx, cy, dx, dy, count, spacing, radius, color, intensity, shrink) {
  const [r, g, b] = color;
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const px = cx + dx * spacing * i, py = cy + dy * spacing * i;
    const rad = radius * (shrink ? 1 - t * 0.55 : 1);
    const x0 = Math.max(0, Math.floor(px - rad)), x1 = Math.min(w - 1, Math.ceil(px + rad));
    const y0 = Math.max(0, Math.floor(py - rad)), y1 = Math.min(h - 1, Math.ceil(py + rad));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - px, y - py);
        if (d > rad || d < rad * 0.82) continue;
        const f = 1 - Math.abs(d - rad * 0.91) / (rad * 0.09);
        blendAdd(data, w, h, x, y, r, g, b, Math.max(0, f) * intensity * (1 - t * 0.35));
      }
    }
  }
}


/** 把一張（可能已染色的）特效圖貼到緩衝上：支援旋轉、縮放、加法混合。 */
function drawSprite(data, w, h, img, cx, cy, scale, rot, intensity) {
  if (intensity <= 0.001 || scale <= 0) return;
  const sw = img.width, sh = img.height;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  // 目的範圍：旋轉後的包圍盒
  const half = Math.ceil(Math.hypot(sw, sh) * scale * 0.5) + 2;
  const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(w - 1, Math.ceil(cx + half));
  const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(h - 1, Math.ceil(cy + half));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // 反向旋轉回貼圖座標
      const dx = (x - cx) / scale, dy = (y - cy) / scale;
      const sx = dx * cos + dy * sin + sw / 2;
      const sy = -dx * sin + dy * cos + sh / 2;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;
      const ix = sx | 0, iy = sy | 0;
      const o = (iy * sw + ix) * 4;
      const a = (img.data[o + 3] / 255) * intensity;
      if (a <= 0.002) continue;
      blendAdd(data, w, h, x, y, img.data[o], img.data[o + 1], img.data[o + 2], a);
    }
  }
}

function drawSparks(data, w, h, cx, cy, count, radius, size, color, intensity, seed) {
  const r = rnd(seed);
  for (let i = 0; i < count; i++) {
    const ang = r() * Math.PI * 2;
    const dist = radius * (0.35 + r() * 0.65);
    const px = cx + Math.cos(ang) * dist;
    const py = cy + Math.sin(ang) * dist;
    drawGlow(data, w, h, px, py, size * (0.6 + r() * 0.8), color, intensity * (0.5 + r() * 0.5));
  }
}

// ── 主流程 ────────────────────────────────────────────────
const specPath = arg('spec');
if (!specPath) { console.error('需要 --spec <file>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const artPath = spec.art;
const art = PNG.sync.read(fs.readFileSync(artPath));
const AW = art.width, AH = art.height;

const PAD = spec.pad || { left: 0, right: 0, top: 0, bottom: 0 };
const OW = AW + PAD.left + PAD.right;
const OH = AH + PAD.top + PAD.bottom;

const [cols, rows] = spec.grid || [48, 62];
const srcVerts = buildGrid(AW, AH, cols, rows);

const boneDefs = Object.entries(spec.bones).map(([name, b]) => ({
  name,
  a: { x: b.a[0], y: b.a[1] },
  b: { x: b.b[0], y: b.b[1] },
}));
// 剛性區（砲、盾、鎧甲片）：整塊 100% 綁單一骨骼，否則平滑權重會把它拉成橡皮。
const rigid = (spec.rigid || []).map((r) => {
  const cap = r.capsule;
  if (!cap) return { bone: r.bone, test: () => false };
  const [ax, ay] = cap.a, [bx, by] = cap.b;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const L = Math.sqrt(L2);
  const nx = -dy / L, ny = dx / L;
  const w0 = cap.w0 ?? 60, w1 = cap.w1 ?? 60;
  return {
    bone: r.bone,
    test: (x, y) => {
      const px = x - ax, py = y - ay;
      const t = (px * dx + py * dy) / L2;
      if (t < -0.12 || t > 1.12) return false;
      const tt = Math.max(0, Math.min(1, t));
      const perp = Math.abs(px * nx + py * ny);
      return perp <= w0 + (w1 - w0) * tt;
    },
  };
});
const weights = autoWeights(srcVerts, boneDefs, { ...(spec.weights || { power: 12, eps: 40 }), rigid });

/** 把來源座標點用蒙皮矩陣變換（砲口就是這樣跟著骨骼跑）。 */
function skinPoint(pt, mats) {
  let x = 0, y = 0, wsum = 0;
  // 用最近的網格點權重近似該點的權重
  const gx = Math.max(0, Math.min(cols, Math.round((pt[0] / AW) * cols)));
  const gy = Math.max(0, Math.min(rows, Math.round((pt[1] / AH) * rows)));
  const w = weights[gy][gx];
  for (const name in w) {
    const k = w[name];
    const m = mats[name];
    if (!m || k < 1e-6) continue;
    x += k * (m.a * pt[0] + m.c * pt[1] + m.e);
    y += k * (m.b * pt[0] + m.d * pt[1] + m.f);
    wsum += k;
  }
  if (wsum < 1e-9) return { x: pt[0], y: pt[1] };
  return { x: x / wsum, y: y / wsum };
}

const previewOnly = flag('preview');
const outRoot = spec.out || path.join('public', 'elf-anim', spec.id);

function renderFrame(seq, fi) {
  const n = seq.frames;
  const time = n > 1 ? fi / (n - 1) : 0;

  // 1) 骨骼姿態
  const pose = {};
  for (const [bone, track] of Object.entries(seq.tracks || {})) {
    const s = sampleTrack(track, time);
    pose[bone] = { rot: s.rot ?? 0, tx: s.tx ?? 0, ty: s.ty ?? 0 };
  }
  const mats = boneMatrices(boneDefs, pose);
  const dstRaw = skinVerts(srcVerts, weights, mats);
  // 本體也要套用 pad 偏移，否則角色會貼在畫布左上角、與光效錨點錯開。
  const dst = dstRaw.map((row) => row.map((p) => ({ x: p.x + PAD.left, y: p.y + PAD.top })));

  // 2) 位移到輸出畫布
  const buf = rasterize(art.data, AW, AH, srcVerts, dst, OW, OH);
  // 本體另存一份：光效畫在另一張緩衝上，兩者分開才不會互相污染外框。
  const body = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  const fxBuf = Buffer.alloc(OW * OH * 4);

  // 3) 光效：全部錨在「變換後的砲口」
  const mz = spec.muzzle;
  if (mz && seq.fx) {
    const p = skinPoint(mz.point, mats);
    const mx = p.x + PAD.left, my = p.y + PAD.top;
    // 砲管方向：肩→砲口，經骨骼旋轉
    const shoulder = spec.bones[mz.bone].a;

    const rot = pose[mz.bone] ? pose[mz.bone].rot : 0;
    const baseDx = mz.point[0] - shoulder[0], baseDy = mz.point[1] - shoulder[1];
    const bl = Math.hypot(baseDx, baseDy) || 1;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const dx = (baseDx * cos - baseDy * sin) / bl;
    const dy = (baseDx * sin + baseDy * cos) / bl;
    // 素材與畫布都是圖片座標（y 向下），dy 不需翻轉。
    const dyScreen = dy;


    for (const fx of seq.fx) {
      const env = sampleTrack(fx.track, time);
      const k = env.k ?? 0;
      if (k <= 0.001) continue;
      const I = fx.intensity * k;
      if (fx.kind === 'glow') drawGlow(fxBuf, OW, OH, mx, my, fx.radius * k, fx.color, I);
      else if (fx.kind === 'beam') drawBeam(fxBuf, OW, OH, mx, my, dx, dyScreen, fx.length * k, fx.width * k, fx.color, I, true);
      else if (fx.kind === 'sparks') drawSparks(fxBuf, OW, OH, mx, my, fx.count || 18, fx.radius * k, fx.size || 6, fx.color, I, fi * 7919 + 13);
      else if (fx.kind === 'shock') drawShockwave(fxBuf, OW, OH, mx, my, fx.radius * k, (fx.thickness || 12) * k, fx.color, I);
      else if (fx.kind === 'arc') {
        // 電弧從砲口往外打，每幀重擲，看起來會跳動
        const r2 = rnd(fi * 31337 + 11);
        for (let i = 0; i < (fx.count || 3); i++) {
          const a = Math.atan2(dyScreen, dx) + (r2() - 0.5) * 1.5;
          const L = fx.length * k * (0.5 + r2() * 0.8);
          drawArc(fxBuf, OW, OH, mx, my, mx + Math.cos(a) * L, my + Math.sin(a) * L,
            9, fx.jitter || 26, fx.thickness || 2, fx.color, I, fi * 977 + i * 131);
        }
      } else if (fx.kind === 'debris') drawDebris(fxBuf, OW, OH, mx, my, fx.count || 26, fx.radius * k, fx.size || 22, fx.color, I, fi * 6151 + 3);
      else if (fx.kind === 'burst') drawBurst(fxBuf, OW, OH, mx, my, (fx.inner || 10) * k, fx.radius * k, fx.count || 14, fx.color, I, fi * 4423 + 5);
      else if (fx.kind === 'rings') drawRings(fxBuf, OW, OH, mx, my, dx, dy, fx.count || 5, (fx.spacing || 34) * k, (fx.radius || 46) * k, fx.color, I, true);
      else if (fx.kind === 'flash') flashScreen(fxBuf, OW, OH, fx.color, I);
      else if (fx.kind === 'sprite') {
        // 官方特效圖塊：魔法陣、光環、星芒、光刃。程式化畫不出這些細節。
        const tile = fx.tile ? fxTile(fx.tile) : null;
        if (tile) {
          const img = fx.tint ? tintFx(tile.img, fx.tint, fx.tintStrength ?? 1) : tile.img;
          const sc = (fx.scale || 1) * k;
          const rot = fx.rot ?? 0;
          // 相對炮口的位置（可隨骨骼旋轉）
          const ox = fx.offset ? fx.offset[0] * k : 0;
          const oy = fx.offset ? fx.offset[1] * k : 0;
          drawSprite(fxBuf, OW, OH, img, mx + ox, my + oy, sc, rot, I);
        }
      }
      else if (fx.kind === 'converge') {
        // 粒子從外圍往砲口收
        const r = rnd(fi * 104729 + 7);
        for (let i = 0; i < (fx.count || 24); i++) {
          const ang = r() * Math.PI * 2;
          const d0 = fx.radius * (1 - k * 0.85) * (0.5 + r() * 0.7);
          drawGlow(fxBuf, OW, OH, mx + Math.cos(ang) * d0, my + Math.sin(ang) * d0, (fx.size || 5) * (0.5 + r() * 0.7), fx.color, I);
        }
      }
    }
  }
  return { data: body, fx: fxBuf, w: OW, h: OH, grid: { srcVerts, dstVerts: dst } };
}

const previewDir = path.join('docs', 'custom-anim', 'preview', spec.id + '-skel');

if (previewOnly) {
  fs.mkdirSync(previewDir, { recursive: true });
  for (const [name, seq] of Object.entries(spec.sequences)) {
    const t0 = Date.now();
    // --all 輸出全部影格（做 GIF 用）；否則只抽關鍵影格。
    const picks = flag('all')
      ? new Set(Array.from({ length: seq.frames }, (_, i) => i))
      : new Set([0, Math.floor(seq.frames * 0.35), Math.floor(seq.frames * 0.5), Math.floor(seq.frames * 0.65), ...(seq.hits || []), seq.frames - 1]);
    for (const i of [...picks].filter((i) => i >= 0 && i < seq.frames).sort((a, b) => a - b)) {
      const f = renderFrame(seq, i);
      const png = new PNG({ width: f.w, height: f.h });
      // 本體與光效是兩張緩衝，預覽必須合成（加法混合）才看得到光束。
      // 深色底只是為了讓半透明光暈看得清楚；烘焙用的圖集不含這層底。
      const out = Buffer.alloc(f.w * f.h * 4);
      for (let p = 0; p < f.w * f.h; p++) {
        const o = p * 4;
        const ba = f.data[o + 3] / 255;
        // 背景：深藍灰，讓加法光效有東西可以疊
        let r = 14, g = 16, b = 24;
        r = f.data[o] * ba + r * (1 - ba);
        g = f.data[o + 1] * ba + g * (1 - ba);
        b = f.data[o + 2] * ba + b * (1 - ba);
        // 光效：加法疊上去
        const fa = f.fx[o + 3] / 255;
        r += f.fx[o] * fa; g += f.fx[o + 1] * fa; b += f.fx[o + 2] * fa;
        out[o] = Math.min(255, r); out[o + 1] = Math.min(255, g); out[o + 2] = Math.min(255, b);
        out[o + 3] = 255;
      }
      png.data = out;
      fs.writeFileSync(path.join(previewDir, name + '-f' + String(i).padStart(3, '0') + '.png'), PNG.sync.write(png));
      // 除錯：把 fx 緩衝單獨輸出
      if (process.env.DBG_DUMP && i === 30) {
        const fp = new PNG({ width: f.w, height: f.h });
        const fb = Buffer.alloc(f.w * f.h * 4);
        for (let q = 0; q < f.w * f.h; q++) {
          const o = q * 4;
          fb[o] = f.fx[o]; fb[o+1] = f.fx[o+1]; fb[o+2] = f.fx[o+2];
          fb[o+3] = 255;
        }
        fp.data = fb;
        fs.writeFileSync(path.join(previewDir, name + '-FXONLY-f' + String(i).padStart(3,'0') + '.png'), PNG.sync.write(fp));
        console.error('[dbg] fx dump written, sample at 637,485 =', f.fx[((485*f.w)+637)*4], f.fx[((485*f.w)+637)*4+1], f.fx[((485*f.w)+637)*4+2], f.fx[((485*f.w)+637)*4+3]);
      }

    }
    console.log('  ' + name.padEnd(8) + seq.frames + ' 幀  用時 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  console.log('\n預覽 → ' + previewDir);
  process.exit(0);
}

// ── 烘焙：與 build_custom_animation.mjs 相同的 atlas + manifest 契約 ──
function contentBox(data, w, h) {
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return [0, 0, 0, 0];
  return [minX, minY, maxX - minX + 1, maxY - minY + 1];
}

const framesBySeq = {};
for (const [name, seq] of Object.entries(spec.sequences)) {
  const list = [];
  for (let i = 0; i < seq.frames; i++) list.push(renderFrame(seq, i));
  framesBySeq[name] = list;
  process.stdout.write('  ' + name.padEnd(8) + list.length + ' 幀\n');
}

// 本體逐幀存格。
// 舊流程只存 standby 第 0 幀一格，等於整段動畫都用同一張靜態圖 ——
// 骨骼形變算得再準，畫面上本體也一動不動。
// 本體只裁一格：standby 第 0 幀的內容框。所有影格共用這張貼圖，
// 形變交給逐幀網格頂點 —— 圖集不會隨幀數膨脹。
const restFrame = framesBySeq.standby[0];
const charBox = contentBox(restFrame.data, OW, OH);
const charCrop = Buffer.alloc(charBox[2] * charBox[3] * 4);
for (let y = 0; y < charBox[3]; y++) {
  const srcOff = ((charBox[1] + y) * OW + charBox[0]) * 4;
  restFrame.data.copy(charCrop, y * charBox[2] * 4, srcOff, srcOff + charBox[2] * 4);
}
console.log("  本體格 1（共用）");

// 光效格：先挖掉本體區域，再只取「光效自己的」外框。
// 關鍵是外框必須只算光效像素，不能算整幀 —— 否則每格都接近全畫布，圖集會爆掉。
const fxCells = [];
for (const name of Object.keys(framesBySeq)) {
  framesBySeq[name].forEach((f, i) => {
    // 光效已經畫在獨立緩衝上，直接取它的外框即可。
    const box = contentBox(f.fx, OW, OH);
    if (!box[2]) return;
    // 光效格降採樣：光暈柔和，縮小視覺幾乎無差，圖集面積少 FX_SCALE^2。
    const sw = Math.max(1, Math.round(box[2] * FX_SCALE));
    const sh = Math.max(1, Math.round(box[3] * FX_SCALE));
    const cell = Buffer.alloc(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      const sy = box[1] + Math.min(box[3] - 1, Math.floor(y / FX_SCALE));
      for (let x = 0; x < sw; x++) {
        const sx = box[0] + Math.min(box[2] - 1, Math.floor(x / FX_SCALE));
        const si = (sy * OW + sx) * 4, di = (y * sw + x) * 4;
        cell[di] = f.fx[si]; cell[di + 1] = f.fx[si + 1];
        cell[di + 2] = f.fx[si + 2]; cell[di + 3] = f.fx[si + 3];
      }
    }
    fxCells.push({ name, i, box, cell, sw, sh, at: null });
  });
}
console.log('  光效格 ' + fxCells.length);

// 貨架打包
const MAXS = 4096;
// 本體只存一格（README 原則）：所有影格共用同一張貼圖，形變靠逐幀頂點。
const cells = [
  { w: charBox[2], h: charBox[3], data: charCrop, kind: 'char' },
  ...fxCells.map((c) => ({ w: c.sw, h: c.sh, data: c.cell, kind: 'fx', ref: c }))];
let shelfY = 0, shelfH = 0, curX = 0, atlasW = 0;
const placed = [];
for (const c of cells) {
  if (curX + c.w > MAXS) { shelfY += shelfH; shelfH = 0; curX = 0; }
  c.at = { x: curX, y: shelfY };
  curX += c.w; shelfH = Math.max(shelfH, c.h); atlasW = Math.max(atlasW, curX);
  placed.push(c);
}
// 打包完才把 at 寫回 fxCells，manifest 才拿得到 UV。
for (const c of placed) if (c.ref) c.ref.at = c.at;
const atlasH = shelfY + shelfH;
const atlas = Buffer.alloc(atlasW * atlasH * 4);
for (const c of placed) {
  for (let y = 0; y < c.h; y++) {
    const srcOff = y * c.w * 4;
    const dstOff = ((c.at.y + y) * atlasW + c.at.x) * 4;
    c.data.copy(atlas, dstOff, srcOff, srcOff + c.w * 4);
  }
}
const outDir = path.join('public', 'elf-anim', spec.id);
fs.mkdirSync(outDir, { recursive: true });
const atlasPng = new PNG({ width: atlasW, height: atlasH });
atlasPng.data = atlas;
fs.writeFileSync(path.join(outDir, 'atlas.png'), PNG.sync.write(atlasPng));

const PPU = 100;
// y 軸翻轉以「輸出畫布」為準（OH），不是圖集高度 —— 圖集只是存放空間。
const toWY = (y) => (OH - y) / PPU;
// UV 一律「左上原點、v 向下遞增」的圖片座標，最後轉成播放器要的 [u0,v0,u1,v1]。
// 注意 box 是 [x,y,w,h]：高度在 box[3]，寬度在 box[2]，不要跟 at（圖集偏移）混用。
function uvOf(box, at, sw, sh) {
  // 光效格已降採樣（sw×sh），UV 必須用實際格子尺寸，不能用原始 box 尺寸，
  // 否則 UV 會超出 1.0、貼圖採樣到圖集外。
  const w = sw ?? box[2], h = sh ?? box[3];
  const x0 = at.x, y0 = at.y;
  return [x0 / atlasW, y0 / atlasH, (x0 + w) / atlasW, (y0 + h) / atlasH];
}

// 把一幀的蒙皮網格轉成「一張貼圖 + 逐幀頂點」。
// 每個格子都對應原圖同一塊區域，頂點隨骨骼移動 → 真正的形變，不是拉伸整張圖。
let charUvRef = () => [0, 0, 1, 1];
let charBoxRef = () => ({ x: 0, y: 0, w: AW, h: AH });
function bodyGrid(seqName, fi, charUv) {
  const [cu0, cv0, cu1, cv1] = charUv;
  const cuW = cu1 - cu0, cuH = cv1 - cv0;
  const CB = charBoxRef();
  const f = framesBySeq[seqName] && framesBySeq[seqName][fi];
  if (!f || !f.grid) return null;
  const out = [];
  const { srcVerts, dstVerts } = f.grid;
  const rows = srcVerts.length - 1, cols = srcVerts[0].length - 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const S00 = srcVerts[r][c], S10 = srcVerts[r][c + 1];
      const S11 = srcVerts[r + 1][c + 1], S01 = srcVerts[r + 1][c];
      const P00 = dstVerts[r][c], P10 = dstVerts[r][c + 1];
      const P11 = dstVerts[r + 1][c + 1], P01 = dstVerts[r + 1][c];
      // 退化格子（面積為 0）直接跳過，避免產生破圖三角形。
      const area = Math.abs((P10.x - P00.x) * (P01.y - P00.y) - (P01.x - P00.x) * (P10.y - P00.y));
      if (area < 1e-6) continue;
      out.push({
        p: [P00.x / PPU, toWY(P00.y), P10.x / PPU, toWY(P10.y),
            P11.x / PPU, toWY(P11.y), P01.x / PPU, toWY(P01.y)],
        // UV 必須落在「圖集裡的角色格」內，不能直接用原圖座標：
        // 圖集寬 4082、原圖寬 1086，直接除會取樣到別的格子（破圖、白色條紋）。
        // 先把原圖座標正規化到 0..1，再映射進 character.uv 的範圍。
        // 貼圖只包含 standby[0] 的內容框（charBox），不是整張原圖。
        // UV 必須先扣掉 charBox 原點、再除以 charBox 尺寸，然後才映射進圖集格。
        u: [
          cu0 + ((S00.x - CB.x) / CB.w) * cuW, cv0 + ((S00.y - CB.y) / CB.h) * cuH,
          cu0 + ((S10.x - CB.x) / CB.w) * cuW, cv0 + ((S10.y - CB.y) / CB.h) * cuH,
          cu0 + ((S11.x - CB.x) / CB.w) * cuW, cv0 + ((S11.y - CB.y) / CB.h) * cuH,
          cu0 + ((S01.x - CB.x) / CB.w) * cuW, cv0 + ((S01.y - CB.y) / CB.h) * cuH,
        ],
      });
    }
  }
  return out;
}
const manifestCharUv = uvOf(charBox, placed.find((c) => c.kind === 'char')?.at || placed[0].at, charBox[2], charBox[3]);
charUvRef = () => manifestCharUv;
charBoxRef = () => ({ x: charBox[0], y: charBox[1], w: charBox[2], h: charBox[3] });
const sequences = {};
for (const [name, list] of Object.entries(framesBySeq)) {
  const seq = spec.sequences[name];
  const quads = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    // 本體四邊形：固定 atlas 格，位置隨骨骼。
    // 世界座標一律「像素 / pixelsPerUnit」—— 播放器把頂點當 Unity 單位，
    // 漏了這個除法整張圖會被放大 100 倍拉成條紋。
    // 本體：貼圖永遠是同一張原始立繪，形變只靠「逐幀網格頂點」。
    // 這是官方 .pet 的做法：一張圖集 + 每幀不同頂點，圖集不會隨幀數膨脹。
    // 逐幀烘焙位圖雖然能動，但 182 幀會讓圖集爆到 100MB+，而且只是整體拉伸。
    const bq = {
      g: bodyGrid(name, i, charUvRef()),
      a: 1,
      buv: manifestCharUv,
    };
    const fx = fxCells.find((c) => c.name === name && c.i === i);
    if (fx) {
      // customPetClip 的 quad() 取 f[1] 當 y0、f[5] 當 y1，且要求 y0 < y1。
      // Unity 座標 y 向上 → 上緣的 y 較大，所以 f[1] 必須放下緣、f[5] 放上緣。
      const fyTop = toWY(fx.box[1]);              // 上緣（y 較大）
      const fyBot = toWY(fx.box[1] + fx.box[3]);  // 下緣（y 較小）
      const fxL = fx.box[0] / PPU, fxR = (fx.box[0] + fx.box[2]) / PPU;
      bq.f = [fxL, fyBot, fxR, fyBot, fxR, fyTop, fxL, fyTop];
      bq.fuv = uvOf(fx.box, fx.at, fx.sw, fx.sh);
    }
    quads.push(bq);
  }
  sequences[name] = { frames: list.length, hits: seq.hits || [], loop: name === 'standby', quads };
}

const manifest = {
  id: spec.id, elfId: spec.elfId || null, elfName: spec.elfName || spec.id,
  fps: 24, facing: spec.facing || 'right',
  canvas: [atlasW, atlasH], pixelsPerUnit: PPU,
  atlas: { file: 'atlas.png', width: atlasW, height: atlasH },
  character: { uv: manifestCharUv, size: [charBox[2], charBox[3]] },
  sequences,
};
const bytes = fs.readFileSync(path.join(outDir, 'atlas.png'));
manifest.size = bytes.length;
manifest.sha256 = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
console.log('  圖集 ' + atlasW + 'x' + atlasH + '  ' + (bytes.length / 1048576).toFixed(2) + ' MB → ' + outDir);

