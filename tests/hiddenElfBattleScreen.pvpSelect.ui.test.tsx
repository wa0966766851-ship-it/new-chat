import { createHiddenElfHarness } from './helpers/hiddenElfScreen';

// 情境二之一：PVP 同屏的選招遮蔽（兩個操作方）。
// 只掛載 2 次戰鬥畫面；浮窗殘留另立一支，避免單一 process 同時保留多份畫面。
const h = await createHiddenElfHarness();
const { assert, check, finish, html, leaked, A, B, secA, secB, document } = h;

for (const phase of ['p1_select', 'p2_select']) {
  await check(`PVP（${phase}）：僅操作側技能列可見，HUD 與其他文字遮蔽`, async () => {
    const out = await html('PVP', true, true, phase);
    const page = document.createElement('div'); page.innerHTML = out;
    const row = page.querySelector('[data-act-side]')!;
    const own = phase === 'p1_select' ? A : B;
    assert.ok(row.textContent?.includes(own.skills[0].name), '操作方可看完整技能名');
    row.remove();
    assert.deepEqual(leaked(page.innerHTML, [...secA, ...secB]), []);
    assert.equal(page.querySelectorAll('[data-protection]').length, 0);
    for (const hp of page.querySelectorAll('.bt-hp')) {
      assert.ok(hp.textContent?.includes('？/？'));
      assert.ok(!hp.textContent?.includes('%'), '不顯示百分比');
    }
    assert.ok(page.textContent?.includes('隱匿'));
    assert.ok(!page.textContent?.includes('123456') && !page.textContent?.includes('654321'));
    page.innerHTML = '';
  });
}

await finish('隱匿戰鬥畫面（PVP 選招）');
