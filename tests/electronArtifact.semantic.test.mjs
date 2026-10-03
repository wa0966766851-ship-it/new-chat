import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const resources = path.resolve('dist-electron/win-unpacked/resources');
const archive = path.join(resources, 'app.asar');
const entries = asar.listPackage(archive).map(name => name.replaceAll('\\', '/')).sort();
assert.deepEqual(entries, [
  '/electron', '/electron/main.cjs', '/electron/preload.cjs',
  '/electron/serverProcess.cjs', '/package.json',
]);
assert.deepEqual(JSON.parse(asar.extractFile(archive, 'package.json').toString()).dependencies, {});
for (const file of ['main.cjs', 'preload.cjs', 'serverProcess.cjs']) {
  assert.equal(asar.extractFile(archive, `electron/${file}`).toString(),
    await fs.readFile(path.join('electron', file), 'utf8'), `不得打包舊版 ${file}`);
}
for (const file of ['server.cjs', 'index.html', 'version.json']) {
  assert.deepEqual(await fs.readFile(path.join(resources, 'dist', file)),
    await fs.readFile(path.join('dist', file)), `不得打包舊版 ${file}`);
}
for (const directory of ['images', 'public', '系', 'pet']) {
  assert.ok((await fs.stat(path.join(resources, directory))).isDirectory());
}
assert.ok(!(await fs.readdir(resources)).some(name => name.startsWith('.env')));
console.log('Electron 封裝：入口與正式建置一致、圖片資源齊備、未攜帶 node_modules 或 .env。');
