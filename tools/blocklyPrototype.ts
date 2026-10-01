/** 獨立相容性原型，不替換正式版。原始碼固定到官方 blockly-v13.2.1。 */
import { build } from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { minify } from 'terser';
const root = resolve('node_modules/.cache/blockly-v13.2.1/packages/blockly');
if (!existsSync(resolve(root, 'core/blockly.ts'))) throw new Error('缺少固定版本官方快取，請依 docs/UI第五階段_驗收追蹤_20261001.md 取得，不使用未核對最新版。');
const result = await build({ stdin: { contents: `export { inject, setLocale, defineBlocksWithJsonArray, Events, svgResize, Theme, Themes, Workspace, serialization } from './core/blockly';`, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', target: 'es2022', treeShaking: true, legalComments: 'inline' });
// 先量測循環依賴，不能任意按檔案大小切開初始化相依的類別。
const graph = result.metafile!.inputs;
let index = 0;
const indices = new Map<string, number>(), low = new Map<string, number>(), active = new Set<string>(), stack: string[] = [], groups: string[][] = [];
function visit(id: string) {
  indices.set(id, index); low.set(id, index++); stack.push(id); active.add(id);
  for (const dep of graph[id].imports) {
    if (!graph[dep.path]) continue;
    if (!indices.has(dep.path)) { visit(dep.path); low.set(id, Math.min(low.get(id)!, low.get(dep.path)!)); }
    else if (active.has(dep.path)) low.set(id, Math.min(low.get(id)!, indices.get(dep.path)!));
  }
  if (low.get(id) === indices.get(id)) {
    const group: string[] = []; let next: string;
    do { next = stack.pop()!; active.delete(next); group.push(next); } while (next !== id);
    groups.push(group);
  }
}
for (const id of Object.keys(graph)) if (!indices.has(id)) visit(id);
console.log(JSON.stringify({ cycleGroups: groups.filter(g => g.length > 1).sort((a,b) => b.length-a.length).slice(0,3).map(g => ({ modules:g.length,sourceBytes:g.reduce((n,id)=>n+graph[id].bytes,0),examples:g.slice(0,5) })) },null,2));
const output = await minify(result.outputFiles[0].text, { module: true, compress: { passes: 2 }, mangle: true, format: { comments: 'some' } });
if (!output.code) throw new Error('原型未產生輸出');
// 輸出交由 esbuild 正規構建寫檔，不覆蓋正式 dist 或套件。
await build({ stdin: { contents: output.code, resolveDir: root, loader: 'js' }, write: true, bundle: false, format: 'esm', outfile: 'build/blockly-prototype/core.mjs' });
const bytes = readFileSync('build/blockly-prototype/core.mjs');
console.log(JSON.stringify({ version: '13.2.1', upstreamCommit: '168fe103ac42294b845dcd88033e30698d0320b8', bytes: bytes.length, gzip: gzipSync(bytes).length, under500k: bytes.length < 500000,
  status: 'prototype_only', compatibility: '尚未完成拖曳、渲染、存檔與懶载入驗收，不可替換正式編輯器' }, null, 2));
