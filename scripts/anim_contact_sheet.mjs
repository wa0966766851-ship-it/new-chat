#!/usr/bin/env node
/**
 * 把 docs/custom-anim/preview/<id> 的關鍵影格拼成一張聯絡表，深底合成，方便人眼驗收。
 *
 * 用法：
 *   node scripts/anim_contact_sheet.mjs --id wuxu_zhuixing --seq sa
 *   node scripts/anim_contact_sheet.mjs --id wuxu_shiyan --seq attack extra
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { PNG } = req('pngjs');

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf('--' + n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const all = (n) => { const i = argv.indexOf('--' + n); const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) out.push(argv[j]); return out; };

const id = arg('id');
if (!id) { console.error('用法：node scripts/anim_contact_sheet.mjs --id <id> --seq <name...> [--scale 0.3]'); process.exit(2); }
const seqs = all('seq');
if (!seqs.length) { console.error('需要 --seq（可多個）'); process.exit(2); }
const scale = Number(arg('scale', '0.3')) || 0.3;
const dir = path.join('docs', 'custom-anim', 'preview', id);
const gap = 8;

for (const seq of seqs) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(seq + '-')).sort();
  if (!files.length) { console.warn('  跳過 ' + seq + '（沒有影格）'); continue; }
  const imgs = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(dir, f))));
  const tw = Math.round(imgs[0].width * scale), th = Math.round(imgs[0].height * scale);
  const W = tw * imgs.length + gap * (imgs.length - 1), H = th;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = 18; out[i * 4 + 1] = 20; out[i * 4 + 2] = 28; out[i * 4 + 3] = 255; }
  imgs.forEach((p, idx) => {
    const ox = idx * (tw + gap);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const sx = Math.min(p.width - 1, Math.floor(x / scale)), sy = Math.min(p.height - 1, Math.floor(y / scale));
      const si = (sy * p.width + sx) * 4, a = p.data[si + 3] / 255, di = (y * W + (ox + x)) * 4;
      out[di] = Math.min(255, p.data[si] * a + out[di] * (1 - a));
      out[di + 1] = Math.min(255, p.data[si + 1] * a + out[di + 1] * (1 - a));
      out[di + 2] = Math.min(255, p.data[si + 2] * a + out[di + 2] * (1 - a));
    }
  });
  const name = path.join('docs', 'custom-anim', 'preview', id + '-' + seq + '-sheet.png');
  fs.writeFileSync(name, PNG.sync.write({ width: W, height: H, data: out }));
  console.log('  ' + seq.padEnd(10) + files.length + ' 格 → ' + name + '  (' + W + '×' + H + ')');
}
