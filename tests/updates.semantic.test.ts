import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { SiteUpdateStore, applySiteUpdate, parseSiteVersion, reloadWebsiteVersion } from '../src/utils/siteUpdates';
import { UpdateSettingsPanel, createPlayerBackup } from '../src/components/UpdateSettingsPanel';
const old = { commit: 'a'.repeat(40), buildId: 'b'.repeat(64), version: '1.0.0' };
const newer = { ...old, buildId: 'c'.repeat(64) };
let passed = 0;
const check = async (name: string, test: () => void | Promise<void>) => { await test(); passed++; console.log(`✓ ${name}`); };
const fetcher = (data: unknown, status = 200) => (async () => new Response(JSON.stringify(data), { status })) as typeof fetch;
await check('套用新版離開舊版固定網址；普通網址保留重新整理行為', () => {
  for (const pathname of [`/__build/${'a'.repeat(64)}/`, `/__build/${'a'.repeat(64)}/assets/entry.js`, '/', '/index.html']) {
    const actions: string[] = [];
    reloadWebsiteVersion({ pathname, assign: url => actions.push(String(url)), reload: () => actions.push('reload') });
    assert.deepEqual(actions, [pathname.startsWith('/__build/') ? '/' : 'reload']);
  }
});
await check('更新按鈕具備獨立樣式、觸控高度與鍵盤焦點', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-update-settings\] \.ios-button/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\[data-update-settings\] \.ios-button:focus-visible/);
});
await check('同 commit 的新建置仍能被手動發現', async () => { const s = new SiteUpdateStore(old, fetcher(newer)); await s.check(); assert.equal(s.getSnapshot().status, 'available'); });
await check('相同建置不是新版', async () => { const s = new SiteUpdateStore(old, fetcher(old)); await s.check(); assert.equal(s.getSnapshot().status, 'latest'); });
await check('舊版 commit 清單相容', async () => { const s = new SiteUpdateStore({ commit: old.commit }, fetcher({ commit: 'd'.repeat(40) })); await s.check(); assert.equal(s.getSnapshot().status, 'available'); });
await check('開發環境明示，不假裝正式最新版本', async () => { const s = new SiteUpdateStore(old, fetcher({ development: true })); await s.check(); assert.equal(s.getSnapshot().status, 'development'); });
for (const invalid of [null, [], {}, { commit: 'bad' }, { buildId: '<script>' }]) await check('損壞版本清單拒絕', () => assert.throws(() => parseSiteVersion(invalid)));
await check('離線／HTTP 失敗不重載、不清存檔', async () => {
  for (const f of [fetcher({}, 503), (async () => { throw new Error('offline'); }) as typeof fetch]) {
    const s = new SiteUpdateStore(old, f); await s.check(); assert.equal(s.getSnapshot().status, 'error');
    assert.equal(applySiteUpdate(true, s.getSnapshot(), () => true, () => assert.fail()), false);
  }
});
await check('連點共用一個請求', async () => {
  let calls = 0, finish!: (r: Response) => void;
  const s = new SiteUpdateStore(old, (() => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); }) as typeof fetch);
  const a = s.check(), b = s.check(); assert.equal(a, b); assert.equal(calls, 1); finish(new Response(JSON.stringify(newer))); await a;
});
await check('未允許、取消、檢查未完成均不重載', () => {
  let reloads = 0;
  assert.equal(applySiteUpdate(false, { status: 'available' }, () => true, () => reloads++), false);
  assert.equal(applySiteUpdate(true, { status: 'available' }, () => false, () => reloads++), false);
  assert.equal(applySiteUpdate(true, { status: 'checking' }, () => true, () => reloads++), false);
  assert.equal(reloads, 0);
  assert.equal(applySiteUpdate(true, { status: 'available' }, () => true, () => reloads++), true); assert.equal(reloads, 1);
});
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
await check('備份保留原始存檔並排除敏感 key', () => {
  dom.window.localStorage.setItem('seer_custom_elves', '{broken-but-preserved');
  dom.window.localStorage.setItem('seer_api_key', 'secret'); dom.window.localStorage.setItem('other-app', 'untouched');
  const value = JSON.parse(createPlayerBackup(dom.window.localStorage, dom.window.location.origin));
  assert.deepEqual(value.storage, { seer_custom_elves: '{broken-but-preserved' }); assert.equal(dom.window.localStorage.length, 3);
});
await check('超量備份明確拒絕，不清除存檔', () => {
  const large = new JSDOM('', { url: 'http://localhost:3000', storageQuota: 6 * 1024 * 1024 });
  large.window.localStorage.setItem('seer_large', 'x'.repeat(4 * 1024 * 1024));
  assert.throws(() => createPlayerBackup(large.window.localStorage, large.window.location.origin), /超過 4 MB/);
  assert.equal(large.window.localStorage.getItem('seer_large')!.length, 4 * 1024 * 1024);
  large.window.close();
});
await check('控制中心 UI 實際點擊檢查、顯示新版並鎖定戰鬥套用', async () => {
  let calls = 0;
  const s = new SiteUpdateStore(old, (async () => { calls++; return new Response(JSON.stringify(newer)); }) as typeof fetch);
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(React.createElement(UpdateSettingsPanel, { canApplyUpdates: false, store: s })));
  const button = [...document.querySelectorAll('button')].find(b => b.textContent === '檢查網站更新')!;
  await act(async () => { button.click(); await s.check(); });
  assert.equal(calls, 1);
  assert.ok(document.body.textContent?.includes('伺服器有不同版本'));
  const apply = [...document.querySelectorAll('button')].find(b => b.textContent === '套用網站更新')!;
  assert.ok(apply.disabled);
  await act(async () => root.render(React.createElement(UpdateSettingsPanel, { canApplyUpdates: true, store: s })));
  assert.equal([...document.querySelectorAll('button')].find(b => b.textContent === '套用網站更新')!.disabled, false);
  const admin = document.querySelector('section[aria-label="管理者網站發布"]')!;
  const link = admin.querySelector('a')!;
  assert.equal(link.textContent, '前往 GitHub 建置／發布');
  assert.equal(link.href, 'https://github.com/wa0966766851-ship-it/new-chat/actions');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.match(admin.textContent!, /需要 GitHub 專案操作權限/);
  assert.match(admin.textContent!, /不勾 publish 只建置及驗證/);
  let confirmations = 0;
  dom.window.confirm = () => { confirmations++; return false; };
  const before = Object.entries(dom.window.localStorage);
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === '套用網站更新')!.click());
  assert.equal(confirmations, 1);
  assert.deepEqual(Object.entries(dom.window.localStorage), before);
  await act(async () => root.unmount());
});
dom.window.close(); console.log(`更新 UI／網站語意驗證：${passed} 項通過。`);
