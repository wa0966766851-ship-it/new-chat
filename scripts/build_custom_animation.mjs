#!/usr/bin/env node
/**
 * 自製動作素材骨架：把一份「動作腳本（spec.json）」烘焙成逐幀 PNG。
 *
 * 為什麼是逐幀 PNG：官方 .pet 是 Unity SWF，我們沒有工具鏈產出。
 * 但播放器真正需要的只是「每個影格一張圖 + 命中幀」。逐幀 PNG 完全能滿足，
 * 而且美術只要交一張立繪，動作由腳本描述（位移／縮放／旋轉／透明度／加算光效）。
 *
 * 用法：
 *   node scripts/build_custom_animation.mjs --spec docs/custom-anim/zhuixing.spec.json
 *   node scripts/build_custom_animation.mjs --spec ... --preview   # 只出關鍵影格聯絡表
 *   node scripts/build_custom_animation.mjs --spec ... --out public/elf-anim
 *
 * 輸出：
 *   <out>/<id>/<seq>/f000.png …
 *   <out>/<id>/manifest.json  （序列、影格數、命中幀、fps、每張 sha256）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { PNG } = req('pngjs');

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);

// ── 緩動 ────────────────────────────────────────────────
const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  /** 蓄力：先慢後快，用於「聚集」階段 */
  charge: (t) => t * t * t,
  /** 出擊：瞬間衝出再回穩，用於開火與後座力 */
  snap: (t) => 1 - Math.pow(1 - t, 4),
  /** 過衝：超過目標再彈回，用於受擊 */
  back: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

function lerp(a, b, t) { return a + (b - a) * t; }

/** 依時間在關鍵影格之間插值；找不到前後影格時夾住端點。 */
function sampleTrack(track, time) {
  if (!track || !track.length) return { x: 0, y: 0, scale: 1, rotate: 0, alpha: 1 };
  const sorted = track;
  if (time <= sorted[0].t) return normalizeKey(sorted[0]);
  const last = sorted[sorted.length - 1];
  if (time >= last.t) return normalizeKey(last);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (time < a.t || time > b.t) continue;
    const span = b.t - a.t || 1;
    const raw = (time - a.t) / span;
    const ease = EASE[b.ease || a.ease || 'linear'] || EASE.linear;
    const t = ease(raw);
    const A = normalizeKey(a), B = normalizeKey(b);
    return {
      x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t),
      scale: lerp(A.scale, B.scale, t), rotate: lerp(A.rotate, B.rotate, t),
      alpha: lerp(A.alpha, B.alpha, t),
    };
  }
  return normalizeKey(last);
}

function normalizeKey(k) {
  return { x: k.x || 0, y: k.y || 0, scale: k.scale == null ? 1 : k.scale, rotate: k.rotate || 0, alpha: k.alpha == null ? 1 : k.alpha };
}

// ── 像素合成 ─────────────────────────────────────────────
function makeCanvas(w, h) { return { w, h, data: Buffer.alloc(w * h * 4) }; }

/** 把一張圖依 transform 疊上去；blend=add 走加算（光效用）。 */
function drawImage(canvas, src, tf, blend) {
  const cx = src.width / 2, cy = src.height / 2;
  const rad = (tf.rotate || 0) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const s = tf.scale || 1;
  const ox = canvas.w / 2 + tf.x, oy = canvas.h / 2 + tf.y;
  const halfDiag = Math.hypot(src.width, src.height) * s / 2;
  const x0 = Math.max(0, Math.floor(ox - halfDiag)), x1 = Math.min(canvas.w, Math.ceil(ox + halfDiag));
  const y0 = Math.max(0, Math.floor(oy - halfDiag)), y1 = Math.min(canvas.h, Math.ceil(oy + halfDiag));
  const alpha = tf.alpha == null ? 1 : tf.alpha;
  if (alpha <= 0) return;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
      // 反向旋轉回來源座標
      const rx = (dx * cos + dy * sin) / s + cx;
      const ry = (-dx * sin + dy * cos) / s + cy;
      if (rx < 0 || ry < 0 || rx >= src.width || ry >= src.height) continue;
      const si = ((ry | 0) * src.width + (rx | 0)) * 4;
      const sa = src.data[si + 3] / 255 * alpha;
      if (sa <= 0.004) continue;
      const di = (y * canvas.w + x) * 4;
      const sr = src.data[si], sg = src.data[si + 1], sb = src.data[si + 2];
      if (blend === 'add') {
        canvas.data[di] = Math.min(255, canvas.data[di] + sr * sa);
        canvas.data[di + 1] = Math.min(255, canvas.data[di + 1] + sg * sa);
        canvas.data[di + 2] = Math.min(255, canvas.data[di + 2] + sb * sa);
        canvas.data[di + 3] = Math.min(255, canvas.data[di + 3] + 255 * sa);
      } else {
        const da = canvas.data[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        canvas.data[di] = (sr * sa + canvas.data[di] * da * (1 - sa)) / oa;
        canvas.data[di + 1] = (sg * sa + canvas.data[di + 1] * da * (1 - sa)) / oa;
        canvas.data[di + 2] = (sb * sa + canvas.data[di + 2] * da * (1 - sa)) / oa;
        canvas.data[di + 3] = oa * 255;
      }
    }
  }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#ffffff');
  const v = m ? parseInt(m[1], 16) : 0xffffff;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** 程序化光暈：不需要美術素材，直接畫徑向漸層。 */
