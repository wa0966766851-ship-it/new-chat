import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { listFiles } from '../scripts/slim_electron_resources.mjs';
const root = resolve(process.argv[2] || 'build/web-package');
const manifest = JSON.parse(await readFile(join(root, 'web-package-manifest.json'), 'utf8'));
assert.equal(manifest.schemaVersion, 1);
assert.match(manifest.commit, /^[a-f0-9]{40}$/); assert.match(manifest.buildId, /^[a-f0-9]{64}$/);
const files = await listFiles(root);
assert.deepEqual(files.sort(), [...manifest.files.map(f => f.path), 'web-package-manifest.json'].sort());
assert.ok(files.includes('images/img_018.png'));
// Express 的官方素材下載快取不會隨靜態網站發布；正式匯入精靈需自帶圖檔。
const importedArt = JSON.parse(await readFile(join(root, 'seer/4937.source.json'), 'utf8'));
for (const art of importedArt.files) {
  assert.ok(files.includes(art.path), `星光雷納多網站素材缺漏：${art.path}`);
  const image = await readFile(join(root, art.path));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(createHash('sha256').update(image).digest('hex'), art.sha256);
}
assert.ok(!files.some(f => /server\.cjs|\.env|node_modules|\.map$/.test(f)));
for (const file of manifest.files) {
  const bytes = await readFile(join(root, file.path));
  assert.equal(bytes.length, file.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
}
const workflow = await readFile('.github/workflows/build-web-package.yml', 'utf8');
assert.match(workflow, /workflow_dispatch/); assert.match(workflow, /contents: read/);
assert.match(workflow, /upload-artifact/);
assert.ok(!/deploy-pages|publish never|GEMINI_API_KEY|OPENAI_API_KEY|GITHUB_PAT|git push/.test(workflow));
assert.match(workflow, /if: \$\{\{ inputs.publish \}\}/);
assert.match(workflow, /secrets.SEER_SITE_SERVICE_TOKEN/);
assert.match(workflow, /secrets.SEER_SITE_PUBLISH_KEY/);
console.log(`網站套件 ${manifest.files.length} 檔逐一 SHA-256 核對，特殊模式背景保留；發布需明確勾選並使用私密變數，沒有 AI 呼叫。`);
