// 工作區整理（2026-11-21）：只「搬移」到可還原的封存區，不刪除任何檔案。
// 預設只預覽並輸出清單；加 --apply 才搬移；--restore <manifest.json> 依清單原路搬回。
// 範圍：專案外層工作區（D:\影片\新增資料夾）與專案根目錄的零散工作檔。
// 安全規則：Git 追蹤檔不動；24 小時內修改過的項目不動；連結（symlink／junction）不動；目的地已存在不覆蓋；
//           只用同磁碟 rename（不複製、不刪除），跨磁碟時跳過並列出。
// 「舊專案副本」（外層殘留的 src／node_modules 等）須加 --include-old-copy 才搬，避免誤判仍在使用的檔案。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTER = path.dirname(PROJECT);
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const DAY = 24 * 3600 * 1000;

/** 外層工作區分類（名稱或樣式）。沒列到的項目一律保留並標「未分類」。 */
export const OUTER_RULES = [
  { bucket: 'keep', names: [path.basename(PROJECT), 'elf_source_files', '工作區入口.md', '啟動對戰模擬器.bat', '停止對戰模擬器.bat', '整理工作區.bat', '_參考資料', '_發佈封存', '_封存'] },
  { bucket: 'confirm', names: ['SeerBattleSim', 'SeerSim_share'] },
  { bucket: 'reference', dest: '_參考資料', names: ['交給Claude_BOSS特性數值計畫與指示.txt', '給Claude的提示詞.txt', 'BOSS特性_效果對照整理.txt', '次數免疫_圖片與判定現況查核.txt',
    '次數免疫_盾牌換色結果_正確', '百度百科_BOSS特性圖標', 'seerapi_異常狀態圖標', '印記圖標', '異常圖標', '系', '06_墜星誤切報告.json', '_useer_research', 'glm-review', 'Claude outputs'],
    patterns: [/^次數免疫_.*\.png$/, /^御天龍神哈莫_.*\.md$/, /^任務-.*/] },
  { bucket: 'release', dest: '_發佈封存', names: ['.sites', '對戰模擬器.zip', 'web-source-20261020'],
    patterns: [/^seer-site-.*/, /^site-.*/] },
  { bucket: 'scratch', dest: path.join('_封存', `暫存-${STAMP}`), names: ['_dom.html', '_py.err', '_py.out', '_erm_copy.log', '_shots'], patterns: [/^dsh-.*\.(md|log)$/] },
  { bucket: 'old-copy', dest: path.join('_封存', `舊專案副本-${STAMP}`), names: ['.env.example', '.gitattributes', '.github', '.gitignore', '.git', 'AGENTS.md', 'Build_EXE.bat', 'docs', 'electron',
    'electron-builder.yml', 'images', 'index.html', 'launcher', 'metadata.json', 'node_modules', 'package-lock.json', 'package.json', 'packaging', 'pet', 'pet_materials.bundle',
    'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'public', 'README.md', 'rebuild-portable-exe.bat', 'scripts', 'server.ts', 'setup-env.bat', 'src', 'tests', 'tools', 'tsconfig.json',
    'version.ts', 'vite.config.ts', '賽爾模擬器一鍵工具.bat', '整理垃圾檔案.bat', '雲端網址.txt', 'seer api網址.txt'] },
];
/** 專案根目錄的零散工作檔（未被 Git 追蹤時才搬）。 */
export const PROJECT_RULES = [
  { bucket: 'scratch', dest: path.join('.local-archives', `tidy-${STAMP}`, 'root-scratch'), names: ['_u_breakdown.json', 'preview-server.log', '_claude_archive_20261107.cmd', '_claude_git_status.cmd', '_claude_src_snapshot.cmd', '_anim_import', '_asset_backup', 'logs'],
    patterns: [/^_split_.*\.json$/] },
];

export function classify(name, rules) {
  for (const rule of rules) if (rule.names?.includes(name) || rule.patterns?.some(p => p.test(name))) return rule;
  return { bucket: 'unclassified' };
}

function gitTracked(root) {
  try { return new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(f => f.split('/')[0])); } catch { return new Set(); }
}

