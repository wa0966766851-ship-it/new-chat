import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import type { Elf } from '../src/types';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), alert: () => {},
  requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
globalThis.fetch = async () => Response.json({ enabled: false });
dom.window.confirm = () => true;
const { createRoot } = await import('react-dom/client');
const { default: ElfEditor } = await import('../src/components/ElfEditor');
const root = createRoot(document.getElementById('root')!);
const sourceRey = DEFAULT_ELVES.find(e => String(e.id) === '5029')!;
const rey = { ...sourceRey, alienTraits: { ...sourceRey.alienTraits, exclusiveTraits: [sourceRey.alienTraits!.exclusiveTraits![0]] } };
let saved: Elf | undefined, passed = 0;
async function check(name: string, run: () => Promise<void>) { await run(); passed++; console.log(`✓ ${name}`); }
async function click(label: string, aria = false) {
  const button = [...document.querySelectorAll('button')].find(b => aria ? b.getAttribute('aria-label') === label : b.textContent?.trim() === label);
  assert.ok(button, label); await act(async () => button.click());
}
async function input(selector: string, value: string) {
  const node = document.querySelector(selector) as HTMLInputElement; assert.ok(node, selector);
  const proto = node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function upload(value: string) {
  const node = document.querySelector('input[aria-label="選擇精靈圖紙"]') as HTMLInputElement;
  assert.ok(node); Object.defineProperty(node, 'files', { configurable: true, value: [{ size: new TextEncoder().encode(value).length, text: async () => value }] });
  await act(async () => node.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
}
try {
  await act(async () => root.render(React.createElement(ElfEditor, { initialElf: rey, onSaveElf: e => { saved = e; }, onBack: () => {} })));
  await check('匯入預覽與取消不取代未儲存草稿、不儲存精靈', async () => {
    await input('#manual-elf-name', '尚未儲存草稿');
    await upload(JSON.stringify({ schemaVersion: 2, manualElf: { ...rey, name: '匯入名稱' } }));
    assert.ok(document.querySelector('[aria-label="確認匯入草稿"]'));
    assert.equal((document.querySelector('#manual-elf-name') as HTMLInputElement).value, '尚未儲存草稿');
    await click('取消匯入'); assert.equal(saved, undefined);
    assert.equal((document.querySelector('#manual-elf-name') as HTMLInputElement).value, '尚未儲存草稿');
  });
  await check('損毀／未來版本／非法抗性圖紙保留草稿並顯示錯誤', async () => {
    for (const value of ['{', '{"schemaVersion":8}', JSON.stringify({ schemaVersion: 2, manualElf: { ...rey, resistances: { damageResist: {}, statusResist: { selectedStatuses: '錯誤' } } } })]) {
      await upload(value); assert.ok(document.querySelector('[role="alert"]'));
      assert.equal(document.querySelector('[aria-label="確認匯入草稿"]'), null);
      assert.equal((document.querySelector('#manual-elf-name') as HTMLInputElement).value, '尚未儲存草稿');
    }
  });
  await check('同 ID 圖紙可重新匯入；不同 ID 不覆寫另一隻，確認仍不直接儲存', async () => {
    await upload(JSON.stringify({ schemaVersion: 2, manualElf: { ...rey, id: 'other-elf', name: '確認匯入' } }));
    await click('確認匯入草稿');
    assert.equal((document.querySelector('#manual-elf-name') as HTMLInputElement).value, '確認匯入'); assert.equal(saved, undefined);
    await click('儲存精靈修改'); assert.equal(saved?.id, rey.id); assert.equal(saved?.name, '確認匯入');
  });
  await check('多專屬特質新增／編輯／上移／刪除，保留未改動機制資料', async () => {
    await click('特性與特質');
    const original = rey.alienTraits!.exclusiveTraits![0];
    await click('新增專屬特質');
    await input('input[aria-label="專屬特質 2 名稱"]', '新特質');
    await input('textarea[aria-label="專屬特質 2 描述"]', '回合開始時恢復10點體力');
    await click('上移專屬特質 2', true);
    await click('儲存精靈修改');
    assert.equal(saved?.alienTraits?.exclusiveTraits?.[0].name, '新特質');
    assert.deepEqual(saved?.alienTraits?.exclusiveTraits?.[1], original);
    await click('刪除專屬特質 1', true); await click('儲存精靈修改');
    assert.deepEqual(saved?.alienTraits?.exclusiveTraits, [original]);
    dom.window.confirm = () => false; await click('刪除專屬特質 1', true); await click('儲存精靈修改');
    assert.deepEqual(saved?.alienTraits?.exclusiveTraits, [original]);
    dom.window.confirm = () => true; await click('刪除專屬特質 1', true); await click('儲存精靈修改');
    assert.equal(saved?.alienTraits?.exclusiveTraits?.length ?? 0, 0);
  });
  await check('AI 頁輸入／解析／預覽分類；預覽無資料時停用，全文輸入保留', async () => {
    await act(async () => root.render(React.createElement(ElfEditor, { key: 'ai', initialTab: 'ai', onSaveElf: () => {}, onBack: () => {} })));
    const nav = document.querySelector('nav[aria-label="AI 編輯分類"]')!; assert.ok(nav);
    assert.equal(nav.querySelectorAll('button').length, 3);
    assert.ok([...nav.querySelectorAll('button')].find(b => b.textContent === '預覽')!.disabled);
    const textarea = document.querySelector('textarea')!; assert.ok(textarea);
    await input('textarea', '◆ 精靈名稱：測試全文\n保留所有尚未解析的原始描述');
    await click('解析'); await click('輸入');
    assert.match((document.querySelector('textarea') as HTMLTextAreaElement).value, /保留所有尚未解析/);
  });
  await check('刻印調校20次開關只有單一頂層視窗，Escape取消不保存並恢復焦點', async () => {
    const { InscriptionModal } = await import('../src/components/InscriptionSystem');
    let closes = 0, saves = 0;
    const launcher = React.createElement('button', { id: 'inscription-launcher', key: 'launcher' }, '開啟刻印');
    await act(async () => root.render(launcher));
    (document.getElementById('inscription-launcher') as HTMLElement).focus();
    for (let i = 0; i < 20; i++) {
      await act(async () => root.render(React.createElement(React.Fragment, {}, launcher, React.createElement(InscriptionModal, { key: i, slotIndex: 0, onSave: () => saves++, onClose: () => closes++ }))));
      const dialog = document.querySelector('[role="dialog"]')!; assert.ok(dialog);
      assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
      assert.ok(!document.getElementById('root')!.contains(dialog));
      await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      await act(async () => root.render(launcher));
      assert.equal(document.querySelector('[role="dialog"]'), null);
      assert.equal(document.activeElement?.id, 'inscription-launcher');
    }
    assert.equal(closes, 20); assert.equal(saves, 0);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(closes, 20);
  });
  await check('量測只手動啟動，停止與卸載清除畫面回呼／長任務觀察器', async () => {
    const { default: PerformanceProbe } = await import('../src/components/PerformanceProbe');
    let activeFrames = new Set<number>(), nextFrame = 0, observers = 0;
    const oldRaf = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
    const oldObserver = globalThis.PerformanceObserver;
    globalThis.requestAnimationFrame = () => { activeFrames.add(++nextFrame); return nextFrame; };
    globalThis.cancelAnimationFrame = id => { activeFrames.delete(id); };
    globalThis.PerformanceObserver = class {
      static supportedEntryTypes = ['longtask'];
      observe() { observers++; } disconnect() { observers--; } takeRecords() { return []; }
    } as unknown as typeof PerformanceObserver;
    try {
      await act(async () => root.render(React.createElement(PerformanceProbe, { onClose: () => {} })));
      assert.equal(activeFrames.size, 0); assert.equal(observers, 0);
      await click('開始量測'); assert.equal(activeFrames.size, 1); assert.equal(observers, 1);
      await click('停止量測'); assert.equal(activeFrames.size, 0); assert.equal(observers, 0);
      await click('開始量測'); await act(async () => root.render(null));
      assert.equal(activeFrames.size, 0); assert.equal(observers, 0);
    } finally { globalThis.requestAnimationFrame = oldRaf; globalThis.cancelAnimationFrame = oldCancel; globalThis.PerformanceObserver = oldObserver; }
  });
} finally { await act(async () => root.unmount()); dom.window.close(); }
console.log(`編輯流程語意測試：${passed} 項通過`);
