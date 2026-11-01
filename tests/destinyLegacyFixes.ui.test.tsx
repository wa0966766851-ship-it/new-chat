import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

// 命運之輪舊頁（A）BUG 修正回歸：D-02 D-03 D-04 D-05 D-06 D-08 D-09 D-10 D-11，另含 B 頁無 emoji。
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
const timers: { id: any; ms: number; cleared: boolean }[] = []; const realST = globalThis.setTimeout, realCT = globalThis.clearTimeout;
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, KeyboardEvent: dom.window.KeyboardEvent,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => realST(f, 0), cancelAnimationFrame: realCT });
(globalThis as any).setTimeout = ((fn: any, ms?: number, ...a: any[]) => { const id = realST(fn, ms, ...a); timers.push({ id, ms: ms ?? 0, cleared: false }); return id; }) as any;
(globalThis as any).clearTimeout = ((id: any) => { const t = timers.find(x => x.id === id); if (t) t.cleared = true; return realCT(id); }) as any;
let seed = 11; const realRandom = Math.random; Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const { createRoot } = await import('react-dom/client');
const { default: Wheel } = await import('../src/components/DestinyWheelScreen');
const { describeAllRankRules, DESTINY_RANK_LABEL } = await import('../src/utils/destinyRankMeta');
const { DISPLAY_RANK_RULES } = await import('../src/utils/elfDisplayRank');
const { default: legacyCss } = await import('../src/components/destiny/destinyLegacyPaperCss');

const skills = (tag: string) => Array.from({ length: 5 }, (_, i) => ({ name: `${tag}技${i}`, type: '普通', category: '物理', power: 80, pp: 20, accuracy: 100, description: 'd', ...(i === 4 ? { isFifthSkill: true } : {}) }));
const mk = (i: number, name: string, rank: string): any => ({ id: String(i), name, type: '普通', level: 100, destinyRank: rank, currentHp: 500, maxHp: 500,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, calculatedStats: { hp: 500 }, skills: skills(name),
  soulMark: { name: '印', description: '# 魂印\n> **為對手附加3回合的星火之灼**\n>> 註：重複獲取重置\n---\n## ◆ 相關說明', effectType: 'none', effectValue: 0 },
  alienTraits: { gen2Trait: { name: '二代', description: '> **二代內容**' } } });
const elves = [mk(0, '甲神', 'S'), ...[1, 2, 3, 4].map(i => mk(i, `乙${i}`, 'A')), mk(5, '丙攔', 'C'), mk(6, '丁攔', 'C'), ...Array.from({ length: 13 }, (_, i) => mk(7 + i, `戊${i}`, 'B'))];
const root = createRoot(document.getElementById('root')!);
const wait = (ms: number) => act(async () => { await new Promise(r => realST(r, ms)); });
const btn = (t: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(t)) as HTMLButtonElement | undefined;
const click = async (el: Element | null | undefined, w = '') => { assert.ok(el, w); await act(async () => (el as HTMLElement).click()); };
const emoji = /\p{Extended_Pictographic}/u;
const noEmoji = (where: string) => { const m = document.body.textContent!.match(emoji); assert.ok(!m, `${where} 不得有 emoji：${m?.[0]}`); };
const mount = async () => { localStorage.setItem('destinyWheelView', 'A'); await act(async () => root.render(React.createElement(Wheel, { key: Math.random(), allElves: elves, onBack: () => {}, onStartBattle: () => {} }))); await wait(60); };

try {
  // ---- D-03 / D-10：介紹頁規則文字由規則表產生，無舊門檻、無 emoji、無裝飾字 ----
  await mount(); noEmoji('介紹頁');
  const intro = document.body.textContent!;
  assert.ok(!/730|601|679|≤\s*600/.test(intro), '介紹頁不得殘留舊分級門檻');
  const rules = document.querySelector('[data-testid="rank-rules"]')!.textContent!;
  for (const line of describeAllRankRules().split('\n')) assert.ok(rules.includes(line), `規則文字應含：${line}`);
  assert.ok(rules.includes(String(DISPLAY_RANK_RULES.aTotalThreshold))); for (const n of DISPLAY_RANK_RULES.cNames) assert.ok(rules.includes(n));
  assert.ok(!/MONTE CARLO|MARKOV|Φ-MATRIX/.test(intro)); console.log('通過：D-03 介紹頁規則由規則表產生；D-10 介紹頁無 emoji');
  // 規則表改動會同步：C 名單每個名稱都在 C 規則文字內
  assert.ok(describeAllRankRules().includes(DISPLAY_RANK_RULES.cNames[0]));

  // ---- D-08：抽卡中鎖定模式、卸載清除計時器 ----
  const modeBtn = () => [...document.querySelectorAll('button')].find(b => /^(PVE|PVP)$/.test(b.textContent!.trim())) as HTMLButtonElement;
  assert.equal(modeBtn().disabled, false); await click(modeBtn()); assert.equal(modeBtn().textContent!.trim(), 'PVP'); await click(modeBtn()); assert.equal(modeBtn().textContent!.trim(), 'PVE');
  timers.length = 0; await click(btn('立即前往抽卡')); assert.equal(modeBtn().disabled, true, '抽卡中模式鈕應鎖定'); await click(modeBtn()); assert.equal(modeBtn().textContent!.trim(), 'PVE');
  noEmoji('抽卡中'); assert.ok(!document.body.textContent!.includes('注入專屬命運攔截'), '不實動畫文案已刪除');
  const pend = timers.find(t => t.ms === 1500)!; assert.ok(pend && !pend.cleared);
  await act(async () => root.unmount()); assert.ok(pend.cleared, '卸載時必須清除抽卡計時器');
  const errs: any[] = []; const ce = console.error; console.error = (...a: any[]) => { errs.push(a); }; await wait(1700); console.error = ce; assert.equal(errs.length, 0, '卸載後不得再 setState');
  console.log('通過：D-08 抽卡中鎖定 PVE/PVP、卸載清理計時器');
} finally { /* 第二段流程使用新的 root */ }

