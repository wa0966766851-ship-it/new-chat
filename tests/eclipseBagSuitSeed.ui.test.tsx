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
const { default: Hub } = await import('../src/components/InterstellarExploration/InterstellarHub');
const { ElfPicker } = await import('../src/components/shared/ElfPicker');
const E = await import('../src/modes/interstellar/v2/engine');
const { encodeRunCode } = await import('../src/modes/interstellar/v2/seed');
const { SUIT_CATALOG } = await import('../src/data/suitsAndEyewears');
const { DEFAULT_ELVES } = await import('../src/data/defaultElvesLoaded');
const pool = DEFAULT_ELVES;
const R_dup = (e: any): number => Math.max(0, Math.floor(Number(e?.dup?.stat) || 0));
const root = createRoot(document.getElementById('root')!);
const sleep = (ms: number) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const qa = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const button = (label: string | RegExp) => qa('button').find(b => typeof label === 'string' ? b.textContent?.trim() === label : label.test(b.textContent || ''));
const click = async (el: Element | null | undefined, what = 'element') => { assert.ok(el, what); await act(async () => { (el as HTMLElement).click(); }); };
const fire = async (el: Element, type: string, init: any = {}) => act(async () => { el.dispatchEvent(new dom.window.Event(type, { bubbles: true, cancelable: true, ...init })); });
const setValue = async (el: HTMLInputElement, v: string) => { const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!; await act(async () => { set.call(el, v); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }); };
const until = async (cond: () => boolean, what: string) => { for (let i = 0; i < 40 && !cond(); i++) await sleep(50); assert.ok(cond(), what); };
const stored = () => E.loadRunV2(localStorage)!;
const runProps = { allElves: pool, startingDiamonds: 3, initialEquipType: 'suit' as const, initialEquipId: '', selectedModifiers: [] as string[], onEndRun: () => {}, onStartBattle: () => {} };

/** 地圖上的局面：3 出戰＋6 倉庫，其中一隻陣亡 */
function seededRun(scene: 'map' | 'prelude' = 'map'): E.RunV2 {
  let run = E.createRun({ pool, equipType: 'suit', equipId: '', modifiers: [], startingShards: 3, seed: 99 });
  if (run.scene.kind === 'draft') for (const id of run.scene.offer.slice(0, 3)) run = E.toggleDraft(run, id);
  run = E.confirmDraft(run, pool);
  const extra = E.bannablePool(pool).filter(e => !run.team.some(t => t.id === e.id)).slice(0, 6).map((e, i) => ({ ...e, battleId: `st-${i}`, currentHp: i === 5 ? 0 : e.maxHp }) as any);
  const base = { ...run, team: [...run.team, ...extra] };
  return scene === 'map' ? { ...base, scene: { kind: 'map' } as any }
    : { ...base, scene: { kind: 'prelude', encounter: { kind: 'combat', title: '測試', enemies: [{ id: String(pool[3].id), affixes: [] }], scale: 1.2, hpScale: 2.5 } } as any };
}
const mount = async (el: React.ReactElement) => { await act(async () => root.render(null)); await act(async () => root.render(el)); await sleep(100); };
const slot = (id: string) => q(`[data-member="${id}"]`);

