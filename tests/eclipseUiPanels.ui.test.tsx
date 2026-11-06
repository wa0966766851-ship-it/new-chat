import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(() => f(performance.now()), 0), cancelAnimationFrame: clearTimeout });
(dom.window as any).HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import('react-dom/client');
const { default: Run } = await import('../src/components/InterstellarExploration/InterstellarRun');
const { floorKeyOf, floorCoverable, FLOOR_COVER_AUTO_MS } = await import('../src/components/InterstellarExploration/eclipse/FloorCover');
const E = await import('../src/modes/interstellar/v2/engine');
const { readAnimationSettings, writeAnimationSettings } = await import('../src/battle/animationSettings');
const { RELICS } = await import('../src/modes/interstellar/v2/relics');
const { DEFAULT_ELVES } = await import('../src/data/defaultElvesLoaded');
const pool = DEFAULT_ELVES;
const root = createRoot(document.getElementById('root')!);
const sleep = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const q = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const click = async (el: HTMLElement | null | undefined, msg: string) => { assert.ok(el, `找不到：${msg}`); await act(async () => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); }); await sleep(30); };
const key = async (target: EventTarget, k: string) => { await act(async () => { target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }); await sleep(30); };
const dbl = async (el: HTMLElement) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, cancelable: true })); }); await sleep(30); };
const runProps = { allElves: pool, startingDiamonds: 3, initialEquipType: 'suit' as const, initialEquipId: '', selectedModifiers: [] as string[], onEndRun: () => {}, onStartBattle: () => {} };
const stored = (): any => JSON.parse(localStorage.getItem(E.RUN_KEY_V2) || 'null');
const mount = async (run: any, opts: { keepCover?: boolean } = {}) => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(run));
  await act(async () => root.render(null)); await act(async () => root.render(React.createElement(Run, runProps))); await sleep(80);
  if (!opts.keepCover && q('[data-testid=floor-cover]')) { await click(q('[data-testid=floor-cover]'), '封面'); await sleep(700); }
};
function baseRun(): any {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 99, seed: 7 });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  return { ...E.confirmDraft(run, pool), lives: 5, tempLives: 0 };
}
const offer = RELICS.filter(r => r.rarity === 'common').slice(0, 3).map(r => r.id);

