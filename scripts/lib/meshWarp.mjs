// 網格變形 + 線性混合蒙皮（LBS）：2D 骨骼動畫的核心，不需要 AI。
// 思路：把圖片切成網格，每個頂點綁到骨骼並帶權重；骨骼旋轉→頂點跟著走→重新光柵化。

/** 建一張 cols x rows 的網格頂點（來源空間座標）。 */
export function buildGrid(w, h, cols, rows) {
  const verts = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) row.push({ x: (c / cols) * w, y: (r / rows) * h });
    verts.push(row);
  }
  return verts;
}

const lerp = (a, b, t) => a + (b - a) * t;

/** 點到線段距離（骨骼權重用）。 */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

/**
 * 依「到骨骼線段的距離」自動算權重。衰減指數越大，影響越局部。
 * bones: [{name, a:{x,y}, b:{x,y}, falloff?}]
 */
export function autoWeights(verts, bones, opts = {}) {
  const power = opts.power ?? 3;
  const eps = opts.eps ?? 1;
  // rigid: [{bone, test(x,y)}]。命中就直接 100% 綁該骨骼 —— 砲、盾這類剛體
  // 若跟著平滑權重走，會被拉成橡皮；整塊綁死才是對的。
  const rigid = opts.rigid || [];
  return verts.map((row) =>
    row.map((v) => {
      for (const rule of rigid) {
        if (rule.test(v.x, v.y)) {
          const w = {};
          for (const bn of bones) w[bn.name] = bn.name === rule.bone ? 1 : 0;
          return w;
        }
      }
      const raw = bones.map((bn) => {
        const d = distToSegment(v.x, v.y, bn.a.x, bn.a.y, bn.b.x, bn.b.y);
        return 1 / Math.pow(d + eps, power);
      });
      const sum = raw.reduce((a, b) => a + b, 0) || 1;
      const w = {};
      bones.forEach((bn, i) => (w[bn.name] = raw[i] / sum));
      // 銳化：平滑權重會把動作「攤薄」，導致每根骨骼都只推一點、整體看起來沒動。
      // 提高對比度讓主導骨骼吃下大部分權重，混合帶自然變窄（關節處仍有過渡）。
      const sharp = opts.sharpen ?? 1;
      if (sharp > 1) {
        let s = 0;
        for (const k in w) {
          w[k] = Math.pow(w[k], sharp);
          s += w[k];
        }
        if (s > 1e-9) for (const k in w) w[k] /= s;
      }
      return w;
    })
  );
}

/** 骨骼姿態 → 每根骨骼的 2x3 仿射矩陣。pose[name] = {rot, tx, ty}（繞 pivot 旋轉）。 */
export function boneMatrices(bones, pose) {
  const out = {};
  for (const bn of bones) {
    const p = pose[bn.name] || {};
    const rot = p.rot ?? 0, tx = p.tx ?? 0, ty = p.ty ?? 0;
    const px = p.pivotX ?? bn.a.x, py = p.pivotY ?? bn.a.y;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    // 先移到 pivot、旋轉、再移回，最後加上平移
    out[bn.name] = {
      a: cos, b: sin, c: -sin, d: cos,
      e: px - cos * px + sin * py + tx,
      f: py - sin * px - cos * py + ty,
    };
  }
  return out;
}

/** 套用蒙皮：頂點 = Σ 權重_i × 矩陣_i × 頂點。 */
export function skinVerts(verts, weights, mats) {
  return verts.map((row, r) =>
    row.map((v, c) => {
      const w = weights[r][c];
      let x = 0, y = 0, wsum = 0;
      for (const name in w) {
        const k = w[name];
        if (k < 1e-6) continue;
        const m = mats[name];
        if (!m) continue;
        x += k * (m.a * v.x + m.c * v.y + m.e);
        y += k * (m.b * v.x + m.d * v.y + m.f);
        wsum += k;
      }
      if (wsum < 1e-9) return { x: v.x, y: v.y };
      return { x: x / wsum, y: y / wsum };
    })
  );
}

