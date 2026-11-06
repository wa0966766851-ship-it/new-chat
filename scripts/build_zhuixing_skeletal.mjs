#!/usr/bin/env node
/**
 * 無序.墜星(5026) 靜態立繪 → 骨骼動畫 烘焙器
 * =====================================================
 *
 * 產出 public/elf-anim/wuxu_zhuixing/{atlas.png, manifest.json}，
 * 格式與 scripts/build_custom_animation.mjs 完全相同（customPetClip.ts 直接吃），
 * 所以播放器一行都不用改。
 *
 * 與舊版 build_custom_animation.mjs 的差別：
 *   舊版：整張立繪一個四邊形，只能整體位移／縮放／旋轉 —— 做不出肢體動作。
 *   本版：把立繪切成 9 個語意部件，每部件低密度網格綁骨骼，
 *         烘焙出「逐幀逐格頂點」的 mesh（官方 .pet 就是這種形狀）。
 *
 * 用法：
 *   node scripts/build_zhuixing_skeletal.mjs                 # 烘焙正式素材
 *   node scripts/build_zhuixing_skeletal.mjs --preview       # 只出關鍵影格 + GIF
 *   node scripts/build_zhuixing_skeletal.mjs --out public/elf-anim
 *   node scripts/build_zhuixing_skeletal.mjs --scale 0.42 --gif-height 380
 *
 * 設計約束（都是實測教訓，不要放寬）：
 *   - 四邊形／幀 ≤ 60（上次 48x62 網格 = 835 萬個數字、manifest 41.9 MB）
 *   - manifest < 2 MB
 *   - 剛體部件一律 1×1 網格（仿射變換單格在數學上就是精確的）
 *   - 部件之間要有 bleed 重疊，否則變形時接縫會裂
 *   - 蓄力可有停頓；不要用每幀像素變化率代替動作品質判斷
 *   - 無光效單片段草稿：--preview --sequence standby --no-fx --preview-out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const req = createRequire(import.meta.url);
const { PNG } = req('pngjs');

// ── 命令列 ────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const flag = (n) => argv.includes('--' + n);

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(REPO, 'scripts', 'lib', 'skeletalRig');
const SPEC = path.join(REPO, 'docs', 'custom-anim', 'wuxu_zhuixing.skel.json');

const outRoot = arg('out', path.join('build', 'custom-animation'));
const previewOnly = flag('preview');
const noFx = flag('no-fx');
if (noFx && !previewOnly) throw Error('--no-fx 僅限預覽，不能誤發佈無特效素材');
const K = Number(arg('scale', '0.42')) || 0.42;
const GIF_H = Number(arg('gif-height', '380')) || 380;

const { PARTS, BONES, ALPHA_THRESHOLD } = await import(pathToFileURL(path.join(LIB, 'parts.mjs')).href);
const R = await import(pathToFileURL(path.join(LIB, 'rigCore.mjs')).href);
const { SEQUENCES } = await import(pathToFileURL(path.join(LIB, 'motion.mjs')).href);
const selectedName = arg('sequence');
if (selectedName && !previewOnly) throw Error('--sequence 僅限預覽，不能誤發佈缺少片段的素材');
if (selectedName && !SEQUENCES[selectedName]) throw Error('未知片段：' + selectedName);
const sequences = selectedName ? { [selectedName]: SEQUENCES[selectedName] } : SEQUENCES;
const visibleFx = seq => noFx ? [] : (seq.fx || []).filter(l => l.kind !== 'beam');
const { renderFxLayer } = await import(pathToFileURL(path.join(LIB, 'fx.mjs')).href);

// 用 utf8 讀再剝掉 BOM：Windows 上以 UTF8 with BOM 存檔的 JSON 會讓 JSON.parse 直接炸。
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8').replace(/^\uFEFF/, ''));
const SRC = path.resolve(spec.source);
if (!fs.existsSync(SRC)) { console.error('找不到來源立繪：' + SRC); process.exit(2); }

const ID = spec.id;
const FPS = spec.fps || 24;
const PPU = 100;
const PAD = spec.pad || { left: 240, right: 380, top: 120, bottom: 90 };
const MAX_SIDE = 4096;

const basePng = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H, data: D } = basePng;
const alpha = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) alpha[i] = D[i * 4 + 3];

// ── 小工具 ───────────────────────────────────────────────
/** alpha>8 的最小外接矩形；全透明回 [0,0,0,0]。 */
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

