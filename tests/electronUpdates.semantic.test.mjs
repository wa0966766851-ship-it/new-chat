import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { compareVersion, parseRelease, trustedUrl, downloadVerified, checkRelease } = require('../electron/update/releaseClient.cjs');
const { UpdateService } = require('../electron/update/updateService.cjs');
const bytes = Buffer.from('verified-new-exe-fixture'); const sha256 = createHash('sha256').update(bytes).digest('hex');
const name = '賽爾對戰模擬器-1.0.1-portable.exe';
const url = `https://github.com/wa0966766851-ship-it/new-chat/releases/download/v1.0.1/${encodeURIComponent(name)}`;
const release = { tag_name: 'v1.0.1', draft: false, prerelease: false, assets: [{ name, size: bytes.length, digest: `sha256:${sha256}`, browser_download_url: url }] };
const asset = parseRelease(release, '1.0.0', 'portable');
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`✓ ${name}`); };
await mkdir(resolve('build'), { recursive: true }); const temp = await mkdtemp(resolve('build/update-tests-'));
await check('semver 數字比較、舊版與同版不下載', () => { assert.equal(compareVersion('1.10.0', '1.2.0'), 1); assert.equal(parseRelease(release, '1.0.1', 'portable').status, 'latest'); });
for (const mutation of [{ prerelease: true }, { draft: true }, { tag_name: 'main' }, { assets: [] }, { assets: [{ ...release.assets[0], digest: '' }] }])
  await check('拒絕草稿／預覽／缺檔／缺校驗資訊', () => assert.throws(() => parseRelease({ ...release, ...mutation }, '1.0.0', 'portable')));
for (const bad of ['http://github.com/file', 'https://evil.test/file', 'https://github.com.evil.test/file', 'https://user:pass@github.com/file']) await check('來源白名單拒絕', () => assert.throws(() => trustedUrl(bad, true)));
await check('未發布 Release 明示，限流明示', async () => {
  assert.equal((await checkRelease('1.0.0', 'portable', async () => new Response('', { status: 404 }))).status, 'unpublished');
  await assert.rejects(checkRelease('1.0.0', 'portable', async () => new Response('', { status: 429 })), /限制/);
});
await check('允許可信 CDN 重新導向並核對大小和 hash', async () => {
  let calls = 0;
  const file = await downloadVerified(asset, join(temp, 'success'), { fetcher: async () => ++calls === 1 ? new Response(null, { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/file' } }) : new Response(bytes) });
  assert.deepEqual(await readFile(file), bytes); assert.equal(calls, 2);
});
await check('錯誤 hash 不留最終檔，清自己 part，不覆寫其他檔', async () => {
  const dir = join(temp, 'bad'); await mkdir(dir); await writeFile(join(dir, 'player.txt'), 'old');
  await assert.rejects(downloadVerified(asset, dir, { fetcher: async () => new Response(Buffer.alloc(bytes.length)) }), /校驗/);
  assert.deepEqual(await readdir(dir), ['player.txt']); assert.equal(await readFile(join(dir, 'player.txt'), 'utf8'), 'old');
});
await check('已有不同版本檔不覆寫', async () => {
  const dir = join(temp, 'existing'); await mkdir(dir); await writeFile(join(dir, name), 'keep');
  await assert.rejects(downloadVerified(asset, dir), /不會覆寫/); assert.equal(await readFile(join(dir, name), 'utf8'), 'keep');
});
await check('跨來源 redirect 拒絕', async () => {
  await assert.rejects(downloadVerified(asset, join(temp, 'redirect'), { fetcher: async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/exe' } }) }), /允許清單/);
});
await check('下載取消，不產生最終檔', async () => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(downloadVerified(asset, join(temp, 'cancel'), { signal: abort.signal, fetcher: async () => new Response(bytes) }), /取消/);
  assert.deepEqual(await readdir(join(temp, 'cancel')), []);
});
await check('真正另存新版、舊 EXE 核對備份、存檔備份、原檔未變動', async () => {
  const originalExe = join(temp, 'old.exe'); await writeFile(originalExe, 'OLD EXE');
  const service = new UpdateService({ version: '1.0.0', kind: 'portable', directory: join(temp, 'jobs'), originalExe,
    fetcher: async requested => requested.includes('api.github.com') ? new Response(JSON.stringify(release)) : new Response(bytes) });
  assert.equal((await service.check()).status, 'available');
  const snapshot = JSON.stringify({ schemaVersion: 1, storage: { seer_custom_elves: '[1]' } });
  const result = await service.download(snapshot); assert.equal(result.status, 'downloaded');
  assert.deepEqual(await readFile(result.file), bytes); assert.equal(await readFile(result.executableBackup, 'utf8'), 'OLD EXE');
  assert.equal(await readFile(join(result.folder, 'player-backup.json'), 'utf8'), snapshot); assert.equal(await readFile(originalExe, 'utf8'), 'OLD EXE');
  assert.equal(JSON.parse(await readFile(join(result.folder, 'receipt.json'), 'utf8')).release.sha256, sha256);
});
console.log(`桌面更新安全語意：${passed} 項通過；測試副本保留於 ${temp}`);
