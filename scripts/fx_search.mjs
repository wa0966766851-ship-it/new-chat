/**
 * 特效庫搜尋器
 *
 * 用法：
 *   node scripts/fx_search.mjs                     列出全部
 *   node scripts/fx_search.mjs --cat fullscreen    只看全屏特效
 *   node scripts/fx_search.mjs --min 500           只看宽高 ≥ 500
 *   node scripts/fx_search.mjs --elf holyPuni      只看某精靈
 *   node scripts/fx_search.mjs --name fx00         按檔名搜
 *   node scripts/fx_search.mjs --json              輸出 JSON
 *   node scripts/fx_search.mjs --top 5             只看前 N 大
 */
import fs from 'node:fs';

const CATALOG = 'docs/fx-catalog.json';
if (!fs.existsSync(CATALOG)) {
  console.error('找不到 ' + CATALOG + '，先跑 node scripts/fx_index_build.mjs');
  process.exit(1);
}
const cat = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i+1] : undefined; };
const flag = (k) => args.includes(k);

let blocks = [...cat.blocks];

// 过滤
const catFilter = arg('--cat');
if (catFilter) blocks = blocks.filter(b => b.category === catFilter);
const elfFilter = arg('--elf');
if (elfFilter) blocks = blocks.filter(b => b.elf.toLowerCase().includes(elfFilter.toLowerCase()));
const nameFilter = arg('--name');
if (nameFilter) blocks = blocks.filter(b => b.file.toLowerCase().includes(nameFilter.toLowerCase()));
const minSize = parseInt(arg('--min') || '0', 10);
if (minSize > 0) blocks = blocks.filter(b => b.w >= minSize && b.h >= minSize);
const maxSize = parseInt(arg('--max') || '0', 10);
if (maxSize > 0) blocks = blocks.filter(b => b.w <= maxSize && b.h <= maxSize);

// 排序：面积大的在前
blocks.sort((a, b) => b.area - a.area);
const top = parseInt(arg('--top') || '0', 10);
if (top > 0) blocks = blocks.slice(0, top);

if (flag('--json')) {
  console.log(JSON.stringify(blocks, null, 1));
  process.exit(0);
}

// 输出
console.log(`=== 找到 ${blocks.length} 个特效块 ===\n`);
console.log('精靈'.padEnd(14) + '文件'.padEnd(28) + '尺寸'.padEnd(14) + '幀'.padStart(4) + '  分類'.padEnd(12) + '大小');
console.log('-'.repeat(90));
for (const b of blocks) {
  const size = b.w && b.h ? `${b.w}×${b.h}` : '(bundle)';
  console.log(
    String(b.elf).padEnd(14) +
    String(b.file).padEnd(28) +
    size.padEnd(14) +
    String(b.frameIndex >= 0 ? b.frameIndex : '-').padStart(4) + '  ' +
    String(b.category).padEnd(12) +
    `${(b.bytes/1024).toFixed(0)} KB`
  );
}
console.log('');
console.log(`分類統計: ${Object.entries(cat.stats).map(([k,v])=>k+'='+v).join('  ')}`);
