/** 分層動畫的連續形變（warp）：相鄰本體零件共用同一個世界座標位移場，接縫處頂點位移一致（2026-11-22 使用者回報待機時身體分裂）。 */
import assert from 'node:assert/strict';
// @ts-ignore 建置腳本是 .mjs
import {compileLayeredAnimation} from '../scripts/lib/layeredAnimation.mjs';
// @ts-ignore
import {idleField} from '../docs/custom-anim/lib/layeredKit.mjs';

const img = (w: number, h: number) => ({width: w, height: h, data: new Uint8Array(w * h * 4).fill(255)});
const image = img(8, 16);
const FIELD = {foot: 0, top: 4, cx: 1, halfW: 1};
const spec = {
  id: 't', elfId: 't', elfName: 't', fps: 24, facing: 'left', presentation: {}, physicalMotion: 'stationary',
  canvas: [200, 400], pixelsPerUnit: 50, pivot: [1, 0], restPart: 'lower',
  parts: [
    {id: 'lower', kind: 'body', image, rect: [0, 8, 8, 8], scale: 1, rest: [0, 2, 2, 0]},
    {id: 'upper', kind: 'body', image, rect: [0, 0, 8, 8], scale: 1, rest: [0, 4, 2, 2]},
  ],
  sequences: {standby: {loop: true, frames: [.25, .5].map(t => [
    {part: 'lower', warp: idleField(FIELD, t, 20)},
    {part: 'upper', warp: idleField(FIELD, t, 20)},
  ])}},
};
const {manifest} = compileLayeredAnimation(spec);
for (const frame of manifest.sequences.standby.quads) {
  const pts = (y: number) => frame.L.flatMap((l: any) => [0, 2, 4, 6].map(i => [l.p[i], l.p[i + 1]])).filter(([, py]: number[]) => Math.abs(py - y) < .2);
  // 下身頂邊（y=2 附近）與上身底邊的頂點：同一個 x 必須有同一個位移後座標
  const seam = pts(2 + 0);
  const byX = new Map<string, number[]>();
  for (const [x, y] of seam) { const k = x.toFixed(2); byX.set(k, [...(byX.get(k) || []), y]); }
  assert.ok(seam.length >= 8, '接縫兩側都有頂點');
  for (const ys of byX.values()) assert.ok(Math.max(...ys) - Math.min(...ys) < 1e-3, '接縫頂點位移一致：' + ys.join(','));
  assert.equal(frame.L.length, 2 * 4 * 6, '每個零件切成 4×6 網格');
}
// 腳底固定：y=0 的頂點不動
const feet = manifest.sequences.standby.quads[0].L.flatMap((l: any) => [1, 3, 5, 7].map(i => l.p[i])).filter((y: number) => Math.abs(y) < .05);
assert.ok(feet.length && feet.every((y: number) => Math.abs(y) < 1e-3), '腳底不動');
console.log('layeredWarp: ok');
