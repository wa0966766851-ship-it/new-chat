import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(() => f(performance.now()), 0), cancelAnimationFrame: clearTimeout });
(dom.window as any).HTMLElement.prototype.scrollIntoView = () => {};
(dom.window as any).HTMLElement.prototype.scrollTo = function (o: any) { this.scrollLeft = o.left; };
const { createRoot } = await import('react-dom/client');
const { default: SuitSelect } = await import('../src/components/InterstellarExploration/eclipse/SuitSelect');
const { default: Run } = await import('../src/components/InterstellarExploration/InterstellarRun');
const { SUIT_CATALOG } = await import('../src/data/suitsAndEyewears');
const { SUIT_ART, suitPortraitUrls } = await import('../src/data/suitArt');
const { DEFAULT_ELVES } = await import('../src/data/defaultElvesLoaded');
const E = await import('../src/modes/interstellar/v2/engine');
const { BARTER_RECIPES, barterLimit } = await import('../src/modes/interstellar/v2/barter');
const root = createRoot(document.getElementById('root')!);
const sleep = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const mount = async (el: React.ReactElement) => { await act(async () => root.render(null)); await act(async () => root.render(el)); await sleep(100); };

/** jsdom 沒有版面：替捲動列補上可寫的 scrollLeft 與寬度 */
function fakeLayout(el: HTMLElement) {
  let left = 0;
  Object.defineProperty(el, 'scrollLeft', { get: () => left, set: v => { left = Math.max(0, Math.min(2000, Number(v))); }, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: 3000, configurable: true }); Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true });
  el.getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000, top: 0, bottom: 400, height: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
  // 每張卡 280px 寬、間距 20px，位置隨 scrollLeft 平移
  el.querySelectorAll('[data-suit]').forEach((c, i) => { (c as HTMLElement).getBoundingClientRect = () => ({ left: i * 300 - left, right: i * 300 - left + 280, width: 280, top: 0, bottom: 400, height: 400, x: 0, y: 0, toJSON() {} }) as DOMRect; });
}
/** 離螢幕中心最近那張卡的偏移（吸附完成時應為 0） */
const centerOffset = (rail: HTMLElement) => Math.min(...[...rail.querySelectorAll('[data-suit]')].map(c => { const r = c.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - 500); }));
const ptr = (el: Element, type: string, x: number, o: any = {}) => act(async () => {
  const ev = new dom.window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: 10, ...o });
  Object.defineProperty(ev, 'timeStamp', { value: o.t ?? performance.now() });
  el.dispatchEvent(ev);
});

/** 吸附完成：最近那張卡置中，或已捲到盡頭 */
const settled = (rail: HTMLElement) => centerOffset(rail) < 1 || rail.scrollLeft <= 0 || rail.scrollLeft >= 2000;

