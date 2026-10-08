import { readdirSync, existsSync, lstatSync, realpathSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

function inside(root, path) {
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`目標超出專案：${path}`);
}
export function planLogArchive(projectRoot, archiveDate) {
  if (!/^\d{8}$/.test(archiveDate)) throw new Error('歸檔日期必須為八位數');
  const root = realpathSync(projectRoot);
  const directory = resolve(root, 'logs/legacy', archiveDate);
  inside(root, directory);
  for (const dir of [resolve(root, 'logs'), resolve(root, 'logs/legacy'), directory]) {
    if (existsSync(dir) && (!lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink())) throw new Error(`歸檔目錄不是普通目錄：${dir}`);
  }
  const files = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.log')).sort((a, b) => a.name.localeCompare(b.name));
  return { root, directory, moves: files.map(file => {
    const from = resolve(root, file.name), to = resolve(directory, file.name);
    inside(root, from); inside(root, to);
    if (existsSync(to)) throw new Error(`不覆寫既有歸檔：${to}`);
    return { from, to, sha256: createHash('sha256').update(readFileSync(from)).digest('hex') };
  }) };
}
export function applyLogArchive(plan) {
  if (!existsSync(resolve(plan.root, '.git'))) throw new Error('實際搬移只限已確認的Git專案根目錄');
  // 執行前重建計畫，拒絕過期計畫／新增檔／改變內容；不強制處理被其他程式鎖住的檔案。
  const refreshed = planLogArchive(plan.root, plan.directory.split(/[\\/]/).at(-1));
  if (JSON.stringify(refreshed) !== JSON.stringify(plan)) throw new Error('日誌計畫已改變，請重新預覽');
  if (!plan.moves.length) return { moved: [], failed: [], manifest: null };
  mkdirSync(plan.directory, { recursive: true });
  const moved = [], failed = [];
  for (const move of plan.moves) {
    try { renameSync(move.from, move.to); moved.push(move); }
    catch (error) { failed.push({ ...move, error: error.message }); }
  }
  const manifest = resolve(plan.directory, `move-manifest-${randomUUID()}.json`);
  writeFileSync(manifest, JSON.stringify({ root: plan.root, moved, failed,
    recovery: '檢查sha256後將to移回from；若from已存在，先人工比較，禁止覆寫。' }, null, 2) + '\n', { flag: 'wx' });
  return { moved, failed, manifest };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const date = process.argv.find(arg => arg.startsWith('--archive='))?.split('=')[1] || '20261008';
  const plan = planLogArchive(process.cwd(), date);
  console.log(JSON.stringify(process.argv.includes('--apply') ? applyLogArchive(plan) : {
    dryRun: true, count: plan.moves.length, destination: plan.directory, files: plan.moves.map(move => relative(plan.root, move.from)),
  }, null, 2));
}
