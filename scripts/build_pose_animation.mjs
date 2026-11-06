#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compilePoseAnimation} from './lib/poseAnimation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), get = key => args[args.indexOf(key) + 1];
if (!args.includes('--spec')) throw Error('Usage: node scripts/build_pose_animation.mjs --spec <file> [--out <draft directory>]');
const spec = JSON.parse(fs.readFileSync(path.resolve(root, get('--spec')), 'utf8').replace(/^\uFEFF/, ''));
const base = path.resolve(root, args.includes('--out') ? get('--out') : 'build/pose-animation');
// Production publication is a separate reviewed action; this command only writes drafts.
if (base === path.join(root, 'public') || base.startsWith(path.join(root, 'public') + path.sep)) throw Error('Build to a draft directory, then review before publishing');
const result = compilePoseAnimation(spec, file => fs.readFileSync(path.resolve(root, file)));
const dest = path.join(base, spec.id);
fs.mkdirSync(dest, {recursive: true});
fs.writeFileSync(path.join(dest, 'atlas.png'), result.atlasBytes);
fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(result.manifest));
fs.writeFileSync(path.join(dest, 'review.json'), JSON.stringify(result.manifest.production, null, 2));
console.log(JSON.stringify({draft: dest, drawings: result.manifest.production.uniqueDrawings,
  downloadBytes: result.atlasBytes.length, decodedBytes: result.manifest.production.rgbaBytes,
  sequences: Object.fromEntries(Object.entries(result.manifest.sequences).map(([n, s]) => [n, {frames: s.frames, hits: s.hits, events: s.events}]))}, null, 2));