function drawGlow(canvas, layer, tf) {
  const [r, g, b] = hexToRgb(layer.color);
  const radius = (layer.radius || 120) * (tf.scale || 1);
  const ox = canvas.w / 2 + tf.x, oy = canvas.h / 2 + tf.y;
  const power = layer.power == null ? 2.2 : layer.power;
  const alpha = tf.alpha == null ? 1 : tf.alpha;
  if (alpha <= 0) return;
  for (let y = Math.max(0, Math.floor(oy - radius)); y < Math.min(canvas.h, Math.ceil(oy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(ox - radius)); x < Math.min(canvas.w, Math.ceil(ox + radius)); x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / radius;
      if (d >= 1) continue;
      const a = Math.pow(1 - d, power) * alpha;
      if (a <= 0.004) continue;
      const di = (y * canvas.w + x) * 4;
      canvas.data[di] = Math.min(255, canvas.data[di] + r * a);
      canvas.data[di + 1] = Math.min(255, canvas.data[di + 1] + g * a);
      canvas.data[di + 2] = Math.min(255, canvas.data[di + 2] + b * a);
      canvas.data[di + 3] = Math.min(255, canvas.data[di + 3] + 255 * a);
    }
  }
}

/** 程序化光環：環狀描邊，用於蓄力時的能量圈。 */
function drawRing(canvas, layer, tf) {
  const [r, g, b] = hexToRgb(layer.color);
  const radius = (layer.radius || 90) * (tf.scale || 1);
  const width = layer.width || 4;
  const ox = canvas.w / 2 + tf.x, oy = canvas.h / 2 + tf.y;
  const alpha = tf.alpha == null ? 1 : tf.alpha;
  if (alpha <= 0) return;
  for (let y = Math.max(0, Math.floor(oy - radius - width)); y < Math.min(canvas.h, Math.ceil(oy + radius + width)); y++) {
    for (let x = Math.max(0, Math.floor(ox - radius - width)); x < Math.min(canvas.w, Math.ceil(ox + radius + width)); x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      const a = Math.max(0, 1 - Math.abs(d - radius) / width) * alpha;
      if (a <= 0.004) continue;
      const di = (y * canvas.w + x) * 4;
      canvas.data[di] = Math.min(255, canvas.data[di] + r * a);
      canvas.data[di + 1] = Math.min(255, canvas.data[di + 1] + g * a);
      canvas.data[di + 2] = Math.min(255, canvas.data[di + 2] + b * a);
      canvas.data[di + 3] = Math.min(255, canvas.data[di + 3] + 255 * a);
    }
  }
}

/** 程序化粒子：固定種子，確保每次烘焙結果一致（可重現）。 */
function drawSparks(canvas, layer, tf, frame, seed) {
  const [r, g, b] = hexToRgb(layer.color);
  const count = layer.count || 24;
  const speed = layer.speed == null ? 1 : layer.speed;
  const spread = layer.spread || 160;
  const ox = canvas.w / 2 + tf.x, oy = canvas.h / 2 + tf.y;
  const alpha = tf.alpha == null ? 1 : tf.alpha;
  if (alpha <= 0) return;
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = spread * speed * (0.25 + rnd() * 0.75) * (0.4 + frame / 12);
    const px = ox + Math.cos(ang) * dist;
    const py = oy + Math.sin(ang) * dist;
    const rad = 1 + rnd() * 2.2;
    const a = alpha * (1 - Math.min(1, frame / 14));
    if (a <= 0.004) continue;
    for (let y = Math.floor(py - rad); y <= Math.ceil(py + rad); y++) {
      for (let x = Math.floor(px - rad); x <= Math.ceil(px + rad); x++) {
        if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) continue;
        if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > rad) continue;
        const di = (y * canvas.w + x) * 4;
        canvas.data[di] = Math.min(255, canvas.data[di] + r * a);
        canvas.data[di + 1] = Math.min(255, canvas.data[di + 1] + g * a);
        canvas.data[di + 2] = Math.min(255, canvas.data[di + 2] + b * a);
        canvas.data[di + 3] = Math.min(255, canvas.data[di + 3] + 255 * a);
      }
    }
  }
}

