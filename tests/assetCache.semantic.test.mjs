import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { AssetCache, validateAssetManifest } = createRequire(import.meta.url)('../electron/update/assetCache.cjs');
const bytes = Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const fileName = `asset-${sha256}.png`;
const item = { url: '/elf-art/rey.png', fileName, size: bytes.length, sha256,
  downloadUrl: `https://github.com/wa0966766851-ship-it/new-chat/releases/download/v1.0.1/${fileName}` };
const manifest = { schemaVersion: 1, version: '1.0.1', entries: [item] };
assert.equal(validateAssetManifest(manifest), manifest);
for (const change of [{ url: '/elf-art/../rey.png' }, { url: '/seer/body/x.png' }, { sha256: 'bad' },
  { size: 0 }, { size: 33 * 1024 * 1024 }, { fileName: 'x.exe' }, { downloadUrl: 'https://evil.test/x.png' }]) {
  assert.throws(() => validateAssetManifest({ ...manifest, entries: [{ ...item, ...change }] }));
}
assert.throws(() => validateAssetManifest({ ...manifest, entries: [item, item] }));
await mkdir(resolve('build'), { recursive: true });
const dir = await mkdtemp(resolve('build/asset-cache-test-'));
let calls = 0;
const cache = new AssetCache(manifest, dir, async url => {
  assert.equal(url, item.downloadUrl); calls++; return new Response(bytes);
});
const [a, b] = await Promise.all([cache.get(item.url), cache.get(item.url)]);
assert.equal(a, b); assert.equal(calls, 1); assert.deepEqual(await readFile(a), bytes);
assert.equal(await cache.get(item.url), a); assert.equal(calls, 1, '已校驗素材可離線重用');
assert.equal(await cache.get('/unknown.png'), null);
await writeFile(a, 'corrupt cache');
assert.equal(await cache.get(item.url), a); assert.equal(calls, 2);
assert.ok((await readdir(join(dir, sha256))).some(n => n.includes('.corrupt-')), '損壞快取先保留');
const bad = new AssetCache(manifest, join(dir, 'bad'), async () => new Response(Buffer.alloc(bytes.length)));
await assert.rejects(bad.get(item.url), /完整性/);
assert.ok(!(await readdir(join(dir, 'bad', sha256))).some(n => n.endsWith('.png')));
assert.equal(bad.running, 0); assert.equal(bad.pending.size, 0);
console.log('素材清單安全、併發去重、SHA-256、離線快取、損壞隔離與下載失敗保護通過。');
