import assert from 'node:assert/strict';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true });
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { TypeMatchupPanel } = await import('../src/components/encyclopedia/TypeMatchupPanel');
const { setDynamicMatchups } = await import('../src/utils/statCalculator');

const root = createRoot(document.getElementById('root')!);
const chart = { 輪迴: { 水: 1.25 } };
setDynamicMatchups(chart);
await act(async () => { root.render(<TypeMatchupPanel customMatchups={chart} />); });
const [attack, defense] = Array.from(document.querySelectorAll('input'));
const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
const fill = (field: HTMLInputElement, text: string) => act(async () => {
  setValue.call(field, text);
  field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
const press = (label: string) => act(async () => {
  Array.from(document.querySelectorAll('button')).find(button => button.textContent === label)!.click();
});
const selected = () => document.querySelector('button[aria-pressed="true"]');

await fill(attack, '轮回系');
await fill(defense, '混沌．水');
assert.match(selected()!.getAttribute('aria-label')!, /^輪迴攻擊水\.混沌/);
assert.match(selected()!.getAttribute('aria-label')!, /自訂倍率/);
const first = selected();
await fill(defense, '水／混沌');
assert.equal(selected(), first);
await press('定位表格');
assert.equal(document.activeElement, first);
await press('交換攻防');
assert.match(selected()!.getAttribute('aria-label')!, /^水\.混沌攻擊輪迴/);
await press('清除搜尋');
assert.equal(selected(), null);
assert.equal(attack.value + defense.value, '');
await act(async () => root.unmount());
setDynamicMatchups(null);
dom.window.close();
console.log('屬性克制搜尋、反序辨識、定位、交換與清除通過');