/** 程序化光束：沿 -x（朝右攻擊）方向的錐形，用於「轟出去」。 */
function drawBeam(canvas, layer, tf) {
  const [r, g, b] = hexToRgb(layer.color);
  const length = (layer.length || 420) * (tf.scale || 1);
  const width = layer.width || 40;
  const ox = canvas.w / 2 + tf.x, oy = canvas.h / 2 + tf.y;
  const alpha = tf.alpha == null ? 1 : tf.alpha;
  if (alpha <= 0) return;
  const dir = layer.dir === 'left' ? -1 : 1;
  for (let i = 0; i < length; i++) {
    const x = ox + dir * i;
    if (x < 0 || x >= canvas.w) continue;
    const taper = 1 - i / length;
    const halfW = width * taper * 0.5;
    const a = alpha * Math.pow(taper, 1.4);
    if (a <= 0.004) continue;
    for (let y = Math.floor(oy - halfW); y <= Math.ceil(oy + halfW); y++) {
      if (y < 0 || y >= canvas.h) continue;
      const edge = 1 - Math.abs(y + 0.5 - oy) / Math.max(1, halfW);
      const aa = a * Math.max(0, edge);
      if (aa <= 0.004) continue;
      const di = (y * canvas.w + Math.floor(x)) * 4;
      canvas.data[di] = Math.min(255, canvas.data[di] + r * aa);
      canvas.data[di + 1] = Math.min(255, canvas.data[di + 1] + g * aa);
      canvas.data[di + 2] = Math.min(255, canvas.data[di + 2] + b * aa);
      canvas.data[di + 3] = Math.min(255, canvas.data[di + 3] + 255 * aa);
    }
  }
}

// ── 主流程 ───────────────────────────────────────────────
const specPath = arg('spec');
if (!specPath) {
  console.error('用法：node scripts/build_custom_animation.mjs --spec <spec.json> [--out <dir>] [--preview] [--scale 0.5]');
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outRoot = arg('out', path.join('build', 'legacy-custom-animation'));
const resolvedOutput=path.resolve(outRoot),publicRoot=path.resolve('public');
if(resolvedOutput===publicRoot||resolvedOutput.startsWith(publicRoot+path.sep))throw Error('舊動畫產生器只能輸出草稿；請使用 publish_custom_animation.mjs 檢查、備份及更新登記表，避免覆蓋新版姿勢動畫。');
const K = Number(arg('scale', String(spec.scale ?? 0.5))) || 0.5;
const previewOnly = flag('preview');

// spec 一律以「角色朝畫面右」撰寫（特效往右射）。立繪實際朝左時，把「動作」鏡射到左邊，
// 立繪本身不動 —— 這樣動畫與靜態圖朝向一致，切換演出模式不會突然轉身。
const mirrorX = spec.facing === 'left';

const sourcePath = spec.source;
if (!fs.existsSync(sourcePath)) { console.error('找不到來源立繪：' + sourcePath); process.exit(2); }
const basePng = PNG.sync.read(fs.readFileSync(sourcePath));

// 畫布可以比立繪大：出招的光束／粒子需要往外延伸的空間。立繪貼在 (padLeft, padTop)。
const pad = spec.pad || {};
const padL = Math.round((pad.left || 0) * K), padR = Math.round((pad.right || 0) * K);
const padT = Math.round((pad.top || 0) * K), padB = Math.round((pad.bottom || 0) * K);
const srcW = Math.round(basePng.width * K), srcH = Math.round(basePng.height * K);
const canvasW = Math.max(1, srcW + padL + padR);
const canvasH = Math.max(1, srcH + padT + padB);
const scaledBase = downscale(basePng, srcW, srcH);
// 立繪中心相對畫布中心的位移；spec 的座標仍以立繪中心為原點。
const baseOX = padL + srcW / 2 - canvasW / 2;
const baseOY = padT + srcH / 2 - canvasH / 2;

function downscale(p, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const x0 = Math.floor(x * p.width / tw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * p.width / tw));
    const y0 = Math.floor(y * p.height / th), y1 = Math.max(y0 + 1, Math.floor((y + 1) * p.height / th));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * p.width + xx) * 4;
      const pa = p.data[i + 3] / 255;
      r += p.data[i] * pa; g += p.data[i + 1] * pa; b += p.data[i + 2] * pa; a += pa; n++;
    }
    const o = (y * tw + x) * 4;
    const oa = a / n;
    if (oa <= 0) { out[o + 3] = 0; continue; }
    out[o] = Math.min(255, r / a); out[o + 1] = Math.min(255, g / a); out[o + 2] = Math.min(255, b / a);
    out[o + 3] = Math.round(oa * 255);
  }
  return { width: tw, height: th, data: out };
}

