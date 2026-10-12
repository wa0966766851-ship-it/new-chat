import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { LauncherSettingsPanel } from '../src/components/LauncherSettingsPanel';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const originalFetch = globalThis.fetch;
const calls: { url: string; body?: any }[] = [];
let supported = true;
globalThis.fetch = (async (input: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ url: String(input), body });
  return { ok: true, json: async () => body?.confirm
    ? { message: '捷徑已建立' }
    : { supported, autoDesktopShortcut: body?.autoDesktopShortcut ?? false } } as Response;
}) as typeof fetch;
let root = createRoot(document.getElementById('root')!);
try {
  await act(async () => { root.render(<LauncherSettingsPanel />); });
  const checkbox = document.querySelector('input')!;
  assert.equal(checkbox.checked, false); assert.equal(checkbox.disabled, false);
  assert.equal(calls.filter(c => c.body).length, 0);
  console.log('✓ 管理中心預設不勾選且不發送建立捷徑要求');
  await act(async () => { checkbox.click(); });
  assert.equal(checkbox.checked, true);
  assert.deepEqual(calls.at(-1), { url: '/api/launcher/preferences', body: { autoDesktopShortcut: true } });
  await act(async () => { checkbox.click(); });
  assert.equal(checkbox.checked, false);
  assert.deepEqual(calls.at(-1)!.body, { autoDesktopShortcut: false });
  console.log('✓ 啟用／停用保存本機偏好，沒有暗中建立或刪除捷徑');
  const button = document.querySelector('button')!;
  const before = calls.length;
  dom.window.confirm = () => false;
  await act(async () => { button.click(); });
  assert.equal(calls.length, before);
  dom.window.confirm = () => true;
  await act(async () => { button.click(); });
  assert.deepEqual(calls.at(-1), { url: '/api/launcher/shortcut', body: { confirm: true } });
  assert.ok(document.querySelector('[role="status"]')!.textContent!.includes('捷徑已建立'));
  console.log('✓ 只建立一次需明確確認，取消不呼叫API');
  await act(async () => root.unmount());
  supported = false;
  root = createRoot(document.getElementById('root')!);
  await act(async () => { root.render(<LauncherSettingsPanel />); });
  assert.equal(document.querySelector('input')!.disabled, true);
  assert.equal(document.querySelector('button')!.disabled, true);
  console.log('✓ 一般網站不可操作桌面');
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  dom.window.close();
}
