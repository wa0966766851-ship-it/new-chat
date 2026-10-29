// 新版 UI 精靈篩選：屬性（單／雙／複合、多選）、分級、特徵、排序，與搜尋並用（共用 ElfFilterBar / useElfFilter）
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: (q: string) => ({ media: q, matches: false, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; } }) });
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
const { createRoot } = await import('react-dom/client');
const { applyElfFilter, elfTypeParts, DEFAULT_ELF_FILTER } = await import('../src/utils/elfFilter');

const mk = (id: string, name: string, type: string, total: number, extra: any = {}): any => ({
  id, battleId: id + '_i', name, type, level: 100, maxHp: 1000, currentHp: 1000,
  baseStats: { hp: total, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
  calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  skills: [], soulMark: { name: '', description: '', effectType: 'custom', effectValue: 0 }, ...extra,
});
const elves = [
  mk('101', '甲火', '火', 300),
  mk('102', '乙水', '水', 500),
  mk('103', '丙火水', '火.水', 400, { skills: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }, { name: 'e', isFifthSkill: true }] }),
  mk('104', '丁水火', '水·火', 650),
  mk('105', '戊次元龍', '次元龍', 700),
  mk('106', '己草', '草', 200),
  mk('custom_1', '庚自訂火', '火', 100, { isCustom: true }),
  mk('107', '辛草戰鬥', '草.戰鬥', 450),
];
const names = (l: any[]) => l.map(e => e.name);
const S = (p: any) => ({ ...DEFAULT_ELF_FILTER, ...p });

// ── 純邏輯 ──
assert.deepEqual(elfTypeParts('火.水'), ['火', '水']);
assert.deepEqual(elfTypeParts('混沌·暗影'), ['混沌', '暗影']);
assert.deepEqual(elfTypeParts('次元龍'), ['次元', '龍'], '複合屬性字串拆成各屬性');
assert.deepEqual(names(applyElfFilter(elves, S({ types: ['火'], typeMode: 'any' }))), ['甲火', '丙火水', '丁水火', '庚自訂火']);
assert.deepEqual(names(applyElfFilter(elves, S({ types: ['火', '水'], typeMode: 'all' }))), ['丙火水', '丁水火'], '多選＋全部＝複合屬性');
assert.deepEqual(names(applyElfFilter(elves, S({ types: ['草', '水'], typeMode: 'any' }))), ['乙水', '丙火水', '丁水火', '己草', '辛草戰鬥']);
assert.deepEqual(names(applyElfFilter(elves, S({ kind: 'single', types: ['火'], typeMode: 'any' }))), ['甲火', '庚自訂火']);
assert.deepEqual(names(applyElfFilter(elves, S({ kind: 'dual' }))), ['丙火水', '丁水火', '戊次元龍', '辛草戰鬥']);
assert.deepEqual(names(applyElfFilter(elves, S({ types: ['龍'] }))), ['戊次元龍'], '次元龍同時屬於次元與龍');
assert.deepEqual(names(applyElfFilter(elves, S({ flags: ['fifth'] }))), ['丙火水']);
assert.deepEqual(names(applyElfFilter(elves, S({ flags: ['custom'] }))), ['庚自訂火']);
assert.deepEqual(names(applyElfFilter(elves, S({ flags: ['new'] }))).length, 6, '新精靈＝清單尾端 6 隻內建（不含自訂）');
assert.ok(!names(applyElfFilter(elves, S({ flags: ['new'] }))).includes('庚自訂火'));
assert.deepEqual(names(applyElfFilter(elves, S({ flags: ['inTeam'] }), { inTeam: new Set(['102']) })), ['乙水']);
assert.deepEqual(names(applyElfFilter(elves, S({ types: ['火'], typeMode: 'any', query: '水' }))), ['丙火水', '丁水火'], '屬性篩選與搜尋並用（AND）');
assert.deepEqual(names(applyElfFilter(elves, S({ sort: 'total', desc: true }))).slice(0, 3), ['戊次元龍', '丁水火', '乙水']);
assert.deepEqual(names(applyElfFilter(elves, S({ sort: 'total' }))).slice(0, 2), ['庚自訂火', '己草']);
assert.deepEqual(names(applyElfFilter(elves, S({ sort: 'id' }))).slice(0, 3), ['甲火', '乙水', '丙火水'], '編號排序數字在前，自訂在後');
assert.equal(names(applyElfFilter(elves, S({ sort: 'id' }))).at(-1), '庚自訂火');
assert.equal(applyElfFilter(elves, S({ sort: 'newest' }))[0].name, '辛草戰鬥', '新增順序：最新的在前');
assert.deepEqual(names(applyElfFilter(elves, S({ sort: 'newest', desc: true }))).slice(0, 2), ['庚自訂火', '甲火'], '反向：自訂最前、最舊其次');
assert.equal(applyElfFilter(elves, S({ sort: 'name' })).length, elves.length, '排序不增減精靈');

