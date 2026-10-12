import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 規範：BattleEventContext 含原型鏈上的計時器、事件與即時 getter，不得用展開運算子複製；
// 一律 Object.create(ctx) 再覆寫。展開 ctx.self 等欄位（有 . 後綴）不在此限。
const bad = /\.\.\.\s*(?:ctx|nodeCtx|subCtx|kitCtx|c2|adapter|context)\b(?!\s*[.\[])/;
function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!/vendor|node_modules/.test(p)) walk(p, out); }
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
const offenders: string[] = [];
for (const file of walk('src')) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(?:\/\/|\*)/.test(line)) return;
    if (bad.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
assert.deepEqual(offenders, [], `不得用展開運算子複製上下文（請用 Object.create(ctx)）：\n${offenders.join('\n')}`);
console.log('上下文規範：src 內沒有以展開運算子複製 BattleEventContext。');
