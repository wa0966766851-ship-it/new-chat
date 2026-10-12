// 入戰動畫：規劃（開關／特殊模式／重來／減少動態）、顯示、跳過、行動閘門。
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { planIntro, createActionGate, formatLabel, INTRO_MS } from '../src/battle/introPlan';
import { DEFAULT_BATTLE_ANIMATION, normalizeAnimationSettings, BATTLE_ANIMATION_OPTIONS } from '../src/battle/animationSettings';

// 規劃
assert.equal(DEFAULT_BATTLE_ANIMATION.intro, true, '預設開');
assert.ok(BATTLE_ANIMATION_OPTIONS.some(o => o.key === 'intro' && o.label === '入戰動畫'));
assert.equal(normalizeAnimationSettings({ intro: false }).intro, false);
assert.deepEqual(planIntro({ enabled: true }), { play: true, ms: INTRO_MS.full, variant: 'full' });
assert.ok(INTRO_MS.full >= 2200 && INTRO_MS.full <= 2800, '完整版 2.2–2.8 秒');
assert.equal(planIntro({ enabled: false }).play, false, '開關關閉不播');
assert.equal(planIntro({ enabled: true, specialMode: 'destiny' }).play, false, '特殊模式不播');
assert.equal(planIntro({ enabled: true, specialMode: 'interstellar' }).play, false);
assert.deepEqual(planIntro({ enabled: true, replay: true }), { play: true, ms: INTRO_MS.short, variant: 'short' });
assert.deepEqual(planIntro({ enabled: true, reducedMotion: true }), { play: true, ms: INTRO_MS.reduced, variant: 'reduced' });
assert.ok(INTRO_MS.reduced < INTRO_MS.short && INTRO_MS.short < INTRO_MS.full);
assert.deepEqual(['normal_6v6', 'solo_1v1', 'peak_6v6', 'peak_3v3'].map(formatLabel), ['自由戰', '單挑 1V1', '巔峰 6V6', '巔峰 3V3']);
console.log('✓ 規劃：開關、特殊模式、重來縮短、減少動態');

// 閘門
{
  const gate = createActionGate();
  assert.equal(gate.wait(), null, '未關閉時放行');
  gate.hold(); const w = gate.wait(); assert.ok(w && gate.held);
  let released = false; void w!.then(() => { released = true; });
  await Promise.resolve(); assert.equal(released, false);
  gate.open(); await w; assert.equal(released, true); assert.equal(gate.wait(), null);
  gate.open(); // 重複開啟無害
}
console.log('✓ 行動閘門');

// 顯示與跳過
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
const { createRoot } = await import('react-dom/client');
const { BattleIntro } = await import('../src/components/battle/BattleIntro');
const elf = (id: string, name: string, extra: any = {}): any => ({ id, battleId: id, name, type: '火', currentHp: 1, maxHp: 1, ...extra });
const root = createRoot(document.getElementById('root')!);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
try {
  let done = 0;
  let seq = 0;
  const show = (plan: any, p2 = elf('x', '丙')) => act(async () => root.render(<BattleIntro key={++seq} p1={elf('a', '甲')} p2={p2} format="單挑 1V1" plan={plan} onDone={() => done++} />));
  await show({ play: true, ms: 80, variant: 'full' });
  const el = document.querySelector('[data-testid="battle-intro"]') as HTMLElement;
  assert.ok(el);
  assert.equal(document.querySelector('[data-testid="intro-name-p1"]')!.textContent, '甲');
  assert.equal(document.querySelector('[data-testid="intro-name-p2"]')!.textContent, '丙');
  assert.equal(document.querySelector('[data-testid="intro-format"]')!.textContent, '單挑 1V1');
  assert.ok(el.textContent!.includes('BATTLE START') && el.textContent!.includes('戰鬥開始'));
  assert.equal(done, 0);
  await act(async () => { await sleep(140); });
  assert.equal(done, 1, '時間到自然結束，只通知一次');
  console.log('✓ 顯示雙方名稱、賽制、BATTLE START，時間到結束一次');

  done = 0;
  await show({ play: true, ms: 5000, variant: 'full' });
  await act(async () => { document.querySelector('[data-testid="battle-intro"]')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); });
  await act(async () => { await sleep(260); });
  assert.equal(done, 1, '點擊跳過');
  for (const key of ['Escape', 'a']) {
    done = 0; await act(async () => root.render(<></>));
    await show({ play: true, ms: 5000, variant: 'full' });
    await act(async () => { dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true })); });
    await act(async () => { await sleep(260); });
    assert.equal(done, 1, `按 ${key} 跳過`);
  }
  console.log('✓ 點擊、Esc、任意鍵跳過，且只通知一次');

  done = 0; await act(async () => root.render(<></>));
  await show({ play: true, ms: 5000, variant: 'full' }, elf('x', '秘', { isConcealed: true }));
  assert.equal(document.querySelector('[data-testid="intro-name-p2"]')!.textContent, '？？？', '隱匿精靈不洩漏名稱');
  console.log('✓ 隱匿精靈名稱遮蔽');
  await act(async () => root.render(<></>));
  await show({ play: true, ms: 700, variant: 'reduced' });
  assert.equal((document.querySelector('[data-testid="battle-intro"]') as HTMLElement).dataset.variant, 'reduced');
  console.log('✓ 減少動態版本');
  // 立繪比例補償：寬圖（窄螢幕上顯得小）依比例放大、上限 1.45；方圖不變
  await act(async () => root.render(<></>));
  await show({ play: true, ms: 5000, variant: 'full' });
  const arts = [...document.querySelectorAll('.bi-art')] as HTMLElement[];
  assert.equal(arts.length, 2);
  assert.ok(arts.every(a => a.style.getPropertyValue('--bi-fit') === '1'), '未載入圖片前為 1');
  const loadImg = async (art: HTMLElement, w: number, h: number) => { const img = document.createElement('img'); Object.defineProperty(img, 'naturalWidth', { value: w }); Object.defineProperty(img, 'naturalHeight', { value: h }); art.appendChild(img); await act(async () => { img.dispatchEvent(new dom.window.Event('load')); }); };
  await loadImg(arts[1], 1500, 1000);
  assert.ok(Math.abs(Number(arts[1].style.getPropertyValue('--bi-fit')) - Math.pow(1.5, .7)) < 1e-6, '寬圖放大');
  await loadImg(arts[0], 1000, 1000);
  assert.equal(arts[0].style.getPropertyValue('--bi-fit'), '1', '方圖不變');
  await loadImg(arts[0], 4000, 1000);
  assert.equal(arts[0].style.getPropertyValue('--bi-fit'), '1.45', '上限 1.45');
  console.log('✓ 入戰動畫立繪比例補償');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