/** spec 的幾何量以「原始立繪像素」為單位，這裡統一乘上縮放倍率。 */
function scaleLayer(layer) {
  const l = { ...layer };
  for (const k of ['radius', 'width', 'length', 'spread']) if (typeof l[k] === 'number') l[k] *= K;
  const sx = mirrorX ? -K : K;
  l.track = (layer.track || []).map((key) => {
    const o = { ...key };
    o.x = (key.x || 0) * sx;
    o.y = (key.y || 0) * K;
    return o;
  });
  if (l.dir) l.dir = mirrorX ? (l.dir === 'left' ? 'right' : 'left') : l.dir;
  return l;
}

/** 只畫非 sprite 的光效圖層；角色本體另外處理（全部影格共用一格）。 */
function renderFx(seq, frameIndex) {
  const canvas = makeCanvas(canvasW, canvasH);
  for (const layer of seq.layers || []) {
    if (!layer.kind || layer.kind === 'sprite') continue;
    const l = scaleLayer(layer);
    const tf = sampleTrack(l.track, frameIndex);
    if (l.kind === 'glow') drawGlow(canvas, l, tf);
    else if (l.kind === 'ring') drawRing(canvas, l, tf);
    else if (l.kind === 'spark') drawSparks(canvas, l, tf, frameIndex, l.seed || 12345);
    else if (l.kind === 'beam') drawBeam(canvas, l, tf);
  }
  return canvas;
}

function renderFull(seq, frameIndex) {
  const canvas = renderFx(seq, frameIndex);
  for (const layer of seq.layers || []) {
    if (layer.kind && layer.kind !== 'sprite') continue;
    const l = scaleLayer(layer);
    const tf = sampleTrack(l.track, frameIndex);
    drawImage(canvas, scaledBase, { ...tf, x: tf.x + baseOX, y: tf.y + baseOY }, l.blend);
  }
  return canvas;
}

/** 內容框：alpha>8 的最小外接矩形；全透明的影格回傳整格。 */
function contentBox(canvas) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < canvas.h; y++) {
    const row = y * canvas.w * 4;
    for (let x = 0; x < canvas.w; x++) {
      if (canvas.data[row + x * 4 + 3] <= 8) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  return [minX, minY, maxX - minX + 1, maxY - minY + 1];
}

const previewDir = path.join('docs', 'custom-anim', 'preview');
const targetDir = path.join(outRoot, spec.id);

function previewPicks(count, hits) {
  const set = new Set([0, Math.floor(count * 0.25), Math.floor(count * 0.5), Math.floor(count * 0.75), count - 1, ...(hits || [])]);
  return [...set].filter((i) => i >= 0 && i < count).sort((a, b) => a - b);
}

/** 把整段序列烘成一張 GIF：關鍵影格看不出「動起來」對不對，GIF 才看得出。 */
async function writeGif(seqName, seq, file) {
  // gifenc 是 CJS：ESM 匯入後真正的東西在 default 上（Node 的 CJS 互操作）。
  const mod = await import('gifenc');
  const { GIFEncoder, quantize, applyPalette } = (mod.default ?? mod);
  const gif = GIFEncoder();
  const delay = Math.round(1000 / (spec.fps || 24));
  // GIF 只為人眼預覽，縮到 360px 高就夠；原尺寸會到 8–10 MB。
  const targetH = Number(arg('gif-height', '360')) || 360;
  for (let i = 0; i < seq.frames; i++) {
    const c = renderFull(seq, i);
    const shrink = Math.min(1, targetH / c.h);
    const w = Math.max(1, Math.round(c.w * shrink)), h = Math.max(1, Math.round(c.h * shrink));
    const rgba = new Uint8ClampedArray(w * h * 4);
    // GIF 沒有 alpha：合成到深色底上，跟戰鬥畫面一致
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = Math.min(c.w - 1, Math.floor(x / shrink)), sy = Math.min(c.h - 1, Math.floor(y / shrink));
      const si = (sy * c.w + sx) * 4, di = (y * w + x) * 4;
      const a = c.data[si + 3] / 255;
      rgba[di] = Math.round(c.data[si] * a + 18 * (1 - a));
      rgba[di + 1] = Math.round(c.data[si + 1] * a + 20 * (1 - a));
      rgba[di + 2] = Math.round(c.data[si + 2] * a + 28 * (1 - a));
      rgba[di + 3] = 255;
    }
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), w, h, { palette, delay, repeat: 0 });
  }
  gif.finish();
  fs.writeFileSync(file, Buffer.from(gif.bytes()));
  return fs.statSync(file).size;
}

