import assert from 'node:assert/strict';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { PageErrorBoundary } from '../src/components/PageErrorBoundary';
import TechLoadingScreen from '../src/components/TechLoadingScreen';
import { TEMPLATE_GRAMMAR_GUIDELINES } from '../src/data/cardTemplates';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
let passed = 0, back = 0, reloaded = 0, confirm = false;
dom.window.confirm = () => confirm;
dom.window.localStorage.setItem('draft-fixture', '已儲存資料');
const originalError = console.error;
console.error = () => {}; // 本測試刻意讓子頁拋錯，避免輸出預期的 React 堆疊。
function BrokenPage() { throw new Error('Failed to fetch dynamically imported module: /assets/old.js'); }
async function check(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`); }
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent === text)!;
  assert.ok(button);
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
}
try {
  await act(async () => root.render(React.createElement(PageErrorBoundary, {
    onBack: () => { back++; }, onReload: () => { reloaded++; }, children: React.createElement(BrokenPage),
  })));
  await check('失敗資源明確說明連線／版本原因與未儲存資料風險，不自動刷新', () => {
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /頁面資源未成功載入/);
    assert.match(document.body.textContent!, /失去未儲存/);
    assert.equal(reloaded, 0);
  });
  await check('返回首頁與取消重新載入不清存檔，不自動刷新', async () => {
    await click('返回首頁'); await click('重新載入應用程式');
    assert.equal(back, 1); assert.equal(reloaded, 0);
    assert.equal(dom.window.localStorage.getItem('draft-fixture'), '已儲存資料');
  });
  await check('只有明確確認後才重新載入，不清除已儲存資料', async () => {
    confirm = true; await click('重新載入應用程式');
    assert.equal(reloaded, 1);
    assert.equal(dom.window.localStorage.getItem('draft-fixture'), '已儲存資料');
  });
  await check('一般頁面錯誤不誤標為版本／資源錯誤；正常子頁照常顯示', () => {
    assert.equal(PageErrorBoundary.getDerivedStateFromError(new Error('invalid form')).resourceFailure, false);
    assert.equal(PageErrorBoundary.getDerivedStateFromError(new Error('Importing a module script failed.')).resourceFailure, true);
    const html = renderToStaticMarkup(React.createElement(PageErrorBoundary, { onBack: () => {}, children: React.createElement('p', {}, '正常頁面') }));
    assert.match(html, /正常頁面/); assert.doesNotMatch(html, /重新載入應用程式/);
  });
  await check('載入提示只有單一動畫且尊重減少動畫，不偽造進度與記憶體', () => {
    const html = renderToStaticMarkup(React.createElement(TechLoadingScreen));
    assert.match(html, /role="status"/); assert.match(html, /motion-reduce:animate-none/);
    assert.equal((html.match(/animate-spin/g) || []).length, 1);
    assert.doesNotMatch(html, /1024MB|Kernel|Secure_Protocol|backdrop-blur|progressbar/);
  });
  await check('模板規範不再將存在描述誤當已實裝，語意不明保留待確認', () => {
    const text = TEMPLATE_GRAMMAR_GUIDELINES.join(' ');
    assert.match(text, /不代表.*已實裝/); assert.match(text, /TXT/);
    assert.match(text, /不可自行猜測/); assert.doesNotMatch(text, /100%|絕無|自動綁定/);
  });
} finally {
  await act(async () => root.unmount()); dom.window.close(); console.error = originalError;
}
console.log(`頁面恢復／輕量載入語意測試 ${passed} 項通過。`);
