// 戰鬥百科整合（2026-11-14）：總索引涵蓋全部節點、觸發詞、積木、異常、機制與玩法；
// 每個積木都有顯示名稱；總索引可搜尋並跳回原分頁；分組導航涵蓋全部分頁。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { JSDOM } from 'jsdom';
import { encyclopediaIndex, opTitle } from '../src/data/encyclopediaIndex';
import { BATTLE_NODES } from '../src/engine/nodes';
import { EFFECT_NODES } from '../src/effects/effectNodes';
import { TRIGGER_CAPTIONS } from '../src/battle/effectPresentation';
import { OP_CATALOG } from '../src/data/opCatalog';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { MODE_GUIDES, MECHANIC_TOPICS } from '../src/data/encyclopediaGuide';

const ix = encyclopediaIndex();
const ids = new Set(ix.map(e => e.id));
assert.equal(ids.size, ix.length, '索引 id 不重複');
for (const n of BATTLE_NODES) assert.ok(ids.has(`bn:${n.id}`), `缺官方節點 ${n.id}`);
for (const k of Object.keys(EFFECT_NODES)) assert.ok(ids.has(`en:${k}`), `缺效果節點 ${k}`);
for (const k of Object.keys(TRIGGER_CAPTIONS)) assert.ok(ids.has(`tr:${k}`), `缺觸發詞 ${k}`);
for (const op of Object.keys(OP_CATALOG)) {
  assert.ok(ids.has(`op:${op}`), `缺積木 ${op}`);
  assert.ok(opTitle(op), `積木 ${op} 沒有顯示名稱`);
}
for (const k of Object.keys(StatusRegistry)) assert.ok(ids.has(`st:${k}`), `缺異常 ${k}`);
for (const g of MODE_GUIDES) assert.ok(ids.has(`mo:${g.id}`), `缺玩法 ${g.id}`);
for (const t of MECHANIC_TOPICS) assert.ok(ids.has(`me:${t.id}`), `缺機制 ${t.id}`);
for (const mode of ['normal_6v6', 'solo_1v1', 'peak_6v6', 'peak_3v3', 'destiny_wheel', 'eclipse']) assert.ok(MODE_GUIDES.some(g => g.id === mode), `玩法說明缺 ${mode}`);

