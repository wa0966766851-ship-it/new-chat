// 2D 骨骼蒙皮核心：部件切分 → 低密度網格 → 骨骼權重 → 蒙皮 → 光柵化。
// 全部在「來源像素座標」計算，輸出時才轉成畫布／世界座標。

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyBox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 依「部件多邊形」把每個不透明像素指派給唯一部件（先列出的優先）。
 * 立繪主體是一個連通塊，alpha 連通分析切不開，所以一定要靠語意多邊形。
 */
export function claimParts(W, H, alpha, parts, threshold) {
  const owner = new Int16Array(W * H).fill(-1);
  const priority=parts.map((part,index)=>({part,index})).sort((a,b)=>(b.part.claimPriority||0)-(a.part.claimPriority||0));
  for (const {index:pi} of priority) {
    const poly = parts[pi].poly;
    if (!poly || poly.length < 3) continue;
    const b = polyBox(poly);
    const x0 = Math.max(0, Math.floor(b.minX)), x1 = Math.min(W - 1, Math.ceil(b.maxX));
    const y0 = Math.max(0, Math.floor(b.minY)), y1 = Math.min(H - 1, Math.ceil(b.maxY));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (owner[i] !== -1) continue;
        if (alpha[i] <= threshold) continue;
        if (!pointInPoly(poly, x + 0.5, y + 0.5)) continue;
        owner[i] = pi;
      }
    }
  }
  return owner;
}

/** 多邊形沒蓋到的殘餘像素，用 BFS 併進最近的部件 —— 保證主體零遺漏。 */
export function fillUnowned(owner, W, H, alpha, threshold) {
  const queue = [];
  for (let i = 0; i < W * H; i++) if (owner[i] >= 0) queue.push(i);
  let head = 0, filled = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % W, y = (i / W) | 0, o = owner[i];
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx;
      if (owner[k] !== -1 || alpha[k] <= threshold) continue;
      owner[k] = o; queue.push(k); filled++;
    }
  }
  // 分離的髮絲／能量碎片無法沿 alpha 連通塊抵達。只對殘留像素，
  // 透過全畫布最近鄰傳播找歸屬；透明像素僅作尋路，不加入部件遮罩。
  const residual=[];
  for(let i=0;i<owner.length;i++)if(alpha[i]>threshold&&owner[i]<0)residual.push(i);
  if(residual.length&&queue.length){
    const nearest=owner.slice(),pending=new Int32Array(W*H);let read=0,write=0;
    for(let i=0;i<owner.length;i++)if(owner[i]>=0)pending[write++]=i;
    while(read<write){const i=pending[read++],x=i%W,y=(i/W)|0;
      for(const k of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1]){
        if(k<0||nearest[k]>=0)continue;nearest[k]=nearest[i];pending[write++]=k;
      }
    }
    for(const i of residual){owner[i]=nearest[i];filled++;}
  }
  return filled;
}

/**
 * 每個部件裁成自己的貼圖塊。
 *
 * bleed：往外擴張 N 像素，把「鄰居的邊緣像素」也吃進來。
 * 為什麼需要：部件之間原本是硬切，各自變形後接縫一定會裂（實測頸部、腰部出現黑線）。
 * 讓相鄰部件重疊幾個像素，後畫的蓋住先畫的，接縫就被藏住了；
 * 重疊區取的是同一張原圖的像素，靜止時完全看不出來。
 */
