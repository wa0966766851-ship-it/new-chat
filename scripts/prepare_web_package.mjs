import { readFile, writeFile, cp, mkdir, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { listFiles } from './slim_electron_resources.mjs';

// A build artifact, NOT a public hosting deployment. Never copy Express or credentials.
const source = resolve(process.argv[2] || 'dist'), output = resolve(process.argv[3] || 'build/web-package');
if (!output.startsWith(resolve('build') + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('網站套件必須放在專案 build 子資料夾');
try { await access(output); throw new Error('網站套件目的地已存在，不覆寫舊套件'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const version = JSON.parse(await readFile(join(source, 'version.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(version.commit) || !/^[a-f0-9]{64}$/.test(version.buildId)) throw new Error('網站套件缺少正式來源／建置識別');
const files = (await listFiles(source)).filter(f => f !== 'server.cjs' && !f.startsWith('.vite/') && !f.endsWith('.map'));
if (files.some(f => /(^|\/)(\.env[^/]*|node_modules|electron|\.git)(\/|$)/.test(f))) throw new Error('網站套件包含不允許的檔案');
if (!files.includes('index.html')) throw new Error('缺少網站入口');
await mkdir(output, { recursive: true });
const entries = [];
for (const file of files) {
  const bytes = await readFile(join(source, file));
  await mkdir(join(output, file, '..'), { recursive: true });
  await cp(join(source, file), join(output, file), { force: false, errorOnExist: true });
  entries.push({ path: file, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
// Express normally serves this directory separately; static hosts need an actual copy.
for (const file of await listFiles(resolve('images'))) {
  if (!/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(file)) continue;
  const bytes = await readFile(join('images', file)), destination = join(output, 'images', file);
  await mkdir(join(destination, '..'), { recursive: true });
  await cp(join('images', file), destination, { force: false, errorOnExist: true });
  entries.push({ path: `images/${file}`, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(join(output, 'web-package-manifest.json'), JSON.stringify({ schemaVersion: 1, ...version, files: entries }, null, 2), { flag: 'wx' });
console.log(`網站建置套件已準備：${entries.length} 檔；沒有呼叫 AI，也沒有發布網站。`);
