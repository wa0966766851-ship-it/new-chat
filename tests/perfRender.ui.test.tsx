// 效能重構護欄（畫面端、計數式）：400 筆日誌的遮蔽／分類管線不得隨每次重繪重算；一頁最多渲染 40 行。
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
(dom.window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Object.assign(globalThis, { requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
const { createRoot } = await import('react-dom/client');
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const root = createRoot(document.getElementById('root')!);
let passed = 0;
const check = async (name: string, run: () => void | Promise<void>) => { await run(); passed++; console.log(`✓ ${name}`); };
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { prepareSavedBattleRoster } = await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const { BattleContext } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { BattleScreenUI } = await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');
  const { buildLogPipeline, maskLogRows, logViewStats, LOG_PAGE_SIZE } = await server.ssrLoadModule('/src/battle/logView.ts');
  const lc = await server.ssrLoadModule('/src/battle/logClassifier.ts');

  const A = DEFAULT_ELVES.find((e: any) => String(e.id) === '5041'), B = DEFAULT_ELVES.find((e: any) => String(e.id) === '5029');
  const team = (e: any, side: string) => prepareSavedBattleRoster([structuredClone(e)], [structuredClone(e)], false, side);
  const p1Team = team(A, 'p1'), p2Team = team(B, 'p2');
  const engine = createBattleEngine({ initialP1Team: p1Team, initialP2Team: p2Team, p1StarterId: p1Team[0].battleId, p2StarterId: p2Team[0].battleId, battleMode: 'PVP', preparedTeams: true });
  const base = engine.getState();
  const makeLogs = (n: number) => Array.from({ length: n }, (_, i) => ({ turn: 1 + Math.floor(i / 8), type: i % 5 === 0 ? 'damage' : i % 7 === 0 ? 'defeat' : 'info',
    text: i % 8 === 0 ? `【${A.name}】使用了【技能${i}】！` : i % 5 === 0 ? `【${B.name}】受到了 ${1000 + i} 點傷害` : `效果訊息 ${i}：【${A.name}】獲得【護盾】` }));

  await check('buildLogPipeline 與原本內聯於 renderBattleLog 的管線逐項相同（模式×精靈×查詢）', () => {
    const logs = maskLogRows(makeLogs(400), (t?: string) => String(t ?? '').split(B.name).join('〔未知〕'));
    assert.equal(logs.length, 400);
    assert.ok(logs.every(l => !l.text.includes(B.name)), '遮蔽已套用');
    for (const mode of ['brief', 'damage', 'full'] as const) for (const elf of [null, A.name]) for (const query of ['', '3 傷害', '護盾']) {
      const modeLogs = lc.filterByMode(logs, mode);
      const got = buildLogPipeline(logs, modeLogs, elf, query);
      // 原始內聯實作
      let pipeline = lc.filterByMode(logs, mode); pipeline = lc.filterByElf(pipeline, elf); pipeline = lc.filterByQuery(pipeline, query);
      const digests = lc.turnDigests(pipeline);
      const elfChoices = [...new Set(([] as string[]).concat(...logs.slice(-LOG_PAGE_SIZE * 6).map((l: any) => lc.elfNamesIn(l.text))))].slice(0, 12);
      assert.deepEqual(got.pipeline, pipeline); assert.deepEqual([...got.digests], [...digests]); assert.deepEqual(got.elfChoices, elfChoices);
    }
  });

  const render = (value: any) => act(async () => root.render(<BattleContext.Provider value={value}><BattleScreenUI battleMode="PVP" onSkillSelect={() => {}} onSwitchElf={() => {}} onUseItem={() => {}} onReset={() => {}} onBackToMenu={() => {}} onAutoBattleToggle={() => {}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={base.damageDealt} /></BattleContext.Provider>));

  await check('400 筆日誌：重繪 8 次（日誌陣列不變）只建一次管線；追加日誌才重建；一頁最多 40 行', async () => {
    const logs = makeLogs(400);
    const before = logViewStats.pipelineBuilds;
    for (let i = 0; i < 8; i++) await render({ ...base, logs, p1: { ...base.p1, currentHp: base.p1.maxHp - i }, turnNumber: 5 });
    assert.equal(logViewStats.pipelineBuilds - before, 1, '日誌沒變時，管線不得隨重繪重算');
    const lines = document.querySelectorAll('[data-battle-log] .bt-log-line').length;
    assert.ok(lines > 0 && lines <= LOG_PAGE_SIZE, `一頁渲染 ${lines} 行`);
    await render({ ...base, logs: [...logs.slice(1), { turn: 99, type: 'info', text: '新的一行' }], turnNumber: 6 });
    assert.equal(logViewStats.pipelineBuilds - before, 2, '日誌改變才重算');
    assert.ok(document.querySelector('[data-battle-log]')!.textContent!.includes('新的一行'), '最新日誌顯示在最後一頁');
  });

  await check('訊息欄關閉時不建管線', async () => {
    const logs = makeLogs(50);
    await render({ ...base, logs, turnNumber: 2 });
    const toggle = document.querySelector('[data-log-toggle]') as HTMLButtonElement;
    await act(async () => { toggle.click(); });
    assert.equal(document.querySelector('[data-battle-log]'), null, '已收起');
    const before = logViewStats.pipelineBuilds;
    for (let i = 0; i < 4; i++) await render({ ...base, logs: [...logs, { turn: 9, type: 'info', text: `x${i}` }], turnNumber: 3 + i });
    assert.equal(logViewStats.pipelineBuilds, before, '收起期間不做分類管線');
  });
  engine.unmount();
} finally {
  await act(async () => root.render(<></>));
  await server.close();
}
console.log(`${passed} checks`);
process.exit(0);
