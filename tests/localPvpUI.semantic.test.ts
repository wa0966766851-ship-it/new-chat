// 雙人同屏（PVP）UI：P2 必須有自己的技能面板與操作權（DSH 20261019 修復驗收）。
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
(window as any).__BATTLE_FAST__ = true; (globalThis as any).__BATTLE_SEED__ = 841;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
  plugins: [{ name: 'headless-pvp-ui', configResolved(config) { config.server.hmr = false; config.server.watch = null; } }] });
let checks = 0;
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const wait = { name: '等待', type: '普通', category: '屬性', power: 0, pp: 20, maxPp: 20, description: '', isSureHit: true };
  const make = (id: string): any => ({ id, name: id, battleId: id, type: '普通', level: 100,
    maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    statStages: {}, effects: [], skills: [{ ...wait }] });
  const seed = (id: string) => structuredClone(DEFAULT_ELVES.find((e: any) => e.id === id));
  let driver: any;
  const mount = (key: string, p1: any, p2: any) => act(async () => root.render(React.createElement(Battle, { key,
    initialP1Team: [p1], initialP2Team: [p2], p1StarterId: p1.id, p2StarterId: p2.id,
    battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onRestartBattle: () => {},
    onDriverInit: (d: any) => driver = d })));
  const settle = async () => { for (let i = 0; i < 300 && (!driver || !driver.getSyncState().turnNumber); i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); }); };

  // 1) P1 選招後 phase 必須進入 p2_select，且畫面出現「操作側=p2」的技能面板
  {
    const a = { ...seed('5000'), ...make('pvp-a'), name: seed('5000').name, skills: [{ ...wait, category: '物理', power: 10 }] };
    const b = { ...seed('5001'), ...make('pvp-b'), name: seed('5001').name, skills: [{ ...wait, category: '屬性' }] };
    await mount('pvp-ui-1', a, b); await settle();
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); });
    for (let i = 0; i < 250 && driver.getSyncState().phase !== 'p2_select'; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().phase, 'p2_select', 'PVP：P1 選招後必須交給 P2');
    const row = document.querySelector('[data-act-side]');
    assert.ok(row, '技能面板必須標記操作側');
    assert.equal((row as HTMLElement).dataset.actSide, 'p2', 'P2 選擇階段面板必須切到 P2');
    assert.ok((row as HTMLElement).textContent!.includes('等待'), 'P2 面板必須顯示 P2 的技能');
    checks++;
  }
  root.render(null); await act(async () => { await new Promise(r => setTimeout(r, 0)); });

  // 2) P2 出招後必須真正結算（turnNumber+1），回到 P1
  {
    const a = { ...seed('5000'), ...make('pvp-c'), name: seed('5000').name, skills: [{ ...wait, category: '物理', power: 10 }] };
    const b = { ...seed('5001'), ...make('pvp-d'), name: seed('5001').name, skills: [{ ...wait, category: '屬性' }] };
    await mount('pvp-ui-2', a, b); await settle();
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); });
    for (let i = 0; i < 250 && driver.getSyncState().phase !== 'p2_select'; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    const before = driver.getSyncState().turnNumber;
    await act(async () => { driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 400 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.ok(driver.getSyncState().turnNumber > before, 'P2 出招必須推進回合');
    assert.equal(driver.getSyncState().phase, 'p1_select', '結算後回到 P1 選擇');
    checks++;
  }
  root.render(null); await act(async () => { await new Promise(r => setTimeout(r, 0)); });

  // 3) PVE 回歸：面板恆為 p1，不因本次修改破壞
  {
    const a = { ...seed('5000'), ...make('pve-a'), name: seed('5000').name, skills: [{ ...wait, category: '物理', power: 10 }] };
    const b = { ...seed('5001'), ...make('pve-b'), name: seed('5001').name, skills: [{ ...wait, category: '屬性' }] };
    await act(async () => root.render(React.createElement(Battle, { key: 'pve-ui',
      initialP1Team: [a], initialP2Team: [b], p1StarterId: a.id, p2StarterId: b.id,
      battleMode: 'PVE', preparedTeams: true, onBackToMenu: () => {}, onRestartBattle: () => {},
      onDriverInit: (d: any) => driver = d })));
    await settle();
    const row = document.querySelector('[data-act-side]');
    assert.ok(row, 'PVE 面板也帶操作側標記');
    assert.equal((row as HTMLElement).dataset.actSide, 'p1', 'PVE 恆為 p1');
    checks++;
  }
  console.log('雙人同屏 UI：' + checks + ' 個情境通過（P2 面板、雙側結算、PVE 回歸）。');
} finally { await act(async () => root.render(null)); await server.close(); dom.window.close(); }
