// 戰鬥百科「BOSS 類」異常：全收錄、子分類不漏不重、每條有圖示、搜尋與子分類篩選
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const { StatusRegistry } = await import('../src/effects/statusRegistry');
const { BOSS_TRAITS } = await import('../src/data/bossTraits');
const { BOSS_STATUS_GROUPS, bossGroupOf } = await import('../src/data/bossStatusGroups');
const { BossStatusSection } = await import('../src/components/BossStatusSection');

// 與 Encyclopedia 同一規則取 BOSS_ONLY（依名稱去重）
const seen = new Set<string>();
const entries = Object.values(StatusRegistry).filter(e => e.categories.includes('BOSS_ONLY') && !seen.has(e.name) && seen.add(e.name))
  .map(e => ({ name: e.name, description: e.description }));
assert.equal(entries.length, 38, '免疫＋神話＋36 條首領特性');
for (const t of BOSS_TRAITS) assert.ok(seen.has(t.status), `${t.status} 已收錄`);

// 子分類：每條恰屬一類、沒有多餘成員
const all = BOSS_STATUS_GROUPS.flatMap(g => g.members);
assert.equal(new Set(all).size, all.length, '同一狀態不得屬於兩個子分類');
assert.deepEqual([...all].sort(), [...seen].sort(), '子分類成員＝全部 BOSS_ONLY 狀態');
const expected: Record<string, number> = { defense: 11, offense: 6, disrupt: 10, sustain: 6, speed: 2, special: 3 };
for (const g of BOSS_STATUS_GROUPS) assert.equal(g.members.length, expected[g.id], `${g.label} 條數`);
assert.ok(entries.every(e => bossGroupOf(e.name)));

const container = document.createElement('div'); document.body.appendChild(container);
const root = createRoot(container);
const draw = async (query = '') => act(async () => { root.render(<BossStatusSection entries={entries} query={query} />); });
const cards = () => [...container.querySelectorAll('[data-boss-status]')].map(c => c.getAttribute('data-boss-status')!);
const chip = (id: string) => container.querySelector<HTMLButtonElement>(`[data-boss-group="${id}"]`)!;

await draw();
assert.equal(cards().length, 38);
assert.match(chip('').textContent!, /全部 38/);
for (const g of BOSS_STATUS_GROUPS) assert.match(chip(g.id).textContent!, new RegExp(`${g.label} ${expected[g.id]}$`), `${g.label} 計數`);
// 每條有圖示、名稱、說明
for (const c of container.querySelectorAll('[data-boss-status]')) {
  const name = c.getAttribute('data-boss-status')!;
  const src = c.querySelector('img[data-boss-icon]')?.getAttribute('src');
  assert.ok(src && /^\/(seerapi\/bosseffect|status-icons\/boss-trait|seer\/abnormal)\//.test(src), `${name} 有圖示：${src}`);
  assert.ok((c.querySelector('p')?.textContent || '').length > 4, `${name} 有說明`);
  if (src.startsWith('/status-icons/')) assert.ok(fs.existsSync('public' + src), `${name} 徽記檔存在`);
}
// 參數與層次
const amp = container.querySelector('[data-boss-status="特性·增傷"]')!;
assert.match(amp.textContent!, /增傷% 100/); assert.match(amp.textContent!, /難度 20／50／100／200/); assert.match(amp.textContent!, /中等/);
// 子分類篩選
await act(async () => chip('speed').click());
assert.deepEqual(cards().sort(), ['特性·疾行', '特性·迅捷'].sort());
assert.equal(chip('speed').getAttribute('aria-pressed'), 'true');
await act(async () => chip('speed').click());
assert.equal(cards().length, 38, '再點一次取消子分類');
await act(async () => chip('special').click());
assert.deepEqual(cards().sort(), ['神話', '特性·系別變化', '特性·覺醒'].sort());
// 搜尋：名稱、說明、參數名稱；子分類計數隨搜尋更新
await act(async () => chip('special').click());
await draw('吸血');
assert.match(chip('sustain').textContent!, /續航／恢復類 1$/, '搜尋後子分類計數同步');
assert.ok(cards().includes('特性·吸血') && cards().length < 10);
await draw('機率%');
assert.ok(cards().includes('特性·要害探尋') && cards().includes('特性·施加異常'), '可依參數名稱搜尋');
await draw('不存在的關鍵字');
assert.equal(cards().length, 0); assert.match(container.textContent!, /沒有符合/);
await act(async () => root.unmount());

const src = fs.readFileSync('src/components/Encyclopedia.tsx', 'utf8');
assert.ok(src.includes('<BossStatusSection') && src.includes("catKey === 'BOSS_ONLY'"), '戰鬥百科異常區使用 BOSS 類區塊');
console.log('戰鬥百科 BOSS 類：38 條、6 個子分類、圖示、參數、搜尋與篩選通過');
