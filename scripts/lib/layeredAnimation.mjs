// 分層動畫編譯器（2026-11-22）：原廠 .pet 同構的「零件＋逐格變換」。
// 本體姿勢圖與官方特效零件各是一個部件；每格由多個部件疊成，各自位移／旋轉／縮放／斜切，
// 加 Flash 式乘色／加色（閃白、殘影上色）與加算光效。輸出 customPetClip 的 L 分層影格。
import crypto from 'node:crypto';
import {PNG} from 'pngjs';

const fail = message => { throw new Error(message); };

/** 雙線性縮放（RGBA，不預乘）。 */
export function resizeRgba(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  const fx = sw / dw, fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + .5) * fy - .5)), y0 = Math.floor(sy), y1 = Math.min(sh - 1, y0 + 1), ty = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + .5) * fx - .5)), x0 = Math.floor(sx), x1 = Math.min(sw - 1, x0 + 1), tx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const a = src[(y0 * sw + x0) * 4 + c], b = src[(y0 * sw + x1) * 4 + c], d = src[(y1 * sw + x0) * 4 + c], e = src[(y1 * sw + x1) * 4 + c];
        out[(y * dw + x) * 4 + c] = Math.round((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty);
      }
    }
  }
  return out;
}
export function cropRgba(png, [x, y, w, h]) {
  const out = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) out.set(png.data.subarray(((y + r) * png.width + x) * 4, ((y + r) * png.width + x + w) * 4), r * w * 4);
  return out;
}

/**
 * 光效換色：依亮度把零件改成指定色系（借用的金色光效 → 綠／紫／藍），亮部保留趨白的高光。
 * color 為 0..1 的 RGB；只改色不改透明度。
 */
export function recolorRgba(rgba, color) {
  for (let i = 0; i < rgba.length; i += 4) {
    // 亮度取最大通道（保留光效強度），高光只取真正接近白色的像素（以明度的四次方衡量）。
    const r = rgba[i] / 255, g = rgba[i + 1] / 255, b = rgba[i + 2] / 255;
    const l = Math.max(r, g, b), hi = (.3 * r + .59 * g + .11 * b) ** 4;
    for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(255 * Math.min(1, color[c] * l * (1 - hi) + hi));
  }
}

/** 部件打包：高度遞減的貨架排列，四周留白避免取樣滲色。 */
function pack(parts, maxSide) {
  const pad = 4, order = [...parts].sort((a, b) => b.h - a.h);
  let width = 0;
  for (const p of order) width = Math.max(width, p.w + pad * 2);
  // 以接近正方形的寬度起算，裝不下再放寬。
  const area = order.reduce((s, p) => s + (p.w + pad * 2) * (p.h + pad * 2), 0);
  for (let W = Math.max(width, Math.ceil(Math.sqrt(area) * 1.08)); W <= maxSide; W += 64) {
    let x = 0, y = 0, row = 0; const place = new Map(); let ok = true;
    for (const p of order) {
      if (x + p.w + pad * 2 > W) { x = 0; y += row; row = 0; }
      place.set(p.id, [x + pad, y + pad]); x += p.w + pad * 2; row = Math.max(row, p.h + pad * 2);
      if (y + row > maxSide) { ok = false; break; }
    }
    if (ok) return {W, H: y + row, place};
  }
  fail('Parts do not fit the atlas budget');
}

/**
 * spec.parts：[{id, kind:'body'|'fx', image:PNG, rect:[x,y,w,h], scale, rest?:[x0,yTop,x1,yBottom] (body 的世界框), anchors?, recolor?:[r,g,b]}]
 * spec.sequences：{name:{frames:[[layer…]…], hits, events, loop}}
 *   body 圖層：{part, rest 世界框, pivot, dx, dy, sx, sy, rot(度), skew(度), a, m, t, b, warp?(x,y)→[dx,dy], grid?:[nx,ny]}
 *   fx 圖層：{part, x, y 世界中心, w 世界寬（高依比例）, sx, sy, rot, a, m, t, b(預設 a)}
 */
