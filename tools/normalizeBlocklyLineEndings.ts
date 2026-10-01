/** Windows 舊工作樹的一次性格式修復。先驗證全部檔案，才寫入，絕不掩蓋內容差異。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const folder = new URL('../src/vendor/blockly/', import.meta.url);
const info = JSON.parse(readFileSync(new URL('build-info.json', folder), 'utf8'));
const files = info.files.map((entry: { file: string; sha256: string }) => {
  if (!/^(index|core-\d+)\.js$/.test(entry.file)) throw new Error('生成清單檔名不合法');
  const path = new URL(entry.file, folder);
  const before = readFileSync(path, 'utf8'), after = before.replace(/\r\n/g, '\n');
  if (createHash('sha256').update(after).digest('hex') !== entry.sha256) {
    throw new Error(`${entry.file} 不是單純換行差異；保留原檔，請核對內容或重新生成。`);
  }
  return { path, after, changed: before !== after };
});
for (const file of files) if (file.changed) writeFileSync(file.path, file.after, 'utf8');
console.log(`Blockly 換行格式修復：${files.filter((f: { changed: boolean }) => f.changed).length} 檔；全部 SHA-256 與已驗收清單一致。`);
