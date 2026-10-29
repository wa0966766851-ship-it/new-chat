import assert from 'node:assert/strict';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { Elf } from '../src/types';
import { hiddenFromViewer, viewerMaskTermsForMode, maskViewerText, maskViewerDeep, maskElfIdentity, UNKNOWN_ELF, UNKNOWN_SKILL } from '../src/battle/viewerPerspective';
import { BattleViewModeContext } from '../src/battle/viewerMode';
import { ElfReadOnlyProfile } from '../src/components/ElfReadOnlyProfile';
import { ElfAvatar } from '../src/components/SeerImages';
import { BattleIntro } from '../src/components/battle/BattleIntro';
import { getActiveEffects } from '../src/components/StatusInspector';

let passed = 0;
const check = (name: string, run: () => void | Promise<void>) => Promise.resolve(run()).then(() => { passed++; console.log(`✓ ${name}`); });

const stats = { hp: 120, atk: 170, def: 125, spatk: 170, spdef: 125, speed: 140 };
const SECRET = { name: '機密譜尼奇', type: '神秘奇屬', soul: '機密魂印名', soulDesc: '機密魂印描述', skill: '機密絕殺技', trait: '機密特質名' };
const elf = (extra: Partial<Elf> = {}): Elf => ({
  id: 'hid', battleId: 'hid', name: SECRET.name, type: SECRET.type, level: 100, baseStats: stats, calculatedStats: stats, currentHp: 777, maxHp: 888,
  soulMark: { name: SECRET.soul, description: SECRET.soulDesc, effectType: 'custom', effectValue: 0 },
  alienTraits: { generalTrait: { name: SECRET.trait, description: '機密特質描述' } },
  skills: [{ name: SECRET.skill, category: '特殊', type: '電', power: 120, pp: 3, maxPp: 20, description: '機密技能描述', effectType: 'none', effectDetail: '' }],
  ...extra,
} as any);
const leaks = (html: string) => Object.values(SECRET).concat(['機密魂印描述', '機密技能描述']).filter(t => html.includes(t));
const inMode = (mode: 'PVE' | 'PVP', node: React.ReactElement) => renderToStaticMarkup(<BattleViewModeContext.Provider value={mode}>{node}</BattleViewModeContext.Provider>);
const concealed = elf({ isConcealed: true });

await check('單一判斷函式：viewer × owner × mode', () => {
  // PVE：持有方（viewer p1）可見、對方不可見
  assert.equal(hiddenFromViewer(concealed, 'p1', 'PVE'), false);
  assert.equal(hiddenFromViewer(concealed, 'p2', 'PVE'), true);
  assert.equal(hiddenFromViewer(concealed, 'p2', 'PVE', 'p2'), false, '以 p2 為 viewer 時 p2 是持有方');
  assert.equal(hiddenFromViewer(concealed, 'p1', 'PVE', 'p2'), true);
  assert.equal(hiddenFromViewer(concealed, undefined, 'PVE'), true, '未指定持有方保守隱藏');
  // PVP：全局隱藏，雙方都看不到
  for (const owner of ['p1', 'p2'] as const) for (const viewer of ['p1', 'p2'] as const) assert.equal(hiddenFromViewer(concealed, owner, 'PVP', viewer), true);
  // 未隱匿者永遠可見
  assert.equal(hiddenFromViewer(elf(), 'p2', 'PVP'), false);
});

await check('文字遮蔽詞：PVE 只遮對方隊伍，PVP 遮雙方', () => {
  const mine = elf({ isConcealed: true, name: '己方隱匿甲', skills: [{ ...elf().skills[0], name: '己方隱匿招' }] });
  const theirs = elf({ isConcealed: true });
  const text = '【己方隱匿甲】使用【己方隱匿招】；【機密譜尼奇】使用【機密絕殺技】';
  assert.equal(maskViewerText(text, viewerMaskTermsForMode([mine], [theirs], 'PVE')), `【己方隱匿甲】使用【己方隱匿招】；【${UNKNOWN_ELF}】使用【${UNKNOWN_SKILL}】`);
  assert.equal(maskViewerText(text, viewerMaskTermsForMode([mine], [theirs], 'PVP')), `【${UNKNOWN_ELF}】使用【${UNKNOWN_SKILL}】；【${UNKNOWN_ELF}】使用【${UNKNOWN_SKILL}】`);
});

await check('精靈詳情彈窗：PVE 持有方可見', () => {
  const html = inMode('PVE', <ElfReadOnlyProfile elf={concealed} battleSide="p1" onClose={() => {}} />);
  assert.ok(html.includes(SECRET.name) && html.includes(SECRET.soulDesc), '持有方照常可見');
});
await check('精靈詳情彈窗：PVE 對方 HTML 不含任何隱藏資訊', () => {
  const html = inMode('PVE', <ElfReadOnlyProfile elf={concealed} battleSide="p2" onClose={() => {}} />);
  assert.deepEqual(leaks(html), []); assert.match(html, /未知精靈/);
});
await check('精靈詳情彈窗：PVP 雙方皆不含隱藏資訊（含 battleMode 屬性覆寫）', () => {
  for (const side of ['p1', 'p2'] as const) {
    assert.deepEqual(leaks(inMode('PVP', <ElfReadOnlyProfile elf={concealed} battleSide={side} onClose={() => {}} />)), []);
    assert.deepEqual(leaks(renderToStaticMarkup(<ElfReadOnlyProfile elf={concealed} battleSide={side} battleMode="PVP" onClose={() => {}} />)), []);
  }
});

