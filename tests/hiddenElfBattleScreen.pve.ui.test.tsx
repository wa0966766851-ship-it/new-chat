import { createHiddenElfHarness } from './helpers/hiddenElfScreen';

// 情境一：PVE 的隱匿可見性（基準、對方隱匿、己方隱匿、只有一方隱匿）。
// 與 PVP／結算情境分檔，單一 process 只掛載 4 次戰鬥畫面。
const h = await createHiddenElfHarness();
const { assert, check, finish, html, leaked, A, B, secA, secB } = h;

await check('基準：未隱匿時雙方名稱與技能都在 DOM（確認掃描有效）', async () => {
  const out = await html('PVE', false, false);
  assert.ok(out.includes(A.name) && out.includes(B.name), '名稱可見');
  assert.ok(leaked(out, secA).length >= 2 && leaked(out, secB).length >= 1);
});

await check('PVE：對方（p2）隱匿 → DOM／title／aria／訊息／圖表不含其名稱、魂印、技能', async () => {
  const out = await html('PVE', false, true);
  assert.deepEqual(leaked(out, secB), []);
  assert.ok(out.includes(A.name), '己方照常可見');
});

await check('PVE：己方（p1）隱匿 → 持有方照常看到自己的名稱與技能', async () => {
  const out = await html('PVE', true, false);
  assert.ok(out.includes(A.name) && out.includes(A.skills[0].name), '持有方可見');
  assert.deepEqual(leaked(out, secB).length > 0, true, '對方未隱匿仍可見');
});

await check('PVP：只有一方隱匿 → 該方被遮、另一方可見', async () => {
  const out = await html('PVP', true, false, 'resolving');
  assert.deepEqual(leaked(out, secA), []);
  assert.ok(leaked(out, secB).length > 0);
});

await finish('隱匿戰鬥畫面（PVE／單方）');
