#!/usr/bin/env node
/**
 * 立繪 alpha 稽核：找出「去背時被誤切」的內容。
 *
 * 模式 1（對照，最準）：--source <原始白底圖> --output <去背圖>
 *   逐像素比對，列出「原圖不是白、去背後卻變透明」的區域，並輸出熱區圖。
 * 模式 2（單檔啟發式）：--output <去背圖>
 *   檢查未去背、碎屑殘留、白邊、貼邊裁切。
 *
 * 用法：
 *   node scripts/sprite_alpha_audit.mjs --source raw.png --output body.png --heatmap heat.png --report r.json
 *   node scripts/sprite_alpha_audit.mjs --output body.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { PNG } = req('pngjs');

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };

const WHITE_MIN = 238;
const ALPHA_KEEP = 40;
const CONTENT_ALPHA = 16;

function readPng(p) {
  if (!fs.existsSync(p)) throw new Error('找不到檔案：' + p);
  return PNG.sync.read(fs.readFileSync(p));
}

function cluster(points, W, H, gap) {
  const set = new Set(points.map(([x, y]) => y * W + x));
  const seen = new Set();
  const out = [];
  for (const k0 of set) {
    if (seen.has(k0)) continue;
    let n = 0, minX = W, maxX = -1, minY = H, maxY = -1;
    const stack = [k0]; seen.add(k0);
    while (stack.length) {
      const c = stack.pop(); n++;
      const x = c % W, y = (c - x) / W;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -gap; dy <= gap; dy++) for (let dx = -gap; dx <= gap; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const kk = ny * W + nx;
        if (set.has(kk) && !seen.has(kk)) { seen.add(kk); stack.push(kk); }
      }
    }
    out.push({ pixels: n, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return out.sort((a, b) => b.pixels - a.pixels);
}

function diffAudit(source, output) {
  const W = output.width, H = output.height;
  const sx = source.width / W, sy = source.height / H;
  const lost = [];
  let sourceNonWhite = 0, lostNonWhite = 0, lostWhite = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const oi = (y * W + x) * 4;
    const si = (Math.min(source.height - 1, Math.floor(y * sy)) * source.width + Math.min(source.width - 1, Math.floor(x * sx))) * 4;
    const srcMin = Math.min(source.data[si], source.data[si + 1], source.data[si + 2]);
    const isWhite = srcMin >= WHITE_MIN;
    if (!isWhite) sourceNonWhite++;
    if (output.data[oi + 3] > ALPHA_KEEP) continue;
    if (isWhite) lostWhite++; else { lostNonWhite++; lost.push([x, y]); }
  }
  const clusters = cluster(lost, W, H, 8);
  return {
    mode: 'diff',
    canvas: W + 'x' + H,
    sourceNonWhitePixels: sourceNonWhite,
    lostNonWhitePixels: lostNonWhite,
    lostNonWhiteRatio: sourceNonWhite ? +(lostNonWhite / sourceNonWhite * 100).toFixed(2) : 0,
    lostWhitePixels: lostWhite,
    clusterCount: clusters.length,
    clusters: clusters.slice(0, 30),
  };
}

function countComponents(solid, W, H) {
  const seen = new Uint8Array(W * H);
  let count = 0, tiny = 0, solidPixels = 0;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let k0 = 0; k0 < W * H; k0++) {
    if (!solid[k0] || seen[k0]) continue;
    count++; let n = 0;
    const stack = [k0]; seen[k0] = 1;
    while (stack.length) {
      const c = stack.pop(); n++;
      const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const kk = ny * W + nx;
        if (solid[kk] && !seen[kk]) { seen[kk] = 1; stack.push(kk); }
      }
    }
    solidPixels += n;
    if (n < 200) tiny++;
  }
  return { count, tiny, solidPixels };
}

function heuristicAudit(img) {
  const W = img.width, H = img.height, D = img.data;
  let opaque = 0, transparent = 0, partial = 0;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  let fringe = 0, whiteishFringe = 0;
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, a = D[i + 3];
    if (a === 255) opaque++; else if (a === 0) transparent++; else partial++;
    if (a > CONTENT_ALPHA) {
      solid[y * W + x] = 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!solid[y * W + x]) continue;
    let adj = false;
    for (let dy = -1; dy <= 1 && !adj; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (!solid[(y + dy) * W + (x + dx)]) { adj = true; break; }
    }
    if (!adj) continue;
    fringe++;
    const i = (y * W + x) * 4;
    if (Math.min(D[i], D[i + 1], D[i + 2]) >= 200) whiteishFringe++;
  }
  const comps = countComponents(solid, W, H);
  const total = W * H;
  const findings = [];
  if (opaque / total > 0.99) findings.push('未去背：alpha=255 佔 ' + (opaque / total * 100).toFixed(1) + '%，整張圖仍是實心');
  if (comps.count > 50 && comps.tiny / Math.max(1, comps.solidPixels) < 0.01) findings.push('碎屑殘留：' + comps.count + ' 個連通塊，其中 ' + comps.tiny + ' 個小於 200px');
  if (fringe && whiteishFringe / fringe > 0.3) findings.push('白邊未清：貼邊像素有 ' + (whiteishFringe / fringe * 100).toFixed(1) + '% 偏白');
  if (minX <= 0 || minY <= 0 || maxX >= W - 1 || maxY >= H - 1) findings.push('內容貼齊畫布邊緣，可能被裁切（bbox=' + (maxX - minX + 1) + 'x' + (maxY - minY + 1) + '）');
  return {
    mode: 'heuristic',
    canvas: W + 'x' + H,
    opaqueRatio: +(opaque / total * 100).toFixed(2),
    partialRatio: +(partial / total * 100).toFixed(2),
    contentBox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    components: comps.count,
    tinyComponents: comps.tiny,
    fringeWhiteishRatio: fringe ? +(whiteishFringe / fringe * 100).toFixed(1) : 0,
    findings,
  };
}

function writeHeatmap(source, output, file) {
  const W = output.width, H = output.height;
  const sx = source.width / W, sy = source.height / H;
  const data = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const oi = (y * W + x) * 4;
    const si = (Math.min(source.height - 1, Math.floor(y * sy)) * source.width + Math.min(source.width - 1, Math.floor(x * sx))) * 4;
    const srcMin = Math.min(source.data[si], source.data[si + 1], source.data[si + 2]);
    const lost = output.data[oi + 3] <= ALPHA_KEEP;
    if (lost && srcMin < WHITE_MIN) { data[oi] = 255; data[oi + 1] = 0; data[oi + 2] = 255; }
    else if (lost) { data[oi] = 55; data[oi + 1] = 55; data[oi + 2] = 55; }
    else { data[oi] = source.data[si]; data[oi + 1] = source.data[si + 1]; data[oi + 2] = source.data[si + 2]; }
    data[oi + 3] = 255;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write({ width: W, height: H, data }));
}

/** 入庫門檻：超過就擋下。數字來自 2026-11-03 對八張自繪立繪的實測反推。 */
const GATE = {
  /** 對照模式：非白內容被誤切的比例上限（墜星實測 4.85% 就是不及格）。 */
  lostNonWhiteRatio: 2,
  /** 邊緣像素偏白的比例上限（白邊未清）。 */
  fringeWhiteishRatio: 30,
  /** alpha=255 佔比超過此值視為「根本沒去背」。 */
  opaqueRatio: 99,
  /** 碎屑佔連通塊的比例上限。 */
  tinyRatio: 80,
};