function scaleTile(tile, k) {
  const tw = Math.max(1, Math.round(tile.w * k)), th = Math.max(1, Math.round(tile.h * k));
  const rgba = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const sx = Math.min(tile.w - 1, Math.floor(x / k)), sy = Math.min(tile.h - 1, Math.floor(y / k));
    const si = (sy * tile.w + sx) * 4, di = (y * tw + x) * 4;
    rgba[di] = tile.rgba[si]; rgba[di + 1] = tile.rgba[si + 1];
    rgba[di + 2] = tile.rgba[si + 2]; rgba[di + 3] = tile.rgba[si + 3];
  }
  return { rgba, x: tile.x * k, y: tile.y * k, w: tw, h: th };
}

// ── 1) 部件切分 ──────────────────────────────────────────
const owner = R.claimParts(W, H, alpha, PARTS, ALPHA_THRESHOLD);
const filled = R.fillUnowned(owner, W, H, alpha, ALPHA_THRESHOLD);
for(let i=0;i<owner.length;i++)if(alpha[i]>ALPHA_THRESHOLD&&owner[i]<0)throw Error('來源仍有未分配像素，禁止輸出');

// ── 2) 每部件：貼圖 + 低密度網格 + 骨骼權重 ─────────────────────
const layers = [];
let quadsPerFrame = 0, vertsPerFrame = 0;
for (let i = 0; i < PARTS.length; i++) {
  const part = PARTS[i];
  const tile = R.cropPartTile(basePng, owner, i, part.bleed || 0);
  if (!tile) { console.warn('  ⚠ 部件無像素，略過：' + part.id); continue; }
  const [cols, rows] = part.grid;
  const box = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
  const srcGrid = R.buildGrid(box, cols, rows);
  const weights = R.computeWeights(srcGrid, part, box, BONES);
  quadsPerFrame += cols * rows;
  vertsPerFrame += (cols + 1) * (rows + 1);
  layers.push({ part, tile, box, cols, rows, srcGrid, weights, order: part.order == null ? 100 : part.order });
}
layers.sort((a, b) => a.order - b.order);

const scaledBones = BONES.map((b) => ({
  ...b,
  pivot: [b.pivot[0] * K, b.pivot[1] * K],
  a: [b.a[0] * K, b.a[1] * K],
  b: [b.b[0] * K, b.b[1] * K],
}));
for (const L of layers) {
  L.scaledTile = scaleTile(L.tile, K);
  L.scaledBox = { x: L.box.x * K, y: L.box.y * K, w: Math.max(1, L.box.w * K), h: Math.max(1, L.box.h * K) };
  L.scaledGrid = R.buildGrid(L.scaledBox, L.cols, L.rows);
}

// 畫布與座標換算
const padL = Math.round(PAD.left * K), padR = Math.round(PAD.right * K);
const padT = Math.round(PAD.top * K), padB = Math.round(PAD.bottom * K);
const canvasW = Math.round(W * K) + padL + padR;
const canvasH = Math.round(H * K) + padT + padB;
const toCanvas = (x, y) => [x * K + padL, y * K + padT];

// ── 3) 每影格蒙皮 ────────────────────────────────────────
/** 回傳該影格「每個部件」的目標網格（已平移到畫布座標）。 */
function skinFrame(seq, frame) {
  const pose = R.samplePose(seq.pose, frame);
  const mats = R.boneMatrices(scaledBones, pose);
  return layers.map((L) => {
    const dst = R.skinGrid(L.scaledGrid, L.weights, mats);
    return { L, dst: dst.map((row) => row.map((v) => ({ x: v.x + padL, y: v.y + padT }))) };
  });
}

