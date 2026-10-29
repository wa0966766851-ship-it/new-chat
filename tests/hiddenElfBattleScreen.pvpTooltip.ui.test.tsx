import { createHiddenElfHarness } from './helpers/hiddenElfScreen';

// 情境二之二：換操作方／進入結算時，上一方的技能浮窗不得殘留。
// 這幾步必須保留同一個 root 連續渲染，因此單獨成檔，process 只做這一件事。
const h = await createHiddenElfHarness();
const { assert, act, check, finish, html, leaked, secA, secB, document } = h;

await check('PVP：換操作方或開始結算時，上一方技能浮窗立即隱藏', async () => {
  await html('PVP', true, true, 'p1_select', false, true);
  const button = document.querySelector('[data-act-side] button:not([disabled])')!;
  assert.ok(button, '測試需有可操作技能');
  await act(async () => { button.dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true })); });
  assert.ok(document.querySelector('[data-skill-tooltip]'), '選招可開啟技能浮窗');
  await html('PVP', true, true, 'p2_select', false, true);
  assert.equal(document.querySelector('[data-skill-tooltip]')?.outerHTML.slice(0, 160) ?? null, null, '不可殘留前一方浮窗');
  assert.deepEqual(leaked(document.body.innerHTML, secA), []);
  await html('PVP', true, true, 'resolving', false, true);
  assert.equal(document.querySelector('[data-skill-tooltip]')?.outerHTML.slice(0, 160) ?? null, null);
  assert.deepEqual(leaked(document.body.innerHTML, [...secA, ...secB]), []);
});

await check('PVP：出招階段雙方技能仍遮蔽', async () => {
  const out = await html('PVP', true, true, 'resolving');
  assert.deepEqual(leaked(out, [...secA, ...secB]), []);
});

await finish('隱匿戰鬥畫面（PVP 浮窗／出招）');