// 導航：EncyclopediaTab 每個值都在分組導航與目錄裡
const enc = fs.readFileSync('src/components/Encyclopedia.tsx', 'utf8');
const features = fs.readFileSync('src/shell/features.ts', 'utf8');
const tabUnion = features.match(/export type EncyclopediaTab = ([^;]+);/)![1].match(/'(\w+)'/g)!.map(s => s.slice(1, -1));
const navTabs = [...enc.matchAll(/\['(\w+)', '[^']+'\]/g)].map(m => m[1]);
assert.deepEqual([...navTabs].sort(), [...tabUnion].sort(), '分組導航涵蓋全部分頁');
assert.ok(!enc.includes('ios-segment'), '舊分段控制已移除');
assert.ok(enc.includes("<MechanicsPanel />"), '戰鬥機制改用資料驅動');
// 2026-11-16：舊「效果查詢」分頁（含錯誤的衝突沙盒）併入總索引並移除。
assert.ok(!navTabs.includes('effectQuery') && !enc.includes('SANDBOX_SCENARIOS') && !features.includes("'effectQuery'"), '效果查詢分頁已移除');
for (const e of ix.filter(e => e.kind === 'effect' || e.kind === 'rule')) assert.equal(e.tab, 'search', `${e.id} 留在總索引`);
assert.ok(MECHANIC_TOPICS.some(t => t.group === 'conflict'), '判定交鋒條目移到戰鬥機制');
const killRule = ix.find(e => e.id === 'ru:INSTA_KILL')!;
assert.ok(killRule && /體力歸 0/.test(killRule.body) && !/補償粉傷/.test(killRule.body), '秒殺定義依原廠更正');
const skillDmg = ix.find(e => e.id === 'ru:SKILL_DAMAGE')!;
assert.ok(skillDmg && /不算技能傷害/.test(skillDmg.body), '技能傷害不含固定／百分比／真實');

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { IndexSearchPanel, NodeAtlasPanel, ModeGuidePanel, MechanicsPanel } = await import('../src/components/encyclopedia/EncyclopediaPanels');
const { OpCodePanel } = await import('../src/components/OpCodePanel');
const host = document.getElementById('root')!;
const root = createRoot(host);

const jumps: Array<[string, string]> = [];
await act(async () => { root.render(React.createElement(IndexSearchPanel, { onJump: (tab: string, e: any) => jumps.push([tab, e.id]) })); });
const input = host.querySelector('input[aria-label="搜尋百科"]') as HTMLInputElement;
const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
const type = async (v: string) => { await act(async () => { setValue.call(input, v); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); };

await type('hp_ratio');
let rows = [...host.querySelectorAll('.enc-row')].map(r => r.textContent);
assert.ok(rows.some(t => t!.includes('體力比例')), '依積木名稱找到條件積木');
await act(async () => { (host.querySelector('.enc-row[data-active="true"]') as HTMLElement)?.click(); });
await act(async () => { (host.querySelector('.enc-go') as HTMLElement).click(); });
assert.deepEqual(jumps.at(-1), ['opCodes', 'op:hp_ratio'], '前往積木代號分頁');

await type('3.10');
assert.ok(host.textContent!.includes('死亡節點一'), '依節點編號找到官方節點');
await type('巔峰');
assert.ok([...host.querySelectorAll('.enc-row small')].some(s => s.textContent === '玩法'), '找到玩法說明');
// 參考詞庫延後載入，送到精靈編輯器
await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
await type('先制');
await act(async () => { (host.querySelector('button[data-kind="template"]') as HTMLElement)?.click(); });
const tpl = [...host.querySelectorAll('.enc-row')].find(r => r.querySelector('small')?.textContent === '參考詞庫') as HTMLElement | undefined;
assert.ok(tpl, '總索引含參考詞庫');
{
  await act(async () => { tpl!.click(); });
  await act(async () => { (host.querySelector('.enc-go') as HTMLElement).click(); });
  assert.ok(dom.window.localStorage.getItem('seer_selected_effect_for_ai'), '參考詞庫可送到精靈編輯器');
}
await type('zzzz不存在');
assert.match(host.textContent!, /沒有符合/);

await act(async () => { root.render(React.createElement(NodeAtlasPanel, {})); });
assert.equal(host.querySelectorAll('.enc-step').length, BATTLE_NODES.length, '官方節點全列');
assert.equal(host.querySelectorAll('tr[data-node]').length, Object.keys(EFFECT_NODES).length, '效果節點全列');
assert.equal(host.querySelectorAll('tr[data-trigger]').length, Object.keys(TRIGGER_CAPTIONS).length, '觸發詞全列');
await act(async () => { root.render(React.createElement(NodeAtlasPanel, { key: 'f', focus: 'round_end' })); });
assert.ok(host.querySelector('tr[data-node="round_end"]') && host.querySelectorAll('tr[data-node]').length < Object.keys(EFFECT_NODES).length, '帶入焦點後只列符合的節點');

await act(async () => { root.render(React.createElement(ModeGuidePanel)); });
assert.equal(host.querySelectorAll('[data-mode]').length, MODE_GUIDES.length);
await act(async () => { root.render(React.createElement(MechanicsPanel)); });
assert.equal(host.querySelectorAll('[data-topic]').length, MECHANIC_TOPICS.length);

await act(async () => { root.render(React.createElement(OpCodePanel, { initialQuery: 'hp_ratio' })); });
assert.ok(host.textContent!.includes(OP_CATALOG.hp_ratio.code) && host.textContent!.includes('體力比例'), '積木代號分頁帶入焦點並顯示名稱');

root.unmount();
dom.window.close();
console.log(`戰鬥百科整合：索引 ${ix.length} 筆，節點／觸發詞／積木／異常／機制／玩法全收錄，跳轉與導航通過`);