// ── 4) 圖集打包：角色部件先排，逐幀光效其後 ────────────────────
let cursorX = 0, cursorY = 0, shelfH = 0, sheetW = 0;
function place(w, h) {
  if (cursorX + w > MAX_SIDE) { cursorX = 0; cursorY += shelfH; shelfH = 0; }
  const at = [cursorX, cursorY];
  cursorX += w; shelfH = Math.max(shelfH, h); sheetW = Math.max(sheetW, cursorX);
  return at;
}
for (const L of layers) L.at = place(Math.max(1, L.scaledTile.w), Math.max(1, L.scaledTile.h));

// ★ 光效用半解析度烘焙：ring/glow/beam/spark 都是柔和漸層，
//   放大回去靠紋理雙線性過濾，肉眼分不出來，但圖集面積直接砍 4 倍（24 MB → 6 MB）。
const FX_K = 0.25;
const fxW = Math.max(1, Math.round(canvasW * FX_K)), fxH = Math.max(1, Math.round(canvasH * FX_K));
const fxFrames = [];
for (const [name, seq] of Object.entries(sequences)) {
  for (let f = 0; f < seq.frames; f++) {
    const canvas = renderFxLayer({...seq,fx:visibleFx(seq)}, f, fxW, fxH, (at) => toCanvas(at[0],at[1]).map(v=>v*FX_K),K*FX_K);
    fxFrames.push({ seq: name, frame: f, canvas, box: contentBox(canvas) });
  }
}
for (const e of fxFrames) e.at = place(Math.max(1, e.box[2]), Math.max(1, e.box[3]));
const sheetH = cursorY + shelfH;

const sheet = Buffer.alloc(sheetW * sheetH * 4);
function blitTile(rgba, w, h, at) {
  if (w <= 0 || h <= 0) return;
  for (let y = 0; y < h; y++) {
    rgba.copy(sheet, ((at[1] + y) * sheetW + at[0]) * 4, y * w * 4, y * w * 4 + w * 4);
  }
}
for (const L of layers) blitTile(L.scaledTile.rgba, L.scaledTile.w, L.scaledTile.h, L.at);
for (const e of fxFrames) {
  const [bx, by, bw, bh] = e.box;
  if (bw <= 0 || bh <= 0) continue;
  for (let y = 0; y < bh; y++) {
    const from = ((by + y) * e.canvas.w + bx) * 4;
    e.canvas.data.copy(sheet, ((e.at[1] + y) * sheetW + e.at[0]) * 4, from, from + bw * 4);
  }
}

const atlasPng = PNG.sync.write({ width: sheetW, height: sheetH, data: sheet });
const toWorldY = (y) => (canvasH - y) / PPU;
const r3 = (n) => Math.round(n * 1000) / 1000;
const r5 = (n) => Math.round(n * 100000) / 100000;
const uvBox = (box, at) => [at[0] / sheetW, at[1] / sheetH, (at[0] + box[2]) / sheetW, (at[1] + box[3]) / sheetH];

// ── 5) 渲染單格（預覽用） ─────────────────────────────────
function renderFull(seq, frame) {
  const canvas = R.makeCanvas(canvasW, canvasH);
  for (const { L, dst } of skinFrame(seq, frame)) R.drawPart(canvas, L.scaledTile, L.scaledGrid, dst);
  const fx = renderFxLayer({...seq,fx:visibleFx(seq)}, frame, canvasW, canvasH, (at) => toCanvas(at[0], at[1]),K);
  for (let i = 0; i < canvas.data.length; i += 4) {
    if (fx.data[i + 3] === 0) continue;
    const a = fx.data[i + 3] / 255;
    canvas.data[i] = Math.min(255, canvas.data[i] + fx.data[i] * a);
    canvas.data[i + 1] = Math.min(255, canvas.data[i + 1] + fx.data[i + 1] * a);
    canvas.data[i + 2] = Math.min(255, canvas.data[i + 2] + fx.data[i + 2] * a);
    canvas.data[i + 3] = Math.min(255, canvas.data[i + 3] + 255 * a);
  }
  return canvas;
}

