import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createServer } from 'vite';
import { createServer as createHttpServer } from 'node:http';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  SVGElement: dom.window.SVGElement, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// 圖標測試不需要請求遠端索引；無屬性prop.png不依賴索引成功與否。
Object.assign(globalThis, { fetch: async () => { throw new Error('offline fixture'); } });
// HMR掛在不監聽的測試HTTP物件，不佔用正在使用中的開發伺服器埠。
const hmrHost = createHttpServer();
const server = await createServer({ configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, hmr: { server: hmrHost }, watch: null } });
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const click = async (label: string) => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label);
  assert.ok(button, label); await act(async () => button.click());
};
try {
  const E = await server.ssrLoadModule('/src/modes/interstellar/v2/engine.ts');
  const { default: Run } = await server.ssrLoadModule('/src/components/InterstellarExploration/InterstellarRun.tsx');
  const { ElfReadOnlyProfile } = await server.ssrLoadModule('/src/components/ElfReadOnlyProfile.tsx');
  // 預載入唯讀積木呈現模組，確保測試離開頁面前沒有未處理的Suspense載入。
  await server.ssrLoadModule('/src/components/LazyBlockProgramView.tsx');
  const source: any = { id: 'integration-elf', name: '更新後的精靈', type: '電', level: 100, maxHp: 500, currentHp: 500,
    baseStats: { hp: 120, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    calculatedStats: { hp: 500, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 300 },
    soulMark: { name: '更新魂印', description: '更新後魂印效果' },
    skills: [{ name: '測試屬性招', type: '火', category: '屬性', power: 0, pp: 10, maxPp: 10, description: '更新後技能效果' }] };
  const stale = { ...source, name: '舊版存檔精靈', currentHp: 234, battleId: 'stable-instance',
    soulMark: { name: '舊魂印', description: '過期魂印' }, skills: [{ ...source.skills[0], pp: 2, description: '過期技能' }] };
  const pool = [source];
  const oldRun = { ...E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 9, seed: 72 }),
    scene: { kind: 'map' }, team: [stale], lineup: ['stable-instance'], revision: 5 };
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(oldRun));
  const props = { allElves: pool, startingDiamonds: 0, initialEquipType: 'suit', initialEquipId: '', selectedModifiers: [],
    onEndRun() {}, onStartBattle() {} };
  await act(async () => root.render(React.createElement(Run, props)));
  const restored = E.loadRunV2(localStorage);
  assert.equal(restored.revision, 6, '實際入口讀舊存檔後寫入同步結果');
  assert.equal(restored.team[0].soulMark.name, '更新魂印');
  assert.equal(restored.team[0].currentHp, 234);
  assert.equal(restored.team[0].skills[0].pp, 2);
  assert.deepEqual(JSON.parse(localStorage.getItem(E.definitionSyncBackupKey(oldRun.runId))!), oldRun);
  // 同一頁資料池刷新時也同步，不必另開新局。
  const newer = { ...source, soulMark: { name: '再次更新魂印', description: '二次修正' } };
  await act(async () => root.render(React.createElement(Run, { ...props, allElves: [newer] })));
  assert.equal(E.loadRunV2(localStorage).team[0].soulMark.name, '再次更新魂印');
  assert.equal(E.loadRunV2(localStorage).revision, 7);
  await act(async () => root.render(null));
  // 同一份已更新的存檔進入實際共用詳情頁：魂印與技能，而非只測helper。
  await act(async () => root.render(React.createElement(ElfReadOnlyProfile, { elf: restored.team[0], onClose() {} })));
  assert.ok(document.body.textContent?.includes('更新魂印'));
  await click('描述');
  assert.ok(document.body.textContent?.includes('更新後魂印效果'));
  await click('技能');
  assert.ok(document.body.textContent?.includes('更新後技能效果'));
  const summary = document.querySelector('details summary')!;
  assert.ok(summary.querySelector('img[src="/seer/type/prop.png"][alt="無屬性"]'), '舊火系屬性招顯示實際無屬性圖標');
  assert.ok(document.querySelector('details')?.textContent?.includes('屬性 · 無屬性'));
  assert.equal(restored.team[0].skills[0].type, '火', 'UI投影不修改底層系別');
  console.log('實際回廊入口／資料池更新／詳情頁整合：存檔備份、效果同步、HP/PP保留與無屬性圖標通過');
} finally {
  await act(async () => root.unmount()); dom.window.close(); await server.close();
}