export function compileLayeredAnimation(spec) {
  const parts = new Map();
  for (const p of spec.parts) {
    if (parts.has(p.id)) fail('Duplicate part ' + p.id);
    const [, , w0, h0] = p.rect, w = Math.max(1, Math.round(w0 * p.scale)), h = Math.max(1, Math.round(h0 * p.scale));
    const rgba = resizeRgba(cropRgba(p.image, p.rect), w0, h0, w, h);
    if (p.recolor) recolorRgba(rgba, p.recolor);
    parts.set(p.id, {...p, w, h, rgba});
  }
  const {W, H, place} = pack([...parts.values()], spec.maxAtlasSide ?? 4096);
  const atlas = new PNG({width: W, height: H});
  for (const p of parts.values()) {
    const [px, py] = place.get(p.id);
    for (let r = 0; r < p.h; r++) atlas.data.set(p.rgba.subarray(r * p.w * 4, (r + 1) * p.w * 4), ((py + r) * W + px) * 4);
    p.uv = [px / W, py / H, (px + p.w) / W, (py + p.h) / H];
  }
  const rad = d => d * Math.PI / 180;
  // 4 角（左上、右上、右下、左下）→ 經縮放／斜切／旋轉／位移。
  const transform = (corners, pivot, l) => {
    const c = Math.cos(rad(l.rot ?? 0)), s = Math.sin(rad(l.rot ?? 0)), k = Math.tan(rad(l.skew ?? 0));
    return corners.flatMap(([x, y]) => {
      let ux = (x - pivot[0]) * (l.sx ?? 1), uy = (y - pivot[1]) * (l.sy ?? 1);
      ux += uy * k;
      return [pivot[0] + ux * c - uy * s + (l.dx ?? 0), pivot[1] + ux * s + uy * c + (l.dy ?? 0)];
    });
  };
  const point = (p, pivot, l) => transform([p], pivot, l);
  const styled = (l, part, p, u) => {
    const layer = {p: p.map(v => +v.toFixed(3)), u: u.map(v => +v.toFixed(5))};
    if ((l.a ?? 1) !== 1) layer.a = +Math.min(1, l.a).toFixed(3);
    if (l.m) layer.m = l.m.map(v => +v.toFixed(3));
    if (l.t) layer.t = l.t.map(v => +v.toFixed(3));
    if ((l.b ?? (part.kind === 'fx' ? 'a' : 'n')) === 'a') layer.b = 'a';
    return layer;
  };
  // 網格格子是否有內容（全透明的格子不輸出）。
  const coverage = new Map();
  const cellCoverage = (part, nx, ny) => {
    const k = part.id + ':' + nx + 'x' + ny;
    if (!coverage.has(k)) {
      const out = new Uint8Array(nx * ny);
      for (let y = 0; y < part.h; y++) for (let x = 0; x < part.w; x++) if (part.rgba[(y * part.w + x) * 4 + 3] > 6)
        out[Math.min(ny - 1, Math.floor(y * ny / part.h)) * nx + Math.min(nx - 1, Math.floor(x * nx / part.w))] = 1;
      coverage.set(k, out);
    }
    return coverage.get(k);
  };
  const sequences = {};
  for (const [name, seq] of Object.entries(spec.sequences)) {
    const quads = seq.frames.map((layers, index) => {
      const L = [], anchors = {};
      for (const l of layers) {
        const part = parts.get(l.part) ?? fail(`${name}#${index}: unknown part ${l.part}`);
        const [u0, v0, u1, v1] = part.uv, u = [u0, v0, u1, v0, u1, v1, u0, v1];
        let p;
        if ((l.a ?? 1) <= 0.003) continue;
        if (part.kind === 'body' && l.warp) {
          // 連續形變：零件切成網格，每個網格點先做零件變換，再加上「世界座標的位移場」warp(x, y)。
          // 位移場對所有零件是同一個函數，所以相鄰零件在接縫處位移一致，不會被拉開。
          const [x0, yt, x1, yb] = part.rest, pivot = l.pivot ?? spec.pivot, [nx, ny] = l.grid ?? spec.warpGrid ?? [4, 6];
          const [u0, v0, u1, v1] = part.uv, filled = cellCoverage(part, nx, ny);
          const vert = (i, j) => { const [wx, wy] = point([x0 + (x1 - x0) * i / nx, yt + (yb - yt) * j / ny], pivot, l), [ox, oy] = l.warp(wx, wy); return [wx + ox, wy + oy]; };
          const grid = Array.from({length: ny + 1}, (_, j) => Array.from({length: nx + 1}, (_, i) => vert(i, j)));
          for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
            if (!filled[j * nx + i]) continue;
            const q = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]].flat();
            const ua = u0 + (u1 - u0) * i / nx, ub = u0 + (u1 - u0) * (i + 1) / nx, va = v0 + (v1 - v0) * j / ny, vb = v0 + (v1 - v0) * (j + 1) / ny;
            L.push(styled(l, part, q, [ua, va, ub, va, ub, vb, ua, vb]));
          }
          if (l.primary !== false && part.anchors?.muzzle && !anchors.muzzle) {
            const [wx, wy] = point(part.anchors.muzzle, pivot, l), [ox, oy] = l.warp(wx, wy);
            anchors.muzzle = [Math.round((wx + ox) * spec.pixelsPerUnit), Math.round(spec.canvas[1] - (wy + oy) * spec.pixelsPerUnit)];
          }
          continue;
        }
        if (part.kind === 'body') {
          const [x0, yt, x1, yb] = part.rest, pivot = l.pivot ?? spec.pivot;
          p = transform([[x0, yt], [x1, yt], [x1, yb], [x0, yb]], pivot, l);
          if (l.primary !== false && part.anchors?.muzzle && !anchors.muzzle) {
            const [wx, wy] = point(part.anchors.muzzle, pivot, l);
            anchors.muzzle = [Math.round(wx * spec.pixelsPerUnit), Math.round(spec.canvas[1] - wy * spec.pixelsPerUnit)];
          }
        } else {
          const w = l.w ?? part.w / spec.pixelsPerUnit, h = w * part.h / part.w;
          p = transform([[l.x - w / 2, l.y + h / 2], [l.x + w / 2, l.y + h / 2], [l.x + w / 2, l.y - h / 2], [l.x - w / 2, l.y - h / 2]], [l.x, l.y], {...l, dx: 0, dy: 0});
        }
        L.push(styled(l, part, p, u));
      }
      if (!L.length) fail(`${name}#${index}: empty frame`);
      return {a: 1, L, ...(Object.keys(anchors).length ? {anchors} : {})};
    });
    sequences[name] = {frames: quads.length, hits: seq.hits ?? [], ...(seq.loop ? {loop: true} : {}), events: seq.events ?? {}, quads};
  }
  const atlasBytes = PNG.sync.write(atlas, {colorType: 6});
  const sha256 = crypto.createHash('sha256').update(atlasBytes).digest('hex');
  const body = [...parts.values()].find(p => p.kind === 'body' && p.id === spec.restPart) ?? fail('Missing rest part');
  return {
    atlasBytes,
    manifest: {
      id: spec.id, elfId: spec.elfId, elfName: spec.elfName, fps: spec.fps, facing: spec.facing,
      presentation: spec.presentation, physicalMotion: spec.physicalMotion, canvas: spec.canvas, pixelsPerUnit: spec.pixelsPerUnit,
      atlas: {file: 'atlas.png', width: W, height: H},
      character: {uv: body.uv, size: [body.w, body.h]},
      sha256, size: atlasBytes.length, poseBlend: false,
      production: {method: 'layered-parts', parts: [...parts.values()].map(p => ({id: p.id, kind: p.kind, source: p.source, rect: p.rect, scale: p.scale, ...(p.recolor ? {recolor: p.recolor} : {})})), notes: spec.notes ?? []},
      sequences,
    },
  };
}
