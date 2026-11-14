// 2026-11-14 桌面版自動跟上來源：比較「來源最新修改時間」與目前啟用版本的完成時間。
// 只讀檔案時間（不讀內容），啟動器每次開啟都能快速判斷。
// 結束碼：0＝已是最新；3＝來源比啟用版本新（需更新）；4＝沒有可用的完成版本。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function newestSourceMtime(root) {
  let newest = 0, file = '';
  const visit = p => {
    let st; try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) { for (const name of fs.readdirSync(p)) visit(path.join(p, name)); return; }
    if (st.mtimeMs > newest) { newest = st.mtimeMs; file = p; }
  };
  for (const d of ['src', 'public', 'server', 'scripts']) visit(path.join(root, d));
  for (const f of ['launcher/launcher.ps1', 'launcher/serverIdentity.ps1', 'server.ts', 'vite.config.ts', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json']) visit(path.join(root, f));
  return { newest, file: path.relative(root, file) };
}

export function releaseState(root) {
  const home = path.join(root, '.desktop-releases');
  let active;
  try { active = JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8')); } catch { return { code: 4, reason: '尚無桌面完成版本' }; }
  let completedAt = 0;
  try { completedAt = Date.parse(JSON.parse(fs.readFileSync(path.join(home, String(active.id), 'completion.json'), 'utf8')).completedAt) || 0; } catch { return { code: 4, reason: '啟用版本缺少完成紀錄' }; }
  const { newest, file } = newestSourceMtime(root);
  return newest > completedAt ? { code: 3, reason: `來源較新：${file}`, newest, completedAt, active: active.id } : { code: 0, reason: '已是最新', newest, completedAt, active: active.id };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const state = releaseState(process.cwd());
  console.log(JSON.stringify(state));
  process.exit(state.code);
}
