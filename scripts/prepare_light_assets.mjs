import { readFile, writeFile, mkdir, cp, access, copyFile, unlink } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { listFiles } from './slim_electron_resources.mjs';
const { validateAssetManifest } = createRequire(import.meta.url)('../electron/update/assetCache.cjs');
const source = resolve(process.argv[2] || 'dist-electron/win-unpacked');
const destination = resolve(process.argv[3] || 'build/electron-lite/win-unpacked');
const project = resolve('.'); const rel = relative(project, destination);
if (!rel.startsWith('build' + sep) || !destination.endsWith(sep + 'win-unpacked') || source === destination) throw new Error('輕量版只能建立在 build 內的新 win-unpacked 目錄');
try { await access(destination); throw new Error('目的地已有內容，不會覆寫；請指定新的輸出目錄'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const resources = join(source, 'resources'); const version = JSON.parse(await readFile(join(resources, 'dist/version.json'), 'utf8')).version;
const files = await listFiles(resources); const manifest = { schemaVersion: 1, version, entries: [] }; const selections = [];
for (const file of files) {
  let url;
  if (/^dist\/elf-art\/[^/]+\.png$/.test(file)) url = '/' + file.slice(5);
  else if (/^images\/[^/]+\.png$/.test(file)) url = '/' + file;
  else if (/^public\/seer\/body\/\d+\.png$/.test(file)) url = '/' + file.slice(7);
  if (!url) continue;
  const bytes = await readFile(join(resources, file)); if (bytes.length < 65536) continue;
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`不是有效 PNG：${file}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex'); const fileName = `asset-${sha256}.png`;
  manifest.entries.push({ url, fileName, size: bytes.length, sha256, downloadUrl: `https://github.com/wa0966766851-ship-it/new-chat/releases/download/v${version}/${fileName}` }); selections.push({ file, fileName });
}
validateAssetManifest(manifest); await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
const attachments = join(destination, '..', 'release-assets'); await mkdir(attachments, { recursive: true });
const copied = new Set();
for (const item of selections) {
  if (!copied.has(item.fileName)) { await copyFile(join(resources, item.file), join(attachments, item.fileName)); copied.add(item.fileName); }
  await unlink(join(destination, 'resources', item.file));
}
await writeFile(join(destination, 'resources/dist/asset-manifest.json'), JSON.stringify(manifest));
await writeFile(join(attachments, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ destination, attachments, images: selections.length, uniqueAttachments: copied.size, bytesDeferred: manifest.entries.reduce((n, e) => n + e.size, 0) }, null, 2));