/** 反雙線性插值：給四邊形與一點，求 (u,v)。牛頓迭代。 */
function invBilinear(P00, P10, P11, P01, Q) {
  const Bx = P10.x - P00.x, By = P10.y - P00.y;
  const Cx = P01.x - P00.x, Cy = P01.y - P00.y;
  const Dx = P11.x - P10.x - P01.x + P00.x, Dy = P11.y - P10.y - P01.y + P00.y;
  let u = 0.5, v = 0.5;
  for (let it = 0; it < 8; it++) {
    const fx = u * Bx + v * Cx + u * v * Dx - (Q.x - P00.x);
    const fy = u * By + v * Cy + u * v * Dy - (Q.y - P00.y);
    const j00 = Bx + v * Dx, j01 = Cx + u * Dx;
    const j10 = By + v * Dy, j11 = Cy + u * Dy;
    const det = j00 * j11 - j01 * j10;
    if (Math.abs(det) < 1e-12) return null;
    const du = (fx * j11 - fy * j01) / det;
    const dv = (fy * j00 - fx * j10) / det;
    u -= du; v -= dv;
    if (Math.abs(du) < 1e-6 && Math.abs(dv) < 1e-6) break;
  }
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  return { u, v };
}

/** 雙線性取樣（前乘 alpha，避免白邊）。 */
function sampleBilinear(data, w, h, x, y, out, oi) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  let r = 0, g = 0, b = 0, a = 0;
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const sx = Math.max(0, Math.min(w - 1, x0 + dx));
      const sy = Math.max(0, Math.min(h - 1, y0 + dy));
      const wt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      if (wt <= 0) continue;
      const si = (sy * w + sx) * 4;
      const al = data[si + 3] / 255;
      r += data[si] * al * wt;
      g += data[si + 1] * al * wt;
      b += data[si + 2] * al * wt;
      a += data[si + 3] * wt;
    }
  }
  if (a > 1e-6) {
    const inv = 255 / a;
    out[oi] = Math.min(255, r * inv);
    out[oi + 1] = Math.min(255, g * inv);
    out[oi + 2] = Math.min(255, b * inv);
  }
  out[oi + 3] = Math.min(255, a);
}

/**
 * 光柵化：把來源網格（srcVerts）變形到目標網格（dstVerts），輸出 RGBA。
 * 逐格前向掃描目標四邊形，用反雙線性求回來源座標。
 */
export function rasterize(src, sw, sh, srcVerts, dstVerts, outW, outH) {
  const out = new Uint8ClampedArray(outW * outH * 4);
  const rows = srcVerts.length - 1, cols = srcVerts[0].length - 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const S00 = srcVerts[r][c], S10 = srcVerts[r][c + 1];
      const S11 = srcVerts[r + 1][c + 1], S01 = srcVerts[r + 1][c];
      const P00 = dstVerts[r][c], P10 = dstVerts[r][c + 1];
      const P11 = dstVerts[r + 1][c + 1], P01 = dstVerts[r + 1][c];
      const minX = Math.max(0, Math.floor(Math.min(P00.x, P10.x, P11.x, P01.x)));
      const maxX = Math.min(outW - 1, Math.ceil(Math.max(P00.x, P10.x, P11.x, P01.x)));
      const minY = Math.max(0, Math.floor(Math.min(P00.y, P10.y, P11.y, P01.y)));
      const maxY = Math.min(outH - 1, Math.ceil(Math.max(P00.y, P10.y, P11.y, P01.y)));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const uv = invBilinear(P00, P10, P11, P01, { x: x + 0.5, y: y + 0.5 });
          if (!uv) continue;
          const { u, v } = uv;
          if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) continue;
          const sx = lerp(lerp(S00.x, S10.x, u), lerp(S01.x, S11.x, u), v);
          const sy = lerp(lerp(S00.y, S10.y, u), lerp(S01.y, S11.y, u), v);
          if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) continue;
          sampleBilinear(src, sw, sh, sx, sy, out, (y * outW + x) * 4);
        }
      }
    }
  }
  return out;
}
