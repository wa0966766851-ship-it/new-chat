import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(dom.window as any).HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import('react-dom/client');
const { default: Run } = await import('../src/components/InterstellarExploration/InterstellarRun');
const E = await import('../src/modes/interstellar/v2/engine');
const { DEFAULT_ELVES } = await import('../src/data/defaultElvesLoaded');
const pool = DEFAULT_ELVES;
const root = createRoot(document.getElementById('root')!);
const sleep = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const runProps = { allElves: pool, startingDiamonds: 3, initialEquipType: 'suit' as const, initialEquipId: '', selectedModifiers: [] as string[], onEndRun: () => {}, onStartBattle: () => {} };
const mount = async () => { await act(async () => root.render(null)); await act(async () => root.render(React.createElement(Run, runProps))); await sleep(100); };

function baseRun(): E.RunV2 {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 7 });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  return E.confirmDraft(run, pool);
}
const text = (el: HTMLElement | undefined) => (el?.textContent || '').replace(/\s+/g, '');

try {
  const scenes: Record<string, any> = {
    map: { kind: 'map' }, rest: { kind: 'rest' }, altar: { kind: 'altar' }, shop: { kind: 'shop', stock: [] },
    end: { kind: 'end', result: 'wiped', cause: 'lives' },
    prelude: { kind: 'prelude', encounter: { kind: 'combat', title: '測試', enemies: [{ id: String(pool[3].id), affixes: [] }], scale: 1.2, hpScale: 2.5 } },
  };
  for (const [kind, scene] of Object.entries(scenes)) {
    localStorage.clear();
    const run = { ...baseRun(), lives: 5, tempLives: 1, scene };
    localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(run));
    await mount();
    const head = qa('[data-testid=life-resource]');
    assert.equal(head.length, 1, `${kind}：頂部資源列顯示生命`);
    assert.equal(qa('[data-testid=life-resource] [data-testid=life-perm]')[0]?.textContent, '5', `${kind}：永久生命`);
    assert.match(text(head[0]), /生命5\(\+1\)/, `${kind}：永久＋臨時以 5 (+1) 顯示`);
    assert.ok(head[0].title.includes('臨時生命') && head[0].title.includes('永久 5、臨時 1'), `${kind}：tooltip 說明規則`);
    if (kind !== 'map') {
      const chip = qa('[data-testid=life-resource-scene]');
      assert.equal(chip.length, 1, `${kind}：場景覆蓋層另有生命標示`);
      assert.match(text(chip[0]), /♥5\(\+1\)/);
    } else assert.equal(qa('[data-testid=life-resource-scene]').length, 0, 'map：不重複顯示');
  }
  // 無臨時生命時不顯示括號
  localStorage.clear();
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify({ ...baseRun(), lives: 3, tempLives: 0, scene: { kind: 'map' } }));
  await mount();
  assert.equal(text(qa('[data-testid=life-resource]')[0]), '♥生命3');
  // 舊存檔（沒有 lives／tempLives 欄位）遷移後顯示預設值
  localStorage.clear();
  const legacy: any = { ...baseRun(), scene: { kind: 'map' } }; delete legacy.lives; delete legacy.tempLives; delete legacy.lifeBought; delete legacy.lastLifeLoss;
  localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(legacy));
  const migrated = E.resumeRunV2(localStorage, pool)!;
  assert.ok(Number.isFinite(migrated.lives) && migrated.lives >= 1, '舊存檔遷移後 lives 有預設值');
  await mount();
  assert.equal(qa('[data-testid=life-perm]')[0]?.textContent, String(migrated.lives), '舊存檔頁面顯示預設生命');
  assert.ok(!/NaN|undefined/.test(document.body.textContent || ''));
  // 標題避讓左上選單按鈕
  assert.match(document.querySelector('header')!.className, /\bpl-16\b/, '頂部列左側留出選單按鈕空間');
  console.log('eclipseLivesHeader ui ok');
} finally { await act(async () => root.unmount()); process.exit(process.exitCode ?? 0); }