// ── 6) 預覽模式 ──────────────────────────────────────────
if (previewOnly) {
  const prevDir = arg('preview-out', path.join('docs', 'custom-anim', 'preview', ID));
  fs.mkdirSync(prevDir, { recursive: true });
  const { GIFEncoder, quantize, applyPalette } = req('gifenc');
  for (const [name, seq] of Object.entries(sequences)) {
    const picks = new Set([0, Math.floor(seq.frames * 0.25), Math.floor(seq.frames * 0.5),
      Math.floor(seq.frames * 0.75), seq.frames - 1, ...(seq.hits || [])]);
    for (const f of [...picks].filter((i) => i >= 0 && i < seq.frames).sort((a, b) => a - b)) {
      const c = renderFull(seq, f);
      fs.writeFileSync(path.join(prevDir, `${name}-f${String(f).padStart(3, '0')}.png`),
        PNG.sync.write({ width: c.w, height: c.h, data: c.data }));
    }
    if(flag('frames-only'))continue;
    const gif = GIFEncoder();
    const delay = Math.round(1000 / FPS);
    for (let f = 0; f < seq.frames; f++) {
      const c = renderFull(seq, f);
      const shrink = Math.min(1, GIF_H / c.h);
      const gw = Math.max(1, Math.round(c.w * shrink)), gh = Math.max(1, Math.round(c.h * shrink));
      const rgba = new Uint8ClampedArray(gw * gh * 4);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const sx = Math.min(c.w - 1, Math.floor(x / shrink)), sy = Math.min(c.h - 1, Math.floor(y / shrink));
        const si = (sy * c.w + sx) * 4, di = (y * gw + x) * 4;
        const a = c.data[si + 3] / 255;
        rgba[di] = Math.round(c.data[si] * a + 18 * (1 - a));
        rgba[di + 1] = Math.round(c.data[si + 1] * a + 20 * (1 - a));
        rgba[di + 2] = Math.round(c.data[si + 2] * a + 28 * (1 - a));
        rgba[di + 3] = 255;
      }
      const palette = quantize(rgba, 256);
      gif.writeFrame(applyPalette(rgba, palette), gw, gh, { palette, delay, repeat: 0 });
    }
    gif.finish();
    const gifPath = path.join(prevDir, name + '.gif');
    fs.writeFileSync(gifPath, Buffer.from(gif.bytes()));
    console.log(`  ${name.padEnd(10)} ${seq.frames} 幀 → GIF ${(fs.statSync(gifPath).size / 1048576).toFixed(2)} MB`);
  }
  fs.writeFileSync(path.join(prevDir, 'preview-source.json'), JSON.stringify({
    status: 'draft-not-approved', generatedAt: new Date().toISOString(),
    source: spec.source, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex'),
    motionSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(LIB, 'motion.mjs'))).digest('hex'),
    scale: K, fps: FPS, noFx, canvas: [canvasW, canvasH],
    sequences: Object.values(sequences).map(s => ({ name: s.name, frames: s.frames, hits: s.hits })),
  }, null, 2));
  console.log('\n預覽 → ' + prevDir);
  process.exit(0);
}

// ── 7) manifest ─────────────────────────────────────────
const manifest = {
  id: ID, elfId: spec.elfId, elfName: spec.elfName,
  fps: FPS, facing: spec.facing || 'left',
  canvas: [canvasW, canvasH], pixelsPerUnit: PPU,
  atlas: { file: 'atlas.png', width: sheetW, height: sheetH },
  character: { uv: [0, 0, 1, 1], size: [canvasW, canvasH] },
  sha256: crypto.createHash('sha256').update(atlasPng).digest('hex'),
  size: atlasPng.length,
  sequences: {},
};

