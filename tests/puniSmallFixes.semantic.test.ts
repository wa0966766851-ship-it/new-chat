import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const souls = getSoulMarkRegistry();
  const wait = { name: '譜尼驗收等待', type: '普通', category: '屬性', power: 0, pp: 30, maxPp: 30, description: '' };
  const attack = { ...wait, name: '譜尼驗收攻擊', category: '特殊', power: 1, isSureHit: true };
  const make = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 200 },
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    statStages: {}, effects: [], skills: [{ ...attack }, { ...wait }] });
  let driver: any;
  for (const side of ['p1', 'p2'] as const) for (const scenario of ['true', 'percent', 'invalid', 'no-boost']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const template = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === (scenario === 'true' || scenario === 'percent' ? '300' : '5000')));
    const skillName = scenario === 'true' ? '斷空破' : scenario === 'percent' ? '聖靈魔閃光' : '神靈之觸';
    const chosen = [...template.skills, ...(template.skillPool || [])].find((s: any) => s.name === skillName);
    // 配裝只攜帶5招；技能池未列入舊招時以TXT元資料建立同名技能，仍走真正的公開技能handler。
    const selected = chosen || { ...attack, name: skillName, power: 90,
      pp: 20, maxPp: 20, description: scenario === 'true' ? '附加對手30點真實傷害' : '消除對手能力提升狀態，消除成功則對手下次攻擊技能無效' };
    const self = { ...template, ...make(template.id), name: template.name,
      skills: [structuredClone(selected), { ...attack }] };
    const enemy = make(`puni-enemy-${side}-${scenario}`);
    enemy.shield = 99999; enemy.barrier = 99999;
    if (scenario === 'invalid') enemy.statStages = { atk: 2, def: -2 };
    const damaged: any[] = [], invalid: any[] = [];
    souls[enemy.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'ON_DAMAGED') damaged.push(data);
      if (event === 'SKILL_INVALID') invalid.push(data);
      return false;
    };
    await act(async () => root.render(React.createElement(Battle, { key: `${side}-${scenario}`,
      initialP1Team: [side === 'p1' ? self : enemy], initialP2Team: [side === 'p2' ? self : enemy],
      p1StarterId: side === 'p1' ? self.id : enemy.id, p2StarterId: side === 'p2' ? self.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    const turn = async (ownIndex: number, enemyIndex: number) => {
      const before = driver.getSyncState().turnNumber;
      await act(async () => {
        driver.onSkillSelect('p1', driver.getSyncState().p1.skills[side === 'p1' ? ownIndex : enemyIndex]);
        driver.onSkillSelect('p2', driver.getSyncState().p2.skills[side === 'p2' ? ownIndex : enemyIndex]);
      });
      for (let i = 0; i < 250 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
      assert.equal(driver.getSyncState().turnNumber, before + 1);
    };
    await turn(0, scenario === 'true' || scenario === 'percent' ? 1 : 0);
    if (scenario === 'true') {
      const r = damaged.find(d => d.receipt?.damageType === 'true' && d.receipt.requestedAmount === 30)?.receipt;
      assert.ok(r, '斷空破真正派發30真傷');
      assert.equal(r.hpLost, 30); assert.equal(r.barrierAbsorbed, 0); assert.equal(r.shieldAbsorbed, 0);
      assert.equal(driver.getSyncState()[other].barrier, 99999, '不能錯走護罩');
    } else if (scenario === 'percent') {
      const r = damaged.find(d => d.receipt?.damageType === 'percent' && d.receipt.requestedAmount === 12500)?.receipt;
      assert.ok(r, '聖靈魔閃光最大HP1/8明確走百分比，不靠日誌猜類型');
      assert.equal(r.hpLost, 0); assert.equal(r.barrierAbsorbed, 12500); assert.equal(r.shieldAbsorbed, 0);
      assert.equal(driver.getSyncState()[other].barrier, 87499);
    } else {
      assert.equal(invalid.filter(d => !d.isIncoming).length, scenario === 'invalid' ? 1 : 0, '僅消強成功後令敵方下一次攻擊無效');
      if (scenario === 'invalid') {
        assert.equal(driver.getSyncState()[other].statStages.atk, 0);
        assert.equal(driver.getSyncState()[other].statStages.def, -2, '消強不清能力下降');
      }
      const prior = damaged.filter(d => d.damageType === 'skill_attack').length;
      await turn(1, 1);
      assert.equal(damaged.filter(d => d.damageType === 'skill_attack').length, prior + 1, '不反過來使譜尼下次攻擊無效');
      assert.ok(!driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'puni_touch_next_attack_invalid'), '次數效果消耗後不殘留');
    }
    delete souls[enemy.name];
  }
  console.log('譜尼小修：P1/P2斷空破真傷穿盾罩、聖靈魔閃光百分比、神靈之觸成功/失敗側別與次數消耗，8個真實引擎情境通過。');
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
