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
