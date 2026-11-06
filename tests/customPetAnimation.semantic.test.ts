/** 自製動作素材的格式契約。
 * 素材由 scripts/build_custom_animation.mjs 烘焙，這裡只驗「播放器吃不吃得下」，
 * 不驗好不好看（那要人眼看圖）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {customClipFromManifest} from '../src/battle/customPetClip';
import {PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';

const IDS = ['wuxu_zhuixing', 'wuxu_shiyan', 'emperor_dixin', 'wuxu_liuren'];
const root = path.resolve('public/elf-anim');
let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + (e as Error).message); }
};

for (const id of IDS) {
  const dir = path.join(root, id);
  console.log('\n[' + id + ']');
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
    console.log('  ✗ 缺少 manifest（先跑 npm run anim:build）'); fail++; continue;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

  check('圖集存在且尺寸相符', () => {
    const atlasPath = path.join(dir, manifest.atlas.file);
    assert.ok(fs.existsSync(atlasPath), 'atlas.png 不存在');
    const bytes = fs.statSync(atlasPath).size;
    assert.equal(bytes, manifest.size, 'manifest.size 與實際檔案大小不符');
  });

  check('登記表有這筆、custom 指向同一個目錄', () => {
    const meta = (PET_ANIMATION_ASSETS as Record<string, {custom?: string}>)[id];
    assert.ok(meta, 'PET_ANIMATION_ASSETS 沒有 ' + id);
    assert.equal(meta.custom, '/elf-anim/' + id);
  });

  check('序列與登記表一致', () => {
    const meta = (PET_ANIMATION_ASSETS as Record<string, {sequences: readonly {name: string; frames: number}[]}>)[id];
    const declared = meta.sequences.map((s) => s.name + ':' + s.frames).sort().join(',');
    const baked = Object.entries(manifest.sequences).map(([n, s]: [string, any]) => n + ':' + s.frames).sort().join(',');
    assert.equal(declared, baked, '登記表 ' + declared + ' ≠ 烘焙 ' + baked);
  });

  check('第五技能確實指向專屬片段', () => {
    const meta = PET_ANIMATION_ASSETS[id as keyof typeof PET_ANIMATION_ASSETS];
    assert.ok(manifest.sequences.ultimate, '缺少第五技能片段');
    assert.equal(meta.fullscreen?.ultimate, 'ultimate', '播放器仍會退回普通攻擊');
  });

  // 本體四邊形是「角色格」在畫布上的擺放位置，出招時本來就會衝出畫布邊界（那是位移），
  // 所以只檢查數值有限、變動幅度合理；光效則是實際畫在畫布裡的像素，越界就是被裁掉了。
  check('本體四邊形數值有限、位移幅度合理', () => {
    const ppu = manifest.pixelsPerUnit;
    const [cw, ch] = manifest.canvas;
    const limit = Math.max(cw, ch) * 1.5;
    for (const [name, seq] of Object.entries(manifest.sequences) as [string, any][]) {
      for (const q of seq.quads) {
        // 兩種格式都支援：
        //   g = 逐幀網格（一張貼圖 + 每格自己的頂點，官方 .pet 的做法）
        //   c = 單一四邊形（舊格式，靠整體位移／縮放）
        const verts: number[] = [];
        if (Array.isArray(q.g) && q.g.length) {
          for (const cell of q.g) for (let i = 0; i < 8; i++) verts.push(cell.p[i]);
        } else if (Array.isArray(q.c)) {
          for (let i = 0; i < 8; i++) verts.push(q.c[i]);
        } else {
          assert.fail(name + ' 本體既沒有 g 也沒有 c');
        }
        for (const raw of verts) {
          const v = raw * ppu;
          assert.ok(Number.isFinite(v), name + ' 本體座標非有限值');
          assert.ok(Math.abs(v) <= limit, name + ' 本體位移過大 ' + v.toFixed(1) + '（上限 ' + limit.toFixed(0) + '）');
        }
        assert.ok(q.a >= 0 && q.a <= 1, name + ' alpha 越界 ' + q.a);
      }
    }
  });

  check('光效四邊形在畫布範圍內', () => {
    const [cw, ch] = manifest.canvas;
    const ppu = manifest.pixelsPerUnit;
    for (const [name, seq] of Object.entries(manifest.sequences) as [string, any][]) {
      for (const q of seq.quads) {
        if (!q.f) continue;
        for (let i = 0; i < 8; i += 2) {
          const x = q.f[i] * ppu, y = q.f[i + 1] * ppu;
          assert.ok(x >= -2 && x <= cw + 2, name + ' 光效 x 越界 ' + x.toFixed(1));
          assert.ok(y >= -2 && y <= ch + 2, name + ' 光效 y 越界 ' + y.toFixed(1));
        }
      }
    }
  });

  check('UV 落在 0..1 且左上小於右下', () => {
    for (const [name, seq] of Object.entries(manifest.sequences) as [string, any][]) {
      for (const q of seq.quads) {
        if (!q.fuv) continue;
        for (const v of q.fuv) assert.ok(v >= 0 && v <= 1, name + ' UV 越界 ' + v);
        assert.ok(q.fuv[0] < q.fuv[2] && q.fuv[1] < q.fuv[3], name + ' UV 順序不對');
      }
    }
  });

  check('轉成 SwfClipData 後每幀 mesh 合法', () => {
    const clip = customClipFromManifest(manifest as any, {width: manifest.atlas.width, height: manifest.atlas.height} as ImageBitmap);
    assert.equal(clip.frameRate, manifest.fps);
    assert.equal(clip.atlasWidth, manifest.atlas.width);
    for (const seq of clip.sequences) {
      assert.ok(seq.frames.length > 0, seq.name + ' 沒有影格');
      for (const [i, f] of seq.frames.entries()) {
        const verts = f.mesh.positions.length / 2;
        assert.equal(verts % 4, 0, seq.name + '#' + i + ' 頂點數不是 4 的倍數');
        assert.equal(f.mesh.uvs.length, f.mesh.positions.length, seq.name + '#' + i + ' uv 與 position 數量不符');
        assert.equal(f.mesh.mulColors.length, verts * 4);
        assert.equal(f.mesh.indices.length, (verts / 4) * 6);
        // 索引是「相對 subMesh 起點」的局部值（播放器會做 indices[i] - startVertex），
        // 所以越界檢查要逐 subMesh 用各自的頂點數判斷。
        // 播放器計算方式：indices[indexStart+j] - startVertex。
        // 所以 indices 存的是絕對索引，減完必須落在 [0, subVerts) 內。
        for (const sm of f.mesh.subMeshes) {
          const subVerts = (sm.indexCount / 6) * 4;
          for (let k = 0; k < sm.indexCount; k++) {
            const local = f.mesh.indices[sm.indexStart + k] - sm.startVertex;
            assert.ok(local >= 0 && local < subVerts, seq.name + '#' + i + ' subMesh 相對索引越界 ' + local + ' 不在 [0,' + subVerts + ')');
          }
        }
        // subMesh 數：本體與光效分開（光效要 add 混合才會發亮），沒有光效的幀只有 1 個。
        assert.ok(f.mesh.subMeshes.length >= 1 && f.mesh.subMeshes.length <= 2, seq.name + '#' + i + ' subMesh 數量異常 ' + f.mesh.subMeshes.length);
        const totalIndex = f.mesh.subMeshes.reduce((a, sm) => a + sm.indexCount, 0);
        assert.equal(totalIndex, f.mesh.indices.length, seq.name + '#' + i + ' subMesh 索引總數不符');
      }
    }
  });

  check('命中幀有 action_hit 標記', () => {
    const clip = customClipFromManifest(manifest as any, {width: 1, height: 1} as ImageBitmap);
    for (const [name, seq] of Object.entries(manifest.sequences) as [string, any][]) {
      if (!seq.hits.length) continue;
      const c = clip.sequences.find((s) => s.name === name)!;
      for (const hit of seq.hits) {
        assert.deepEqual(c.frames[hit].labels, ['action_hit'], name + ' 第 ' + hit + ' 幀缺 action_hit');
      }
    }
  });
}

console.log('\n' + pass + ' pass / ' + fail + ' fail');
if (fail) process.exit(1);
