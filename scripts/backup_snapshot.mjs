// scripts/backup_snapshot.mjs
// 一鍵把目前工作區快照成 GitHub 備份分支。
// 規則：測試全綠才 commit；只建立 backup/<slug>，不碰 main、不開 PR、不上線。
//   node scripts/backup_snapshot.mjs [--slug elf-work] [--no-test] [--dry-run]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const slug = opt('--slug', `snapshot-${new Date().toISOString().slice(0, 10)}`);
const noTest = argv.includes('--no-test');
const dry = argv.includes('--dry-run');
if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw Error('slug 只接受英數與連字號');

const tests = [
  'tests/grauenAndTypeMatchup.semantic.test.ts',
  'tests/holyOscar.semantic.test.ts',
  'tests/leonidas.semantic.test.ts',
  'tests/elfGroupBlocks.semantic.test.ts',
  'tests/naifenStarDeath.semantic.test.ts',
  'tests/oscarAnimation.semantic.test.ts',
];
const git = (args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!noTest) {
  for (const t of tests) {
    if (!fs.existsSync(path.join(root, t))) { console.log(`SKIP ${t}（不存在）`); continue; }
    process.stdout.write(`TEST ${t} ... `);
    try { execFileSync(process.execPath, ['--import', 'tsx', t], { cwd: root, stdio: 'ignore' }); console.log('OK'); }
    catch { throw Error(`測試失敗：${t}，未建立備份`); }
  }
} else console.log('SKIP 測試（--no-test）');

const branch = `backup/${slug}-${new Date().toISOString().slice(0, 10)}`;
const status = git(['status', '--porcelain=v1', '-uall']);
if (!status) { console.log('工作區乾淨，無須備份。'); process.exit(0); }
const forbidden = status.split('\n').filter(l => /node_modules|dist-electron|dist_release|\.desktop-releases|\.env$|credentials|\.pem$/.test(l));
if (forbidden.length) throw Error('拒絕備份：發現敏感或中繼檔案\n' + forbidden.join('\n'));

if (dry) { console.log('DRY RUN，將建立：' + branch + '\n' + status.split('\n').length + ' 個檔案變更'); process.exit(0); }

const current = git(['branch', '--show-current']);
console.log(`目前分支 ${current} → 建立 ${branch}`);
git(['checkout', '-b', branch]);
git(['add', '-A']);
git(['commit', '-m', `chore(backup): ${slug} 工作區快照 ${new Date().toISOString().slice(0, 10)}`]);
git(['push', '-u', 'origin', branch]);
console.log(`備份完成：${branch} @ ${git(['rev-parse', '--short', 'HEAD'])}（未動 main）`);
