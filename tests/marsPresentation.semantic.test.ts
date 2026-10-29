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
  const { marsMechanismEffects } = await server.ssrLoadModule('/src/effects/elves/mars/presentation.ts');
  const { EFFECT_CATALOG } = await server.ssrLoadModule('/src/data/effectCatalog.ts');
  const { SkillResources, skillResourceView } = await server.ssrLoadModule('/src/components/SkillResources.tsx');
  const { getActiveEffects } = await server.ssrLoadModule('/src/components/StatusInspector.tsx');
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const mars = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5016'));
  const starBefore = JSON.stringify(EFFECT_CATALOG.star_rule);
  const curseBefore = JSON.stringify(EFFECT_CATALOG.demon_curse);
  const original = JSON.stringify(mars);
  for (const mode of ['speed', 'destroy', 'wall']) {
    const views = marsMechanismEffects(mars, { marsMechaMode: mode });
    assert.deepEqual(views.map((v: any) => v.catalogId), mode === 'wall' ? ['mars_mech_wall'] : ['mars_mech_wall', `mars_mech_${mode}`]);
    assert.ok(views.every((v: any) => v.remainingTurns === undefined));
    assert.ok(views.every((v: any) => !['star_rule', 'demon_curse', 'mars_record_paralyzed'].includes(v.catalogId))); checks++;
  }
  assert.deepEqual(marsMechanismEffects(mars, {}), [], '未啟動不可自行猜極速');
  assert.deepEqual(marsMechanismEffects({ ...mars, name: '其他精靈' }, { marsMechaMode: 'destroy', marsShieldActive: true }), []);
  assert.equal(JSON.stringify(mars), original); checks++;
  const skill = { ...mars.skills[0], maxPp: 20, pp: 0, charge: 44 };
  assert.deepEqual(skillResourceView(mars, skill, 20), { maxPp: 20, pp: 20, permanentFull: true, charge: 44 });
  assert.equal(skill.pp, 0, '顯示不可改寫PP儲存值'); checks++;
  await act(async () => root.render(React.createElement(SkillResources, { elf: mars, skill, maxPp: 20 })));
  assert.match(document.body.textContent!, /PP 20\/20恆滿.*充能 44/); checks++;
  await act(async () => root.render(React.createElement(SkillResources, { elf: { ...mars, name: '其他精靈' }, skill: { ...skill, charge: undefined } })));
  assert.match(document.body.textContent!, /PP 0 \/ 20/); assert.doesNotMatch(document.body.textContent!, /恆滿|充能/); checks++;
  for (const side of ['p1', 'p2']) {
    const state = { [side]: mars, [`${side}RegistryState`]: { marsMechaMode: 'destroy', marsShieldActive: true } };
    const views = getActiveEffects(side, state);
    assert.ok(views.some((v: any) => v.name === '堅壁機甲' && v.remaining === undefined));
    assert.ok(views.some((v: any) => v.name === '毀滅機甲' && v.category === '常駐'));
    assert.ok(!views.some((v: any) => v.name === '星執' || v.name === '魔王咒怨')); checks++;
    const other = { ...structuredClone(mars), id: 'mars-other', battleId: 'mars-other', name: '驗收對手', soulMark: undefined,
      skills: [{ name: '等待', type: '普通', category: '屬性', power: 0, pp: 10, maxPp: 10 }] };
    const self = { ...structuredClone(mars), battleId: 'mars-test', skills: mars.skills.map((s: any) => ({ ...s, maxPp: s.maxPp ?? s.pp, charge: 0, pp: 0 })) };
    await act(async () => root.render(React.createElement(Battle, { key: side,
      initialP1Team: [side === 'p1' ? self : other], initialP2Team: [side === 'p2' ? self : other],
      p1StarterId: side === 'p1' ? self.id : other.id, p2StarterId: side === 'p2' ? self.id : other.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {} })));
    const tray = document.querySelector(`[data-status-tray="${side}"]`)!;
    assert.ok(tray); assert.match(tray.textContent!, /堅壁機甲.*極速機甲/);
    assert.doesNotMatch(tray.textContent!, /星執|魔王咒怨|堅壁解析/);
    if (side === 'p1') {
      const resource = document.querySelector('[data-skill-resources="革新已至"]')!;
      assert.ok(resource); assert.match(resource.textContent!, /PP 20\/20恆滿.*充能 0/);
      assert.equal(resource.closest('button')!.disabled, false, '0充能仍能選招');
    }
    checks++;
  }
  assert.equal(EFFECT_CATALOG.star_rule.label, '星執');
  assert.equal(EFFECT_CATALOG.demon_curse.label, '魔王咒怨');
  assert.equal(JSON.stringify(EFFECT_CATALOG.star_rule), starBefore);
  assert.equal(JSON.stringify(EFFECT_CATALOG.demon_curse), curseBefore); checks++;
  console.log(`馬爾修斯機甲名稱、PP/充能、雙側及原主顯示隔離：${checks}情境通過。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
