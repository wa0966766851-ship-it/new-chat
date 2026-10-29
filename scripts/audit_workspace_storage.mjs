import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Read-only inventory. Hash equality identifies copies, not permission to remove them.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = { root, generatedAt: new Date().toISOString(), totalBytes: 0, files: 0,
  directories: {}, largestFiles: [], duplicates: [], skippedLinks: [], errors: [] };
const bySize = new Map();
const budgetArg = process.argv.find(arg => arg.startsWith('--budget-mib='));
const budgetMiB = budgetArg ? Number(budgetArg.split('=')[1]) : 128;
if (!Number.isSafeInteger(budgetMiB) || budgetMiB < 1 || budgetMiB > 65536) throw Error('budget-mib must be an integer from 1 to 65536');
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name), rel = path.relative(root, full).replaceAll('\\', '/');
    try {
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) { report.skippedLinks.push(rel); continue; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) {
        report.totalBytes += st.size; report.files++;
        const parts = rel.split('/');
        for (const level of [1, 2]) {
          if (parts.length <= level) continue;
          const key = parts.slice(0, level).join('/');
          report.directories[key] ??= { bytes: 0, files: 0 };
          report.directories[key].bytes += st.size; report.directories[key].files++;
        }
        if (st.size >= 1024 ** 2) {
          const file = { path: rel, bytes: st.size, mtime: st.mtimeMs };
          report.largestFiles.push(file);
          // Exclude Git objects and installed dependencies from deduplication proposals.
          if (!['.git', 'node_modules'].includes(parts[0])) {
            if (!bySize.has(st.size)) bySize.set(st.size, []);
            bySize.get(st.size).push(file);
          }
        }
      }
    } catch (e) { report.errors.push({ path: rel, error: e.code || e.message }); }
  }
}
walk(root);
const output = path.join(root, '.cleanup-audit', 'storage-analysis.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
// Save the complete inventory before optional expensive disk reads.
fs.writeFileSync(output, JSON.stringify(report, null, 2));
if (process.argv.includes('--hash')) {
  const eligible = [...bySize.values()].filter(files => files.length > 1);
  report.hashScan = { budgetBytes: budgetMiB * 1024 ** 2, readBytes: 0, hashedFiles: 0,
    candidateFiles: eligible.reduce((n,a) => n+a.length,0), skippedFiles: 0, complete: true };
  console.log(JSON.stringify({ phase: 'hashing', files: eligible.reduce((n, a) => n + a.length, 0) }));
  for (const files of eligible) {
    if (files[0].bytes * files.length + report.hashScan.readBytes > report.hashScan.budgetBytes) {
      report.hashScan.skippedFiles += files.length; report.hashScan.complete = false; continue;
    }
    const hashes = new Map();
    for (const file of files) {
      try {
        const full = path.join(root, file.path), hash = crypto.createHash('sha256');
        for await (const chunk of fs.createReadStream(full)) { hash.update(chunk); report.hashScan.readBytes += chunk.length; }
        const after = fs.statSync(full);
        if (after.size !== file.bytes || after.mtimeMs !== file.mtime) throw Error('changed during audit');
        const digest = hash.digest('hex');
        report.hashScan.hashedFiles++;
        if (!hashes.has(digest)) hashes.set(digest, []);
        hashes.get(digest).push(file.path);
      } catch (e) { report.hashScan.complete=false; report.errors.push({ path: file.path, error: e.code || e.message }); }
    }
    for (const [sha256, paths] of hashes) if (paths.length > 1) report.duplicates.push({ sha256, bytes: files[0].bytes, paths, extraBytes: files[0].bytes * (paths.length - 1) });
  }
}
report.largestFiles.sort((a, b) => b.bytes - a.bytes);
report.largestFiles = report.largestFiles.slice(0, 80);
report.duplicates.sort((a, b) => b.extraBytes - a.extraBytes);
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ GiB: report.totalBytes / 1024 ** 3, files: report.files, errors: report.errors.length,
  duplicatesChecked: process.argv.includes('--hash'), duplicateGroups: process.argv.includes('--hash') ? report.duplicates.length : null,
  duplicateExtraGiB: process.argv.includes('--hash') ? report.duplicates.reduce((n, a) => n + a.extraBytes, 0) / 1024 ** 3 : null,
  topDirectories: Object.entries(report.directories).filter(([key]) => key.includes('/')).sort((a,b) => b[1].bytes - a[1].bytes).slice(0,25) }, null, 2));
