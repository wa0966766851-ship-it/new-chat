import assert from 'node:assert/strict';
import fs from 'node:fs';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { createRoot } = await import('react-dom/client');
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { preserveSymlinks: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const root = createRoot(document.getElementById('root')!);
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { BattleContext } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { BattleScreenUI } = await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');
  const { BATTLE_ITEMS } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const sk = (i: number) => ({ name: `技${i}`, type: '普通', category: '物理', power: 80, pp: 5, maxPp: 5, description: '', ...(i === 4 ? { isFifthSkill: true } : {}) });
  const elf = (id: string): any => ({ id, battleId: id, name: id, type: '普通', currentHp: 1000, maxHp: 1000, level: 100, skills: [0, 1, 2, 3, 4].map(sk), statStages: {}, calculatedStats: { hp: 1000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 100 } });
  const engine = createBattleEngine({ initialP1Team: [elf('A')], initialP2Team: [elf('E')], p1StarterId: 'A', p2StarterId: 'E', battleMode: 'PVP', preparedTeams: true });
  const base = engine.getState();
  const css = document.createElement('style');
  css.textContent = fs.readFileSync('src/components/battle/battleGameSkin.css', 'utf8').split('\n').filter(s => /^\.btg-(fifth|skill)\[data-(disabled|abolished)/.test(s)).join('\n'); document.head.append(css);
  let passed = 0, selected = 0;
  let pauseTaps = 0;
  const render = async (value: any, side: string, layout: string, paused = false) => {
    localStorage.setItem('battleLayoutStyle', layout);
    await act(async () => { window.dispatchEvent(new window.Event('battle-layout-pref')); });
    await act(async () => root.render(<BattleContext.Provider value={{ ...value, phase: `${side}_select` }}><BattleScreenUI battleMode="PVP" paused={paused} onPauseToggle={()=>pauseTaps++} turnClock={<span data-testid="turn-timer">剩餘 10 秒</span>} onPass={() => passed++} onSkillSelect={() => selected++} onSwitchElf={() => {}} onUseItem={() => {}} onReset={() => {}} onBackToMenu={() => {}} onAutoBattleToggle={() => {}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={{}} /></BattleContext.Provider>));
  };
  for (const side of ['p1', 'p2']) for (const layout of ['game', 'classic']) {
    const state = structuredClone(base), self = state[side];
    self.skills[0].pp = 0; self.skills[0].ignorePpLimit = true;
    self.skills[4].pp = 0; self.skills[4].ignorePpLimit = true;
    await render(state, side, layout);
    assert.ok(document.querySelector('[data-match-info] [data-testid="turn-timer"]'), '計時器錨定在回合資訊內');
    const cards = () => [...document.querySelectorAll(`[data-act-side="${side}"] > button`)] as HTMLButtonElement[];
    const card = (n: number) => cards().find(b => b.textContent?.includes(`技${n}`))!;
    for (const n of [0, 4]) { assert.equal(card(n).getAttribute('aria-disabled'), 'false'); assert.equal(card(n).classList.contains('grayscale'), false); if (layout === 'game') assert.ok(!window.getComputedStyle(card(n)).filter.includes('grayscale')); }
    await act(async () => card(4).click()); assert.ok(selected > 0);
    state[`${side}Timers`] = [{ id: 'selection-lock', kind: 'turns', remaining: 2, payload: { blockAttack: true } }];
    self.skills[4].pp = 5;
    await render(state, side, layout); assert.equal(card(4).getAttribute('aria-disabled'), 'true');
    assert.equal(card(4).getAttribute('data-skill-disabled-reason'), '無法選擇攻擊技能');
    state[`${side}Timers`] = [];
    self.skills[4].pp = 5; self.skills[4].isAbolished = true;
    await render(state, side, layout); assert.equal(card(4).getAttribute('aria-disabled'), 'true');
    if (layout === 'game') assert.ok(window.getComputedStyle(card(4)).filter.includes('grayscale')); else assert.ok(card(4).classList.contains('grayscale'));
    const before = selected; await act(async () => card(4).click()); assert.equal(selected, before, '不可選僅查看，不選招');
    self.skills.forEach((s: any) => { s.isAbolished = true; });
    state[`${side}ItemInventory`] = {}; state[`${side}Team`] = [self];
    await render(state, side, layout);
    assert.equal(document.querySelector('[data-skill-pass-area]')?.getAttribute('data-skill-pass-area'), 'true');
    assert.ok(document.querySelector('[data-skill-pass-hint]')?.textContent?.includes('點擊空過這回合'));
    const p = passed; await act(async () => card(0).click()); assert.equal(passed, p + 1);
    const item = BATTLE_ITEMS.find((i: any) => !i.pickTarget)!;
    state[`${side}ItemInventory`] = { [item.id]: { left: 1, max: 1 } };
    await render(state, side, layout); assert.equal(document.querySelector('[data-skill-pass-area]')?.getAttribute('data-skill-pass-area'), 'false', '可用藥劑時不提示空過');
    state[`${side}RegistryState`] = { ...state[`${side}RegistryState`], noItemTurns: 1 };
    await render(state, side, layout); assert.equal(document.querySelector('[data-skill-pass-area]')?.getAttribute('data-skill-pass-area'), 'true', '藥劑也被禁止才提示空過');
    // 尚有合法切換，不能將技能區改成空過。
    state[`${side}Team`] = [self, elf('reserve')];
    await render(state, side, layout); assert.equal(document.querySelector('[data-skill-pass-area]')?.getAttribute('data-skill-pass-area'), 'false');
    // 上方兩種名單皆有標記，目標成為在場者後立即隱藏。
    const target = state[`${side}Team`][1], other = side === 'p1' ? 'p2' : 'p1';
    state[other].preparedExtraAttack = { side, ids: [target.id] };
    await render(state, side, layout); assert.ok(document.querySelector('[data-extra-attack-target="true"]')); assert.ok(document.querySelector('[data-extra-target-legend]'));
    state[side] = target; state[`${side}ActiveIndex`] = 1;
    await render(state, side, layout); assert.equal(document.querySelector('[data-extra-attack-target="true"]'), null);
    const pause = () => document.querySelector<HTMLButtonElement>('[data-battle-pause]')!;
    assert.equal(pause().getAttribute('aria-label'), '暫停對戰');
    const clicks = pauseTaps; await act(async () => pause().click()); assert.equal(pauseTaps, clicks + 1);
    await render(state, side, layout, true);
    assert.equal(pause().getAttribute('aria-label'), '繼續對戰');
    assert.ok(document.querySelector('[data-act-side]')?.closest('[inert]'));
    assert.equal(pause().closest('[inert]'), null);
    await act(async () => pause().click()); assert.equal(pauseTaps, clicks + 2);
    console.log(`✓ ${side}/${layout} PP零合法亮起、有PP禁用灰化、禁止出招、技能區空過、合法換人保留、預選標記`);
  }
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
process.exit(0);
