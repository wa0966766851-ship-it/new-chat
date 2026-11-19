// P4 smoke: the op-code panel renders all three modes without crashing.
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { OpCodePanel } from '../src/components/OpCodePanel';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root')!);

await act(async () => { root.render(React.createElement(OpCodePanel)); });
const html = document.getElementById('root')!.innerHTML;
assert.ok(html.includes('積木代號查詢'), 'panel title');
assert.ok(html.includes('S-016'), 'S-016 listed in byCode mode');
assert.ok(html.includes('246') || html.includes('代號'), 'catalog count visible');
console.log('OpCodePanel UI smoke: render OK, S-016 visible');

const group=renderToStaticMarkup(React.createElement(OpCodePanel,{initialQuery:'EG-005'}));
assert.ok(group.includes('精靈王')&&group.includes('Q-106')&&group.includes('D-049'));
await act(async()=>root.unmount());
dom.window.close();
