import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const { NtExecutable, NtExecutableResource, Data, Resource } = await import('resedit');
const resources = path.resolve('dist-electron/win-unpacked/resources');
const version = JSON.parse(await fs.readFile('package.json', 'utf8')).version;
const archive = path.join(resources, 'app.asar');
const entries = asar.listPackage(archive).map(name => name.replaceAll('\\', '/')).sort();
assert.deepEqual(entries, [
  '/electron', '/electron/main.cjs', '/electron/preload.cjs',
  '/electron/serverProcess.cjs', '/electron/update', '/electron/update/releaseClient.cjs',
  '/electron/update/updateService.cjs', '/package.json',
]);
assert.deepEqual(JSON.parse(asar.extractFile(archive, 'package.json').toString()).dependencies, {});
for (const file of ['main.cjs', 'preload.cjs', 'serverProcess.cjs']) {
  assert.equal(asar.extractFile(archive, `electron/${file}`).toString(),
    await fs.readFile(path.join('electron', file), 'utf8'), `不得打包舊版 ${file}`);
}
for (const file of ['releaseClient.cjs', 'updateService.cjs']) {
  assert.equal(asar.extractFile(archive, path.join('electron', 'update', file)).toString(),
    await fs.readFile(path.join('electron/update', file), 'utf8'));
}
for (const file of ['server.cjs', 'index.html', 'version.json']) {
  assert.deepEqual(await fs.readFile(path.join(resources, 'dist', file)),
    await fs.readFile(path.join('dist', file)), `不得打包舊版 ${file}`);
}
for (const directory of ['images', 'public', '系', 'pet']) {
  assert.ok((await fs.stat(path.join(resources, directory))).isDirectory());
}
assert.ok(!(await fs.readdir(resources)).some(name => name.startsWith('.env')));
const expectedIcons = Data.IconFile.from(await fs.readFile('electron/assets/holy-puni.ico')).icons;
assert.deepEqual(expectedIcons.map(icon => icon.width || icon.data.width), [16, 24, 32, 48, 64, 128, 256]);
// Inspect the PE resources, not just the builder configuration or a cached Explorer icon.
for (const executable of [
  'dist-electron/win-unpacked/賽爾對戰模擬器.exe',
  `dist-electron/賽爾對戰模擬器-${version}-portable.exe`,
  `dist-electron/賽爾對戰模擬器-${version}-win-x64.exe`,
]) {
  const exe = NtExecutable.from(await fs.readFile(executable));
  const resource = NtExecutableResource.from(exe);
  const iconGroups = Resource.IconGroupEntry.fromEntries(resource.entries);
  assert.ok(iconGroups.some(group => {
    const actual = group.getIconItemsFromEntries(resource.entries);
    // NSIS reverses the frame order; compare every PNG frame, not directory order.
    return actual.length === expectedIcons.length && expectedIcons.every(expected =>
      actual.some(icon => icon.isRaw() && Buffer.from(icon.bin).equals(Buffer.from(expected.data.bin))));
  }), `${executable} 必須真正嵌入聖靈譜尼圖標`);
}
console.log('Electron 封裝：入口與正式建置一致、圖片資源齊備、未攜帶 node_modules 或 .env。');
console.log('Electron 圖標：桌面、免安裝、安裝三份 EXE 的圖標資源均逐幀一致。');