export function cropPartTile(png, owner, partIndex, bleed = 0) {
  const { width: W, height: H, data: D } = png;
  // 先做一次膨脹遮罩（只往不透明像素擴張，不會吃到空白背景）
  let mask = null;
  if (bleed > 0) {
    mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (owner[i] === partIndex) mask[i] = 1;
    let frontier = [];
    for (let i = 0; i < W * H; i++) if (mask[i]) frontier.push(i);
    for (let step = 0; step < bleed; step++) {
      const next = [];
      for (const i of frontier) {
        const x = i % W, y = (i / W) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (mask[k]) continue;
          if (D[k * 4 + 3] <= 8) continue;   // 不吃背景
          mask[k] = 1; next.push(k);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
  }
  const inTile = (i) => (mask ? mask[i] === 1 : owner[i] === partIndex);

  let minX = W, minY = H, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!inTile(i)) continue;
      count++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (count === 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (minY + y) * W + (minX + x);
      if (!inTile(si)) continue;
      const di = (y * w + x) * 4, s4 = si * 4;
      rgba[di] = D[s4]; rgba[di + 1] = D[s4 + 1]; rgba[di + 2] = D[s4 + 2]; rgba[di + 3] = D[s4 + 3];
    }
  }
  return { rgba, x: minX, y: minY, w, h, count };
}

/** 部件網格：cols×rows 個格子，頂點存「來源像素座標」。 */
export function buildGrid(box, cols, rows) {
  const verts = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) row.push({ x: box.x + (c / cols) * box.w, y: box.y + (r / rows) * box.h });
    verts.push(row);
  }
  return verts;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * 頂點權重。
 *  rigid：整塊 100% 綁自己那根骨（砲、浮游機這種剛體，用平滑權重會被拉成橡皮）。
 *  blend：沿某一軸在「自己」與「上層骨」之間過渡。
 *         ownAt 決定哪一端是自己的骨：頭是 'top'（頭骨管頭頂、底部漸變到軀幹），
 *         腿與披風是 'bottom'（自己的骨管下半、上緣漸變到軀幹）。
 *         這個方向寫反會讓頭頂跟著軀幹走、脖子跟著頭走 —— 轉頭時脖子就裂開。
 *  auto ：按到各骨線段的距離反比混合（軀幹這種要多骨過渡的）。
 */
export function computeWeights(grid, part, box, allBones) {
  const spec = part.weight || { mode: 'rigid' };
  const own = part.bone;
  // auto 只跟指定的一組骨混合（預設全部）。軀幹若讓砲骨、翼骨也參與，
  // 後坐時軀幹會被砲拉著走，看起來像整個人被吸向砲。
  const pool = spec.bones ? allBones.filter((b) => spec.bones.includes(b.name)) : allBones;
  return grid.map((row) =>
    row.map((v) => {
      if (spec.mode === 'rigid') return { [own]: 1 };
      if (spec.mode === 'blend') {
        const axis = spec.axis === 'x' ? 'x' : 'y';
        const from = spec.from == null ? 0 : spec.from;
        const to = spec.to == null ? 1 : spec.to;
        const t = (v[axis] - (axis === 'x' ? box.x : box.y)) / (axis === 'x' ? box.w : box.h);
        const k = clamp((t - from) / (to - from || 1), 0, 1);
        // ownAt='bottom'：t 越大越是自己；'top'：t 越小越是自己。
        const ownW = spec.ownAt === 'top' ? 1 - k : k;
        const parent = spec.other || 'root';
        return { [own]: ownW, [parent]: 1 - ownW };
      }
      const raw = pool.map((bn) => {
        const d = distToSegment(v.x, v.y, bn.a[0], bn.a[1], bn.b[0], bn.b[1]);
        return 1 / Math.pow(d + 1, spec.power || 3);
      });
      const sum = raw.reduce((a, b) => a + b, 0) || 1;
      const w = {};
      pool.forEach((bn, i) => { w[bn.name] = raw[i] / sum; });
      const sharp = spec.sharpen || 1;
      if (sharp > 1) {
        let s = 0;
        for (const k in w) { w[k] = Math.pow(w[k], sharp); s += w[k]; }
        if (s > 1e-9) for (const k in w) w[k] /= s;
      }
      return w;
    })
  );
}