// ── 預覽 ─────────────────────────────────────────────────
if (previewOnly) {
  for (const [seqName, seq] of Object.entries(spec.sequences)) {
    const dir = path.join(previewDir, spec.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const i of previewPicks(seq.frames, seq.hits)) {
      const canvas = renderFull(seq, i);
      fs.writeFileSync(path.join(dir, seqName + '-f' + String(i).padStart(3, '0') + '.png'),
        PNG.sync.write({ width: canvas.w, height: canvas.h, data: canvas.data }));
    }
    let gifNote = '';
    if (!flag('no-gif')) {
      try {
        const bytes = await writeGif(seqName, seq, path.join(dir, seqName + '.gif'));
        gifNote = '，GIF ' + (bytes / 1048576).toFixed(2) + ' MB';
      } catch (e) {
        gifNote = '，GIF 失敗：' + e.message;
      }
    }
    console.log('  ' + seqName.padEnd(10) + seq.frames + ' 幀' + (seq.hits && seq.hits.length ? '，命中 ' + seq.hits.join(',') : '') + '（預覽' + gifNote + '）');
  }
  console.log('\n預覽影格 → ' + path.join(previewDir, spec.id));
  process.exit(0);
}

// ── 烘焙 ─────────────────────────────────────────────────
// 關鍵設計：**角色本體只佔圖集一格，所有影格共用**。
// 位移／縮放靠每幀四邊形的頂點座標（mesh positions 本來就逐幀不同），
// 透明度靠逐頂點 mulColor；只有「光效」逐幀不同、才各佔一格。
// 這樣 126 幀不會變成 126 份角色貼圖（那是 97 MB），而是一份角色 + 126 份小光效。
const MAX_SIDE = 4096;

// 1) 角色本體：取第一段序列的第一個 sprite 圖層，畫在它自己的靜止狀態。
const firstSeq = spec.sequences[Object.keys(spec.sequences)[0]];
const spriteLayers = (firstSeq.layers || []).filter((l) => !l.kind || l.kind === 'sprite');
if (!spriteLayers.length) { console.error('spec 缺少 sprite 圖層'); process.exit(2); }
const charCanvas = makeCanvas(canvasW, canvasH);
for (const layer of spriteLayers) {
  const l = scaleLayer(layer);
  drawImage(charCanvas, scaledBase, { x: baseOX, y: baseOY, scale: 1, rotate: 0, alpha: 1 }, l.blend);
}
const charBox = contentBox(charCanvas);

// 2) 每個影格：只算光效，並記下本體變換。
const entries = [];
for (const [seqName, seq] of Object.entries(spec.sequences)) {
  const spriteTrack = ((seq.layers || []).filter((l) => !l.kind || l.kind === 'sprite')[0] || {}).track;
  const scaledSpriteTrack = spriteTrack ? scaleLayer({ track: spriteTrack }).track : [];
  for (let i = 0; i < seq.frames; i++) {
    const fxCanvas = renderFx(seq, i);
    entries.push({
      seq: seqName, index: i, fxCanvas, fxBox: contentBox(fxCanvas),
      tf: sampleTrack(scaledSpriteTrack, i),
    });
  }
}

