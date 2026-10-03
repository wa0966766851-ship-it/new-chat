import { readdir, readFile, stat, unlink, writeFile, lstat } from 'node:fs/promises';
import { join, resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
const hash = data => createHash('sha256').update(data).digest('hex');
export async function listFiles(root, sub = '') {
  const result = [];
  for (const entry of await readdir(join(root, sub), { withFileTypes: true })) {
    const name = sub ? `${sub}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`不能瘦身符號連結：${name}`);
    if (entry.isDirectory()) result.push(...await listFiles(root, name));
    else if (entry.isFile()) result.push(name);
  } return result;
}
export async function planResourceSlimming(resources) {
  const files = await listFiles(resources); const available = new Set(files); const plans = [];
  for (const file of files) {
    let keep;
    // Only routes supported by the special PNG handler may lose their dist copy.
    if (/^dist\/seer\/(head|body|type|abnormal|buff|signbuff|card)\/\d+\.png$/i.test(file) || file === 'dist/seer/type/prop.png' || /^dist\/seer\/xi\/[^/]+\.png$/i.test(file)) keep = file.replace(/^dist\//, 'public/');
    else if (file.startsWith('public/') && !file.startsWith('public/seer/')) keep = file.replace(/^public\//, 'dist/');
    else if (/^pet\/\d+\.png$/i.test(file)) keep = file.replace(/^pet\//, 'public/seer/head/');
    else if (/^系\/[^/]+\.png$/i.test(file)) keep = file.replace(/^系\//, 'public/seer/xi/');
    if (!keep || !available.has(keep)) continue;
    const source = await readFile(join(resources, file)); const other = await readFile(join(resources, keep));
    if (source.equals(other)) plans.push({ remove: file, keep, bytes: source.length, sha256: hash(source) });
  }
  const removed = new Set(plans.map(p => p.remove));
  if (plans.some(p => removed.has(p.keep))) throw new Error('瘦身清單互相移除了保留檔');
  return plans;
}
export async function slimPackagedResources(appOutDir, projectDir) {
  const root = resolve(appOutDir), project = resolve(projectDir);
  const rel = relative(project, root);
  if (!rel || rel.startsWith(`..${sep}`) || !['build', 'dist-electron'].includes(rel.split(sep)[0]) || !rel.includes('win-unpacked')) throw new Error('只允許處理專案內的 build／dist-electron/win-unpacked 封裝副本');
  if ((await lstat(root)).isSymbolicLink()) throw new Error('封裝根不可為符號連結');
  const resources = join(root, 'resources'); const plans = await planResourceSlimming(resources);
  for (const p of plans) {
    const file = resolve(resources, p.remove); const keep = resolve(resources, p.keep);
    if (!file.startsWith(resources + sep) || !keep.startsWith(resources + sep)) throw new Error('清理路徑越界');
    if (hash(await readFile(file)) !== p.sha256 || hash(await readFile(keep)) !== p.sha256) throw new Error('素材在清理前變動，中止封裝');
    await unlink(file); // Only the generated duplicate, never the source asset.
  }
  const manifest = { schemaVersion: 1, filesRemoved: plans.length, bytesRemoved: plans.reduce((n, p) => n + p.bytes, 0), plans };
  await writeFile(join(resources, 'resource-slimming.json'), JSON.stringify(manifest, null, 2));
  console.log(`封裝副本去重：${manifest.filesRemoved} 個／${(manifest.bytesRemoved / 1e6).toFixed(2)} MB；原稿未變更。`);
  return manifest;
}
