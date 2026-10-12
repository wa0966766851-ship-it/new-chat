/** 盤點 blocks/runtime.ts 每個 op 寫入的狀態鍵與讀取端。輸出 docs/audits/op-keys.md。無其他出現處的鍵＝死鍵候選。 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const runtime = readFileSync('src/blocks/runtime.ts', 'utf8');
const start = runtime.indexOf('export const OPS');
const body = runtime.slice(start);
const opsEnd = body.indexOf('\n};');
const opRe = /^  ([a-z_0-9]+):\s*\(/gm;
const spans: Array<{ op: string; from: number; to: number }> = [];
let m: RegExpExecArray | null;
while ((m = opRe.exec(body))) if (m.index < opsEnd) spans.push({ op: m[1], from: m.index, to: opsEnd });
spans.forEach((s, i) => { if (spans[i + 1]) s.to = spans[i + 1].from; });

function walk(dir: string, out: string[] = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!/vendor|node_modules/.test(p)) walk(p, out); } else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
const files = walk('src').map(f => [f, readFileSync(f, 'utf8')] as const);
// 寫入形式：setPlayerState("key"|`key`, …)、setOpponentState(同)、setTurnKey(…, { key: … }, "key")。
const stateRe = /(?:setPlayerState|setOpponentState)\(\s*["'`]([A-Za-z][A-Za-z0-9_:]*)["'`]/g;
const turnKeyRe = /setTurnKey\([^;]*?\{\s*([A-Za-z][A-Za-z0-9_]*)\s*:/g;
const rows: string[] = []; let dead = 0;
for (const { op, from, to } of spans) {
  const text = body.slice(from, to);
  const keys = new Set<string>();
  for (const re of [stateRe, turnKeyRe]) { re.lastIndex = 0; let k: RegExpExecArray | null; while ((k = re.exec(text))) keys.add(k[1]); }
  for (const key of keys) {
    let outside = 0; const where = new Set<string>();
    for (const [f, src] of files) {
      const count = src.split(key).length - 1;
      const own = f === 'src/blocks/runtime.ts' ? text.split(key).length - 1 : 0;
      if (count - own > 0) { outside += count - own; where.add(f.replace(/^src\//, '')); }
    }
    if (!outside) dead++;
    rows.push(`| ${op} | \`${key}\` | ${outside ? [...where].slice(0, 3).join('、') : '**無（死鍵候選）**'} |`);
  }
}
writeFileSync('docs/audits/op-keys.md', `# 積木 op 寫入的狀態鍵與讀取端

自動產生：\`node --import tsx scripts/audit_op_keys.ts\`。只比對字串字面量；用變數組成的鍵不在此列，需人工檢查。
「無」表示整個 src 沒有其他地方出現這個鍵（含 runtime.ts 的其他 op）。死鍵候選 ${dead} 個，需逐一確認後修成接上讀取端，或刪除。

| op | 鍵 | 其他出現處 |
|---|---|---|
${rows.join('\n')}
`);
console.log(`ops: ${spans.length}, keys: ${rows.length}, dead candidates: ${dead}`);
