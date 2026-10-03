import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { planResourceSlimming, slimPackagedResources } from '../scripts/slim_electron_resources.mjs';
await mkdir(resolve('build'), { recursive: true }); const job = await mkdtemp(resolve('build/slimming-test-'));
const out = join(job, 'win-unpacked'), resources = join(out, 'resources');
async function put(name, value) { const p = join(resources, name); await mkdir(join(p, '..'), { recursive: true }); await writeFile(p, value); }
await put('dist/seer/body/123.png', 'same'); await put('public/seer/body/123.png', 'same');
await put('dist/elf-art/rey.png', 'rey'); await put('public/elf-art/rey.png', 'rey');
await put('dist/seer/index.json', 'index'); await put('public/seer/index.json', 'index');
await put('系/test.png', 'different'); await put('public/seer/xi/test.png', 'keep');
await put('pet/123.png', 'head'); await put('public/seer/head/123.png', 'different-head');
const plans = await planResourceSlimming(resources);
assert.deepEqual(plans.map(p => p.remove).sort(), ['dist/seer/body/123.png', 'public/elf-art/rey.png']);
const result = await slimPackagedResources(out, resolve('.')); assert.equal(result.filesRemoved, 2);
for (const p of plans) { await assert.rejects(stat(join(resources, p.remove)), { code: 'ENOENT' }); assert.equal(await readFile(join(resources, p.keep), 'utf8'), p.remove.includes('body') ? 'same' : 'rey'); }
assert.equal(await readFile(join(resources, 'dist/seer/index.json'), 'utf8'), 'index');
assert.equal(await readFile(join(resources, '系/test.png'), 'utf8'), 'different');
await assert.rejects(slimPackagedResources(resolve('.'), resolve('.')), /只允許/);
console.log('封裝瘦身：路由對應、同 bytes、不同內容保留、JSON 索引保留、越界拒絕通過。');