// ── 骨骼階層 ─────────────────────────────────────────────────────────
// 局部矩陣：繞 pivot 縮放+旋轉，再平移。
// 世界矩陣 = 父世界矩陣 ∘ 局部矩陣。軀幹後仰時頭與砲要跟著走，浮游機不跟。
function localMatrix(bn, p) {
  const rot = ((p.rot || 0) * Math.PI) / 180;
  const sx = p.sx == null ? 1 : p.sx, sy = p.sy == null ? 1 : p.sy;
  const px = bn.pivot[0], py = bn.pivot[1];
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
  return {
    a, b, c, d,
    e: px + (p.tx || 0) - (a * px + c * py),
    f: py + (p.ty || 0) - (b * px + d * py),
  };
}

function mul(m, n) {
  // m ∘ n
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

const IDENT = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** 骨骼姿態 → 每根骨的世界 2x3 矩陣（含階層）。 */
export function boneMatrices(bones, pose) {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const world = new Map();
  const resolve = (name, depth = 0) => {
    if (world.has(name)) return world.get(name);
    const bn = byName.get(name);
    if (!bn || depth > 16) return IDENT;
    const local = localMatrix(bn, pose[name] || {});
    const parent = bn.parent ? resolve(bn.parent, depth + 1) : IDENT;
    const m = mul(parent, local);
    world.set(name, m);
    return m;
  };
  const out = {};
  for (const bn of bones) out[bn.name] = resolve(bn.name);
  return out;
}

/** 套用蒙皮：頂點 = Σ 權重 × 矩陣 × 頂點。 */
export function skinGrid(grid, weights, mats) {
  return grid.map((row, r) =>
    row.map((v, c) => {
      const w = weights[r][c];
      let x = 0, y = 0, sum = 0;
      for (const name in w) {
        const k = w[name];
        if (k < 1e-6) continue;
        const m = mats[name];
        if (!m) continue;
        x += k * (m.a * v.x + m.c * v.y + m.e);
        y += k * (m.b * v.x + m.d * v.y + m.f);
        sum += k;
      }
      if (sum < 1e-9) return { x: v.x, y: v.y };
      return { x: x / sum, y: y / sum };
    })
  );
}

// ── 光柵化（只給預覽／GIF 用；正式輸出只寫頂點，GPU 自己畫） ──────────────
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
    const du = (fx * j11 - fy * j01) / det, dv = (fy * j00 - fx * j10) / det;
    u -= du; v -= dv;
    if (Math.abs(du) < 1e-6 && Math.abs(dv) < 1e-6) break;
  }
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  return { u, v };
}

function sampleBilinear(data, w, h, x, y, out, oi) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  let r = 0, g = 0, b = 0, a = 0;
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const sx = clamp(x0 + dx, 0, w - 1), sy = clamp(y0 + dy, 0, h - 1);
      const wt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      if (wt <= 0) continue;
      const si = (sy * w + sx) * 4;
      const al = data[si + 3] / 255;
      r += data[si] * al * wt; g += data[si + 1] * al * wt; b += data[si + 2] * al * wt;
      a += data[si + 3] * wt;
    }
  }
  if (a > 1e-6) { const inv = 255 / a; out[oi] = Math.min(255, r * inv); out[oi + 1] = Math.min(255, g * inv); out[oi + 2] = Math.min(255, b * inv); }
  out[oi + 3] = Math.min(255, a);
}

