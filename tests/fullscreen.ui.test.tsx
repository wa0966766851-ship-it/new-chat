import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { FullscreenProvider } = await server.ssrLoadModule('/src/contexts/FullscreenContext.tsx');
const { FullscreenSettings } = await server.ssrLoadModule('/src/components/FullscreenSettings.tsx');

let activeElement: HTMLElement | null = null;
let enters = 0, exits = 0;
Object.defineProperty(document, 'fullscreenElement', { get: () => activeElement });
document.documentElement.requestFullscreen = async () => {
  enters++;
  activeElement = document.documentElement;
  document.dispatchEvent(new dom.window.Event('fullscreenchange'));
};
document.exitFullscreen = async () => {
  exits++;
  activeElement = null;
  document.dispatchEvent(new dom.window.Event('fullscreenchange'));
};

const root = createRoot(document.getElementById('root')!);
const mount = () => act(async () => root.render(<FullscreenProvider><FullscreenSettings /><input aria-label="測試輸入" /></FullscreenProvider>));
const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
const key = (target: EventTarget, options: KeyboardEventInit) => act(async () => {
  target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options }));
});
const click = (label: string) => act(async () => button(label).click());
const unmount = () => act(async () => root.render(null));

try {
  await mount();
  assert.ok(button('更換快捷鍵 · F8'));
  await key(window, { key: 'F8' });
  assert.equal(enters, 1);
  assert.ok(button('退出全螢幕'));
  await key(window, { key: 'F8', repeat: true });
  assert.equal(exits, 0);
  await click('退出全螢幕');
  assert.equal(exits, 1);
  await key(document.querySelector('input')!, { key: 'F8' });
  assert.equal(enters, 1);

  await click('更換快捷鍵');
  await key(button('請按下新快捷鍵'), { key: 'F8' });
  assert.equal(enters, 1, '錄入原快捷鍵不得同時切換全螢幕');
  await click('更換快捷鍵');
  await key(button('請按下新快捷鍵'), { key: 'F4', altKey: true });
  assert.ok(button('請按下新快捷鍵'), '拒絕系統關閉視窗鍵');
  const alternate = { key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true };
  await key(button('請按下新快捷鍵'), alternate);
  await key(window, { key: 'F8' });
  assert.equal(enters, 1);
  await unmount();
  await mount();
  assert.ok(button('更換快捷鍵 · Ctrl+Shift+F'));
  await key(window, alternate);
  assert.equal(enters, 2);
  await act(async () => document.exitFullscreen());
  assert.ok(button('進入全螢幕'), '瀏覽器自行退出時同步按鈕');

  await click('恢復 F8');
  await click('更換快捷鍵');
  await key(button('請按下新快捷鍵'), { key: 'Escape' });
  assert.ok(button('更換快捷鍵 · F8'));
  await unmount();

  let nativeActive = false;
  let nativeListener: ((active: boolean) => void) | undefined;
  Object.assign(window, { seerDesktop: { fullscreen: {
    status: async () => nativeActive,
    set: async (active: boolean) => { nativeActive = active; nativeListener?.(active); },
    onChange: (listener: (active: boolean) => void) => {
      nativeListener = listener;
      return () => { nativeListener = undefined; };
    },
  } } });
  await mount();
  await key(window, { key: 'F8' });
  assert.equal(nativeActive, true);
  assert.equal(enters, 2, '桌面版使用視窗介面');
  await click('退出全螢幕');
  assert.equal(nativeActive, false);
  await unmount();
  assert.equal(nativeListener, undefined);
  console.log('全螢幕：瀏覽器與桌面介面、改鍵與重載、輸入保護、退出同步皆通過');
} finally {
  await act(async () => root.unmount());
  await server.close();
  dom.window.close();
}
