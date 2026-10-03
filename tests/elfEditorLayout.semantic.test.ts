import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import type { Elf } from '../src/types';
import { getTemplateReviewReason, getTemplateTimingLabel } from '../src/utils/templateReview';
import { REAL_CARD_EFFECT_MODULES } from '../src/data/cardTemplates';
import { calculateElfStats } from '../src/utils/statCalculator';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  alert: () => {}, requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout });
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => Response.json({ enabled: false });
const { createRoot } = await import('react-dom/client');
const { default: ElfEditor } = await import('../src/components/ElfEditor');
const { EffectLibraryModal } = await import('../src/components/EffectLibraryModal');
const stats = { hp: 120, atk: 170, def: 125, spatk: 170, spdef: 125, speed: 140 };
const fixture = { id: 'editor-fixture', name: '測試精靈', type: '神秘.電', level: 100,
  baseStats: stats, calculatedStats: stats, currentHp: 992, maxHp: 992,
  ivs: { hp: 25, atk: 26, def: 27, spatk: 28, spdef: 29, speed: 30 },
  height: 185, weight: 70, gender: '雄性', path: '/test/rey.png', description: '背景資料',
  resistances: { damageResist: { crit: 20, fixed: 25, percent: 30 }, statusResist: { allImmune: false, selectedStatuses: ['麻痺'], slots: [{ id: 'c1', category: 'control', status: '麻痺', rate: 30 }] } },
  soulMark: { name: '異', description: '回合開始時令自身攻擊+2', effectType: 'custom', effectValue: 0 },
  alienTraits: { exclusiveTrait: { name: '神明', description: '原專屬描述' }, exclusiveTraits: [{ name: '雷神', description: '另一專屬描述' }] },
  skills: [{ name: '測試技能', category: '特殊', type: '電', power: 120, pp: 20, maxPp: 20, description: '令對手麻痺', effectType: 'none', effectDetail: '' }],
  skillPool: [{ name: '預備技能', category: '物理', type: '普通', power: 70, pp: 10, maxPp: 10, description: '', effectType: 'none', effectDetail: '' }],
} as Elf;
let passed = 0, saved: Elf | undefined, back = 0, exportedBlob: Blob | undefined;
const originalCreateUrl = URL.createObjectURL, originalRevokeUrl = URL.revokeObjectURL;
URL.createObjectURL = blob => { exportedBlob = blob as Blob; return 'blob:test-export'; };
URL.revokeObjectURL = () => {};
const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
dom.window.HTMLAnchorElement.prototype.click = () => {};
async function check(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`); }
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  assert.ok(button, `找不到按鈕 ${text}`);
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
}
async function input(id: string, value: string) {
  const node = document.getElementById(id) as HTMLInputElement;
  assert.ok(node, `找不到欄位 ${id}`);
  const prototype = node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const root = createRoot(document.getElementById('root')!);
try {
  await act(async () => root.render(React.createElement(ElfEditor, { initialElf: fixture, onSaveElf: e => { saved = e; }, onBack: () => { back++; } })));
  await check('編輯預設僅基本資料；不建立特性與技能欄位', () => {
    assert.equal(document.querySelectorAll('nav[aria-label="手動編輯分類"] button').length, 5);
    assert.ok(document.getElementById('manual-elf-name'));
    assert.equal(document.getElementById('manual-soul-desc'), null);
  });
  await check('基本資料修改即更新草稿摘要', async () => {
    await input('manual-elf-name', '更新測試精靈');
    await input('manual-stat-hp', '140');
    assert.match(document.querySelector('aside[aria-label="精靈草稿摘要"]')!.textContent!, /更新測試精靈/);
  });
  await check('分類切換保留基本資料與特性輸入', async () => {
    await click('特性與特質');
    await input('manual-soul-desc', '回合開始時令自身攻擊+3');
    await click('基本資料');
    assert.equal((document.getElementById('manual-stat-hp') as HTMLInputElement).value, '140');
    assert.equal((document.getElementById('manual-elf-name') as HTMLInputElement).value, '更新測試精靈');
    await click('特性與特質');
    assert.equal((document.getElementById('manual-soul-desc') as HTMLTextAreaElement).value, '回合開始時令自身攻擊+3');
  });
  await check('訓練／技能／抗性分類皆可開啟，基本欄位不重複', async () => {
    for (const section of ['訓練與刻印', '技能', '抗性']) {
      await click(section);
      assert.ok(document.getElementById('manual-section-content')!.textContent!.length > 20);
      assert.equal(document.getElementById('manual-elf-name'), null);
    }
  });
  await check('匯出完整草稿，保留身高體重／抗性／特質／技能庫，不執行儲存', async () => {
    await click('匯出圖紙');
    assert.ok(exportedBlob);
    const data = JSON.parse(await exportedBlob.text());
    assert.equal(data.schemaVersion, 2);
    assert.equal(data.manualElf.name, '更新測試精靈');
    for (const field of ['height', 'weight', 'gender', 'path', 'description', 'resistances', 'ivs'] as const) {
      assert.deepEqual(data.manualElf[field], fixture[field]);
    }
    assert.deepEqual(data.manualElf.alienTraits.exclusiveTraits, fixture.alienTraits?.exclusiveTraits);
    assert.ok(data.manualElf.skillPool.some((skill: { name: string }) => skill.name === '預備技能'));
    assert.equal(saved, undefined); assert.equal(back, 0);
  });
  await check('儲存跨頁草稿，保留個體值／其他專屬特質／預備技能', async () => {
    await click('儲存精靈修改');
    assert.ok(saved);
    assert.equal(saved.name, '更新測試精靈');
    assert.equal(saved.baseStats.hp, 140);
    assert.equal(saved.soulMark.description, '回合開始時令自身攻擊+3');
    assert.deepEqual(saved.ivs, fixture.ivs);
    assert.deepEqual(saved.alienTraits?.exclusiveTraits, fixture.alienTraits?.exclusiveTraits);
    assert.ok(saved.skillPool?.some(skill => skill.name === '預備技能'));
    const calculated = calculateElfStats(saved.baseStats, 100, saved.ivs, saved.evs, saved.natureModifiers, saved.inscriptions, saved.guildBonuses, saved.hasAnnualBonus);
    assert.equal(saved.maxHp, calculated.hp);
    assert.equal(saved.currentHp, calculated.hp);
    assert.equal(back, 1);
  });
  await check('離開頁面不自動再次儲存', async () => {
    const previous = saved;
    await act(async () => document.getElementById('btn-editor-back')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal(saved, previous); assert.equal(back, 2);
  });
  await check('匯出與正式儲存的精靈資料一致；重新開啟保留修改', async () => {
    assert.ok(saved && exportedBlob);
    assert.deepEqual(JSON.parse(await exportedBlob.text()).manualElf, JSON.parse(JSON.stringify(saved)));
    await act(async () => root.render(React.createElement(ElfEditor, { key: 'reopen', initialElf: saved, onSaveElf: e => { saved = e; }, onBack: () => {} })));
    assert.equal((document.getElementById('manual-elf-name') as HTMLInputElement).value, '更新測試精靈');
    await click('特性與特質');
    assert.equal((document.getElementById('manual-soul-desc') as HTMLTextAreaElement).value, '回合開始時令自身攻擊+3');
  });
  await check('僅有其他專屬特質陣列時儲存不會遺失整組', async () => {
    const arrayOnly = { ...fixture, id: 'array-only', alienTraits: { exclusiveTraits: fixture.alienTraits!.exclusiveTraits } };
    await act(async () => root.render(React.createElement(ElfEditor, { key: 'array-only', initialElf: arrayOnly, onSaveElf: e => { saved = e; }, onBack: () => {} })));
    await click('儲存精靈修改');
    assert.deepEqual(saved?.alienTraits?.exclusiveTraits, fixture.alienTraits?.exclusiveTraits);
  });
  await check('抗性選單只有一個麻痺顯示項，支援魘味且不改寫舊存檔 key', async () => {
    const legacy = { ...fixture, id: 'legacy-resistance', resistances: {
      ...fixture.resistances!, statusResist: { allImmune: true, selectedStatuses: ['麻痹', '中毒'], slots: [
        { id: 'c1', category: 'control' as const, status: '麻痹', rate: 20 },
        { id: 'w1', category: 'weakening' as const, status: '中毒', rate: 30 },
      ] },
    } };
    await act(async () => root.render(React.createElement(ElfEditor, { key: 'legacy', initialElf: legacy, onSaveElf: e => { saved = e; }, onBack: () => {} })));
    await click('抗性');
    const control = document.querySelector('select[aria-label="控制類抗性 c1"]') as HTMLSelectElement;
    const weakening = document.querySelector('select[aria-label="弱化類抗性 w1"]') as HTMLSelectElement;
    assert.equal([...control.options].filter(option => option.textContent === '麻痺').length, 1);
    assert.equal(control.value, '麻痹');
    assert.ok([...weakening.options].some(option => option.value === '魘昧'), '官方名稱魘昧');
    await click('儲存精靈修改');
    assert.deepEqual(saved?.resistances, legacy.resistances);
    assert.deepEqual(fixture.resistances?.statusResist.selectedStatuses, ['麻痺']);
  });
  await check('新建草稿重複匯出與儲存保持同一身分，不產生多份精靈', async () => {
    await act(async () => root.render(React.createElement(ElfEditor, { key: 'new-draft', initialTab: 'manual', onSaveElf: e => { saved = e; }, onBack: () => {} })));
    await click('匯出圖紙');
    const first = JSON.parse(await exportedBlob!.text()).manualElf;
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 10000;
      await click('匯出圖紙');
      assert.deepEqual(JSON.parse(await exportedBlob!.text()).manualElf, first);
      await click('儲存自訂精靈卡牌');
      assert.deepEqual(JSON.parse(JSON.stringify(saved)), first);
    } finally { Date.now = originalNow; }
  });
  let closed = 0;
  const modalProps = { isOpen: true, onClose: () => { closed++; }, onSelectModule: () => { throw new Error('待確認資料不應引用'); } };
  const opener = document.createElement('button'); opener.textContent = '測試開啟者'; document.body.appendChild(opener); opener.focus();
  await act(async () => root.render(React.createElement(EffectLibraryModal, modalProps)));
  await check('效果庫移出頁面堆疊層，鍵盤焦點留在視窗，Escape 可關閉', async () => {
    const dialog = document.querySelector('[role="dialog"]')!;
    assert.ok(dialog.parentElement!.parentElement === document.body, '視窗應直接掛載於 body');
    const controls = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    assert.ok(document.activeElement === controls[0], '開啟後關閉按鈕取得焦點');
    controls[controls.length - 1].focus();
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    assert.ok(document.activeElement === controls[0], `Tab 回到首個按鈕：實際 ${document.activeElement?.outerHTML.slice(0, 160)}`);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    assert.ok(document.activeElement === controls[controls.length - 1], 'Shift+Tab 回到末個按鈕');
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(closed, 1);
  });
  await check('待確認原始資料保留且禁止引用；分類不累積卡片', async () => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent?.startsWith('待確認資料'))!;
    await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    const disabled = [...document.querySelectorAll('button')].filter(b => b.textContent === '待原始文本確認');
    assert.ok(disabled.length > 0 && disabled.length <= 32);
    assert.ok(disabled.every(b => b.disabled));
    assert.match(document.querySelector('nav')!.textContent!, /第 1 \//);
  });
  await check('段落標題與有效效果保守分離，不刪除原資料', () => {
    assert.ok(getTemplateReviewReason('【修復】'));
    assert.ok(getTemplateReviewReason('自身選擇技能時：'));
    assert.equal(getTemplateReviewReason('每次登場時：恢復自身250點體力'), null);
    assert.equal(REAL_CARD_EFFECT_MODULES.length, 733);
    assert.equal(new Set(REAL_CARD_EFFECT_MODULES.map(m => m.id)).size, 733);
  });
  await check('未知時點不偽造技能使用時；被擊敗不顯示成受傷', () => {
    assert.equal(getTemplateTimingLabel('令自身下2回合增傷70%'), '待確認：需原段落時點');
    assert.equal(getTemplateTimingLabel('被擊敗時：令對手害怕'), '被擊敗時');
    assert.equal(getTemplateTimingLabel('使用技能時：回合結束時恢復體力'), '使用技能時');
  });
  await check('效果庫關閉清除視窗與鍵盤監聽，還原焦點；反覆開啟不累積', async () => {
    for (let cycle = 0; cycle < 8; cycle++) {
      await act(async () => root.render(React.createElement(EffectLibraryModal, { ...modalProps, isOpen: false })));
      assert.equal(document.querySelector('[role="dialog"]'), null);
      assert.ok(document.activeElement === opener, '關閉後還原開啟者焦點');
      const before = closed;
      document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.equal(closed, before);
      await act(async () => root.render(React.createElement(EffectLibraryModal, modalProps)));
      assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
      assert.ok(document.querySelectorAll('[role="dialog"] button').length <= 50);
    }
    await act(async () => root.render(React.createElement(EffectLibraryModal, { ...modalProps, isOpen: false })));
    opener.remove();
  });
} finally {
  await act(async () => root.unmount()); dom.window.close(); globalThis.fetch = originalFetch;
  URL.createObjectURL = originalCreateUrl; URL.revokeObjectURL = originalRevokeUrl;
  dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick;
}
console.log(`編輯排版／模板分類語意測試 ${passed} 項通過。`);
