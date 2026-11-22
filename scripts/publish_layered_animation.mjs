#!/usr/bin/env node
// 分層動畫發布（使用者驗收後才執行）：
//   node scripts/publish_layered_animation.mjs --draft <草稿目錄>/<id>
// 1. 舊版正式素材（atlas／manifest／fx 序列圖）先備份到 docs/custom-anim/pose-source/<id>/（已存在則不覆寫）；
//    分層規格的本體姿勢圖即取自這份備份，之後重建不依賴 public/。
// 2. 草稿 atlas.png、manifest.json 複製到 public/elf-anim/<id>/；bakedFx 時舊 fx 序列圖自 public 移除（光效已烘進影格）。
// 3. 更新 src/battle/petAnimationAssets.ts 該筆：atlas 尺寸、size、sha256、sequences、presentation（取自規格）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), get = key => args[args.indexOf(key) + 1];
if (!args.includes('--draft')) throw Error('Usage: node scripts/publish_layered_animation.mjs --draft <draft dir>/<id>');
const draft = path.resolve(root, get('--draft'));
const manifest = JSON.parse(fs.readFileSync(path.join(draft, 'manifest.json'), 'utf8'));
if (manifest.production?.method !== 'layered-parts') throw Error('Only layered-parts drafts can be published here');
const id = manifest.id, pub = path.join(root, 'public/elf-anim', id), backup = path.join(root, 'docs/custom-anim/pose-source', id);

if (!fs.existsSync(backup)) {
  fs.mkdirSync(backup, {recursive: true});
  for (const f of ['atlas.png', 'manifest.json']) fs.copyFileSync(path.join(pub, f), path.join(backup, f));
  if (fs.existsSync(path.join(pub, 'fx'))) fs.cpSync(path.join(pub, 'fx'), path.join(backup, 'fx'), {recursive: true});
  console.log('backup', path.relative(root, backup));
}
const atlas = fs.readFileSync(path.join(draft, 'atlas.png'));
const sha256 = crypto.createHash('sha256').update(atlas).digest('hex');
if (sha256 !== manifest.sha256) throw Error('Draft atlas does not match its manifest');
const assetsFile = path.join(root, 'src/battle/petAnimationAssets.ts');
const lines = fs.readFileSync(assetsFile, 'utf8').split('\n');
const at = lines.findIndex(l => l.trimStart().startsWith(`${id}: {`));
if (at < 0) throw Error('Missing petAnimationAssets entry ' + id);
let line = lines[at];
const replaceJson = (key, value) => {
  const start = line.indexOf(`${key}:`);
  if (start < 0) throw Error('Missing field ' + key);
  let i = start + key.length + 1, depth = 0;
  for (; i < line.length; i++) { const ch = line[i]; if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') { depth--; if (!depth) { i++; break; } } }
  line = line.slice(0, start) + `${key}:${JSON.stringify(value)}` + line.slice(i);
};
// 演出設定以規格為準：bakedFx（光效全烘進影格）時不留序列圖；遠程型保留對手處的序列圖，自身處的已烘進影格。
const presentation = {...manifest.presentation};
if (presentation.bakedFx) delete presentation.fxSheets;
replaceJson('presentation', presentation);
replaceJson('sequences', Object.entries(manifest.sequences).map(([name, s]) => ({name, frames: s.frames, hits: s.hits})));
line = line.replace(/atlas:\[\d+,\d+\] as const/, `atlas:[${manifest.atlas.width},${manifest.atlas.height}] as const`)
  .replace(/size:\d+,sha256:'[0-9a-f]+'/, `size:${atlas.length},sha256:'${sha256}'`);
lines[at] = line;
fs.writeFileSync(assetsFile, lines.join('\n'));
fs.writeFileSync(path.join(pub, 'atlas.png'), atlas);
fs.copyFileSync(path.join(draft, 'manifest.json'), path.join(pub, 'manifest.json'));
if (presentation.bakedFx) fs.rmSync(path.join(pub, 'fx'), {recursive: true, force: true});


console.log(JSON.stringify({published: path.relative(root, pub), size: atlas.length, sha256}));