/** 把部件貼圖依「來源網格 → 目標網格」變形後貼到畫布上。 */
export function drawPart(canvas, tile, srcGrid, dstGrid) {
  const rows = srcGrid.length - 1, cols = srcGrid[0].length - 1;
  const { w: tw, h: th, rgba } = tile;
  const tmp = [0, 0, 0, 0];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const S00 = srcGrid[r][c], S10 = srcGrid[r][c + 1], S11 = srcGrid[r + 1][c + 1], S01 = srcGrid[r + 1][c];
      const P00 = dstGrid[r][c], P10 = dstGrid[r][c + 1], P11 = dstGrid[r + 1][c + 1], P01 = dstGrid[r + 1][c];
      const minX = Math.max(0, Math.floor(Math.min(P00.x, P10.x, P11.x, P01.x)));
      const maxX = Math.min(canvas.w - 1, Math.ceil(Math.max(P00.x, P10.x, P11.x, P01.x)));
      const minY = Math.max(0, Math.floor(Math.min(P00.y, P10.y, P11.y, P01.y)));
      const maxY = Math.min(canvas.h - 1, Math.ceil(Math.max(P00.y, P10.y, P11.y, P01.y)));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const uv = invBilinear(P00, P10, P11, P01, { x: x + 0.5, y: y + 0.5 });
          if (!uv) continue;
          const { u, v } = uv;
          if (u < -0.002 || u > 1.002 || v < -0.002 || v > 1.002) continue;
          const sx = lerp(lerp(S00.x, S10.x, u), lerp(S01.x, S11.x, u), v) - tile.x;
          const sy = lerp(lerp(S00.y, S10.y, u), lerp(S01.y, S11.y, u), v) - tile.y;
          if (sx < 0 || sy < 0 || sx > tw - 1 || sy > th - 1) continue;
          const oi = (y * canvas.w + x) * 4;
          tmp[0] = tmp[1] = tmp[2] = tmp[3] = 0;
          sampleBilinear(rgba, tw, th, sx, sy, tmp, 0);
          const sa = tmp[3] / 255;
          if (sa <= 0.004) continue;
          const da = canvas.data[oi + 3] / 255;
          const oa = sa + da * (1 - sa);
          if (oa <= 0) continue;
          canvas.data[oi] = (tmp[0] * sa + canvas.data[oi] * da * (1 - sa)) / oa;
          canvas.data[oi + 1] = (tmp[1] * sa + canvas.data[oi + 1] * da * (1 - sa)) / oa;
          canvas.data[oi + 2] = (tmp[2] * sa + canvas.data[oi + 2] * da * (1 - sa)) / oa;
          canvas.data[oi + 3] = oa * 255;
        }
      }
    }
  }
}

export function makeCanvas(w, h) { return { w, h, data: Buffer.alloc(w * h * 4) }; }

// ── 時間軸：關鍵影格 → 每格數值 ─────────────────────────────────────
export const EASE = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  /** 蓄力：先慢後快，用於聚氣 */
  charge: (t) => t * t * t,
  /** 出擊：瞬間衝出再回落 */
  snap: (t) => 1 - Math.pow(1 - t, 4),
  /** 回彈：超調再彈回，用於受擊 */
  back: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  /** 開火抖動：快速來回 */
  shake: (t) => Math.sin(t * Math.PI * 6) * (1 - t),
};

/** 在某影格上取樣一條軌道（track 是 [{t, ...值, ease}]）。 */
export function sampleTrack(track, time) {
  if (!track || !track.length) return null;
  if (time <= track[0].t) return { ...track[0] };
  const last = track[track.length - 1];
  if (time >= last.t) return { ...last };
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i], b = track[i + 1];
    if (time < a.t || time > b.t) continue;
    const span = b.t - a.t || 1;
    const ease = EASE[b.ease || a.ease || 'linear'] || EASE.linear;
    const raw = (time - a.t) / span;
    const t = ease(raw);
    const out = { ...a };
    for (const k of Object.keys(b)) {
      if (k === 't' || k === 'ease') continue;
      const av = a[k] == null ? 0 : a[k];
      const bv = b[k];
      out[k] = av + (bv - av) * t;
    }
    out.t = time;
    return out;
  }
  return { ...last };
}

/** 把「每根骨一條軌道」的 pose 定義取樣成該影格的完整姿態。 */
export function samplePose(poseTracks, frame) {
  const pose = {};
  for (const bone in poseTracks) {
    const v = sampleTrack(poseTracks[bone], frame);
    if (v) pose[bone] = v;
  }
  return pose;
}
