import { createHiddenElfHarness } from './helpers/hiddenElfScreen';

// 情境三：結算畫面（MVP、排行、技能 Top）不得洩漏不可見方。
// 與 PVE／PVP 情境分檔，單一 process 只掛載 2 次戰鬥畫面。
const h = await createHiddenElfHarness();
const { assert, check, finish, html, leaked, A, secA, secB } = h;

await check('結算畫面：PVE 對方隱匿的名稱／技能（MVP、排行、技能 Top）不出現；己方照常', async () => {
  const out = await html('PVE', false, true, 'p1_select', true);
  assert.ok(out.includes('data-testid="battle-result"'), '結算畫面有渲染');
  assert.deepEqual(leaked(out, secB), []);
  assert.ok(out.includes(A.name));
});

await check('結算畫面：PVP 雙方隱匿都不出現', async () => {
  const out = await html('PVP', true, true, 'p1_select', true);
  assert.ok(out.includes('data-testid="battle-result"'));
  assert.deepEqual([...leaked(out, secA), ...leaked(out, secB)], []);
});

await finish('隱匿結算畫面');
