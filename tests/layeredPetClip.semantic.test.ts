/** 分層影格（L）契約：零件＋逐格變換的影格能被播放器吃下——
 * 每個圖層 4 頂點、乘色含 alpha、加色寫入、混合模式相同的相鄰圖層合併為同一 subMesh、命中標記保留。 */
import assert from 'node:assert/strict';
import {customClipFromManifest} from '../src/battle/customPetClip';

const sq = (x: number, y: number) => [x, y + 1, x + 1, y + 1, x + 1, y, x, y];
const uv = [0, 0, .5, 0, .5, .5, 0, .5];
const manifest: any = {
  id: 't', elfId: 't', elfName: 't', fps: 24, facing: 'left', canvas: [100, 100], pixelsPerUnit: 10,
  atlas: {file: 'atlas.png', width: 8, height: 8}, character: {uv: [0, 0, .5, .5], size: [4, 4]}, poseBlend: false,
  sequences: {attack: {frames: 2, hits: [1], events: {}, quads: [
    {a: 1, L: [{p: sq(0, 0), u: uv}]},
    {a: 1, L: [{p: sq(0, 0), u: uv, m: [0, 0, 0], t: [1, 1, 1]}, {p: sq(1, 0), u: uv, b: 'a', a: .5}, {p: sq(2, 0), u: uv, b: 'a'}, {p: sq(3, 0), u: uv}]},
  ]}},
};
const clip = customClipFromManifest(manifest, {width: 8, height: 8} as ImageBitmap);
const [f0, f1] = clip.sequences[0].frames;
assert.equal(f0.mesh.positions.length, 8);
assert.equal(f0.mesh.subMeshes.length, 1);
assert.equal(f1.mesh.positions.length, 4 * 4 * 2, '4 個圖層 → 16 頂點');
assert.deepEqual([...f1.mesh.mulColors.slice(0, 4)], [0, 0, 0, 1], '閃白：乘色 0');
assert.deepEqual([...f1.mesh.addColors.slice(0, 4)], [1, 1, 1, 0], '閃白：加色 1');
assert.equal(f1.mesh.mulColors[4 * 4 + 3], .5, '圖層 alpha 寫入乘色');
assert.equal(f1.mesh.subMeshes.length, 3, '一般｜加算×2（合併）｜一般');
assert.deepEqual(f1.mesh.subMeshes.map(s => [s.startVertex, s.indexStart, s.indexCount]), [[0, 0, 6], [4, 6, 12], [12, 18, 6]]);
for (const sm of f1.mesh.subMeshes) for (let k = 0; k < sm.indexCount; k++) {
  const local = f1.mesh.indices[sm.indexStart + k] - sm.startVertex;
  assert.ok(local >= 0 && local < sm.indexCount / 6 * 4, '相對索引越界');
}
assert.notEqual(f1.mesh.subMeshes[0].material, f1.mesh.subMeshes[1].material, '加算圖層用不同材質');
assert.deepEqual(f1.labels, ['action_hit']);
console.log('layeredPetClip: ok');
