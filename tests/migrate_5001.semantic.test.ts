// 5001 悲歌.索比拉特：黯索魂噬 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。魂印「黯」未轉，見交接單 §4。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
try {
  const skill = h.find('5001', '黯索魂噬');
  h.assertKitOnly(skill);
  await check('原文保護與固有屬性', async () => {
    assert.equal(skill.description, '■ 先制+3\n■ 必中\n🎯 消除對手回合類效果\n  > 消除成功則令對手害怕\n🎯 消除對手能力提升狀態\n  > 消除成功則對手全屬性-1');
    assert.deepEqual(skill.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`), ['base_priority=3', 'sure_hit=true']);
    assert.equal(skill.kit.length, 4);
  });
  const duel = (side: 'p1' | 'p2', o: { boosts?: boolean; turnEffect?: boolean; sealed?: boolean }) => h.play(side, {
    self: h.unit('S', 20000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', 20000, [h.turnEffectSkill(), h.wait()], { maxHp: 20000, speed: 100, statStages: o.boosts ? { atk: 2 } : {} }),
    turns: (_e: any, t: number) => t === 1 ? [1, o.turnEffect ? 0 : 1] : [0, 1],
  } as any, 2).then(r => r[1]);
  for (const side of ['p1', 'p2'] as const) {
    const opp = side === 'p1' ? 'p2' : 'p1';
    await check(`${side} 黯索魂噬：兩段消除都成功 → 對手害怕＋全屬性-1，回合類效果清除`, async () => {
      const r = await duel(side, { boosts: true, turnEffect: true });
      assert.ok(h.statuses(r.opp).includes('害怕'));
      for (const k of STAGES) assert.equal(r.opp.statStages[k] || 0, -1, k);
      assert.ok(!h.timers(r.state, opp).some((t: string) => t.startsWith('免疫')));
      assert.ok(r.opp.currentHp < 20000);
    });
    await check(`${side} 黯索魂噬：各段失敗不觸發各自成功分支；封印附加時只有傷害`, async () => {
      const none = await duel(side, {});
      assert.ok(!h.statuses(none.opp).includes('害怕')); for (const k of STAGES) assert.equal(none.opp.statStages[k] || 0, 0);
      const onlyBoost = await duel(side, { boosts: true });
      assert.ok(!h.statuses(onlyBoost.opp).includes('害怕')); for (const k of STAGES) assert.equal(onlyBoost.opp.statStages[k] || 0, -1);
      const onlyTurn = await duel(side, { turnEffect: true });
      assert.ok(h.statuses(onlyTurn.opp).includes('害怕')); for (const k of STAGES) assert.equal(onlyTurn.opp.statStages[k] || 0, 0);
      const sealed = await duel(side, { boosts: true, turnEffect: true, sealed: true });
      assert.ok(!h.statuses(sealed.opp).includes('害怕')); assert.equal(sealed.opp.statStages.atk, 2);
      assert.ok(h.timers(sealed.state, opp).some((t: string) => t.startsWith('免疫'))); assert.ok(sealed.opp.currentHp < 20000);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