try {
  /* ── 1. 樓層封面 ── */
  const b = baseRun();
  const b1 = E.moveTo(b, E.movesFrom(b)[0].id, pool); // 踏上第 1 層
  const cover = () => q('[data-testid=floor-cover]');
  const fresh1 = () => ({ ...b1 });
  assert.ok(!floorCoverable(b), '起點尚未進入樓層，不顯示封面');
  assert.ok(floorCoverable(b1), '進入第 1 層顯示封面');
  assert.ok(!floorCoverable({ ...b1, scene: { kind: 'draft', offer: [], picks: [] } }), '選燈階段不顯示封面');
  assert.notEqual(floorKeyOf(b1), floorKeyOf({ ...b1, rescues: ['reverse_hourglass'] }), '逆時沙漏倒轉後同一層視為重新進入');
  await mount(b, { keepCover: true }); assert.equal(cover(), null, '起點沒有封面');
  const startCol = E.currentNode(stored()).col;
  await click(q('.ecl-node-reachable'), '前往第一個節點'); await sleep(80);
  assert.ok(E.currentNode(stored()).col > startCol, '已移動'); assert.ok(cover(), '進入第 1 層：顯示封面');
  assert.equal(cover()!.getAttribute('data-floor'), '1');
  assert.match(cover()!.textContent || '', /第 1 層/);
  assert.ok(qa('[data-testid=life-resource]').length >= 1, '封面不阻擋底下畫面（狀態照常載入）');
  await click(cover(), '封面'); await sleep(700);
  assert.equal(cover(), null, '點擊關閉封面');// 再往前一層：換層再顯示，樓層編號遞增
  await mount({ ...b1, scene: { kind: 'map' } });const col1 = E.currentNode(stored()).col;
  await click(q('.ecl-node-reachable'), '前往下一層'); await sleep(80);
  assert.ok(E.currentNode(stored()).col > col1);
  assert.ok(cover(), '換層後再顯示封面');
  assert.ok(Number(cover()!.getAttribute('data-floor')) > 1, '樓層編號遞增');
  // Enter / Space / Esc 關閉
  for (const k of ['Enter', ' ', 'Escape']) {
    await mount(fresh1(), { keepCover: true });assert.ok(cover(), `${JSON.stringify(k)}：封面存在`);
    await key(window, k);await sleep(700);
    assert.equal(cover(), null, `${JSON.stringify(k)} 關閉封面`);
  }
  // Esc 只關封面，不連帶關閉底下的帳冊
  await mount(fresh1(), { keepCover: true });
  await click(qa('button').find(x => x.textContent?.startsWith('隊伍')), '隊伍鈕'); assert.ok(q('[aria-label=帳冊]'));
  await key(window, 'Escape'); await sleep(700);
  assert.equal(cover(), null); assert.ok(q('[aria-label=帳冊]'), 'Esc 先關封面，帳冊仍在');
  // 自動關閉：預設約 2.5 秒；動畫速度設定會縮短等待（10 倍速 → 最短 0.5 秒）
  assert.equal(FLOOR_COVER_AUTO_MS, 2500, '預設自動關閉約 2.5 秒');
  localStorage.clear(); sessionStorage.clear();
  writeAnimationSettings({ ...readAnimationSettings(), speed: 10 });
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(fresh1()));
  await act(async () => root.render(null)); await act(async () => root.render(React.createElement(Run, runProps))); await sleep(80);
  assert.ok(cover(), '自動關閉前封面存在');
  for (let i = 0; i < 6; i++) await sleep(200); // 分段等待（單次長 act 會讓 motion 動畫迴圈堆積記憶體）
  assert.equal(cover(), null, '依動畫速度自動關閉');
  // 戰鬥返回（已記為看過）不重複顯示；逆時沙漏倒轉（rescues 變動）則重新顯示
  const remount = async (run: any) => { localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(run)); await act(async () => root.render(null)); await act(async () => root.render(React.createElement(Run, runProps))); await sleep(80); };
  localStorage.clear(); sessionStorage.setItem('ECL_COVER_SEEN', floorKeyOf(b1));
  await remount(b1);
  assert.equal(cover(), null, '同一層戰鬥返回不重複顯示');
  await remount({ ...b1, rescues: ['reverse_hourglass'] });
  assert.ok(cover(), '倒轉後重新進入同一層：再顯示封面');

  /* ── 2. 藏品兩段式選擇 ── */
  const cards = () => qa('[data-pick=relic]');
  const confirmBtn = () => q<HTMLButtonElement>('[data-testid=pick-confirm]');
  const treasure = () => ({ ...b, relics: [], scene: { kind: 'treasure', offer } });
  await mount(treasure());
  assert.equal(cards().length, 3);
  await click(cards()[0], '選 A');
  assert.equal(cards()[0].getAttribute('data-picked'), 'true');
  assert.equal(stored().relics.length, 0, '單擊不鎖定');
  assert.equal(confirmBtn()!.disabled, false);
  await click(cards()[1], '改選 B');
  assert.deepEqual(cards().map(c => c.getAttribute('data-picked')), ['false', 'true', 'false'], '可自由改選');
  assert.equal(stored().relics.length, 0, '改選後仍未鎖定');
  assert.equal(stored().scene.done, undefined);
  await click(confirmBtn(), '確認');
  assert.deepEqual(stored().relics, [offer[1]], '確認後取得改選的藏品');
  assert.ok(stored().scene.done !== undefined);
  assert.equal(q('[data-testid=pick-confirm]'), null, '確認後不再顯示確認鈕');
  // 雙擊直接確認
  await mount(treasure());
  await click(cards()[2], '選 C'); await dbl(cards()[2]);
  assert.deepEqual(stored().relics, [offer[2]], '雙擊確認');
  // Enter 確認
  await mount(treasure());
  await click(cards()[0], '選 A'); await key(cards()[0], 'Enter');
  assert.deepEqual(stored().relics, [offer[0]], 'Enter 確認');
  // 未選時沒有可確認的東西
  await mount(treasure());
  assert.equal(confirmBtn()!.disabled, true, '未選時確認鈕停用');
  await key(window, 'Enter'); assert.equal(stored().relics.length, 0);
  // 戰利品的遺物選擇同樣兩段式
  const reward = { beans: 1, potions: 0, exp: 0, relicChoices: offer, recruitChoices: [] as string[] };
  await mount({ ...b, relics: [], scene: { kind: 'reward', title: '戰利品', reward } });
  await click(cards()[0], '選 A'); await click(cards()[2], '改選 C');
  assert.equal(stored().scene.reward.relicTaken, undefined, '戰利品單擊不鎖定');
  await click(confirmBtn(), '確認');
  assert.equal(stored().scene.reward.relicTaken, offer[2]);
  assert.deepEqual(stored().relics, [offer[2]]);
  // 精靈三選一：同樣兩段式
  const ids = pool.slice(0, 3).map(e => String(e.id));
  await mount({ ...b, scene: { kind: 'recruit', offer: ids, note: '測試' } });
  const tarots = () => qa('[data-pick=elf]');
  const teamBefore = b.team.length;
  await click(tarots()[0], '選精靈 A'); await click(tarots()[1], '改選精靈 B');
  assert.equal(stored().scene.kind, 'recruit', '單擊不離開招募場景');
  await click(confirmBtn(), '確認');
  assert.equal(stored().team.length, teamBefore + 1);
  assert.equal(String(stored().team[stored().team.length - 1].id), ids[1], '收下改選的精靈');

  /* ── 3. 面板：背板點擊與 Esc ── */
  const dialog = (name: string) => q(`[role=dialog][aria-label="${name}"]`);
  await mount({ ...b, scene: { kind: 'map' } });
  const open = async () => click(qa('button').find(x => x.textContent?.startsWith('隊伍')), '隊伍鈕');
  await open(); assert.ok(dialog('帳冊'));
  await click(dialog('帳冊')!.firstElementChild as HTMLElement, '帳冊內側'); assert.ok(dialog('帳冊'), '點面板內不關閉');
  await click(dialog('帳冊'), '帳冊背板'); await sleep(500); assert.equal(dialog('帳冊'), null, '帳冊：點背板關閉');
  await open(); await key(window, 'Escape'); await sleep(500); assert.equal(dialog('帳冊'), null, '帳冊：Esc 關閉');
  // 更換精靈（疊在帳冊上）：背板與 Esc 只關最上層
  await open();
  await dbl(q('[data-member]')!); assert.ok(dialog('更換精靈'), '雙擊成員開啟更換精靈');
  await click(dialog('更換精靈')!.firstElementChild as HTMLElement, '更換內側'); assert.ok(dialog('更換精靈'), '更換精靈：內側點擊不關閉');
  await click(dialog('更換精靈'), '更換背板'); assert.equal(dialog('更換精靈'), null, '更換精靈：點背板關閉'); assert.ok(dialog('帳冊'), '帳冊仍在');
  await dbl(q('[data-member]')!); assert.ok(dialog('更換精靈'));
  await key(window, 'Escape'); assert.equal(dialog('更換精靈'), null, '更換精靈：Esc 關閉'); assert.ok(dialog('帳冊'), 'Esc 只關最上層');
  // 招募彈窗
  await click(qa('[role=tab]').find(x => x.textContent?.startsWith('招募')), '招募分頁');
  await click(q('[data-testid=recruit-shards]'), '星晶招募'); assert.ok(dialog('招募'));
  await click(dialog('招募')!.firstElementChild as HTMLElement, '招募內側'); assert.ok(dialog('招募'), '招募：內側點擊不關閉');
  await click(dialog('招募'), '招募背板'); assert.equal(dialog('招募'), null, '招募：點背板關閉'); assert.ok(dialog('帳冊'));
  await click(q('[data-testid=recruit-shards]'), '星晶招募'); await key(window, 'Escape');
  assert.equal(dialog('招募'), null, '招募：Esc 關閉'); assert.ok(dialog('帳冊'));
  // 場景覆蓋層（強制選擇）：點背板不應丟失選擇
  await mount({ ...b, relics: [], scene: { kind: 'treasure', offer } });
  const overlay = q('div.absolute.inset-0.z-40')!; assert.ok(overlay);
  await click(overlay, '場景背板'); assert.ok(q('[data-pick=relic]'), '場景背板點擊不關閉');
  console.log('eclipseUiPanels ui ok');
} catch (e) { console.error(e); process.exitCode = 1; } finally { await act(async () => root.unmount()); process.exit(process.exitCode ?? 0); }
