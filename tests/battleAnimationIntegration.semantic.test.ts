import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const BattleSkillRegistry = getBattleSkillRegistry();
  let extra = false;
  BattleSkillRegistry['播放隔離驗收'] = (c: any) => {
    c.applySkillTypeDamage('p2', 50, '屬性技能紅傷', { category: 'skill_attribute', node: 'attack_damage' });
    c.applyPinkDamage('p2', 10, '附加粉傷');
    c.applyHeal('p1', 20);
    c.applyTrueDamage('p2', 5, '白傷一');
    c.applyTrueDamage('p2', 7, '白傷二');
    if (extra) c.queueExtraAction('p1', { amount: 15, label: '額外行動驗收' });
  };
  const make = (id: string, hp: number, name: string, speed: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    currentHp: hp, maxHp: 500, baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed },
    calculatedStats: { hp: 500, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, statStages: {},
    skills: [{ name, category: '屬性', type: '普通', power: 0, pp: 5, maxPp: 5 }] });
  let driver: any;
  async function run(fast: boolean, withExtra: boolean) {
    extra = withExtra;
    (window as any).__BATTLE_FAST__ = fast;
    (globalThis as any).__BATTLE_SEED__ = 321;
    const seen = new Map<string, { type: string; text: string }>();
    const observer = new dom.window.MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('[data-presentation-id]').forEach(el => seen.set(el.dataset.presentationId!, { type: el.dataset.battlePopup!, text: el.textContent || '' }));
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true, attributes: true });
    await act(async () => root.render(React.createElement(Battle, {
      key: `${fast}:${withExtra}`, initialP1Team: [make('a', 150, '播放隔離驗收', 200)], initialP2Team: [make('b', 500, '等待', 100)],
      p1StarterId: 'a', p2StarterId: 'b', battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {},
      onDriverInit: (d: any) => driver = d,
    })));
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 250 && !(driver.getSyncState().turnNumber === 2 && driver.getSyncState().phase === 'p1_select'); i++) {
      await act(async () => { await new Promise(r => setTimeout(r, 40)); });
    }
    observer.disconnect();
    const st = driver.getSyncState();
    assert.equal(st.phase, 'p1_select');
    assert.equal(st.turnNumber, 2);
    assert.equal(st.p1.currentHp, 170);
    assert.equal(st.p2.currentHp, withExtra ? 413 : 428);
    assert.equal(document.querySelectorAll('[data-battle-popup]').length, 0, '收束後不殘留數字');
    if (!fast) {
      const numbers = [...seen.values()];
      assert.equal(numbers.filter(n => n.type === 'skill').length, withExtra ? 2 : 1, '沒有額外行動不插入额外紅傷動畫');
      assert.ok(numbers.some(n => n.type === 'true' && n.text.includes('-12')), '兩筆白傷合併，數字不遺漏');
      assert.ok(numbers.findIndex(n => n.type === 'fixed') < numbers.findIndex(n => n.type === 'heal'));
      assert.ok(numbers.findIndex(n => n.type === 'heal') < numbers.findIndex(n => n.type === 'true'));
    }
    return { p1: structuredClone(st.p1Team), p2: structuredClone(st.p2Team), logs: structuredClone(st.logs),
      p1Registry: structuredClone(st.p1RegistryState), p2Registry: structuredClone(st.p2RegistryState),
      p1Timers: structuredClone(st.p1Timers), p2Timers: structuredClone(st.p2Timers), turn: st.turnNumber, phase: st.phase };
  }
  for (const withExtra of [false, true]) assert.deepEqual(await run(false, withExtra), await run(true, withExtra), '完整播放與快速模式的效果結果、PP、日誌、計時及註冊狀態一致');
  // 播放尚未完成時重建對戰，驗收舊控制器的等待／HP／數字都不會寫入新局。
  (window as any).__BATTLE_FAST__ = false;
  await act(async () => root.render(React.createElement(Battle, {
    key: 'old-playing', initialP1Team: [make('a', 150, '播放隔離驗收', 200)], initialP2Team: [make('b', 500, '等待', 100)],
    p1StarterId: 'a', p2StarterId: 'b', battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d,
  })));
  await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
  for (let i = 0; i < 50 && !document.querySelector('[data-battle-popup="skill"]'); i++) await act(async () => { await new Promise(r => setTimeout(r, 30)); });
  assert.ok(document.querySelector('[data-battle-popup="skill"]'));
  await act(async () => root.render(React.createElement(Battle, {
    key: 'fresh-after-playing', initialP1Team: [make('a', 150, '等待', 200)], initialP2Team: [make('b', 500, '等待', 100)],
    p1StarterId: 'a', p2StarterId: 'b', battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d,
  })));
  await act(async () => { await new Promise(r => setTimeout(r, 850)); });
  assert.equal(driver.getSyncState().p1.currentHp, 150);
  assert.equal(driver.getSyncState().p2.currentHp, 500);
  assert.equal(driver.getSyncState().turnNumber, 1);
  assert.equal(document.querySelectorAll('[data-battle-popup]').length, 0);
  BattleSkillRegistry['真傷上限驗收'] = (c: any) => {
    const target = c.actor === 'p1' ? 'p2' : 'p1';
    c.applyTrueDamage(target, 127, '原真傷一');
    c.applyTrueDamage(target, 53, '原真傷二');
  };
  async function boundedTruth(targetSide: 'p1' | 'p2', initialHp: number, fast: boolean) {
    (window as any).__BATTLE_FAST__ = fast;
    const defender = make(`bound-${targetSide}`, initialHp, '等待', 100);
    defender.survivalRule = { mode: 'freeze_at_zero', active: true, preserveOffField: true, minHp: 0 };
    defender.shield = 999; defender.barrier = 999;
    const attacker = make('source', 500, '真傷上限驗收', 200);
    const seen = new Map<string, { text: string; hp: number }>();
    const observer = new dom.window.MutationObserver(() => {
      document.querySelectorAll<HTMLElement>('[data-battle-popup="true"]').forEach(el => seen.set(el.dataset.presentationId!, {
        text: el.textContent || '', hp: driver.getSyncState()[targetSide].currentHp,
      }));
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    await act(async () => root.render(React.createElement(Battle, {
      key: `bound:${targetSide}:${initialHp}:${fast}`, initialP1Team: [targetSide === 'p1' ? defender : attacker],
      initialP2Team: [targetSide === 'p2' ? defender : attacker],
      p1StarterId: targetSide === 'p1' ? defender.id : attacker.id, p2StarterId: targetSide === 'p2' ? defender.id : attacker.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d,
    })));
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 150 && !(driver.getSyncState().turnNumber === 2 && driver.getSyncState().phase === 'p1_select'); i++) await act(async () => { await new Promise(r => setTimeout(r, 40)); });
    observer.disconnect();
    const st = driver.getSyncState();
    assert.equal(st.phase, 'p1_select'); assert.equal(st.winner, null);
    assert.equal(st[targetSide].currentHp, 0);
    assert.equal(st[targetSide].shield, 999); assert.equal(st[targetSide].barrier, 999, '真傷不被防護資源吸收');
    assert.equal(st[targetSide].skills[0].pp, 4, '0 HP 仍可正常出手，不是假陣亡');
    if (!fast) {
      assert.equal(seen.size, 1, '體力抵達 0 仍存活，兩筆白傷在收束合併');
      assert.ok([...seen.values()][0].text.includes('-180'));
      assert.ok(![...seen.values()][0].text.includes('-0'));
      assert.equal([...seen.values()][0].hp, 0);
    }
    return { p1: structuredClone(st.p1Team), p2: structuredClone(st.p2Team), logs: structuredClone(st.logs),
      p1Registry: structuredClone(st.p1RegistryState), p2Registry: structuredClone(st.p2RegistryState), winner: st.winner, phase: st.phase };
  }
  for (const target of ['p1', 'p2'] as const) for (const hp of [0, 40]) {
    assert.deepEqual(await boundedTruth(target, hp, false), await boundedTruth(target, hp, true), '白字修正不改變結算、PP或存活結果');
  }
  delete BattleSkillRegistry['真傷上限驗收'];
  console.log('真傷显示驗收：P1/P2、正體力跨到0／已在0、兩筆白傷180、防護不吸收、0 HP出手與播放模式結算一致。');
  delete BattleSkillRegistry['播放隔離驗收'];
  console.log('真實戰鬥驗收：有／無額外行動、粉綠白順序、白傷合計與動畫開關的全結算快照一致。');
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