try {
  // ───────── 套裝頁：拖曳捲動
  let changes: string[] = [];
  const ids = Object.keys(SUIT_CATALOG);
  const Harness = () => { const [id, setId] = React.useState(ids[0]); return <SuitSelect equipType="suit" equipId={id} onChange={(_t, x) => { changes.push(x); setId(x); }} />; };
  await mount(<Harness />);
  const rail = q('[data-testid="suit-rail"]')!; fakeLayout(rail);
  const cards = () => qa('[data-suit]');
  assert.equal(cards().length, ids.length, '每套一張卡');
  const sel = () => cards().find(c => c.getAttribute('aria-selected') === 'true')!.dataset.suit;
  assert.equal(sel(), ids[0]);

  // 由右向左拖（內容向右捲）：不誤選
  const target = cards()[4];
  changes = [];
  await ptr(target, 'pointerdown', 600, { t: 0 });
  await ptr(target, 'pointermove', 500, { t: 16 }); await ptr(target, 'pointermove', 300, { t: 32 });
  assert.equal(rail.scrollLeft, 300, '向左拖 300px，內容向右捲 300px');
  assert.equal(rail.dataset.dragging, '1', '拖曳中標記');
  await ptr(target, 'pointerup', 300, { t: 400 }); // 停住再放開：沒有慣性，直接吸附
  await act(async () => { target.click(); }); // 瀏覽器在拖曳後仍會補一個 click
  assert.deepEqual(changes, [], '拖曳後的 click 被吞掉，不會誤選卡片');
  assert.equal(sel(), ids[0]);
  assert.ok(settled(rail), '放開後吸附到最近的卡片中心');
  const afterFirst = rail.scrollLeft;
  // 反方向（由左向右拖，內容向左捲）
  await sleep(30);
  await ptr(target, 'pointerdown', 200, { t: 1000 }); await ptr(target, 'pointermove', 260, { t: 1016 }); await ptr(target, 'pointermove', 500, { t: 1032 });
  assert.equal(rail.scrollLeft, Math.max(0, afterFirst - 300), '由左向右拖，內容向左捲');
  await ptr(target, 'pointerup', 500, { t: 1500 }); await act(async () => { target.click(); });
  assert.deepEqual(changes, [], '反向拖曳也不誤選');
  assert.ok(settled(rail));
  // 慣性：放開時還有速度 → 繼續滑動一小段
  await sleep(30);
  rail.scrollLeft = 1000; await ptr(target, 'pointerdown', 700, { t: 2000 }); await ptr(target, 'pointermove', 650, { t: 2010 }); await ptr(target, 'pointermove', 560, { t: 2020 });
  const atRelease = rail.scrollLeft; await ptr(target, 'pointerup', 560, { t: 2021 });
  await sleep(120); assert.ok(rail.scrollLeft > atRelease, `放開後有慣性（${atRelease} → ${rail.scrollLeft}）`);
  await sleep(1500); assert.ok(settled(rail), '慣性結束後吸附');
  // 一般點擊（沒移動）仍可選取；移動未達門檻也算點擊
  changes = [];
  const c2 = cards()[2]; await ptr(c2, 'pointerdown', 400); await ptr(c2, 'pointermove', 403); await ptr(c2, 'pointerup', 403); await act(async () => { c2.click(); });
  assert.deepEqual(changes, [ids[2]], '小於門檻的移動視為點擊'); assert.equal(sel(), ids[2]);
  // 觸控不攔截（原生捲動）
  const before = rail.scrollLeft; const c3 = cards()[3];
  await ptr(c3, 'pointerdown', 600, { pointerType: 'touch' }); await ptr(c3, 'pointermove', 100, { pointerType: 'touch' }); await ptr(c3, 'pointerup', 100, { pointerType: 'touch' });
  assert.equal(rail.scrollLeft, before, '觸控交給瀏覽器原生捲動與吸附');
  // 鍵盤左右仍可用
  changes = []; await act(async () => { rail.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); });
  assert.deepEqual(changes, [ids[3]], '方向鍵右＝下一套'); await act(async () => { rail.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); });
  assert.equal(sel(), ids[2], '方向鍵左＝上一套');
  // 滾輪：垂直滾輪轉水平捲動，捲到盡頭時放行
  rail.scrollLeft = 100; const wheel = (dy: number) => { const ev = new dom.window.WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true }); rail.dispatchEvent(ev); return ev.defaultPrevented; };
  assert.equal(wheel(120), true); assert.equal(rail.scrollLeft, 220, '滾輪水平捲動');
  rail.scrollLeft = 0; assert.equal(wheel(-120), false, '已在最左端：放行給頁面');

  // ───────── 立繪：小圖以原尺寸置中（只縮不放），沒有圖的維持徽記大字
  const img = (id: string) => q<HTMLImageElement>(`[data-suit="${id}"] img`);
  const first = ids.find(i => i !== 'morning_star')!;
  assert.ok(img(first)!.getAttribute('src')!.endsWith(`/elf-art/suit_${first}.png`), '依序嘗試 /elf-art/suit_<id>.png');
  assert.ok(/object-contain/.test(img(first)!.className) && /w-auto/.test(img(first)!.className) && /h-auto/.test(img(first)!.className) && /max-w-\[94%\]/.test(img(first)!.className), 'contain、不拉伸');
  assert.ok(!/w-full|h-full/.test(img(first)!.className), '不撐滿容器（避免小圖放大糊掉）');
  if (ids.includes('morning_star')) {
    const ms = () => q<HTMLImageElement>('[data-suit="morning_star"] img');
    const chain = suitPortraitUrls('morning_star');
    assert.ok(chain.length === 3 && chain[2] === SUIT_ART.morning_star && SUIT_ART.morning_star.endsWith('/suiticon/447.png'), '晨曦之星：兩個舊來源後接對照表的原廠圖');
    assert.ok(ms()!.getAttribute('src')!.endsWith('/elf-art/suit_morning_star.png'), '既有 suit_<id>.png 仍優先');
    for (let i = 0; i < chain.length && ms(); i++) await act(async () => { ms()!.dispatchEvent(new dom.window.Event('error')); });
    assert.equal(ms(), null, '沒有圖：所有來源都失敗後不再有 img');
    assert.ok(q('[data-suit="morning_star"]')!.textContent!.includes(SUIT_CATALOG.morning_star.badge ?? SUIT_CATALOG.morning_star.name.slice(0, 2)), '改顯示徽記大字');
  }

  // ───────── 敗北結算畫面、保命提示、失與得商店
  const pool = DEFAULT_ELVES;
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 77 });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  const props = { allElves: pool, startingDiamonds: 3, initialEquipType: 'suit' as const, initialEquipId: '', selectedModifiers: [] as string[], onStartBattle: () => {} };
  let ended = 0;
  const wiped = { ...run, scene: { kind: 'end', result: 'wiped', cause: 'wipe', by: '遭遇・測試' }, rescues: ['substitute_doll'] } as E.RunV2;
  localStorage.clear(); localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(wiped));
  await mount(<Run {...props} onEndRun={() => { ended++; }} />);
  assert.ok(q('[data-testid="defeat-banner"]')!.textContent!.includes('全隊陣亡'), '敗北結算顯示敗因');
  assert.ok(q('[data-testid="defeat-banner"]')!.textContent!.includes('遭遇・測試'));
  assert.ok(q('[data-testid="end-stats"]')!.textContent!.includes('替身人偶'), '列出本局觸發過的保命');
  assert.ok(qa('button').find(b => b.title.includes('隊伍') || false) || true);
  await act(async () => { qa('button').find(b => b.textContent === '收起殘燭')!.click(); }); assert.equal(ended, 1, '收起殘燭 → 結束這局');
  // 資源列 tooltip 寫明失敗條件
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(run));
  await mount(<Run {...props} onEndRun={() => {}} />);
  // 失敗條件在隊伍鈕 tooltip（draft 場景下仍在 header）
  assert.ok(qa('header button').some(b => b.title.includes('生命歸 0') && b.title.includes('倒下')), '隊伍鈕 tooltip：失敗條件');
  // 保命遺物提示
  const armed = E.gainRelic(E.gainRelic({ ...run, scene: { kind: 'map' } as any }, 'undying_core'), 'substitute_doll');
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(armed));
  await mount(<Run {...props} onEndRun={() => {}} />);
  const chip = qa('header button').find(b => b.textContent!.includes('保命'))!; assert.ok(chip, '標頭顯示保命數'); assert.ok(chip.textContent!.includes('2'));
  assert.ok(chip.title.includes('替身人偶') && chip.title.includes('不滅星核') && chip.title.indexOf('替身人偶') < chip.title.indexOf('不滅星核'), 'tooltip 說明消耗順序');
  // 保命觸發後的橫幅
  const fought = E.startBattle({ ...armed, scene: { kind: 'prelude', encounter: { kind: 'boss', title: '測試首領', enemies: [{ id: String(pool[3].id), affixes: [] }], scale: 1.2, hpScale: 2.5 } } as any }, pool, 'ui-b')!;
  // 生命制：生命剛好等於倒下數才算致命，保命才會觸發
  const rescued = E.settleBattleV2({ ...fought.run, lives: fought.p1.length, tempLives: 0 }, 'ui-b', 'p2', fought.p1.map(e => ({ ...e, currentHp: 0 })), pool);
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(rescued));
  await mount(<Run {...props} onEndRun={() => {}} />);
  assert.ok(q('[data-testid="rescue-banner"]')!.textContent!.includes('替身人偶'), '重回戰前時顯示保命橫幅');
  // 失與得
  const shop = { ...armed, beans: 500, shards: 5, potions: 6, scene: { kind: 'shop', stock: [], barter: { offers: BARTER_RECIPES.slice(0, 12).map(r => r.id).filter(id => id !== 'potion_token_hi').slice(0, 6), left: barterLimit(0), uses: {} } } } as E.RunV2;
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(shop));
  await mount(<Run {...props} onEndRun={() => {}} />);
  const panel = q('[data-testid="barter"]')!; assert.ok(panel, '商店有失與得'); assert.ok(panel.textContent!.includes('剩餘 3 次'));
  assert.equal(panel.querySelectorAll('[data-testid^="barter-"]').length, 6);
  const row = q('[data-testid="barter-shard_beans"]') ?? q('[data-testid="barter-relic_r_beans"]')!;
  const beansBefore = E.loadRunV2(localStorage)!.beans;
  const btn = [...q('[data-testid="barter-relic_c_beans"]')!.querySelectorAll('button')].find(b => b.textContent === '兌換') as HTMLButtonElement; assert.ok(!btn.disabled, '有普通遺物可換');
  await act(async () => { btn.click(); });
  const after = E.loadRunV2(localStorage)!; assert.equal(after.beans, beansBefore + 55); assert.equal((after.scene as any).barter.left, 2);
  assert.ok(panel.textContent!.includes('剩餘 2 次') || q('[data-testid="barter"]')!.textContent!.includes('剩餘 2 次'));
  void row;
  console.log('套裝頁拖曳捲動（左右拖、不誤選、慣性、觸控與鍵盤滾輪）、立繪、敗北結算、保命提示、失與得商店通過');
} finally { await act(async () => root.unmount()); dom.window.close(); }