export function plan({ includeOldCopy = false, now = Date.now() } = {}) {
  const items = [];
  const tracked = gitTracked(PROJECT);
  const scan = (base, rules, projectScope) => {
    for (const name of fs.readdirSync(base)) {
      const full = path.join(base, name);
      let st; try { st = fs.lstatSync(full); } catch { continue; }
      const rule = classify(name, rules);
      const entry = { source: full, name, bucket: rule.bucket, dest: rule.dest ? path.join(base === PROJECT ? PROJECT : OUTER, rule.dest, name) : null, reason: '' };
      if (projectScope && rule.bucket === 'unclassified') continue; // 專案內只處理明列的零散檔
      if (rule.bucket === 'keep') entry.reason = '保留';
      else if (rule.bucket === 'confirm' || rule.bucket === 'unclassified') entry.reason = '用途不明，保留待確認';
      else if (st.isSymbolicLink()) entry.reason = '連結，不搬';
      else if (projectScope && tracked.has(name)) entry.reason = 'Git 追蹤中，不搬';
      else if (now - st.mtimeMs < DAY) entry.reason = '24 小時內修改過，不搬';
      else if (rule.bucket === 'old-copy' && !includeOldCopy) entry.reason = '舊專案副本：需加 --include-old-copy';
      else if (entry.dest && fs.existsSync(entry.dest)) entry.reason = '目的地已存在，不覆蓋';
      else entry.move = true;
      items.push(entry);
    }
  };
  scan(OUTER, OUTER_RULES, false);
  scan(PROJECT, PROJECT_RULES, true);
  return items;
}

function apply(items) {
  const moved = [], skipped = [];
  for (const it of items.filter(i => i.move)) {
    try {
      fs.mkdirSync(path.dirname(it.dest), { recursive: true });
      fs.renameSync(it.source, it.dest);
      moved.push({ source: it.source, dest: it.dest, bucket: it.bucket });
    } catch (error) { skipped.push({ source: it.source, error: String(error.code || error.message) }); }
  }
  const manifestDir = path.join(PROJECT, '.cleanup-audit');
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifest = path.join(manifestDir, `tidy-manifest-${Date.now()}.json`);
  fs.writeFileSync(manifest, JSON.stringify({ at: new Date().toISOString(), moved, skipped }, null, 2));
  return { moved, skipped, manifest };
}

function restore(manifestPath) {
  const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const back = [], failed = [];
  for (const m of [...data.moved].reverse()) {
    if (fs.existsSync(m.source)) { failed.push({ ...m, error: '原位置已有同名檔案' }); continue; }
    try { fs.mkdirSync(path.dirname(m.source), { recursive: true }); fs.renameSync(m.dest, m.source); back.push(m); } catch (error) { failed.push({ ...m, error: String(error.code || error.message) }); }
  }
  return { back, failed };
}

const LABEL = { reference: '參考資料', release: '發佈封存', scratch: '暫存', 'old-copy': '舊專案副本', keep: '保留', confirm: '待確認', unclassified: '未分類' };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const restoreAt = args.indexOf('--restore');
  if (restoreAt >= 0) {
    const r = restore(path.resolve(args[restoreAt + 1]));
    console.log(`已搬回 ${r.back.length} 項；失敗 ${r.failed.length} 項。`);
    for (const f of r.failed) console.log(`  × ${f.source}：${f.error}`);
    process.exit(r.failed.length ? 1 : 0);
  }
  const items = plan({ includeOldCopy: args.includes('--include-old-copy') });
  const groups = {};
  for (const it of items) (groups[it.bucket] ||= []).push(it);
  for (const [bucket, list] of Object.entries(groups)) {
    console.log(`\n【${LABEL[bucket] || bucket}】${list.length} 項`);
    for (const it of list) console.log(`  ${it.move ? '→' : '·'} ${path.relative(OUTER, it.source)}${it.move ? `  ⇒  ${path.relative(OUTER, it.dest)}` : `（${it.reason}）`}`);
  }
  const auditDir = path.join(PROJECT, '.cleanup-audit');
  fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(auditDir, `tidy-plan-${STAMP}.json`), JSON.stringify(items, null, 2));
  const count = items.filter(i => i.move).length;
  if (!args.includes('--apply')) { console.log(`\n預覽：可搬移 ${count} 項（未搬動任何檔案）。加 --apply 才執行。`); process.exit(0); }
  const r = apply(items);
  console.log(`\n已搬移 ${r.moved.length} 項；跳過 ${r.skipped.length} 項。還原：node scripts/workspace_tidy.mjs --restore "${r.manifest}"`);
  for (const s of r.skipped) console.log(`  × ${s.source}：${s.error}`);
}
