import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs');
const output = '開發紀錄索引.md';
const groups = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.md') && full !== path.join(root, output)) {
      const rel = path.relative(root, full).replaceAll('\\', '/');
      const match = entry.name.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
      const key = match ? `${match[1]}-${match[2]}-${match[3]}` : '未標日期';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rel);
    }
  }
}
walk(root);
const lines = ['# 開發紀錄索引', '', '由 `node scripts/index_development_records.mjs` 重建。按檔名日期排序；日期只代表檔名標示，不代表效果已驗收。舊報告可能已被後續修正，接續前仍須核對現有程式。', '', '目前維護入口：[整合開發日誌](開發日誌.md)、[檔案地圖](PROJECT_STRUCTURE.md)、[空間整理指南](guides/project-housekeeping.md)。', ''];
const dated = [...groups.keys()].filter(key => key !== '未標日期').sort().reverse();
for (const key of [...dated, ...(groups.has('未標日期') ? ['未標日期'] : [])]) {
  lines.push(`## ${key}`, '');
  for (const rel of groups.get(key).sort()) lines.push(`- [${rel.replaceAll('[', '').replaceAll(']', '')}](<${rel}>)`);
  lines.push('');
}
fs.writeFileSync(path.join(root, output), lines.join('\n'));
console.log(JSON.stringify({ indexedFiles: [...groups.values()].reduce((n, a) => n + a.length, 0) }));