// 3) 貨架式打包：角色格排第一，其後是逐幀光效格。
let cursorX = 0, cursorY = 0, shelfH = 0, sheetW = 0;
function place(w, h) {
  if (cursorX + w > MAX_SIDE) { cursorX = 0; cursorY += shelfH; shelfH = 0; }
  const at = [cursorX, cursorY];
  cursorX += w; shelfH = Math.max(shelfH, h); sheetW = Math.max(sheetW, cursorX);
  return at;
}
const charAt = place(charBox[2], charBox[3]);
for (const e of entries) e.at = place(Math.max(1, e.fxBox[2]), Math.max(1, e.fxBox[3]));
const sheetH = cursorY + shelfH;
const sheet = makeCanvas(sheetW, sheetH);

function blit(src, box, at) {
  const [bx, by, bw, bh] = box;
  if (bw <= 0 || bh <= 0) return;
  const [ax, ay] = at;
  for (let y = 0; y < bh; y++) {
    const from = ((by + y) * src.w + bx) * 4;
    src.data.copy(sheet.data, ((ay + y) * sheetW + ax) * 4, from, from + bw * 4);
  }
}
blit(charCanvas, charBox, charAt);
for (const e of entries) blit(e.fxCanvas, e.fxBox, e.at);

const atlasPng = PNG.sync.write({ width: sheetW, height: sheetH, data: sheet.data });
const PPU = 100;
const toWorldY = (y) => (canvasH - y) / PPU;
const uvOf = (box, at) => [at[0] / sheetW, at[1] / sheetH, (at[0] + box[2]) / sheetW, (at[1] + box[3]) / sheetH];

// 角色本體格相對立繪中心的四邊（未縮放，畫布像素）
const charRel = {
  dx0: charBox[0] - baseOX, dx1: charBox[0] + charBox[2] - baseOX,
  dy0: charBox[1] - baseOY, dy1: charBox[1] + charBox[3] - baseOY,
};

const manifest = {
  id: spec.id, elfId: spec.elfId, elfName: spec.elfName,
  fps: spec.fps || 24, facing: spec.facing || 'right',
  canvas: [canvasW, canvasH], pixelsPerUnit: PPU,
  atlas: { file: 'atlas.png', width: sheetW, height: sheetH },
  character: { uv: uvOf(charBox, charAt), size: [charBox[2], charBox[3]] },
  sha256: crypto.createHash('sha256').update(atlasPng).digest('hex'),
  size: atlasPng.length,
  sequences: {},
};

for (const seqName of Object.keys(spec.sequences)) {
  const seq = spec.sequences[seqName];
  const mine = entries.filter((e) => e.seq === seqName);
  manifest.sequences[seqName] = {
    frames: mine.length,
    hits: seq.hits || [],
    loop: !!seq.loop,
    quads: mine.map((e) => {
      const s = e.tf.scale || 1;
      const cx = baseOX + (e.tf.x || 0), cy = baseOY + (e.tf.y || 0);
      const L = cx + charRel.dx0 * s, R = cx + charRel.dx1 * s;
      const T = cy + charRel.dy0 * s, B = cy + charRel.dy1 * s;
      const q = {
        // 角色四邊形：左上、右上、右下、左下（世界座標，y 向上）
        c: [L / PPU, toWorldY(T), R / PPU, toWorldY(T), R / PPU, toWorldY(B), L / PPU, toWorldY(B)],
        // 本體透明度（受擊閃爍、出招淡出）
        a: e.tf.alpha == null ? 1 : e.tf.alpha,
      };
      if (e.fxBox[2] > 0 && e.fxBox[3] > 0) {
        const [bx, by, bw, bh] = e.fxBox;
        q.f = [bx / PPU, toWorldY(by), (bx + bw) / PPU, toWorldY(by), (bx + bw) / PPU, toWorldY(by + bh), bx / PPU, toWorldY(by + bh)];
        q.fuv = uvOf(e.fxBox, e.at);
      }
      return q;
    }),
  };
  console.log('  ' + seqName.padEnd(10) + mine.length + ' 幀' + (seq.hits && seq.hits.length ? '，命中 ' + seq.hits.join(',') : ''));
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, 'atlas.png'), atlasPng);
fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest));
console.log('\n圖集 ' + sheetW + '×' + sheetH + '（角色 1 格 + 光效 ' + entries.length + ' 格，' + (atlasPng.length / 1048576).toFixed(2) + ' MB）');
console.log('已輸出 → ' + targetDir);