try {
  // ───────── 背包／倉庫（迎戰前也可存取）
  for (const sceneKind of ['map', 'prelude'] as const) {
    localStorage.clear(); const seeded = seededRun(sceneKind); localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(seeded));
    await mount(React.createElement(Run, runProps));
    await click(button(/^隊伍/), '隊伍鈕');
    const storageIds = () => qa('[data-bag-slot="storage"]').map(e => e.dataset.member!);
    assert.equal(storageIds().length, 6, `${sceneKind}：倉庫可見且 6 隻`);
    assert.ok(qa('[data-bag-slot="storage"]').every(c => { const put = [...c.querySelectorAll('button')].find(b => b.textContent === '放入背包') as HTMLButtonElement; return put && !put.disabled; }), `${sceneKind}：倉庫每一隻都能直接放入背包（待命有空位）`);
    // 搜尋：以名稱縮小倉庫
    const first = seeded.team[3]; const search = q<HTMLInputElement>('input[aria-label="搜尋精靈"]')!;
    await setValue(search, first.name!.slice(0, 2));
    assert.ok(storageIds().includes('st-0') && storageIds().length < 6, `${sceneKind}：搜尋篩選倉庫`);
    await setValue(search, '');
    // 屬性篩選
    await click(button(/屬性篩選/), '屬性篩選'); const t = first.type.split(/[.·・/／]/)[0];
    const chip = qa('button').find(b => b.textContent?.trim() === t); assert.ok(chip, `屬性鈕 ${t}`); await click(chip);
    assert.ok(storageIds().every(id => seeded.team.find(e => e.battleId === id)!.type.includes(t)), `${sceneKind}：屬性篩選只留 ${t}`);
    await click(button('全部'));
    // 點選互換：倉庫 st-0 ↔ 首發
    const starter = E.bagLists(seeded).lineup[0];
    await click(slot('st-0'), 'st-0'); await click(slot(starter), '首發');
    let l = E.bagLists(stored()); assert.equal(l.lineup[0], 'st-0', `${sceneKind}：倉庫成員直接換進出戰`); assert.ok(l.storage.includes(starter));
    // 拖拉互換：st-1 拖到 lineup 第 2 格
    const second = E.bagLists(stored()).lineup[1];
    await fire(slot('st-1')!, 'dragstart'); await fire(slot(second)!, 'dragover'); await fire(slot(second)!, 'drop'); await fire(slot('st-1')!, 'dragend');
    l = E.bagLists(stored()); assert.equal(l.lineup[1], 'st-1', `${sceneKind}：拖拉換位`); assert.ok(l.storage.includes(second));
    // 陣亡者不可拖進出戰
    const before = JSON.stringify(E.bagLists(stored()));
    await fire(slot('st-5')!, 'dragstart'); await fire(slot('st-1')!, 'dragover'); await fire(slot('st-1')!, 'drop');
    assert.equal(JSON.stringify(E.bagLists(stored())), before, '陣亡者不能換進出戰');
    // 更換視窗：從倉庫挑一隻換掉出戰第 3 格
    const third = E.bagLists(stored()).lineup[2];
    await click(qa(`[data-member="${third}"] button`).find(b => b.textContent === '更換'), '更換鈕');
    const dlg = q('[role=dialog][aria-label=更換精靈]')!; assert.ok(dlg);
    assert.ok([...dlg.querySelectorAll('button')].some(b => b.disabled), '陣亡者在更換清單中不可選');
    const pick = [...dlg.querySelectorAll('button')].find(b => !b.disabled && b.textContent!.includes('倉庫'))!;
    await click(pick); assert.equal(q('[role=dialog][aria-label=更換精靈]'), null, '選定後關閉');
    assert.ok(!E.bagLists(stored()).lineup.includes(third) && E.bagLists(stored()).storage.includes(third), `${sceneKind}：更換後原成員進倉庫`);
    assert.equal(E.bagLists(stored()).lineup.length, 3);
    await click(button('闔上'));
  }

  // ───────── 套裝獨立頁、橫向卡片、鍵盤、特權
  localStorage.clear();
  const hubProps = { allElves: pool, onBack: () => {}, onStartBattle: () => {} };
  await mount(React.createElement(Hub, hubProps));
  await click(button('啟程'), '啟程'); await until(() => !!q('[data-testid=suit-rail]'), '套裝頁');
  const cards = qa('[role=option][data-suit]'); assert.equal(cards.length, Object.keys(SUIT_CATALOG).length, '每個套裝一張卡');
  assert.ok(cards.every(c => c.textContent!.includes('CORRIDOR PERK') || c.textContent!.includes('Corridor Perk') || /✦/.test(c.textContent!)), '每張卡顯示回廊特權');
  assert.equal(cards.filter(c => c.getAttribute('aria-selected') === 'true').length, 1);
  const sel0 = cards.find(c => c.getAttribute('aria-selected') === 'true')!.dataset.suit;
  const rail = q('[data-testid=suit-rail]')!;
  await act(async () => { rail.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
  const sel1 = qa('[role=option][data-suit]').find(c => c.getAttribute('aria-selected') === 'true')!.dataset.suit;
  assert.notEqual(sel1, sel0, '鍵盤右鍵切到下一張'); assert.equal(sel1, Object.keys(SUIT_CATALOG)[1]);
  await act(async () => { rail.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
  assert.equal(qa('[role=option][data-suit]').find(c => c.getAttribute('aria-selected') === 'true')!.dataset.suit, sel0, '左鍵回上一張');
  await click(qa('[role=option][data-suit="eternal_starlight"]')[0]);   // 星光永恆：起始任意招募令 +1
  await click(button('下一步'), '下一步'); await until(() => !!q('#ecl-seed'), '設定頁');
  assert.ok(/星晶\s*3/.test(document.body.textContent!) && /招募令\s*1/.test(document.body.textContent!), '起始資源：星晶 3（保留為貨幣）、套裝特權任意招募令 1');

  // ───────── 種子／N 等級／禁用
  const seedInput = q<HTMLInputElement>('#ecl-seed')!; await setValue(seedInput, '31337');
  const range = q<HTMLInputElement>('input[type=range]')!; await setValue(range, '15');
  assert.ok(document.body.textContent!.includes('N15'));
  await click(button(/＋ 禁用/)); const banDlg = q('[role=dialog][aria-label=選擇禁用精靈]')!; assert.ok(banDlg);
  const names: string[] = []; // 禁用 1 隻（N15 名額 1），選完自動關閉
  const firstBan = [...banDlg.querySelectorAll('button')].find(b => b.textContent!.length > 2 && !/完成|屬性篩選/.test(b.textContent!))!;
  names.push(firstBan.textContent!); await click(firstBan);
  assert.equal(q('[role=dialog][aria-label=選擇禁用精靈]'), null, '名額用完自動關閉');
  assert.ok((button(/＋ 禁用/) as HTMLButtonElement).disabled, '名額用完不能再禁');
  await setValue(range, '3');  // N3：名額 5，已選的保留
  assert.ok(!(button(/＋ 禁用/) as HTMLButtonElement).disabled);
  await setValue(range, '18'); assert.ok(document.body.textContent!.includes('0 / 0'), 'N18 禁用名額歸零並清空'); await setValue(range, '15');
  await click(button(/＋ 禁用/)); const again = [...q('[role=dialog][aria-label=選擇禁用精靈]')!.querySelectorAll('button')].find(b => b.textContent!.length > 2 && !/完成|屬性篩選/.test(b.textContent!))!;
  await click(again);
  // 局碼：複製後貼回，裝束／等級／禁用／種子都帶回來
  const code = encodeRunCode({ seed: 31337, nLevel: 15, equipType: 'suit', equipId: 'sky_cloud', modifiers: ['no_potions'], bans: [String(pool[5].id)], poolSig: E.poolSigOf(pool) });
  await setValue(seedInput, code);
  assert.ok(document.body.textContent!.includes('N15') && /禁用[\s\S]*1 \/ 1/.test(document.body.textContent!), '局碼帶回 N 等級與禁用');
  assert.ok(!document.body.textContent!.includes('局碼格式不正確'));
  await setValue(seedInput, 'ECL1.壞掉'); assert.ok(document.body.textContent!.includes('局碼格式不正確')); assert.ok((button('點燃第一盞燈') as HTMLButtonElement).disabled, '壞局碼不能開局');
  await setValue(seedInput, code);
  await click(button('點燃第一盞燈')); await until(() => !!E.loadRunV2(localStorage), '開局存檔');
  const run = stored(); assert.equal(run.seed, 31337); assert.equal(run.nLevel, 15); assert.deepEqual(run.bans, [String(pool[5].id)]); assert.equal(run.equipId, 'sky_cloud'); assert.deepEqual(run.modifiers, ['no_potions']);
  assert.ok(run.scene.kind === 'draft' && !run.scene.offer.includes(String(pool[5].id)), '被禁用者不在選秀');
  // 同一局碼再開一局 → 地圖與選秀完全相同
  const again1 = E.createRun({ pool, equipType: 'suit', equipId: 'sky_cloud', modifiers: ['no_potions'], startingShards: 3, seed: 31337, nLevel: 15, bans: [String(pool[5].id)] });
  assert.equal(JSON.stringify(again1.map), JSON.stringify(run.map)); assert.deepEqual((again1.scene as any).offer, (run.scene as any).offer);

  // ───────── 首頁背包的共用挑選器
  const picked: string[] = [];
  await mount(React.createElement(ElfPicker as any, { elves: pool.slice(0, 20), onPick: (e: any) => picked.push(e.name), getKey: (e: any) => String(e.id), renderItem: (e: any) => React.createElement('span', null, e.name), itemClassName: 'x' }));
  const total = qa('button.x').length; assert.equal(total, 20);
  await setValue(q<HTMLInputElement>('input[aria-label="搜尋精靈"]')!, pool[0].name!.slice(0, 2)); assert.ok(qa('button.x').length < total && qa('button.x').length >= 1);
  await click(qa('button.x')[0]); assert.equal(picked.length, 1);

  // ───────── 星晶招募與進階介面：價格、不足提示、持令免費、背包卡進階鈕
  {
    localStorage.clear(); const seeded = { ...seededRun('map'), shards: 4, recruitCount: 1 } as E.RunV2; localStorage.setItem(E.RUN_KEY_V2, JSON.stringify(seeded));
    await mount(React.createElement(Run, runProps));
    await click(button(/^招募/), '招募分頁鈕'); await until(() => !!q('[data-testid=shard-count]'), '招募頁');
    assert.ok(q('[data-testid=shard-count]')!.textContent!.includes('4'), '招募頁顯示星晶 4');
    await click(q('[data-testid=recruit-shards]'), '星晶招募'); await until(() => !!q('[data-testid=recruit-picker]'), '招募挑選視窗');
    const prices = qa('[data-testid=recruit-picker] [data-price]').map(e => e.dataset.price);
    assert.ok(prices.length > 20 && prices.every(x => /^\d+$/.test(x!)), '每張卡標星晶價'); assert.equal(Math.min(...prices.map(Number)), 3, '招募過 1 次：基價 2+1');
    assert.ok(qa('[data-testid=recruit-picker] button[disabled]').length > 0, '星晶不足者停用（頂階 Ⅳ 5）');
    const cheap = qa('[data-testid=recruit-picker] button').find(b => b.querySelector('[data-price="3"]'))!; await click(cheap, '招募一隻 3 星晶');
    await until(() => stored().team.length === seeded.team.length + 1, '招募入隊'); assert.equal(stored().shards, 1); assert.equal(stored().recruitCount, 2);
    // 持有任意令：以令招募時價籤顯示「免費」，且不扣星晶
    const withTok = E.mintToken(stored(), { kind: 'any', types: [], match: 'has', tier: 'apex' }); localStorage.setItem(E.RUN_KEY_V2, JSON.stringify({ ...withTok, scene: { kind: 'map' } }));
    await mount(React.createElement(Run, runProps)); await click(button(/^招募/), '招募分頁鈕');
    await click(button('免費招募'), '用令'); await until(() => !!q('[data-testid=recruit-picker]'), '令的挑選視窗');
    assert.ok(qa('[data-testid=recruit-picker] [data-price="free"]').length > 5 && qa('[data-testid=recruit-picker] [data-price]:not([data-price="free"])').length === 0, '持令時一律顯示「免費」');
    await click(qa('[data-testid=recruit-picker] button').find(b => b.querySelector('[data-price="free"]')), '招募'); await until(() => stored().tokens.length === 0, '令消耗'); assert.equal(stored().shards, 1, '免費：星晶不變');
    // 背包卡的進階鈕：價格在 tooltip，二選一，扣星晶
    localStorage.setItem(E.RUN_KEY_V2, JSON.stringify({ ...stored(), shards: 3 }));
    await mount(React.createElement(Run, runProps)); await click(button(/^隊伍/), '隊伍鈕');
    const adv = q<HTMLButtonElement>('[data-advance]')!; assert.ok(adv && !adv.disabled && /強化 3 星晶/.test(adv.title), '進階鈕與價格 tooltip'); await click(adv);
    await until(() => !!q('[data-testid=advance-dialog]'), '進階視窗');
    const stat = q<HTMLButtonElement>('[data-dup=stat]')!, ppb = q<HTMLButtonElement>('[data-dup=pp]')!; assert.ok(!stat.disabled && ppb.disabled, '3 星晶可強化（3），買不起 PP×2（4）');
    assert.equal(stat.querySelector('[data-price]')!.dataset.price, '3');
    await click(stat); await until(() => stored().shards === 0, '進階扣星晶'); assert.equal(R_dup(stored().team.find(e => E.bagIdOf(e) === adv.dataset.advance)!), 1);
    await mount(React.createElement(Run, runProps)); await click(button(/^隊伍/), '隊伍鈕'); assert.ok(q<HTMLButtonElement>('[data-advance]')!.disabled, '星晶不足時進階鈕停用');
  }
  console.log('星蝕回廊 UI：背包與倉庫（拖拉、點選、搜尋、屬性篩選、更換）、套裝頁、種子／N／禁用／局碼、共用挑選器通過');
} finally { await act(async () => root.unmount()); dom.window.close(); }
