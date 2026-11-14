import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createServer } from 'vite';

// 真實抽卡入口 → 禁用 → 選隊 → App 同款準備 → 正式引擎。不能只測人工 bindBag。
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const { useDestinyDraft } = await import('../src/components/destiny/useDestinyDraft');
const { DEFAULT_ELVES: pool } = await import('../src/data/defaultElvesLoaded');
const { correspondingBagElf } = await import('../src/battle/bagTargets');
const { resetElfStateForBattle } = await import('../src/utils/statCalculator');
const { applySavedSkillCorrections } = await import('../src/data/savedSkillCorrections');
const root = createRoot(document.getElementById('root')!);
let draft: any, launched: any, seed = 7;
const random = Math.random;
Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
function Probe() {
  draft = useDestinyDraft({ allElves: pool, initialBattleMode: 'PVP', onBack: () => {}, onStartBattle: (...args: any[]) => { launched = args; } }, { pullMs: 0 });
  return null;
}
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  for (const side of ['p1', 'p2'] as const) {
    let found = false;
    for (let i = 0; i < 60; i++) {
      await act(async () => root.render(<Probe key={`${side}-${i}`} />));
      await act(async () => draft.handleStartPull());
      await act(async () => draft.skipPull());
      if (draft[`${side}Pool`].some((e: any) => String(e.id) === '5033')) { found = true; break; }
    }
    assert.ok(found, `${side} 固定亂數序列須抽到艾斯菲格`);
    await act(async () => draft.handleProceedToBan());
    for (const e of draft.p2Pool.filter((e: any) => String(e.id) !== '5033').slice(-3)) await act(async () => draft.toggleBan(e.instanceId));
    for (const e of draft.p1Pool.filter((e: any) => String(e.id) !== '5033').slice(-3)) await act(async () => draft.toggleP2Ban(e.instanceId));
    await act(async () => draft.handleConfirmBan());
    const elf = draft[`${side}Pool`].find((e: any) => String(e.id) === '5033');
    const toggle = side === 'p1' ? 'togglePick' : 'toggleP2Pick';
    if (!draft[`${side}PickedIds`].includes(elf.instanceId)) {
      await act(async () => draft[toggle](draft[`${side}PickedIds`].at(-1)));
      await act(async () => draft[toggle](elf.instanceId));
    }
    await act(async () => draft[side === 'p1' ? 'setP1StarterId' : 'setP2StarterId'](elf.instanceId));
    await act(async () => draft.handleLaunchBattle());
    assert.ok(launched);
    const prepare = (team: any[], starter: string) => team.map(e => resetElfStateForBattle(applySavedSkillCorrections(e, pool), e.battleId === starter));
    const p1 = prepare(launched[1], launched[3]), p2 = prepare(launched[2], launched[4]);
    const own = side === 'p1' ? p1 : p2;
    const self = own.find(e => e.battleId === elf.instanceId)!;
    assert.equal(self.initialBench?.length, 3);
    const expected = correspondingBagElf(own, self);
    assert.ok(expected, `${side} App 準備後仍保留待命配對`);
    const engine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: launched[3], p2StarterId: launched[4],
      battleMode: 'PVP', specialMode: 'destiny', p1Suit: launched[5], p2Suit: launched[7], isFast: () => true, onNode: () => {} });
    try {
      engine.mount(); engine.start(); await engine.idle();
      assert.equal(engine.getState()[side].illusion?.target?.name, expected.name, `${side} 正式進戰幻化指定待命精靈`);
    } finally { engine.unmount(); }
    console.log(`${side} 命運抽卡至進戰：艾斯菲格幻化配對通過`);
  }
} finally {
  Math.random = random;
  await act(async () => root.unmount());
  await server.close(); dom.window.close();
}
process.exit(0);