// ── UI ──
const makeBridge = (all: any[]): any => { const noop = () => {}; return { view: 'start', setView: noop, allElves: all, allElvesCombined: all, p1Team: [], p2Team: [], setEditingElf: noop }; };
async function render(el: React.ReactElement) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); await act(async () => { root.render(el); }); await act(async () => { await Promise.resolve(); });
  return { root, container };
}
const click = async (el: Element | undefined | null, what: string) => { assert.ok(el, `找不到 ${what}`); await act(async () => { (el as HTMLElement).click(); }); };
const btn = (c: ParentNode, re: RegExp) => [...c.querySelectorAll('button')].find(b => re.test(b.textContent || ''));
const chip = (c: ParentNode, label: string) => [...c.querySelectorAll('[data-testid="elf-filter-panel"] button')].find(b => (b.textContent || '').trim() === label);
async function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { set.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function exercise(label: string, container: HTMLElement, items: () => string[], expectInTeam = false) {
  const total = items().length; assert.equal(total, elves.length, `${label}：未篩選時全部列出`);
  await click(btn(container, /篩選/), `${label} 篩選鈕`);
  assert.ok(container.querySelector('[data-testid="elf-filter-panel"]'), `${label}：展開篩選面板`);
  assert.ok(chip(container, '火')!.querySelector('img, svg, span') !== undefined);
  // 多選屬性（火＋水，符合＝全部）→ 雙屬性複合
  await click(chip(container, '火'), '火'); await click(chip(container, '水'), '水');
  assert.equal(chip(container, '火')!.getAttribute('aria-pressed'), 'true'); assert.equal(chip(container, '水')!.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(items(), ['丙火水', '丁水火'], `${label}：火＋水（全部）只留複合屬性`);
  await click(chip(container, '任一'), '任一');
  assert.deepEqual(items(), ['甲火', '乙水', '丙火水', '丁水火', '庚自訂火'], `${label}：火或水`);
  // 與搜尋並用
  const input = container.querySelector<HTMLInputElement>('input[aria-label="搜尋精靈"]')!;
  await type(input, '自訂'); assert.deepEqual(items(), ['庚自訂火'], `${label}：屬性＋搜尋`);
  await type(input, ''); assert.equal(items().length, 5);
  // 型態、特徵
  await click(chip(container, '單屬性'), '單屬性'); assert.deepEqual(items(), ['甲火', '乙水', '庚自訂火'], `${label}：單屬性`);
  await click(chip(container, '單屬性'), '單屬性'); // 再點仍為單屬性（單選段）
  await click(chip(container, '不限'), '不限');
  await click(chip(container, '有第五技能'), '有第五技能'); assert.deepEqual(items(), ['丙火水'], `${label}：有第五技能`);
  assert.ok(chip(container, '已編入') ? expectInTeam : !expectInTeam, `${label}：已編入只在有隊伍脈絡的挑選器出現`);
  await click(chip(container, '有第五技能'), '取消第五技能');
  // 清除全部
  await click(container.querySelector('[aria-label="清除所有篩選"]'), '清除');
  assert.equal(items().length, elves.length, `${label}：清除後恢復`);
  // 分級（S/A/B/C）至少能篩出與評級函式一致的結果
  const { getElfDisplayRank } = await import('../src/utils/elfDisplayRank');
  const bCount = elves.filter(e => getElfDisplayRank(e) === 'B').length;
  await click(chip(container, 'B'), 'B 級'); assert.equal(items().length, bCount, `${label}：分級 B`);
  await click(chip(container, 'B'), 'B 級');
  // 排序：種族值總和（由大到小）、再反向
  const sel = container.querySelector<HTMLSelectElement>('select[aria-label="排序"]')!;
  const setSel = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
  await act(async () => { setSel.call(sel, 'total'); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.deepEqual(items().slice(0, 3), ['戊次元龍', '丁水火', '乙水'], `${label}：種族值總和由大到小`);
  await click(container.querySelector('[aria-label="反向排序"]'), '反向');
  assert.deepEqual(items().slice(0, 2), ['庚自訂火', '己草'], `${label}：反向`);
}

{ // 換立繪 HeroPicker：預設新精靈在前
  const { default: HeroPicker } = await import('../src/shell/scenes/HeroPicker');
  const { root, container } = await render(<HeroPicker b={makeBridge(elves)} current={elves[0]} onClose={() => {}} onPick={() => {}} />);
  const items = () => [...container.querySelectorAll('[role=dialog] .grid button')].map(b => b.getAttribute('title')!);
  assert.equal(items()[0], '辛草戰鬥', '換立繪預設：新精靈在前');
  // 預設排序為新增順序；切到預設後與清單一致，後續斷言用共用流程
  const sel = container.querySelector<HTMLSelectElement>('select[aria-label="排序"]')!;
  const setSel = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value')!.set!;
  await act(async () => { setSel.call(sel, 'default'); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  await exercise('換立繪', container, items);
  await act(async () => root.unmount());
}
{ // 編成 TeamScene 角色庫
  dom.window.localStorage.clear();
  const { TeamScene } = await import('../src/shell/scenes/TeamScene');
  const { root, container } = await render(<TeamScene b={makeBridge(elves)} />);
  const items = () => [...container.querySelectorAll('.elf-library button')].map(b => (b.getAttribute('title') || '').replace(/^加入 /, ''));
  await exercise('編成', container, items, true);
  await act(async () => root.unmount());
}
{ // 精靈倉庫選擇抽屜
  const { ElfPickerDrawer } = await import('../src/shell/art/TeamPanel');
  const { root, container } = await render(<ElfPickerDrawer b={makeBridge(elves)} current={elves[0]} onClose={() => {}} onPick={() => {}} />);
  const items = () => [...container.querySelectorAll('[role=dialog] .grid button')].map(b => b.getAttribute('title')!);
  await exercise('精靈倉庫', container, items);
  await act(async () => root.unmount());
}
console.log('新版 UI 精靈篩選：屬性多選（單／雙／複合）、分級、特徵、搜尋並用、排序通過');
