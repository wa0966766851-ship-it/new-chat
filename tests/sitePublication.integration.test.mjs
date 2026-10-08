// Local acceptance harness: exercises the exact Site worker candidate and a
// complete website package. No requests leave this process; no real keys used.
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { publishPackage } from '../scripts/publish_site_package.mjs';
const packageRoot = resolve(process.argv[2] || 'build/site-package-connected-20261004');
const workerPath = resolve(process.argv[3] || '../seer-site-update-readonly-20261004/worker/index.js');
const { default: worker } = await import(pathToFileURL(workerPath).href);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
class MemoryBucket {
  entries = new Map(); writes = 0; operations = 0;
  async get(key) {
    this.operations++;
    const object = this.entries.get(key);
    return object ? { ...object, json: async () => JSON.parse(object.bytes.toString()), text: async () => object.bytes.toString(), body: new Uint8Array(object.bytes) } : null;
  }
  async head(key) { return this.get(key); }
  async put(key, value, options = {}) {
    this.operations++;
    const old = this.entries.get(key), condition = options.onlyIf;
    if ((condition instanceof Headers && condition.get('if-none-match') === '*' && old) || (condition?.etagMatches && condition.etagMatches !== old?.etag)) return null;
    const bytes = Buffer.from(value);
    const object = { bytes, size: bytes.length, etag: String(++this.writes), customMetadata: options.customMetadata };
    this.entries.set(key, object); return object;
  }
}
const credentials = { publisher: 'local-test-only-'.repeat(4), service: 'local-test-service' };
const env = { BUCKET: new MemoryBucket(), SEER_PUBLISH_KEY: credentials.publisher };
const site = 'https://seer-battle-preview.worry0487.chatgpt.site';
const calls = []; let mode = 'normal'; let manifestOperations = 0;
const fetcher = async (url, init) => {
  assert.equal(new URL(url).origin, site);
  assert.equal(init.redirect, 'error');
  assert.equal(init.headers['OAI-Sites-Authorization'], `Bearer ${credentials.service}`);
  const path = new URL(url).pathname; calls.push(path);
  if (path === '/version.json' && mode === 'verification-unavailable') return new Response(null, { status: 503 });
  if (path === '/version.json' && mode === 'wrong-version') return Response.json({ buildId: '0'.repeat(64), commit: '0'.repeat(40), version: 'invalid' });
  if (mode === 'interrupted' && init.method === 'PUT') return Response.json({}, { status: 503 });
  const body = mode === 'corrupted' && init.method === 'PUT' ? Buffer.from('corrupted') : init.body;
  const before = env.BUCKET.operations;
  const response = await worker.fetch(new Request(url, { ...init, body }), env);
  if (path === '/_updates/manifest') manifestOperations = env.BUCKET.operations - before;
  return response;
};
const read = (path, headers = {}) => worker.fetch(new Request(site + path, { headers }), env);
const activeId = async () => (await (await env.BUCKET.get('active')).json()).buildId;
const oldId = '1'.repeat(64), commit = '2'.repeat(40);
const fixture = await mkdtemp(join(tmpdir(), 'seer-site-acceptance-'));
const oldFiles = [ ['index.html', '<script src="/assets/old.js"></script>'], ['version.json', JSON.stringify({ buildId: oldId, commit, version: '1.0.0' })], ['assets/old.js', 'import("./lazy.js")'], ['assets/lazy.js', 'export default 7'] ];
const old = { schemaVersion: 1, buildId: oldId, commit, version: '1.0.0', files: [] };
for (const [path, text] of oldFiles) {
  await mkdir(dirname(join(fixture, path)), { recursive: true }); await writeFile(join(fixture, path), text);
  old.files.push({ path, size: Buffer.byteLength(text), sha256: hash(text) });
}
await writeFile(join(fixture, 'web-package-manifest.json'), JSON.stringify(old));
await publishPackage(fixture, credentials, fetcher);
assert.equal(await activeId(), oldId);
for (const failure of ['verification-unavailable', 'wrong-version']) {
  mode = failure;
  await assert.rejects(publishPackage(fixture, credentials, fetcher), /啟用後/);
  assert.equal(await activeId(), oldId); // 校驗失敗不能假報成功或刪除已啟用的資源。
  assert.equal((await read(`/__build/${oldId}/assets/lazy.js`)).status, 200);
}
for (const failure of ['interrupted', 'corrupted']) {
  calls.length = 0; mode = failure;
  await assert.rejects(publishPackage(packageRoot, credentials, fetcher));
  assert.equal(await activeId(), oldId);
  assert.ok(!calls.includes('/_updates/manifest'));
  assert.ok(!calls.includes('/_updates/activate'));
}
mode = 'normal'; calls.length = 0;
const manifest = JSON.parse(await readFile(join(packageRoot, 'web-package-manifest.json'), 'utf8'));
const result = await publishPackage(packageRoot, credentials, fetcher);
assert.equal(result.previousBuildId, oldId);
assert.equal(await activeId(), manifest.buildId);
assert.deepEqual(calls.slice(-3), ['/_updates/activate', '/_updates/status', '/version.json']);
assert.equal(result.verified, true);
assert.equal(result.commit, manifest.commit);
assert.equal((await read('/')).headers.get('location'), `/__build/${manifest.buildId}/`);
assert.equal((await (await read('/version.json')).json()).buildId, manifest.buildId);
for (const file of manifest.files) {
  const response = await read(`/__build/${manifest.buildId}/${file.path}`);
  assert.equal(response.status, 200, file.path);
  assert.equal(response.headers.get('x-seer-build-id'), manifest.buildId);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (file.path === 'index.html') {
    assert.match(bytes.toString(), new RegExp(`/__build/${manifest.buildId}/assets/`));
    assert.ok(!bytes.includes(Buffer.from(credentials.publisher)));
  } else assert.equal(hash(bytes), file.sha256, file.path);
}
assert.equal((await read(`/__build/${oldId}/assets/lazy.js`)).status, 200);
assert.equal((await read('/assets/old.js', { Referer: `${site}/__build/${oldId}/` })).status, 200);
const writes = env.BUCKET.writes;
assert.equal((await worker.fetch(new Request(`${site}/_updates/activate`, { method: 'POST', body: JSON.stringify({ buildId: oldId, expectedBuildId: manifest.buildId }) }), env)).status, 403);
assert.equal(env.BUCKET.writes, writes);
const rollback = await fetcher(`${site}/_updates/activate`, { method: 'POST', redirect: 'error', headers: { 'OAI-Sites-Authorization': `Bearer ${credentials.service}`, 'X-Seer-Publish-Key': credentials.publisher }, body: JSON.stringify({ buildId: oldId, expectedBuildId: manifest.buildId }) });
assert.equal(rollback.status, 200); assert.equal(await activeId(), oldId);
assert.equal((await read(`/__build/${manifest.buildId}/index.html`)).status, 200);
console.log(JSON.stringify({ result: 'passed', packageFiles: manifest.files.length, manifestStorageOperations: manifestOperations, checks: ['interrupted upload retains old version', 'corrupted upload rejected', 'all resources and lazy modules readable', 'old tab pinned', 'publisher key required', 'rollback keeps both versions', 'post-activation lookup failure cannot report success', 'mismatched live version cannot report success'], scope: 'local mock only; platform visitor sharing and real R2 unverified', temporaryFixture: fixture }));