await check('頭像／立繪：aria-label、alt、title 不含名稱（PVE 對方、PVP 雙方）', () => {
  for (const kind of ['head', 'body'] as const) {
    assert.deepEqual(leaks(inMode('PVE', <ElfAvatar elf={concealed} battleSide="p2" kind={kind} />)), []);
    for (const side of ['p1', 'p2'] as const) assert.deepEqual(leaks(inMode('PVP', <ElfAvatar elf={concealed} battleSide={side} kind={kind} />)), []);
  }
  assert.ok(inMode('PVE', <ElfAvatar elf={concealed} battleSide="p1" kind="head" />).includes(SECRET.name), 'PVE 持有方頭像可帶名稱');
});

await check('入戰動畫：PVE 對方遮蔽、持有方可見；PVP 雙方遮蔽', () => {
  const plan = { play: true, ms: 80, variant: 'full' } as any;
  const intro = (mode: 'PVE' | 'PVP', p1: Elf, p2: Elf) => inMode(mode, <BattleIntro p1={p1} p2={p2} format="單挑 1V1" plan={plan} onDone={() => {}} />);
  const plain = elf({ name: '普通乙', type: '火', isConcealed: false, soulMark: undefined as any, alienTraits: undefined as any, skills: [{ ...elf().skills[0], name: '普通招', description: '' }] });
  assert.deepEqual(leaks(intro('PVE', plain, concealed)), []);
  assert.ok(intro('PVE', concealed, plain).includes(SECRET.name), 'PVE 持有方（p1）入戰動畫可見');
  assert.deepEqual(leaks(intro('PVP', concealed, plain)), []);
  assert.deepEqual(leaks(intro('PVP', plain, concealed)), []);
});

await check('狀態檢視：PVE 對方無資料、PVP 雙方無資料', () => {
  const state = { p1: concealed, p2: concealed, p1Team: [concealed], p2Team: [concealed] };
  assert.deepEqual(getActiveEffects('p2', state, 'PVE'), []);
  assert.deepEqual(getActiveEffects('p1', state, 'PVP'), []);
  assert.ok(getActiveEffects('p1', state, 'PVE').length >= 0);
});

await check('結算資料：摘要與隊伍替身不含隱藏名稱／技能', () => {
  const terms = viewerMaskTermsForMode([], [concealed], 'PVE');
  const summary = { heroes: [{ name: SECRET.name, label: SECRET.skill, dealt: 99 }], top: [{ sourceName: SECRET.name, label: `${SECRET.skill}` }] };
  const masked = maskViewerDeep(summary, terms);
  assert.deepEqual(leaks(JSON.stringify(masked)), []);
  assert.equal(masked.heroes[0].dealt, 99, '數字不變');
  const stand = maskElfIdentity(concealed, 'p2', 'PVE');
  assert.deepEqual(leaks(JSON.stringify(stand)), []);
  assert.equal(stand.battleId, 'hid', '保留對應用 id');
  assert.equal(maskElfIdentity(concealed, 'p1', 'PVE'), concealed, '持有方結算不變');
  assert.deepEqual(leaks(JSON.stringify(maskElfIdentity(concealed, 'p1', 'PVP'))), [], 'PVP 持有方也遮蔽');
});

// 背包挑選器（portal，需 DOM）
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.fetch = (async () => { throw new Error('offline'); }) as any;
const { createRoot } = await import('react-dom/client');
const { default: BagElfPickerModal } = await import('../src/components/battle/BagElfPickerModal');
const root = createRoot(document.getElementById('root')!);
const mine = elf({ id: 'mine', battleId: 'mine', name: '我方普通甲', type: '火', isConcealed: false, soulMark: undefined as any, alienTraits: undefined as any, skills: [{ ...elf().skills[0], name: '普通招', description: '' }] });
for (const mode of ['PVE', 'PVP'] as const) {
  await check(`背包挑選器 ${mode}：不可見的隱匿精靈不出現在 DOM`, async () => {
    await act(async () => root.render(<BattleViewModeContext.Provider value={mode}>
      <BagElfPickerModal teams={{ p1: [mine], p2: [concealed] }} title="選擇" onPick={() => {}} onClose={() => {}} /></BattleViewModeContext.Provider>));
    assert.deepEqual(leaks(document.body.innerHTML), []);
    assert.ok(document.body.innerHTML.includes('我方普通甲'));
    await act(async () => root.render(<></>));
  });
}
await check('背包挑選器 PVE：持有方自己的隱匿精靈可見', async () => {
  await act(async () => root.render(<BagElfPickerModal teams={{ p1: [concealed], p2: [mine] }} title="選擇" onPick={() => {}} onClose={() => {}} />));
  assert.ok(document.body.innerHTML.includes(SECRET.name));
});
await act(async () => root.unmount());
console.log(`隱匿可見性測試 ${passed} 項通過。`);
