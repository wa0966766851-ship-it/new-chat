// 2026-11-14 桌面版自動跟上來源：完成版本比來源舊就判定需要更新；最新則不更新。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { releaseState } from '../scripts/desktop_stale.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seer-stale-'));
try {
  fs.mkdirSync(path.join(root, 'src')); fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'x');
  assert.equal(releaseState(root).code, 4, '沒有完成版本');
  const home = path.join(root, '.desktop-releases'); fs.mkdirSync(path.join(home, '1'), { recursive: true });
  fs.writeFileSync(path.join(home, 'active.json'), JSON.stringify({ id: '1', buildId: 'b' }));
  const write = (t) => fs.writeFileSync(path.join(home, '1', 'completion.json'), JSON.stringify({ completedAt: new Date(t).toISOString() }));
  write(Date.now() + 60_000);
  assert.equal(releaseState(root).code, 0, '完成版本較新');
  write(Date.now() - 60_000);
  const stale = releaseState(root);
  assert.equal(stale.code, 3, '來源較新需更新'); assert.match(stale.reason, /a\.ts/);
  const upd = fs.readFileSync('scripts/desktop_update.mjs', 'utf8');
  assert.ok(upd.includes("--quick") && upd.includes('45*60*1000'), '快速更新與逾時鎖清除');
  console.log('桌面自動更新判定：無版本／最新／來源較新 通過');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
