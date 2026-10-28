import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, SVGElement: dom.window.SVGElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  fetch: async () => ({ ok: false, json: async () => ({}) }) });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.matchMedia = ((media: string) => ({ media, matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as any;
const { createRoot } = await import('react-dom/client');
const { GameDataProvider } = await import('../src/contexts/GameDataContext');
const { default: StartScreen } = await import('../src/components/StartScreen');
const { DEFAULT_ELVES } = await import('../src/data/defaultElves');
const { calculateElfStats } = await import('../src/utils/elfStats');
const root = createRoot(document.getElementById('root')!);
const launches: any[][] = [];
const render = async (presentation: 'aegis' | 'legacy' = 'aegis') => {
  await act(async () => { root.render(<GameDataProvider><StartScreen presentation={presentation} onNavigateToCustom={() => {}} onStartBattle={(...args) => launches.push(args)} /></GameDataProvider>); });
};
const waitFor = async (check: () => boolean) => {
  for (let n = 0; n < 80; n++) { if (check()) return; await act(async () => { await new Promise(r => setTimeout(r, 25)); }); }
  assert.ok(check(), 'UI did not become ready');
};
const click = async (button: HTMLElement | null) => { assert.ok(button, 'expected clickable control'); await act(async () => { button!.click(); }); };
const slot = (side: string, index: number) => document.querySelector<HTMLElement>(`[data-workspace-slot="${side}-${index}"]`)!;
const choose = () => document.querySelector<HTMLElement>('[aria-label="選擇替換精靈"]');
const annual = (side: string) => document.querySelector<HTMLInputElement>(`[data-team-side="${side}"] input[type=checkbox]`)!;
const values = (side: string) => [...slot(side, 0).textContent!.matchAll(/(?:HP |速 |攻 |特攻 |防 |特防 )(\d+)/g)].map(m => Number(m[1]));
const replacement = DEFAULT_ELVES.find(e => e.id === '5021')!;
const oldJiuqing=structuredClone(DEFAULT_ELVES.find(e=>e.id==='5036')!);
oldJiuqing.skills=[oldJiuqing.skills[4],...oldJiuqing.skills.slice(0,4),...oldJiuqing.skillPool!.filter(s=>!oldJiuqing.skills.some(m=>m.name===s.name))];
oldJiuqing.skills.find(s=>s.name==='蒼靈銜樂')!.isFifthSkill=true;
localStorage.setItem('seer_default_elves_overrides',JSON.stringify({'5036':oldJiuqing}));
try {
  await render(); await waitFor(() => !!slot('p1', 0));
  assert.equal(annual('p1').checked, true); assert.equal(annual('p2').checked, true);
  for (const [side, index] of [['p1', 0], ['p2', 7]] as const) {
    await click(slot(side, index).querySelector('[aria-label="替換精靈"]'));
    await waitFor(() => !!choose()?.querySelector('[aria-label="搜尋精靈"]'));
    await click([...choose()!.querySelectorAll('button')].find(b => b.textContent?.includes(replacement.name))!);
    assert.equal(choose(), null); assert.ok(slot(side, index).textContent?.includes(replacement.name));
  }
  assert.equal(slot('p1', 0).dataset.starter, 'true', 'replacing starter must retain the slot as starter');
  await click(slot('p1', 11).querySelector('[aria-label="移出隊伍"]'));
  await click(slot('p1', 11).querySelector('button'));
  await waitFor(() => !!choose()?.querySelector('[aria-label="搜尋精靈"]'));
  await click([...choose()!.querySelectorAll('button')].find(b => b.textContent?.includes(replacement.name))!);
  assert.ok(slot('p1', 11).textContent?.includes(replacement.name), 'empty slot picker must also render');
  const enabled = values('p1'), other = values('p2');
  assert.equal(enabled.length, 6);
  await click(annual('p1'));
  assert.deepEqual(values('p1'), enabled.map(n => n - 10));
  assert.deepEqual(values('p2'), other); assert.equal(annual('p2').checked, true);
  assert.equal(localStorage.getItem('seer_p1_annual_bonus'), '0');
  await click(annual('p1')); assert.deepEqual(values('p1'), enabled);
  await click(annual('p1')); assert.deepEqual(values('p1'), enabled.map(n => n - 10));
  await click(document.querySelector('.workspace-launch'));
  const battle = launches.at(-1)!;
  assert.ok(battle, 'normal battle launches from the same workspace');
  for (const [team, bonus] of [[battle[1], false], [battle[2], true]] as const) for (const elf of team) {
    assert.equal(elf.hasAnnualBonus, bonus);
    assert.deepEqual(elf.calculatedStats, calculateElfStats(elf.baseStats, elf.level, elf.ivs, elf.evs, elf.natureModifiers, elf.inscriptions, elf.guildBonuses, bonus));
  }
  assert.equal(battle[3], battle[1][0].battleId, 'launch must use the replacement starter');
  await render('legacy');
  await waitFor(() => !!document.getElementById('p1-team-card'));
  const legacyToggle = document.querySelector<HTMLInputElement>('#p1-team-card input[type=checkbox]')!;
  assert.equal(legacyToggle.checked, false, 'switching layout respects explicit user choice');
  await act(async () => root.render(null));
  await render(); await waitFor(() => !!slot('p1', 0));
  assert.equal(annual('p1').checked, false, 'reopening respects the saved manual choice');
  assert.equal(annual('p2').checked, true);
  await click(document.querySelector('[aria-label="精靈倉庫"]'));
  await click(document.querySelector(`[aria-label="用 ${replacement.name} 換掉隊伍中的精靈"]`));
  const swap=document.querySelector('[aria-label="選擇要替換的精靈"]')!;
  const groups=[...swap.querySelectorAll('h3')].map(title=>title.parentElement!);
  await click(groups[0].querySelector('button'));
  assert.equal(choose(),null,'倉庫已選好精靈，不應要求再選一次');
  assert.equal(document.querySelector('[aria-label="選擇要替換的精靈"]'),null);
  await click(document.querySelector('[aria-label="返回隊伍"]'));
  assert.ok(slot('p1',0).textContent?.includes(replacement.name));
  assert.equal(slot('p1',0).dataset.starter,'true');
  await render('legacy');
  await waitFor(() => !!document.querySelector('[aria-label="查看 九青 的詳情"]'));
  await click(document.querySelector('[aria-label="查看 九青 的詳情"]'));
  const skillButtons=[...document.querySelectorAll<HTMLButtonElement>('[aria-label^="替換技能 "]')];
  assert.deepEqual(skillButtons.map(b=>b.getAttribute('aria-label')),['生塵眷盼','如日方升','遂心快意','蒼靈銜樂','清璨星辰落'].map(name=>`替換技能 ${name}`),'倉庫四普通在前、第五在最後，只有五格');
  assert.deepEqual(skillButtons.map(b=>b.closest('div.p-4')!.textContent!.includes('第五技能')),[false,false,false,false,true]);
  await click(skillButtons[0]);
  const pool=document.querySelector('[aria-label="技能替換庫"]')!;
  assert.ok(pool.textContent?.includes('安魂曲'),'備招在替換庫可用');
  assert.ok(!pool.textContent?.includes('清璨星辰落'),'普通替換庫不能混入第五');
  console.log('Team workspace UI: both pickers, active/standby, empty slot, starter replacement, default annual on, independent toggles, preview/launch parity, layout parity passed.');
} finally { await act(async () => root.unmount()); dom.window.close(); }
