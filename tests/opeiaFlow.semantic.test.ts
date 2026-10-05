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
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const souls = getSoulMarkRegistry();
  const original = souls['蟲后·奧佩婭'];
  assert.equal(typeof original, 'function', '真正註冊而非只有文字');
  let driver: any;
  const waitSkill = { name: '中性等待測試', type: '普通', category: '屬性', power: 0, pp: 20, maxPp: 20, description: '' };
  const make = (id: string, name = id): any => ({ id, name, battleId: id, type: '普通', level: 100,
    maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 200 },
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, statStages: {},
    effects: [], skills: [structuredClone(waitSkill)] });
  for (const side of ['p1', 'p2']) for (const scenario of ['attack', 'attribute', 'immune']) {
    const trace: any[] = [];
    souls['蟲后·奧佩婭'] = (ctx: any, event: string, data: any) => original({ ...ctx,
      applyStatusWithImmunityCheck: (target: string, status: string, duration: number) => {
        const result = ctx.applyStatusWithImmunityCheck(target, status, duration);
        trace.push({ event, target, status, ...result });
        return result;
      },
    }, event as any, data);
    const template = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5018'));
    const opeia = { ...template, ...make('5018', template.name), type: '蟲',
      skills: [scenario === 'attack' ? structuredClone(template.skills.find((s: any) => s.name === '毒噬魂絲')) : structuredClone(waitSkill)] };
    const enemy = make('neutral-target');
    if (scenario === 'immune') {
      enemy.name = '中毒免疫測試者';
      souls[enemy.name] = (_ctx: any, event: string, data: any) => {
        if (event === 'BEFORE_STATUS_APPLY' && data?.status === '中毒') data.prevented = true;
        return false;
      };
    }
    await act(async () => root.render(React.createElement(Battle, { key: `${side}-${scenario}`,
      initialP1Team: [side === 'p1' ? opeia : enemy], initialP2Team: [side === 'p2' ? opeia : enemy],
      p1StarterId: side === 'p1' ? opeia.id : enemy.id, p2StarterId: side === 'p2' ? opeia.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber < 2; i++) {
      await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    }
    assert.equal(driver.getSyncState().turnNumber, 2, `${side}/${scenario}完成回合`);
    const target = driver.getSyncState()[side === 'p1' ? 'p2' : 'p1'];
    if (scenario === 'immune') {
      assert.ok(trace.some(e => e.status === '中毒' && e.immune && !e.success), '免疫有真實失敗結果');
      assert.ok(!getStatuses(target)['感染'], '中毒未成功不凭空轉化');
    } else {
      assert.ok(trace.some(e => e.status === '中毒' && e.success), `${side}/${scenario}中毒成功`);
      assert.ok(trace.some(e => e.status === '感染' && e.success), `${side}/${scenario}出手結束轉化成功`);
      assert.ok(getStatuses(target)['感染'] > 0, `${side}/${scenario}感染真正保留於結算狀態`);
      assert.ok(!getStatuses(target)['中毒'], '轉化後不殘留中毒');
    }
    console.log(`${side}/${scenario}: ${JSON.stringify(trace)}`);
  }
  souls['蟲后·奧佩婭'] = original;
  delete souls['中毒免疫測試者'];
  for (const side of ['p1', 'p2']) for (const id of ['5004', '5005']) {
    const receipts: any[] = [];
    souls['致死結算測試者'] = (_ctx: any, event: string, data: any) => { if (event === 'OPPONENT_DAMAGE') receipts.push(data.receipt); return false; };
    const survivor = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === id));
    Object.assign(survivor, { ...make(id, survivor.name), skills: [structuredClone(waitSkill)], maxHp: 1000, currentHp: 1000 });
    const attacker = make('致死結算測試者');
    attacker.calculatedStats.speed = 5000;
    attacker.skills = [{ ...waitSkill, name: '必中致死測試', category: '物理', power: 10000000, isSureHit: true }];
    await act(async () => root.render(React.createElement(Battle, { key: `fatal-${side}-${id}`,
      initialP1Team: [side === 'p1' ? survivor : attacker], initialP2Team: [side === 'p2' ? survivor : attacker],
      p1StarterId: side === 'p1' ? survivor.id : attacker.id, p2StarterId: side === 'p2' ? survivor.id : attacker.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber < 2; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState()[side].currentHp, 1, `${side}/${id}致死後真正留下1HP，不是保留受擊前HP`);
    assert.equal(driver.getSyncState().winner, null);
    assert.ok(receipts.some(r => r?.resistedFatal && r.hpAfter === 1 && r.hpLost === 999), '免死回饋使用真正HP差，不用未抵擋的假死亡結果');
  }
  delete souls['致死結算測試者'];
  // 六維臨時加成必須真的寫入引擎，換人還原且重新登場不複利。
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const template = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5018'));
    const opeia = { ...template, ...make('5018', template.name), skills: [structuredClone(waitSkill)] };
    const bench = make('bonus-bench'), enemy = make('bonus-enemy');
    await act(async () => root.render(React.createElement(Battle, { key: `stats-${side}`,
      initialP1Team: side === 'p1' ? [opeia, bench] : [enemy], initialP2Team: side === 'p2' ? [opeia, bench] : [enemy],
      p1StarterId: side === 'p1' ? opeia.id : enemy.id, p2StarterId: side === 'p2' ? opeia.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    const expected = { hp: 124080, atk: 24180, def: 34080, spatk: 24180, spdef: 34080, speed: 24280 };
    assert.deepEqual(driver.getSyncState()[side].calculatedStats, expected, '120400×2×10%=24080，每一維都加24080');
    assert.equal(driver.getSyncState()[side].maxHp, expected.hp);
    assert.equal(driver.getSyncState()[side].currentHp, 100000, '能力上限加成不是自動回血');
    await act(async () => {
      if (side === 'p1') { driver.onSwitchElf(side, 1); driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]); }
      else { driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]); driver.onSwitchElf(side, 1); }
    });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber < 2; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState()[side].id, bench.id, JSON.stringify({ side, phase: driver.getSyncState().phase,
      round: driver.getSyncState().turnNumber, logs: driver.getSyncState().logs }));
    const stored = driver.getSyncState()[`${side}Team`][0];
    assert.deepEqual(stored.calculatedStats, opeia.calculatedStats, '下場還原六維');
    assert.equal(stored.maxHp, 100000);
    assert.deepEqual(driver.getSyncState()[side].calculatedStats, bench.calculatedStats, '不污染下隻精靈');
    await act(async () => {
      if (side === 'p1') { driver.onSwitchElf(side, 0); driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]); }
      else { driver.onSkillSelect(other, driver.getSyncState()[other].skills[0]); driver.onSwitchElf(side, 0); }
    });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.deepEqual(driver.getSyncState()[side].calculatedStats, expected, '重新登場按原始六維重算，不複利');
  }
  const originalRey = souls['異境神霆·雷伊'];
  const turnActions: string[] = [];
  souls['雷伊機制測試者'] = (_ctx: any, event: string, data: any) => {
    if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
    if (event === 'BEFORE_SKILL') turnActions.push('enemy');
    return false;
  };
  souls['異境神霆·雷伊'] = (ctx: any, event: string, data: any) => {
    if (event === 'BEFORE_SKILL') turnActions.push('rey');
    return originalRey(ctx, event as any, data);
  };
  for (const side of ['p1', 'p2'] as const) for (const scenario of ['attribute-pp', 'attack-pp', 'priority']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const template = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5029'));
    const rey = { ...template, ...make('5029', template.name), maxHp: 1000, currentHp: 900 };
    rey.calculatedStats = { ...rey.calculatedStats, hp: 1000, speed: 100 };
    rey.skills = scenario === 'priority'
      ? [{ ...waitSkill, name: '先制效果驗收特殊招', category: '特殊', power: 1, priority: 2 }, structuredClone(waitSkill)]
      : [structuredClone(template.skills.find((s: any) => s.name === '同塵祭'))];
    const enemy = make('雷伊機制測試者');
    enemy.calculatedStats.speed = 5000;
    enemy.skills = [{ ...waitSkill, category: scenario === 'attack-pp' ? '物理' : '屬性', power: scenario === 'attack-pp' ? 1 : 0,
      priority: scenario === 'priority' ? 1 : -10 }];
    await act(async () => root.render(React.createElement(Battle, { key: `rey-${side}-${scenario}`,
      initialP1Team: [side === 'p1' ? rey : enemy], initialP2Team: [side === 'p2' ? rey : enemy],
      p1StarterId: side === 'p1' ? rey.id : enemy.id, p2StarterId: side === 'p2' ? rey.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber < 2; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().turnNumber, 2);
    if (scenario === 'priority') {
      assert.ok(driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'rey_special_priority_penalty' && t.payload.block.prio === -1));
      assert.ok(!driver.getSyncState()[`${side}Timers`].some((t: any) => t.id === 'rey_special_priority_penalty'));
      turnActions.length = 0;
      await act(async () => {
        driver.onSkillSelect('p1', driver.getSyncState().p1.skills[side === 'p1' ? 1 : 0]);
        driver.onSkillSelect('p2', driver.getSyncState().p2.skills[side === 'p2' ? 1 : 0]);
      });
      for (let i = 0; i < 250 && driver.getSyncState().turnNumber < 3; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
      assert.deepEqual(turnActions.slice(0, 2), ['rey', 'enemy'], '敵人先制1被降至0，雷伊先制1勝出，不能錯扣雷伊');
    } else assert.equal(driver.getSyncState()[other].skills[0].pp, 13, `${side}/${scenario}實際扣7PP，屬性／攻擊皆讀同一計時器`);
  }
  souls['異境神霆·雷伊'] = originalRey;
  delete souls['雷伊機制測試者'];
  console.log('蟲后真實引擎：P1/P2、攻擊／屬性、中毒成功／免疫及感染轉化通過。');
  console.log('5004／5005 真實引擎致死存活：P1/P2留下1HP通過。');
  console.log('蟲后六維加成／下場還原／重登場不複利；雷伊兩側PP×7及先制降低實際出手順序通過。');
} finally {
  await act(async () => root.unmount()); await server.close(); dom.window.close();
}
