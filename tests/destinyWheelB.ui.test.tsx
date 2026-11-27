import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

// 命運之輪 B 頁（拾光行記風格）真實元件測試：功能對照、PVE/PVP 流程到 onStartBattle、詳情、隱匿、鍵盤、靜態模式。
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
let rafCalls = 0;
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, KeyboardEvent: dom.window.KeyboardEvent,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => { rafCalls++; return setTimeout(() => f(Date.now()), 0) as any; }, cancelAnimationFrame: clearTimeout });
(dom.window as any).requestAnimationFrame = (globalThis as any).requestAnimationFrame;
let seed = 7; const realRandom = Math.random;
Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const { createRoot } = await import('react-dom/client');
const { default: Wheel } = await import('../src/components/DestinyWheelScreen');
const { PARITY } = await import('../src/components/destiny/DestinyWheelB/parity');
const { default: dwbCss } = await import('../src/components/destiny/DestinyWheelB/dwbCss');

const skills = (tag: string) => Array.from({ length: 5 }, (_, i) => ({ name: `${tag}技${i}`, type: '普通', category: '物理', power: 80 + i, pp: 20, accuracy: 100, description: `${tag}技${i}說明`, ...(i === 4 ? { isFifthSkill: true } : {}) }));
const mk = (i: number, name: string, rank: string, extra: any = {}): any => ({ id: String(i), name, type: '普通', level: 100, destinyRank: rank, currentHp: 500, maxHp: 500,
  baseStats: { hp: 100, atk: 110, def: 100, spatk: 100, spdef: 100, speed: 100 }, calculatedStats: { hp: 500 }, skills: skills(name),
  soulMark: { name: `印${i}`, description: '# 魂印\n每次登場時：\n> **為對手附加3回合的星火之灼**\n>> 註：重複獲取重置', effectType: 'none', effectValue: 0 },
  alienTraits: { gen2Trait: { name: '二代', description: '> **二代特質內容**' }, exclusiveTrait: { name: '專屬', description: '專屬內容' }, generalTrait: { name: '通用', description: '通用內容' } }, ...extra });
const elves = [mk(0, '甲神', 'S'), ...[1, 2, 3, 4].map(i => mk(i, `乙${i}`, 'A')), mk(5, '丙攔', 'C'), mk(6, '六界神王', 'C'),
  ...Array.from({ length: 13 }, (_, i) => mk(7 + i, `丁${i}`, 'B'))];

