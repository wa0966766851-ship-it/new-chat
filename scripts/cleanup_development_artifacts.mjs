import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Explicitly bounded maintenance. Source files, user storage and real game assets are excluded.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32') throw Error('Windows process checks are required for this cleanup policy');
const apply = process.argv.includes('--apply');
const cutoff = Date.now() - 24 * 3600e3;
const reportDir = path.join(root, '.cleanup-audit');
fs.mkdirSync(reportDir, { recursive: true });
const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'));
const commands = process.platform === 'win32'
  ? String(execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress'], { encoding: 'utf8', windowsHide: true })).toLowerCase().replaceAll('\\\\', '\\')
  : ''; // This cleanup policy is intended for this Windows project.
const activeFile = path.join(root, '.desktop-releases', 'active.json');
const active = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
for (const id of [active.id, active.previous]) {
  if (!/^\d{13}$/.test(String(id))) throw Error('Invalid protected release ID');
  for (const file of ['version.json', 'completion.json', 'server.cjs', 'index.html']) fs.accessSync(path.join(root, '.desktop-releases', id, file));
}

function inspect(target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Outside project: ' + target);
  for (let p = target; p !== root; p = path.dirname(p)) {
    if (fs.lstatSync(p).isSymbolicLink()) throw Error('Linked path: ' + p);
  }
  const files = [];
  function visit(p) {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) throw Error('Linked content: ' + p);
    if (path.basename(p) === '.git') throw Error('Git checkout: ' + p);
    if (st.isDirectory()) for (const name of fs.readdirSync(p)) visit(path.join(p, name));
    else if (st.isFile()) {
      if (tracked.has(path.relative(root, p).replaceAll(path.sep, '/'))) throw Error('Tracked file: ' + p);
      files.push({ path: path.relative(root, p), bytes: st.size, mtime: st.mtimeMs });
    }
  }
  visit(target);
  return { files, bytes: files.reduce((n, f) => n + f.bytes, 0), newest: Math.max(0, ...files.map(f => f.mtime)) };
}
const candidates = [], skipped = [];
function add(relative, reason) {
  const target = path.resolve(root, relative);
  if (!fs.existsSync(target)) return;
  if (commands.includes(target.toLowerCase())) { skipped.push({ path: relative, reason: 'running process' }); return; }
  try {
    const entry = inspect(target);
    if (entry.newest > cutoff) { skipped.push({ path: relative, reason: 'changed within 24 hours' }); return; }
    if (entry.bytes) candidates.push({ path: relative, reason, ...entry });
  } catch (e) { skipped.push({ path: relative, reason: e.message }); }
}

// Keep every test profile's Local Storage, IndexedDB, cookies, preferences, extensions and reports.
// Only browser-generated caches are removed; the real launcher profile is outside this project.
for (const name of fs.readdirSync(path.join(root, '.seer-cache'))) {
  if (!/^(diag-[\w-]+|[\w-]+-browser)$/.test(name)) continue;
  const profile = path.join(root, '.seer-cache', name);
  if (!fs.existsSync(path.join(profile, 'Local State')) || !fs.existsSync(path.join(profile, 'Default'))) continue;
  if (commands.includes(profile.toLowerCase())) { skipped.push({ path: '.seer-cache/' + name, reason: 'running browser profile' }); continue; }
  for (const cache of ['component_crx_cache', 'extensions_crx_cache', 'GrShaderCache', 'ShaderCache', 'GPUPersistentCache',
    'Default/Cache', 'Default/Code Cache', 'Default/GPUCache', 'Default/DawnCache', 'Default/DawnWebGPUCache', 'Default/DawnGraphiteCache', 'Default/Service Worker/CacheStorage']) {
    add('.seer-cache/' + name + '/' + cache, 'stale isolated browser cache; user storage retained');
  }
}

for (const name of fs.readdirSync(path.join(root, 'build'))) {
  if (/^(portable-smoke-|renderer-smoke-|launcher-tests-|update-tests-)/.test(name)
    || /^(site-(preview|package)-.*-20261004|web-preview-20261004|site-ci-run-37151386670)$/.test(name)) {
    add('build/' + name, 'old generated test/preview output');
  }
}
for (const name of fs.readdirSync(path.join(root, '.desktop-releases'))) {
  if (!/^\d{13}$/.test(name) || [active.id, active.previous].includes(name)) continue;
  add('.desktop-releases/' + name, 'retired desktop output; active and immediate rollback retained');
}

const report = { generatedAt: new Date().toISOString(), applied: apply, protectedReleases: [active.id, active.previous],
  candidates: candidates.map(({ files, ...e }) => ({ ...e, fileCount: files.length })), skipped, removedBytes: 0, removedFiles: 0 };
const receipt = path.join(reportDir, apply ? 'cleanup-result.json' : 'cleanup-plan.json');
fs.writeFileSync(receipt, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ apply, candidates: candidates.length, GiB: candidates.reduce((n, x) => n + x.bytes, 0) / 2 ** 30, skipped: skipped.length, protectedReleases: report.protectedReleases }));
if (apply) {
  for (const entry of candidates) {
    // Recheck complete paths and file metadata immediately before native removal.
    const check = inspect(path.resolve(root, entry.path));
    if (JSON.stringify(check.files) !== JSON.stringify(entry.files)) throw Error('Changed during cleanup: ' + entry.path);
    const latest = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
    if (JSON.stringify(latest) !== JSON.stringify(active)) throw Error('Desktop release changed during cleanup');
    fs.rmSync(path.resolve(root, entry.path), { recursive: true, force: true, maxRetries: 2 });
    report.removedBytes += entry.bytes;
    report.removedFiles += entry.files.length;
    report.candidates.find(e => e.path === entry.path).removed = true;
    fs.writeFileSync(receipt, JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify({ removedGiB: report.removedBytes / 2 ** 30, removedFiles: report.removedFiles }));
}
