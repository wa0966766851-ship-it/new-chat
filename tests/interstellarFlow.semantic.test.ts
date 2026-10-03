import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
const { createRoot } = await import('react-dom/client');
const { default: Run } = await import('../src/components/InterstellarExploration/InterstellarRun');
const E = await import('../src/modes/interstellar/v2/engine');
const { DEFAULT_ELVES } = await import('../src/data/defaultElves');
const root = createRoot(document.getElementById('root')!);
let launched: any;
const props = { allElves: DEFAULT_ELVES, startingDiamonds: 4, initialEquipType: 'suit' as const, initialEquipId: '', selectedModifiers: ['no_potions'],
  onEndRun: () => {}, onStartBattle: (p1: any, p2: any, mode: any, options: any) => { launched = { p1, p2, mode, options }; } };
const buttons = () => [...document.querySelectorAll('button')];
const click = async (label: string) => { const b = buttons().find(e => e.textContent?.trim() === label); assert.ok(b, label); await act(async () => b!.click()); };
const text = () => document.body.textContent || '';
try {
  await act(async () => root.render(React.createElement(Run, props)));
  let run = E.loadRunV2(localStorage)!;
  assert.equal(run.shards, 4); assert.equal(run.potions, 1, '禁藥之契');
  assert.ok(text().includes('選擇持燈者'));
  // 選秀：點三張卡
  const cards = buttons().filter(b => b.classList.contains('ecl-card')).slice(0, 3);
  for (const c of cards) await act(async () => c.click());
  await click('點燃燈火');
  run = E.loadRunV2(localStorage)!;
  assert.equal(run.team.length, 3); assert.equal(run.scene.kind, 'map');
  // 地圖：點一個可前往的戰鬥節點（SVG g[role=button]）
  const target = E.movesFrom(run).find(n => n.kind === 'combat') ?? E.movesFrom(run)[0];
  const g = document.querySelector(`[data-node="${target.id}"]`)!;
  await act(async () => { g.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  run = E.loadRunV2(localStorage)!;
  if (run.scene.kind !== 'prelude') {
    // 「？」可能揭曉為非戰鬥：直接由引擎轉到一場戰鬥驗收開戰流程
    const forced = { ...run, scene: { kind: 'prelude' as const, encounter: { kind: 'combat' as const, title: '測試', enemies: [{ id: String(DEFAULT_ELVES[3].id), affixes: ['affix_regen'] }], scale: 1.2, hpScale: 2.5 } } };
    localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(forced));
    await act(async () => root.render(null));
    await act(async () => root.render(React.createElement(Run, props)));
  }
  await click('迎戰');
  assert.ok(launched, '開戰交接');
  assert.equal(launched.options.specialMode, 'interstellar');
  assert.ok(launched.p2[0].maxHp > launched.p1[0].maxHp, '敵方體力高於玩家');
  const opts = launched.options.interstellarOptions;
  assert.ok(Array.isArray(opts.enemyRelics));
  await act(async () => root.render(null));
  assert.equal(opts.onPotionUse(), true); assert.equal(opts.onPotionUse(), false, '藥劑用盡');
  const after = launched.p1.map((e: any, i: number) => i === 0 ? { ...e, currentHp: 123, skills: e.skills.map((s: any) => ({ ...s, pp: 1 })) } : e);
  opts.onBattleEnd('p1', after);
  const settled = E.loadRunV2(localStorage)!;
  assert.equal(settled.scene.kind, 'reward'); assert.equal(settled.team.find((e: any) => e.battleId === after[0].battleId)!.currentHp, 123);
  opts.onBattleEnd('p1', after); assert.equal(E.loadRunV2(localStorage)!.revision, settled.revision, '重複結算無效');
  await act(async () => root.render(React.createElement(Run, props)));
  assert.ok(text().includes('戰鬥結束'));
  await click('繼續前行');
  assert.equal(E.loadRunV2(localStorage)!.scene.kind, 'map');
  console.log('星蝕回廊元件：選秀、地圖移動、開戰交接、藥劑、結算延續與獎勵返回通過');
} finally { await act(async () => root.unmount()); dom.window.close(); }
