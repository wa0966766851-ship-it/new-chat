// 白底去背：用「從邊界洪水填充」找真正的背景，而不是靠全域閾值。
// 全域閾值會把角色周圍那圈半透明的能量光暈一起切掉 —— 那正是之前素材缺塊的原因。
import fs from 'node:fs';
import {PNG} from 'pngjs';

const src = process.argv[2];
const out = process.argv[3];
const T = Number(process.argv[4] || 240);   // 判定「純白背景」的門檻
const FEATHER = Number(process.argv[5] || 2); // 邊緣羽化半徑（px）

const img = PNG.sync.read(fs.readFileSync(src));
const {width: w, height: h, data} = img;
const minCh = (i) => Math.min(data[i], data[i + 1], data[i + 2]);

// 1) 從四邊洪水填充，只吃「接近純白」的連通區。
//    光暈（淡藍，min 通道 150~220）達不到門檻，因此不會被吃掉。
const isWhite = (x, y) => {
  const i = (y * w + x) * 4;
  return minCh(i) >= T;
};
const bg = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) { stack.push([x, 0]); stack.push([x, h - 1]); }
for (let y = 0; y < h; y++) { stack.push([0, y]); stack.push([w - 1, y]); }
for (const [x, y] of stack) if (isWhite(x, y)) bg[y * w + x] = 1;
const q = [];
for (let i = 0; i < bg.length; i++) if (bg[i]) q.push(i);
let head = 0;
while (head < q.length) {
  const idx = q[head++];
  const x = idx % w, y = (idx / w) | 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = ny * w + nx;
    if (bg[ni]) continue;
    if (!isWhite(nx, ny)) continue;
    bg[ni] = 1; q.push(ni);
  }
}
const bgCount = q.length;

// 2) alpha 遮罩：背景 0，其餘 1（光暈與角色都保留）
const alpha = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) alpha[i] = bg[i] ? 0 : 1;

// 3) 羽化：對 alpha 做分離式盒狀模糊，讓邊緣平滑而不是硬切
if (FEATHER > 0) {
  const tmp = new Float32Array(w * h);
  const r = FEATHER;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const nx = x + d; if (nx >= 0 && nx < w) { s += alpha[y * w + nx]; n++; } }
      tmp[y * w + x] = s / n;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const ny = y + d; if (ny >= 0 && ny < h) { s += tmp[ny * w + x]; n++; } }
      alpha[y * w + x] = s / n;
    }
  }
}

// 4) 寫回：邊緣像素用「對白底反預乘」還原顏色，避免白邊
for (let i = 0; i < w * h; i++) {
  const o = i * 4;
  const a = alpha[i];
  if (a <= 0.004) { data[o + 3] = 0; continue; }
  if (a < 0.996) {
    // P = a*C + (1-a)*255  →  C = (P - (1-a)*255) / a
    for (let c = 0; c < 3; c++) {
      const v = (data[o + c] - (1 - a) * 255) / a;
      data[o + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  data[o + 3] = Math.round(a * 255);
}

fs.writeFileSync(out, PNG.sync.write(img));
console.log('背景像素', bgCount, '占比', (bgCount / (w * h) * 100).toFixed(1) + '%');
console.log('→', out);
