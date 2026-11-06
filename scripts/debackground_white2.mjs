import fs from 'node:fs';
import {PNG} from 'pngjs';

const SRC = 'public/elf-art/wuxu_zhuixing_src.png';
const OUT = 'public/elf-art/wuxu_zhuixing_body_new.png';
const img = PNG.sync.read(fs.readFileSync(SRC));
const W = img.width, H = img.height, d = img.data;

const WHITE = 246;      // 近白門檻
const FLOOD = 240;      // 從邊界可連通的白底門檻
const isWhite = (i) => d[i] >= WHITE && d[i+1] >= WHITE && d[i+2] >= WHITE;

// 1) 邊界洪水填充：真正的背景
const bg = new Uint8Array(W*H);
const q = [];
const pushIf = (x, y) => {
  const i = y*W+x;
  if (bg[i]) return;
  if (d[i*4] < FLOOD || d[i*4+1] < FLOOD || d[i*4+2] < FLOOD) return;
  bg[i] = 1; q.push(i);
};
for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H-1); }
for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W-1, y); }
for (let h = 0; h < q.length; h++) {
  const idx = q[h], x = idx % W, y = (idx / W) | 0;
  if (x > 0) pushIf(x-1, y);
  if (x < W-1) pushIf(x+1, y);
  if (y > 0) pushIf(x, y-1);
  if (y < H-1) pushIf(x, y+1);
}

// 2) 內部純白塊：被角色包住的白底，洪水填充進不去
//    條件：近白、不是背景、且連通塊面積 > 150px（排除角色身上的高光小點）
const white = new Uint8Array(W*H);
for (let i = 0; i < W*H; i++) if (!bg[i] && isWhite(i*4)) white[i] = 1;
const seen = new Uint8Array(W*H);
let removedInterior = 0, interiorComps = 0;
for (let i = 0; i < W*H; i++) {
  if (!white[i] || seen[i]) continue;
  const comp = [i]; seen[i] = 1;
  for (let h = 0; h < comp.length; h++) {
    const idx = comp[h], x = idx % W, y = (idx / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny*W+nx;
      if (white[ni] && !seen[ni]) { seen[ni] = 1; comp.push(ni); }
    }
  }
  if (comp.length > 150) {
    interiorComps++;
    for (const idx of comp) { bg[idx] = 1; removedInterior++; }
  }
}

// 3) alpha 遮罩 + 羽化
const alpha = new Float32Array(W*H);
for (let i = 0; i < W*H; i++) alpha[i] = bg[i] ? 0 : 1;
const R = 2;
const tmp = new Float32Array(W*H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let s = 0, n = 0;
  for (let k = -R; k <= R; k++) { const nx = x+k; if (nx >= 0 && nx < W) { s += alpha[y*W+nx]; n++; } }
  tmp[y*W+x] = s/n;
}
for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
  let s = 0, n = 0;
  for (let k = -R; k <= R; k++) { const ny = y+k; if (ny >= 0 && ny < H) { s += tmp[ny*W+x]; n++; } }
  alpha[y*W+x] = s/n;
}

// 4) 寫回：對白底反預乘，消除白邊
for (let i = 0; i < W*H; i++) {
  const o = i*4, a = alpha[i];
  if (a <= 0.004) { d[o+3] = 0; continue; }
  if (a < 0.996) for (let c = 0; c < 3; c++) {
    const v = (d[o+c] - (1-a)*255) / a;
    d[o+c] = Math.max(0, Math.min(255, Math.round(v)));
  }
  d[o+3] = Math.round(a*255);
}
fs.writeFileSync(OUT, PNG.sync.write(img));
console.log('背景像素', q.length);
console.log('內部白塊', interiorComps, '塊,', removedInterior, 'px 已清');
console.log('→', OUT);