function gate(report) {
  const fails = [];
  if (report.mode === 'diff') {
    if (report.lostNonWhiteRatio > GATE.lostNonWhiteRatio)
      fails.push('誤切 ' + report.lostNonWhiteRatio + '% 的非白內容（上限 ' + GATE.lostNonWhiteRatio + '%）');
  }
  if (report.opaqueRatio > GATE.opaqueRatio)
    fails.push('alpha=255 佔 ' + report.opaqueRatio + '%，整張圖沒去背');
  if (report.fringeWhiteishRatio > GATE.fringeWhiteishRatio)
    fails.push('貼邊像素 ' + report.fringeWhiteishRatio + '% 偏白，白邊未清');
  const tinyRatio = report.components ? (report.tinyComponents / report.components * 100) : 0;
  if (report.components > 50 && tinyRatio > GATE.tinyRatio)
    fails.push('碎屑過多：' + report.tinyComponents + '/' + report.components + ' 個連通塊小於 200px');
  return fails;
}

const sourcePath = arg('source');
const outputPath = arg('output');
if (!outputPath) {
  console.error('用法：node scripts/sprite_alpha_audit.mjs --output <去背圖> [--source <原始圖>] [--heatmap <熱區圖>] [--report <json>] [--gate]');
  process.exit(2);
}
const output = readPng(outputPath);
const report = sourcePath
  ? { file: outputPath, ...diffAudit(readPng(sourcePath), output) }
  : { file: outputPath, ...heuristicAudit(output) };
const heatmap = arg('heatmap');
if (heatmap && sourcePath) writeHeatmap(readPng(sourcePath), output, heatmap);
const reportPath = arg('report');
if (reportPath) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (argv.includes('--gate')) {
  const fails = gate(report);
  if (fails.length) {
    console.error('\n[sprite-alpha-audit] 不入庫：');
    for (const f of fails) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log('\n[sprite-alpha-audit] 通過');
}
