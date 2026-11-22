#!/usr/bin/env node
// 分層動畫建置（草稿）：node scripts/build_layered_animation.mjs --spec docs/custom-anim/emperor_dixin.layered.mjs [--out build/layered]
// 只輸出到草稿目錄；正式發布另走 publish 流程（使用者驗收後）。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {PNG} from 'pngjs';
import {compileLayeredAnimation} from './lib/layeredAnimation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), get = key => args[args.indexOf(key) + 1];
if (!args.includes('--spec')) throw Error('Usage: node scripts/build_layered_animation.mjs --spec <module> [--out <draft directory>]');
const base = path.resolve(root, args.includes('--out') ? get('--out') : 'build/layered');
if (base === path.join(root, 'public') || base.startsWith(path.join(root, 'public') + path.sep)) throw Error('Build to a draft directory, then review before publishing');
const images = new Map();
const readPng = file => {
  const full = path.resolve(root, file);
  if (!images.has(full)) images.set(full, PNG.sync.read(fs.readFileSync(full)));
  return images.get(full);
};
const {default: makeSpec} = await import(pathToFileURL(path.resolve(root, get('--spec'))).href);
const spec = await makeSpec({root, readPng, readJson: file => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8').replace(/^﻿/, ''))});
const result = compileLayeredAnimation(spec);
const dest = path.join(base, spec.id);
fs.mkdirSync(dest, {recursive: true});
fs.writeFileSync(path.join(dest, 'atlas.png'), result.atlasBytes);
fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(result.manifest));
const layers = Object.fromEntries(Object.entries(result.manifest.sequences).map(([n, s]) => [n, {frames: s.frames, hits: s.hits, maxLayers: Math.max(...s.quads.map(q => q.L.length))}]));
console.log(JSON.stringify({draft: dest, atlas: result.manifest.atlas, atlasBytes: result.atlasBytes.length, manifestBytes: JSON.stringify(result.manifest).length, sequences: layers}, null, 2));
