// API 匯入精靈（4937）與階段競技場精靈（5 隻，heavyweights.json）延後載入：首頁初始 JS 不含匯入資料；用到之前由 loadImportedElves() 取得，且戰鬥資料與靜態載入完全相同。
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
let checks = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++; };

// 1) 靜態匯入圖：從應用程式入口沿「靜態 import」可達的模組不得含匯入精靈模組與打包檔（動態 import() 不算）。
function staticImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs = [...text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^'"\n;]*?from\s+['"]([^'"]+)['"]/g)].map(m => m[1])
    .concat([...text.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)].map(m => m[1]));
  const out: string[] = [];
  for (const spec of specs) {
    if (!spec.startsWith('.')) continue;
    const base = resolve(dirname(file), spec);
    const hit = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(p => existsSync(p) && /\.(tsx?|json)$/.test(p));
    if (hit) out.push(hit);
  }
  return out;
}
const seen = new Set<string>();
(function walk(file: string) {
  if (seen.has(file)) return;
  seen.add(file);
  if (file.endsWith('.json')) return;
  staticImports(file).forEach(walk);
})(resolve(root, 'src/main.tsx'));
const reached = [...seen].map(f => f.replaceAll('\\', '/'));
ok(reached.some(f => f.endsWith('/src/data/defaultElves.ts')), '入口確實會載入 defaultElves（檢查有效）');
ok(!reached.some(f => /\/src\/data\/importedElves\.ts$/.test(f)), '首頁靜態匯入圖不含 importedElves.ts');
ok(!reached.some(f => /\/src\/data\/imported\//.test(f)), '首頁靜態匯入圖不含 imported/ 打包資料');
ok(!reached.some(f => /\/src\/data\/stagedArenaElves\.ts$/.test(f)) && !reached.some(f => /heavyweights\.json$/.test(f)), '首頁靜態匯入圖不含階段競技場精靈（stagedArenaElves／heavyweights.json）');
ok(!reached.some(f => /defaultElvesLoaded\.ts$/.test(f)), '應用程式不得引用含頂層 await 的測試入口');
ok(/import\(\s*["']\.\/importedElves["']\s*\)/.test(readFileSync(resolve(root, 'src/data/defaultElves.ts'), 'utf8')), '以動態 import 取得匯入精靈');
ok(/import\(\s*["']\.\/stagedArenaElves["']\s*\)/.test(readFileSync(resolve(root, 'src/data/defaultElves.ts'), 'utf8')), '以動態 import 取得階段競技場精靈');

// 2) 執行期：載入前清單不含匯入精靈，載入後追加；重複載入只加一次。
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: FrameRequestCallback) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
try {
  const mod = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { DEFAULT_ELVES, loadImportedElves, subscribeDefaultElves, getDefaultElvesRevision } = mod;
  const game = await server.ssrLoadModule('/src/data/gameData.ts');
  // Vite 模組圖使用正斜線路徑；Windows resolve() 的反斜線不能直接查索引。
  const importedGraph = () => [...(server.moduleGraph.getModulesByFile(resolve(root, 'src/data/importedElves.ts').replaceAll('\\', '/')) || [])].some(m => !!m.ssrModule);
  ok(!importedGraph(), '載入前 importedElves 尚未執行（只有動態 import 的參照）');
  ok(!DEFAULT_ELVES.some((e: any) => String(e.id) === 'wiki_4937'), '載入前清單不含 4937（wiki_4937）');
  const { STAGED_ARENA_ELVES } = await server.ssrLoadModule('/src/data/stagedArenaElves.ts');
  const arenaIds = STAGED_ARENA_ELVES.map((x: any) => String(x.id));
  ok(arenaIds.length === 5 && !DEFAULT_ELVES.some((e: any) => arenaIds.includes(String(e.id))), '載入前清單不含階段競技場精靈');
  const before = DEFAULT_ELVES.length, skillsBefore = game.GLOBAL_SKILLS.length, revisionBefore = getDefaultElvesRevision();
  let notified = 0;
  const off = subscribeDefaultElves(() => notified++);
  const first = loadImportedElves();
  ok(loadImportedElves() === first, '重複呼叫共用同一個載入');
  await first; await loadImportedElves();
  off();
  const imported = DEFAULT_ELVES.filter((e: any) => String(e.id) === 'wiki_4937');
  ok(imported.length === 1 && DEFAULT_ELVES.length === before + arenaIds.length + 1, '載入後只追加一次（競技場精靈＋匯入精靈），且追加在清單尾端');
  ok(DEFAULT_ELVES.slice(before, before + arenaIds.length).every((e: any, i: number) => String(e.name) === STAGED_ARENA_ELVES[i].name) && arenaIds.every((_: string, i: number) => DEFAULT_ELVES.filter((e: any) => e.name === STAGED_ARENA_ELVES[i].name).length === 1), '階段競技場精靈依原順序追加在匯入精靈之前，各只一份');
  ok(String(DEFAULT_ELVES[DEFAULT_ELVES.length - 1].id) === 'wiki_4937', '匯入精靈排在原有精靈之後（順序與先前靜態載入相同）');
  ok(notified === 1 && getDefaultElvesRevision() === revisionBefore + 1, '訂閱者只收到一次通知');
  ok(game.GLOBAL_ELVES === DEFAULT_ELVES && game.GLOBAL_ELVES.length === before + arenaIds.length + 1, 'GLOBAL_ELVES 與預設清單為同一個陣列');
  ok(game.GLOBAL_SKILLS.length > skillsBefore && game.GLOBAL_SKILLS.some((s: any) => imported[0].skills.includes(s)), 'GLOBAL_SKILLS 同步補齊');
  const e = imported[0];
  ok(importedGraph(), '載入後 importedElves 才被執行');
  ok(e.soulMark?.effectMode === 'kit' && e.skills.length > 0 && e.skills.every((s: any) => s.effectMode === 'kit'), '匯入精靈仍只走 Kit');
  ok(e.calculatedStats?.hp > 0 && e.maxHp === e.calculatedStats.hp && e.currentHp === e.maxHp, '匯入精靈與其他預設精靈一樣完成數值計算');

  // 3) 介面：Provider 掛載時清單不含匯入精靈（載入尚未發生）；載入完成後 allElves 重算並包含它。
  const server2 = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  try {
    const defs = await server2.ssrLoadModule('/src/data/defaultElves.ts');
    const { GameDataProvider, useGameData } = await server2.ssrLoadModule('/src/contexts/GameDataContext.tsx');
    const { createRoot } = await import('react-dom/client');
    const container = document.getElementById('root')!;
    const rootEl = createRoot(container);
    const has = () => container.querySelector('i')?.getAttribute('data-has');
    const Probe = () => { const { allElves } = useGameData(); return React.createElement('i', { 'data-has': String(allElves.some((x: any) => String(x.id) === 'wiki_4937')) }); };
    await act(async () => rootEl.render(React.createElement(GameDataProvider, null, React.createElement(Probe))));
    ok(has() === 'false', '載入前 allElves 不含匯入精靈');
    await act(async () => { await defs.loadImportedElves(); });
    ok(has() === 'true', '載入完成後 allElves 重算並含 wiki_4937');
    await act(async () => rootEl.unmount());
  } finally { await server2.close(); }
  // 4) 進入點：main.tsx 必須在首次繪製前等待載入完成（避免使用者保存的隊伍還原後清單才改變、被清單同步改寫）。
  const main = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
  ok(/loadImportedElves\(\)[\s\S]*\.finally\([\s\S]*createRoot\(/.test(main), 'main.tsx 先載入匯入精靈，完成（或失敗）後才首次繪製');
  console.log(`匯入精靈延後載入：${checks} 項通過`);
} finally { await server.close(); }
