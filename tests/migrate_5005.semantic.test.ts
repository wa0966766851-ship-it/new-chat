// 5005 布萊克：狂夜屠戮、夜魔神襲 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
try {
  const big = h.find('5005', '狂夜屠戮'), strike = h.find('5005', '夜魔神襲');
  for (const s of [big, strike]) h.assertKitOnly(s);
  await check('原文保護：描述與原文一致，Kit 條目與原文逐句對應', async () => {
    assert.equal(big.description, '（無特殊效果）');
    assert.equal(strike.description, '■ 必中\n🎯 解除自身能力下降狀態\n🎯 造成技能傷害的50%恢復自身體力');
    assert.deepEqual(strike.kit.map((e: any) => e.customText), ['■ 必中', '🎯 解除自身能力下降狀態', '🎯 造成技能傷害的50%恢復自身體力']);
    assert.equal(strike.kit[0].params.property, 'sure_hit');
    assert.deepEqual(strike.kit[2].params.clause.body[0].acts[0].p, { ratio: 0.5, kind: '技能' });
    assert.equal(big.kit.length, 1);
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 狂夜屠戮：只造成傷害，無任何附加效果`, async () => {
      const [r] = await h.play(side, { self: h.unit('S', 8000, [{ ...big }, h.wait()], { maxHp: 20000, speed: 200, statStages: { atk: -2 } }), opp: h.unit('E', 20000, [h.wait()], { speed: 100 }) });
      assert.ok(r.opp.currentHp < 20000, '造成傷害');
      assert.equal(r.self.currentHp, 8000, '不回血');
      assert.equal(r.self.statStages.atk, -2, '不解除能力下降');
      assert.deepEqual(r.opp.statStages, {});
      assert.ok(!r.logs.some((l: string) => l.includes('效果待接通')));
    });
    await check(`${side} 夜魔神襲：解除自身能力下降＋傷害的50%回血（技能傷害）`, async () => {
      const [r] = await h.play(side, { self: h.unit('S', 8000, [{ ...strike }, h.wait()], { maxHp: 20000, speed: 200, statStages: { atk: -2, def: -1, spatk: 1 } }), opp: h.unit('E', 20000, [h.wait()], { speed: 100 }) });
      const dealt = 20000 - r.opp.currentHp;
      assert.ok(dealt > 0);
      assert.equal(r.self.statStages.atk || 0, 0); assert.equal(r.self.statStages.def || 0, 0);
      assert.equal(r.self.statStages.spatk, 1, '只解除下降，不動提升');
      assert.ok(Math.abs(r.self.currentHp - 8000 - dealt * 0.5) <= 1, `回血 ${r.self.currentHp - 8000} 應為傷害 ${dealt} 的一半`);
    });
    await check(`${side} 夜魔神襲：附加效果被封印時不解除、不吸血（傷害照常）`, async () => {
      const [r] = await h.play(side, { self: h.unit('S', 8000, [{ ...strike }, h.wait()], { maxHp: 20000, speed: 200, statStages: { atk: -2 }, extra: { isAdditionalInvalid: true } }), opp: h.unit('E', 20000, [h.wait()], { speed: 100 }) });
      assert.ok(r.opp.currentHp < 20000);
      assert.equal(r.self.statStages.atk, -2); assert.equal(r.self.currentHp, 8000);
    });
    await check(`${side} 夜魔神襲：無能力下降時照常吸血；兩回合各吸一次不累積`, async () => {
      const hist = await h.play(side, { self: h.unit('S', 8000, [{ ...strike }, h.wait()], { maxHp: 20000, speed: 200 }), opp: h.unit('E', 20000, [h.wait()], { speed: 100 }), turns: (_e: any, t: number) => [t === 1 ? 0 : 1, 0] } as any, 2);
      const d1 = 20000 - hist[0].opp.currentHp;
      assert.ok(Math.abs(hist[0].self.currentHp - 8000 - d1 * 0.5) <= 1);
      assert.equal(hist[1].self.currentHp, hist[0].self.currentHp, '第二回合用等待技，不再吸血');
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