const root = createRoot(document.getElementById('root')!);
let launched: any[] | undefined; let backed = 0;
const $ = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const $$ = (id: string) => [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
const click = async (el: Element | null | undefined, what = '') => { assert.ok(el, `找不到 ${what}`); await act(async () => (el as HTMLElement).click()); };
const wait = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const key = (k: string) => act(async () => { window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true })); });
const mount = async (list = elves, view: 'A' | 'B' = 'B') => {
  localStorage.setItem('destinyWheelView', view); launched = undefined;
  await act(async () => root.render(React.createElement(Wheel, { key: Math.random(), allElves: list, onBack: () => { backed++; }, onStartBattle: (...a: any[]) => { launched = a; } })));
  await wait(60);
};
const toReveal = async () => { await click($('b-start'), 'b-start'); await wait(1600); assert.ok($('b-next-ban'), '抽卡後應進入圖版'); };
const toBan = async () => { await toReveal(); await click($('b-reveal-all')); await click($('b-next-ban')); };
const toPick = async (pvp = false) => {
  await toBan();
  for (const c of $$('b-ban-card').slice(0, 3)) await click(c);
  if (pvp) for (const c of $$('b-ban-own-card').slice(0, 3)) await click(c);
  await click($('b-confirm-ban'));
};
const stateIds = () => new Set([...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid')!));
const results: string[] = []; const ok = (m: string) => { results.push(m); };

try {
  // ---- 偏好：2026-11-07 起預設 B 頁；可切經典版並記住 ----
  localStorage.removeItem('destinyWheelView'); await mount(elves, 'A'); localStorage.removeItem('destinyWheelView');
  await act(async () => root.render(React.createElement(Wheel, { key: 'default', allElves: elves, onBack: () => {}, onStartBattle: () => {} })));
  assert.ok(document.querySelector('[data-destiny-view="B"]'), '預設應為 B 頁');
  await click($('b-switch-a')); assert.ok(document.querySelector('[data-destiny-view="A"]'), '可切到經典版');
  const toB = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'B 頁'); await click(toB, 'B 頁鈕'); await wait(60);
  assert.ok(document.querySelector('[data-destiny-view="B"]'), '切換後應為 B 頁'); assert.equal(localStorage.getItem('destinyWheelView'), 'B');
  await click($('b-switch-a')); assert.ok(document.querySelector('[data-destiny-view="A"]')); assert.equal(localStorage.getItem('destinyWheelView'), 'A');
  ok('偏好切換 A↔B 並記住');

  // ---- 切換時抽卡進度保留 ----
  await mount(); await toReveal(); await click($$('b-card')[0]);
  await click($('b-switch-a')); assert.ok(document.body.textContent?.includes('1 / 24'), '舊頁應保留翻牌進度');
  ok('A↔B 切換保留流程狀態');

  // ---- 功能對照：每一列在對應狀態都存在 ----
  const need = (state: string) => PARITY.filter(r => r.state === state || r.state === 'any');
  const verify = (state: string, extra: string[] = []) => {
    const have = stateIds();
    for (const r of need(state)) for (const id of r.b) if (!extra.includes(id)) assert.ok(have.has(id), `對照表 #${r.no}「${r.old}」缺 ${id}（狀態 ${state}）`);
  };
  await mount(); verify('intro');
  await click($('b-blueprint')); verify('intro-bp'); await click($('b-blueprint'));
  // 卡池不足
  await mount([]); await click($('b-start')); assert.ok($('b-error')?.textContent?.includes('卡池不足')); assert.equal($('b-error')!.getAttribute('role'), 'alert'); ok('短池提示 b-error');
  await mount(); await click($('b-start')); assert.ok($('b-pulling')); verify('pulling'); assert.equal($('b-mode')!.hasAttribute('disabled'), true, '抽卡中應鎖定 PVE/PVP');
  await click($('b-mode')); assert.equal($('b-mode')!.textContent, 'PVE', '鎖定時點擊不得切換');
  await wait(1600); verify('reveal-back');
  assert.equal($$('b-card').length, 24); assert.equal($('b-revealed-count')!.textContent, '已翻 0 / 24');
  await click($$('b-card')[0]); assert.equal($('b-revealed-count')!.textContent, '已翻 1 / 24'); ok('單翻 1/24');
  await click($('b-reveal-all')); assert.equal($('b-revealed-count')!.textContent, '已翻 24 / 24'); verify('reveal-front');
  // 統計四項相加＝12（D-02）
  for (const p of ['b-pool-p1', 'b-pool-p2']) { const t = $(p)!.querySelector('[data-testid="b-pool-stats"]')!.textContent!; const n = [...t.matchAll(/(\d+)/g)].map(m => +m[1]); assert.equal(n.length, 4); assert.equal(n.reduce((a, b) => a + b, 0), 12, t); assert.match(t, /B \d+/); }
  ok('圖版統計含 B 且四項相加＝12');
  assert.ok($$('b-card').every(c => c.getAttribute('data-face') === 'front'));
  assert.ok($$('b-card').some(c => c.getAttribute('data-rank') === 'S') && $$('b-card').some(c => c.getAttribute('data-rank') === 'C'));
  // 分級以字母＋造型＋顏色三者標示
  for (const r of ['S', 'A', 'B', 'C']) { const seal = $$(`b-rank-${r}`)[0]; assert.ok(seal, r); assert.equal(seal.textContent, r); }
  // 圖紙模式：卡面顯示判定來源
  await key('b'); assert.ok($('b-blueprint-note')); assert.ok($$('b-card-bp').length >= 24); await key('b'); assert.equal($('b-blueprint-note'), null);
  ok('圖紙 B 鍵');

  // ---- 詳情 ----
  const faceCards = $$('b-card'); const cCard = faceCards.find(c => c.getAttribute('data-rank') === 'C' && !c.textContent!.includes('六界神王'))!;
  await click(cCard); assert.ok($('b-detail')); verify('detail');
  assert.ok($('b-detail-intercept'), 'C 級詳情應有攔截區');
  assert.equal($$('b-fifth').length, 1, '第五技能恰一個標記'); const skillLis = [...$('b-detail-skills')!.querySelectorAll('li')]; assert.equal(skillLis.length, 5);
  assert.ok(skillLis[4].querySelector('[data-fifth-skill]'), '第五技能在資料順序最後一格');
  const soulText = $('b-detail-soul')!.textContent!; assert.ok(soulText.includes('為對手附加3回合的星火之灼')); assert.ok(!soulText.includes('**') && !/>\s*>/.test(soulText) && !soulText.includes('# '), `魂印不得露出 Markdown 符號：${soulText}`);
  const sheet = $('b-detail')!; assert.ok(!sheet.querySelector('.dwb-sheet-body')!.contains($('b-detail-close')), '關閉鈕在捲動區之外，手機永遠可見');
  assert.ok(sheet.querySelector('.dwb-sheet-top')!.contains($('b-detail-close')));
  assert.ok(sheet.querySelector('.dwb-sheet-profile') && sheet.querySelector('.dwb-sheet-effects'), '桌面詳情分為立繪能力與效果區');
  assert.match(dwbCss, /width:min\(1280px,100%\)/, '桌面使用寬版詳情');
  assert.match(dwbCss, /\.dwb-sheet-body\s*\{[^}]*overflow-y:auto/); assert.match(dwbCss, /\.dwb-sheet\s*\{[^}]*max-height:100dvh/);
  await key('Escape'); assert.equal($('b-detail'), null, 'Esc 關閉詳情'); ok('詳情：攔截、第五技能、層次描述、可捲動結構、Esc');
  const liu = faceCards.find(c => c.textContent!.includes('六界神王'));
  assert.ok(liu?.querySelector('[data-testid="b-intercept-tag"]'), '六界神王顯示其命運攔截');
  verify('reveal-front');

  // ---- 鍵盤切章 ----
  await key('ArrowLeft'); assert.ok($('b-start'), '←：回序章'); await key('ArrowRight'); assert.ok($('b-next-ban'), '→：回到圖版'); ok('←→ 切章');

  // ---- PVE 流程：Ban → Pick → onStartBattle ----
  await click($('b-next-ban'));
  const opp = $$('b-ban-card'); assert.equal(opp.length, 12);
  assert.equal($('b-confirm-ban')!.hasAttribute('disabled'), true);
  for (const c of opp.slice(0, 3)) await click(c);
  verify('ban-pve'); assert.equal($$('b-ban-mark').length, 3); assert.match($('b-ban-count')!.textContent!, /3 \/ 3/);
  await click($$('b-ban-card')[0]); assert.equal($$('b-ban-mark').length, 2, '再點一次取消禁用'); await click($$('b-ban-card')[0]);
  assert.equal($('b-confirm-ban')!.hasAttribute('disabled'), false);
  await click($('b-confirm-ban')); verify('pick-pve');
  assert.ok($('b-loadout'), '編隊章有命運配裝');
  assert.equal($$('b-lo-p1-suit').length,0,'預設只展示目前配裝');
  await click($('b-lo-summary-p1-suit'));
  { const suits = $$('b-lo-p1-suit'); assert.equal(suits.length, 3); assert.equal(suits[0].getAttribute('aria-checked'), 'true');
    await click(suits[2]);assert.equal($$('b-lo-p1-suit').length,0,'選好後收合');await click($('b-lo-summary-p1-suit')); assert.equal($$('b-lo-p1-suit')[2].getAttribute('aria-checked'), 'true'); assert.equal($$('b-lo-p1-suit')[0].getAttribute('aria-checked'), 'false');
    await click($('b-lo-summary-p2-suit'));const ai = $$('b-lo-p2-suit'); assert.equal(ai.filter(b => b.getAttribute('aria-checked') === 'true').length, 1, 'AI 已選一件');
    assert.ok(ai.filter(b => b.getAttribute('aria-checked') !== 'true').every(b => b.hasAttribute('disabled')), 'PVE：AI 配裝不可改');
    const mine = new Set($$('b-lo-p1-suit').map(b => b.getAttribute('data-value'))); assert.ok(ai.every(b => !mine.has(b.getAttribute('data-value'))), '雙方套裝候選不重複');
    await click($('b-lo-summary-p1-flame'));assert.equal($$('b-lo-p1-flame').length, 2, '火焰 2 選 1');await act(async()=>{$('b-lo-summary-p1-flame')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});assert.equal($$('b-lo-p1-flame').length,0,'Esc只收合候選');assert.ok($('b-pick-p1'),'收合不退回上一階段');await click($('b-lo-summary-p1-suit'));await act(async()=>document.body.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true})));assert.equal($$('b-lo-p1-suit').length,0,'點擊外部收合候選'); ok('命運配裝：可改選、AI 鎖定、雙方不重複'); }
  assert.match($('b-pick-count')!.textContent!, /6 \/ 6/); assert.equal($$('b-pick-card').length, 12); assert.equal($$('b-pick2-card').length, 12, 'PVE 保留 AI 原卡池 12 位');
  for (const testid of ['b-pick-card', 'b-pick2-card']) {
    const cards = $$(testid);
    assert.deepEqual(cards.map(c => Number(c.dataset.poolSlot)), Array.from({length:12},(_,i)=>i+1));
    assert.equal(cards.filter(c => c.dataset.banned === '1').length, 3);
    const before = $('b-pick-count')!.textContent;
    await click(cards.find(c => c.dataset.banned === '1')!);
    assert.equal($('b-pick-count')!.textContent, before, '已禁用卡不能加入戰隊');
  }
  assert.ok($$('b-pick2-card').some(c => c.querySelector('[data-testid="b-starter-mark"]')), 'AI 首發可見（決定 3：維持現況）');
  const picked = $$('b-pick-card').filter(c => c.getAttribute('data-picked') === '1'); assert.equal(picked.length, 6);
  await click($$('b-pick-card').find(c => c.dataset.picked === '1')!); assert.match($('b-pick-count')!.textContent!, /5 \/ 6/); assert.equal($('b-launch')!.hasAttribute('disabled'), true);
  await click($$('b-pick-card').find(c => !c.dataset.picked && !c.dataset.banned)!); assert.match($('b-pick-count')!.textContent!, /6 \/ 6/);
  const target = $$('b-pick-card').filter(c => c.getAttribute('data-picked') === '1')[3]; const targetId = target.getAttribute('data-instance')!;
  await click(target.querySelector('[data-testid="b-starter-btn"]'), '首發鈕');
  assert.ok($$('b-pick-card').find(c => c.getAttribute('data-instance') === targetId)!.querySelector('[data-testid="b-starter-mark"]'));
  await click($('b-launch'));
  assert.ok(launched, 'onStartBattle 應被呼叫'); const [mode, p1, p2, f1, f2] = launched!;
  assert.equal(mode, 'PVE'); assert.equal(p1.length, 6); assert.equal(p2.length, 6); assert.equal(f1, targetId); assert.ok(p1.some((e: any) => e.battleId === f1)); assert.ok(p2.some((e: any) => e.battleId === f2));
  assert.equal(new Set([...p1, ...p2].map((e: any) => e.battleId)).size, 12); assert.equal(launched![11], 'peak_6v6'); ok('PVE 流程到 onStartBattle（簽名不變）');
  // 命運配裝：雙方套裝／目鏡／稱號不重複，火焰隨開戰帶出
  { const [, , , , , s1, e1, s2, e2, t1, t2, , opts] = launched!;
    assert.ok(s1 && s2 && s1 !== s2, '雙方套裝不同'); assert.ok(e1 && e2 && e1 !== e2, '雙方目鏡不同'); assert.ok(t1 && t2 && t1 !== t2, '雙方稱號不同');
    assert.match(String(opts?.flames?.p1), /^flame_/); assert.match(String(opts?.flames?.p2), /^flame_/); ok('命運配裝帶入開戰'); }

  // ---- PVP 流程 ----
  await mount(); await click($('b-mode')); assert.equal($('b-mode')!.textContent, 'PVP');
  await toBan(); assert.equal($('b-confirm-ban')!.hasAttribute('disabled'), true);
  for (const c of $$('b-ban-card').slice(0, 3)) await click(c);
  assert.equal($('b-confirm-ban')!.hasAttribute('disabled'), true, 'PVP 需雙方都選滿 3');
  for (const c of $$('b-ban-own-card').slice(0, 3)) await click(c);
  verify('ban-pvp'); await click($('b-confirm-ban')); verify('pick-pvp');
  assert.equal($$('b-pick2-card').length, 12, 'PVP 保留 P2 原卡池 12 位');
  for (const id of ['b-pick-card', 'b-pick2-card']) {
    assert.deepEqual($$(id).map(c => Number(c.dataset.poolSlot)), Array.from({length:12},(_,i)=>i+1));
    assert.equal($$(id).filter(c=>c.dataset.banned==='1').length,3);
  }
  const p2Card = $$('b-pick2-card').filter(c => c.getAttribute('data-picked') === '1')[2]; const p2Id = p2Card.getAttribute('data-instance')!;
  await click(p2Card.querySelector('[data-testid="b-starter-btn"]'));
  await click($('b-launch')); const [m2, q1, q2, , g2] = launched!;
  assert.equal(m2, 'PVP'); assert.equal(q1.length, 6); assert.equal(q2.length, 6); assert.equal(g2, p2Id); ok('PVP 流程到 onStartBattle，P2 首發');

  // ---- 靜態模式與視差：靜態不註冊 rAF，動畫模式只在指標移動時跑並會停 ----
  await mount(); await click($('b-static')); rafCalls = 0;
  await act(async () => { const ev: any = new dom.window.Event('pointermove'); ev.clientX = 300; ev.clientY = 200; window.dispatchEvent(ev); }); await wait(80);
  assert.equal(rafCalls, 0, '靜態模式不得跑 rAF'); await click($('b-static')); rafCalls = 0;
  await act(async () => { const ev: any = new dom.window.Event('pointermove'); ev.clientX = 300; ev.clientY = 200; window.dispatchEvent(ev); }); await wait(600);
  assert.ok(rafCalls > 0, '動畫模式指標移動應觸發視差');
  // 忙碌的電腦不保證 600ms 內完成全部影格，但視差仍須在有限時間內停止。
  let stopped = false;
  for (let i = 0; i < 20; i++) { const before = rafCalls; await wait(300); if (rafCalls === before) { stopped = true; break; } }
  assert.ok(stopped, '指標靜止後 rAF 必須停止'); const settled = rafCalls; await wait(300); assert.equal(rafCalls, settled); ok('靜態／視差 rAF');
  await click($('b-static')); await click($('b-start')); await wait(500); assert.ok($('b-next-ban'), '靜態模式輪盤儀式縮短'); ok('靜態輪盤縮短');

  // ---- 返回大廳 ----
  await mount(); const b0 = backed; await click($('b-back')); assert.equal(backed, b0 + 1); ok('返回大廳');

  // ---- 隱匿：B 頁凡顯示名稱／技能／魂印處都走 hiddenFromViewer ----
  const secret = elves.map((e, i) => ({ ...e, name: `${e.name === '六界神王' ? '界秘' : '秘' }${i}號`, isConcealed: true, soulMark: { ...e.soulMark, name: `機密魂印${i}` }, skills: skills(`機密技${i}`) }));
  await mount(secret); await toReveal(); await click($('b-reveal-all'));
  assert.ok($('b-pool-p1')!.textContent!.includes('號'), 'PVE 己方隱匿精靈對自己可見');
  assert.ok(!$('b-pool-p2')!.textContent!.includes('號'), 'PVE 對手隱匿精靈不得露出名稱'); assert.ok($('b-pool-p2')!.textContent!.includes('未知精靈'));
  await click($$('b-card').filter(c => c.getAttribute('data-instance')!.startsWith('p2_'))[0]);
  assert.ok(!$('b-detail')!.textContent!.includes('機密') && !$('b-detail')!.textContent!.includes('號'), '詳情不得洩漏對手隱匿精靈'); await key('Escape');
  await click($('b-next-ban')); for (const c of $$('b-ban-card').slice(0, 3)) await click(c); await click($('b-confirm-ban'));
  assert.ok(!$('b-pick-p2')!.textContent!.includes('號') && !$('b-pick-p2')!.textContent!.includes('機密'), 'Pick 對手陣容不得含隱匿名稱／魂印／技能');
  await mount(secret); await click($('b-mode')); await toReveal(); await click($('b-reveal-all'));
  assert.ok(!$('b-pool-p1')!.textContent!.includes('號') && !$('b-pool-p2')!.textContent!.includes('號'), 'PVP 雙方隱匿精靈皆不可見'); ok('隱匿遮蔽（PVE 對手、PVP 雙方）');

  console.log(results.map(r => '通過：' + r).join('\n')); console.log('命運之輪 B 頁 UI：功能對照 ' + PARITY.length + ' 項、PVE/PVP 流程、詳情、隱匿、鍵盤、靜態模式通過');
} finally { Math.random = realRandom; await act(async () => root.unmount()); dom.window.close(); }