for (const [name, seq] of Object.entries(SEQUENCES)) {
  const quads = [];
  for (let f = 0; f < seq.frames; f++) {
    const g = [];
    for (const { L, dst } of skinFrame(seq, f)) {
      const ax = L.at[0], ay = L.at[1];
      const uv = (S) => [(ax + (S.x - L.scaledTile.x)) / sheetW, (ay + (S.y - L.scaledTile.y)) / sheetH];
      const rows = L.scaledGrid.length - 1, cols = L.scaledGrid[0].length - 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const P00 = dst[r][c], P10 = dst[r][c + 1], P11 = dst[r + 1][c + 1], P01 = dst[r + 1][c];
          const S00 = L.scaledGrid[r][c], S10 = L.scaledGrid[r][c + 1];
          const S11 = L.scaledGrid[r + 1][c + 1], S01 = L.scaledGrid[r + 1][c];
          const u00 = uv(S00), u10 = uv(S10), u11 = uv(S11), u01 = uv(S01);
          // 頂點順序：左上、右上、右下、左下（與 customPetClip 的 INDEX 一致）
          // ★ 數字精度：位置 3 位小數、UV 5 位小數。
          //   PPU=100 時 0.001 世界單位 = 0.1 畫布像素，肉眼不可見；
          //   但少這兩位就能讓 manifest 從 3.7 MB 掉到 1 MB 以下。
          g.push({
            p: [r3(P00.x / PPU), r3(toWorldY(P00.y)), r3(P10.x / PPU), r3(toWorldY(P10.y)),
              r3(P11.x / PPU), r3(toWorldY(P11.y)), r3(P01.x / PPU), r3(toWorldY(P01.y))],
            u: [r5(u00[0]), r5(u00[1]), r5(u10[0]), r5(u10[1]), r5(u11[0]), r5(u11[1]), r5(u01[0]), r5(u01[1])],
          });
        }
      }
    }
    const e = fxFrames.find((x) => x.seq === name && x.frame === f);
    const q = { a: 1, g };
    if (e && e.box[2] > 0 && e.box[3] > 0) {
      // 圖集裡是半解析度格；畫面上要還原成全尺寸，所以座標除以 FX_K。
      const [bx, by, bw, bh] = e.box;
      const bxF = bx / FX_K, byF = by / FX_K, bwF = bw / FX_K, bhF = bh / FX_K;
      q.f = [r3(bxF / PPU), r3(toWorldY(byF)), r3((bxF + bwF) / PPU), r3(toWorldY(byF)),
        r3((bxF + bwF) / PPU), r3(toWorldY(byF + bhF)), r3(bxF / PPU), r3(toWorldY(byF + bhF))];
      q.fuv = uvBox(e.box, e.at).map(r5);
    }
    quads.push(q);
  }
  manifest.sequences[name] = { frames: seq.frames, hits: seq.hits || [], loop: !!seq.loop, quads };
  console.log(`  ${name.padEnd(10)} ${seq.frames} 幀` +
    (seq.hits && seq.hits.length ? `，命中 ${seq.hits.join(',')}` : '') + (seq.loop ? '，循環' : ''));
}

const manifestJson = JSON.stringify(manifest);
const targetDir = path.join(outRoot, ID);
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(path.join(targetDir, 'atlas.png'), atlasPng);
fs.writeFileSync(path.join(targetDir, 'manifest.json'), manifestJson);

console.log('');
console.log(`部件 ${layers.length}、四邊形／幀 ${quadsPerFrame}、頂點／幀 ${vertsPerFrame}`);
console.log(`圖集 ${sheetW}×${sheetH}（${(atlasPng.length / 1048576).toFixed(2)} MB）`);
console.log(`manifest ${(manifestJson.length / 1048576).toFixed(3)} MB`);
console.log(`畫布 ${canvasW}×${canvasH}（scale ${K}）`);
console.log(`BFS 補回像素 ${filled}`);
console.log('已輸出 → ' + targetDir);