const root3 = createRoot(document.getElementById('root')!);
const mount3 = async (view: 'A' | 'B') => { localStorage.setItem('destinyWheelView', view); await act(async () => root3.render(React.createElement(Wheel, { key: Math.random(), allElves: elves, onBack: () => {}, onStartBattle: () => {} }))); await wait(60); };
try {
  await mount3('A'); await click(btn('立即前往抽卡')); await wait(1600);
  await click(btn('點一次全翻所有牌')); noEmoji('揭曉頁');
  // D-02：四項統計含 B，相加＝12
  const counts = [...document.querySelectorAll('[data-testid="rank-counts"]')]; assert.equal(counts.length, 2);
  for (const c of counts) { const n = [...c.textContent!.matchAll(/(\d+)/g)].map(m => +m[1]); assert.equal(n.length, 4); assert.equal(n.reduce((a, b) => a + b, 0), 12, c.textContent!); assert.match(c.textContent!, /B × \d+/); }
  console.log('通過：D-02 統計列含 B 且相加＝12');
  // D-05/06/09：詳情
  const card = [...document.querySelectorAll<HTMLElement>('.cursor-pointer')].find(e => e.textContent!.includes('甲神') || e.textContent!.includes('乙'))!;
  await click(card); const modal = document.querySelector('[data-testid="destiny-inspect"]')!; assert.ok(modal); noEmoji('詳情視窗');
  const panel = modal.firstElementChild as HTMLElement; assert.match(modal.className, /overflow-y-auto/); assert.match(panel.className, /max-h-/); assert.match(panel.className, /overflow-y-auto/);
  assert.ok(!/\*\*|>\s*>|---|##/.test(panel.textContent!), `詳情不得露出 Markdown 符號：${panel.textContent}`); assert.ok(panel.textContent!.includes('為對手附加3回合的星火之灼'));
  assert.equal(panel.querySelectorAll('[data-fifth-skill]').length, 1, 'D-09 第五技能標記'); assert.ok(panel.querySelector('button[aria-label="關閉詳情"]'));
  console.log('通過：D-05 詳情可捲動且有 max-h；D-06 無 Markdown 符號；D-09 第五技能標記');
  await click(panel.querySelector('button[aria-label="關閉詳情"]'));
  // Ban / Pick 無 emoji
  await click(btn('下一步：進入 Ban')); noEmoji('Ban'); const sect = [...document.querySelectorAll('h4')].find(e => e.textContent?.includes('點擊敵方'))!.parentElement!;
  for (const c of [...sect.querySelectorAll<HTMLElement>('.cursor-pointer')].slice(0, 3)) await click(c);
  await click(btn('確認禁用')); noEmoji('Pick');

  // ---- D-04：紙本風全頁可讀（作用域映射）----
  await click(btn('紙本')); const rootEl = document.querySelector('[data-destiny-view="A"]')!; assert.match(rootEl.className, /destiny-legacy-paper/);
  const style = document.getElementById('destiny-legacy-paper-css'); assert.ok(style, '紙本映射樣式已注入');
  for (const rule of ['bg-slate-9', 'text-white', 'text-slate-', 'border-', 'bg-gradient', 'backdrop-filter']) assert.ok(legacyCss.includes(rule), `紙本映射缺 ${rule}`);
  assert.ok(!/radial-gradient|linear-gradient/.test(legacyCss.replace(/\[class\*="bg-gradient"\]/g, '')), '紙本樣式本身無漸層');
  assert.ok(!rootEl.querySelector('.blur-\\[120px\\]'), '紙本態不畫光斑'); console.log('通過：D-04 紙本態注入全頁映射');

  // ---- D-11：不再有魔術邊距 ----
  const src = readFileSync(new URL('../src/components/destiny/DestinyWheelClassic.tsx', import.meta.url), 'utf8'); assert.ok(!src.includes('md:mr-52'), 'D-11'); assert.ok(src.includes('--control-hub-safe'));
  console.log('通過：D-11 魔術邊距改為具名變數');

  // ---- B 頁各階段無 emoji ----
  await mount3('B'); noEmoji('B 序章'); await click(document.querySelector('[data-testid="b-start"]')); noEmoji('B 輪盤'); await wait(1600);
  await click(document.querySelector('[data-testid="b-reveal-all"]')); noEmoji('B 圖版'); await click(document.querySelector('[data-testid="b-blueprint"]')); noEmoji('B 圖紙');
  await click(document.querySelector('[data-testid="b-next-ban"]')); noEmoji('B 禁選'); console.log('通過：B 頁無 emoji');
} finally { Math.random = realRandom; (globalThis as any).setTimeout = realST; (globalThis as any).clearTimeout = realCT; await act(async () => root3.unmount()); dom.window.close(); }
console.log('命運之輪舊頁 BUG 修正回歸通過');
