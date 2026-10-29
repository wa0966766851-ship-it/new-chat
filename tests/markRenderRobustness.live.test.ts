// 印記渲染不崩潰（2026-10-30）。
//
// 真實事故：poem_chapter 在 MARK_DEFINITIONS 缺少 displayChar 與 name，
// effectViewModel.ts:63 的 `mark.displayChar || mark.name.slice(0,1)` 直接拋 TypeError，
// 導致「整個印記清單渲染失敗」—— 連其他正常印記也一起看不到。
//
// 這個測試確保：
// 1. poem_chapter 有 displayChar / name
// 2. 任何缺欄位的印記都不會讓渲染崩潰
// 3. 詩章能正常產出 view model
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { buildEffectViewModels } = await server.ssrLoadModule('/src/battle/effectViewModel.ts');
const { MARK_DEFINITIONS } = await server.ssrLoadModule('/src/battle/marks.ts');

let count = 0;
const check = (name: string, run: () => void) => { run(); count++; console.log(`✓ ${name}`); };

check('poem_chapter 定義有 displayChar 與 name', () => {
  const def = MARK_DEFINITIONS['poem_chapter'];
  assert.ok(def, '必須有 poem_chapter 定義');
  assert.equal(def.displayChar, '詩', 'displayChar 必須是「詩」');
  assert.equal(def.name, '詩章', 'name 必須是「詩章」');
  assert.equal(def.unit, '篇');
});

check('任何印記缺 displayChar/name 都不會崩潰（含 8 個已知靠 mark_add 傳值的）', () => {
  // 這些印記的 displayChar/name 由 resource_mark_add 建立時傳入，
  // 定義表本身可以沒有；但渲染層必須能容忍缺失。
  const missing: string[] = [];
  for (const [id, def] of Object.entries(MARK_DEFINITIONS)) {
    const d: any = def;
    if (!d.displayChar && !d.name) missing.push(id);
    // 用最小物件模擬「只靠定義表」的情況，必須不拋錯
    const views = buildEffectViewModels([{ id, count: 1, ...d } as any], [], undefined);
    assert.equal(views.length, 1, id + ' 必須能產出 view');
    assert.ok(views[0].shortLabel, id + ' 必須有 shortLabel');
  }
  console.log('   定義表缺 displayChar/name 的印記：' + (missing.length ? missing.join(', ') : '（無）'));
});

check('詩章印記能產出正確的 view model', () => {
  const mark: any = { id: 'poem_chapter', displayChar: '詩', name: '詩章', count: 1, unit: '篇',
    ownerBattleId: 'D1', scope: 'elf', clearable: false, persistsOffField: true, polarity: 'positive',
    source: '治癒.龍魂再臨 次元龍', effects: { poemHpSnapshots: [8000] } };
  const views = buildEffectViewModels([mark], [], 'D1');
  assert.equal(views.length, 1, '必須產生 1 個 view');
  assert.equal(views[0].label, '詩章');
  assert.equal(views[0].shortLabel, '詩');
  assert.equal(views[0].unit, '篇');
  assert.equal(views[0].value, 1);
});

check('缺 displayChar 與 name 的印記不會讓渲染崩潰', () => {
  const broken: any = { id: 'some_unknown_mark', count: 2, ownerBattleId: 'D1' };
  // 修復前這裡會拋 TypeError: Cannot read properties of undefined (reading 'slice')
  const views = buildEffectViewModels([broken], [], 'D1');
  assert.equal(views.length, 1, '必須仍產生 view');
  assert.equal(views[0].shortLabel, '印', 'fallback 必須是「印」');
  assert.equal(views[0].label, 'some_unknown_mark', 'label 退回 id');
});

check('一個壞印記不影響同批其他印記', () => {
  const good: any = { id: 'blk_永恆之水', displayChar: '水', name: '永恆之水', count: 3, unit: '道', ownerBattleId: 'D1', polarity: 'positive' };
  const broken: any = { id: 'broken_mark', count: 1, ownerBattleId: 'D1' };
  const views = buildEffectViewModels([good, broken], [], 'D1');
  assert.equal(views.length, 2, '兩個都要顯示');
  assert.ok(views.some(v => v.label === '永恆之水'), '永恆之水必須在');
  assert.ok(views.some(v => v.shortLabel === '印'), '壞印記也要有 fallback');
});

await server.close();
console.log(`\n印記渲染健壯性：${count} 項通過`);
