import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: FrameRequestCallback) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
});
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const loaded = (name: string) => !!server.moduleGraph.getModuleById(
  fileURLToPath(new URL(`../src/components/${name}.tsx`, import.meta.url)).replaceAll('\\', '/')
)?.ssrModule;
const waitFor = async (predicate: () => boolean, label: string) => {
  for (let i = 0; i < 100 && !predicate(); i++) await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  assert.ok(predicate(), label);
};
const click = async (button: Element | null, label: string) => {
  assert.ok(button, label);
  await act(async () => { (button as HTMLButtonElement).focus(); (button as HTMLButtonElement).click(); });
};

try {
  const { default: Hub } = await server.ssrLoadModule('/src/components/ControlHub.tsx');
  const { default: Start } = await server.ssrLoadModule('/src/components/StartScreen.tsx');
  const { GameDataProvider } = await server.ssrLoadModule('/src/contexts/GameDataContext.tsx');
  const deferred = ['ControlHubPanel', 'EvNaturePanel', 'ResistancePanel', 'TypeMatchupPanel', 'InscriptionModal'];
  await act(async () => root.render(React.createElement(GameDataProvider, null,
    React.createElement(React.Fragment, null,
      React.createElement(Hub, { currentScene: 'start' }),
      React.createElement(Start, { onStartBattle: () => {}, onNavigateToCustom: () => {} }),
    ),
  )));
  for (const name of deferred) assert.equal(loaded(name), false, `${name} 不得在首頁提前執行`);
  assert.equal(document.querySelector('iframe'), null, '未播放音樂不得建立播放器');

  const openHub = () => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '控制中心')!;
  await click(openHub(), '開啟控制中心');
  await waitFor(() => !!document.querySelector('[data-control-hub]'), '設定視窗可按需載入');
  assert.ok(loaded('ControlHubPanel'));
  const playlistIndex = localStorage.getItem('seer_yt_index_start');
  await click([...document.querySelectorAll('[data-control-hub] button')].find(b => b.textContent?.includes('音樂'))!, '切音樂分類');
  await click(document.querySelector('[aria-label="關閉控制中心"]'), '關閉設定');
  await waitFor(() => !document.querySelector('[data-control-hub]'), '關閉後視窗移除');
  await click(openHub(), '重新開啟設定');
  await waitFor(() => !!document.querySelector('[data-control-hub]'), '重新開啟設定成功');
  assert.ok(document.querySelector('[data-control-hub]')!.textContent?.includes('播放'), '分類狀態保留');
  assert.equal(localStorage.getItem('seer_yt_index_start'), playlistIndex, '開關視窗不觸發音樂輪替');
  await click(document.querySelector('[aria-label="關閉控制中心"]'), '關閉設定');

  await click(document.querySelector('button[aria-label^="查看 "][aria-label$=" 的詳情"]'), '開啟精靈詳情');
  await waitFor(() => ['EvNaturePanel', 'ResistancePanel', 'TypeMatchupPanel'].every(loaded), '三個詳情面板按需載入');
  assert.equal(loaded('InscriptionModal'), false, '未開啟刻印孔不應載入調校視窗');
  const inscription = document.querySelector('button[aria-label="編輯第 1 刻印孔"]');
  await click(inscription, '開啟刻印孔');
  await waitFor(() => !!document.querySelector('[role="dialog"][aria-label*="刻印孔"]'), '刻印視窗載入且可操作');
  assert.ok(loaded('InscriptionModal'));
  await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(document.querySelector('[role="dialog"][aria-label*="刻印孔"]'), null, 'Escape 取消不遺留視窗');
  assert.equal(document.activeElement, inscription, '取消後回復刻印孔焦點');
  console.log('首頁按需載入：五個面板未提前執行、設定開關與音樂狀態保留、詳情與刻印取消／焦點通過。');
} finally {
  await act(async () => root.unmount());
  await server.close();
  dom.window.close();
}
