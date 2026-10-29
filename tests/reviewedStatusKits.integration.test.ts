import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (fn: any) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
(window as any).__BATTLE_FAST__ = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0;
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { REVIEWED_SKILL_KITS } = await server.ssrLoadModule('/src/data/reviewedSkillKits.ts');
  const { resetPrd } = await server.ssrLoadModule('/src/utils/prd.ts');
  const { getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const make = (id: string, speed: number, skill: any): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
    currentHp: 4000, maxHp: 4000, baseStats: { hp: 4000, atk: 100, def: 1000, spatk: 100, spdef: 1000, speed },
    calculatedStats: { hp: 4000, atk: 100, def: 1000, spatk: 100, spdef: 1000, speed }, statStages: { def: 0 },
    skills: [{ ...skill, maxPp: skill.maxPp ?? skill.pp }] });
  let driver: any;
  for (const row of REVIEWED_SKILL_KITS.filter((r: any) => !r.elfIds.includes('300'))) {
    const elf = DEFAULT_ELVES.find((e: any) => e.id === row.elfIds[0]);
    const skill = [...elf.skills, ...(elf.skillPool || [])].find((s: any) => s.name === row.name);
    const expectedStatus = row.name === '雙重暗影' ? '害怕' : row.name.includes('海嘯') ? '凍傷' : row.name.includes('攻碎') ? '中毒' : '燒傷';
    for (const side of ['p1', 'p2']) for (const mode of ['hit', 'miss', 'sealed', 'immune']) {
      const requests: any[] = [];
      getSoulMarkRegistry()['status-target'] = (ctx: any, event: any, data: any) => {
        if (event !== EffectTiming.BEFORE_STATUS_APPLY) return;
        requests.push({ ...data, hp: ctx.self.currentHp });
        if (mode === 'immune') data.prevented = true;
      };
      const self = { ...make('status-self', 200, { ...skill, accuracy: mode === 'miss' ? 0 : 100, isSureHit: mode !== 'miss' }), isAdditionalInvalid: mode === 'sealed' };
      const target = make('status-target', 100, { name: '等待', type: '普通', category: '屬性', power: 0, pp: 10 });
      await act(async () => root.render(React.createElement(Battle, { key: `${row.name}/${side}/${mode}`,
        initialP1Team: [side === 'p1' ? self : target], initialP2Team: [side === 'p2' ? self : target],
        p1StarterId: side === 'p1' ? self.id : target.id, p2StarterId: side === 'p2' ? self.id : target.id,
        battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
      resetPrd(() => 0); // 強制10%分支成功；失敗分支另由semantic檔核對。
      await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
      for (let i = 0; i < 150 && !(driver.getSyncState().turnNumber === 2 && driver.getSyncState().phase === 'p1_select'); i++)
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
      const state = driver.getSyncState();
      assert.equal(state.turnNumber, 2); assert.equal(state.phase, 'p1_select');
      const useTriggered = row.name === '雙重暗影';
      // 使用節點仍受正式技能成功／命中閘門限制，不代表未命中也附加。
      const shouldRequest = mode !== 'sealed' && mode !== 'miss';
      assert.equal(requests.length, shouldRequest ? 1 : 0, `${row.name}/${side}/${mode} 正式戰鬥只附加一次`);
      if (shouldRequest) {
        assert.equal(requests[0].status, expectedStatus);
        assert.equal(requests[0].duration, 3);
        assert.equal(requests[0].targetSide, side === 'p1' ? 'p2' : 'p1');
        assert.equal(requests[0].sourceSide, side);
        if (!useTriggered) assert.ok(requests[0].hp < 4000, '命中後異常必須在主攻擊扣血後請求');
      }
      // 強制PRD成功也可能引發暴擊消除正防禦；以0為起點隔離此正常機制。
      if (useTriggered) assert.equal(state[side === 'p1' ? 'p2' : 'p1'].statStages.def, mode === 'sealed' || mode === 'miss' ? 0 : -1, `${row.name}/${side}/${mode} 降防結果；日誌 ${JSON.stringify(state.logs)}`);
      checks++;
    }
  }
  console.log(`第二批六技能：正式戰鬥雙側／命中未命中／附加失效／免疫攔截 ${checks} 情境通過；非整隻驗收。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
