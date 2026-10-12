import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const punch = h.find('5006', '星光·音速火拳'), awake = h.find('5006', '星光·覺醒');
  const { validateKit } = await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
  for (const skill of [punch, awake, h.find('300', '生命'), h.find('5000', '生命')]) {
    validateKit(skill.kit); h.assertKitOnly(skill);
  }
  for (const side of ['p1', 'p2'] as const) {
    const miss = { ...h.wait(), name: '落空', category: '物理', power: 10, accuracy: 0, isSureHit: false };
    for (const id of ['300', '5000']) {
      const life = h.find(id, '生命');
      const hist = await h.play(side, { self: h.unit('S', 3000, [life, miss]), opp: h.unit('E', 100000, [h.wait()]),
        turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 6);
      // 起始滿血就不能證明回血；此fixture另設上限。
      const healed = await h.play(side, { self: h.unit('S', 3000, [life, miss], { maxHp: 10000 }), opp: h.unit('E', 100000, [h.wait()]),
        turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 6);
      assert.deepEqual(healed.map(r => r.self.currentHp), [3100, 3200, 3300, 3400, 3500, 3500], `${id}/${side}: 當回合起5次，後續miss也回復`);
      assert.ok(hist.every(r => r.self.currentHp === 3000)); checks++;
    }
    for (const speed of [200, 50]) {
      const [r] = await h.play(side, { self: h.unit('S', 90000, [awake], { speed }), opp: h.unit('E', 1000000, [h.wait()], { speed: 100 }) });
      assert.equal(r.self.statStages.atk, speed === 200 ? 2 : 1, `${side}: 覺醒先後手強化`); checks++;
    }
    const [low] = await h.play(side, { self: h.unit('S', 30000, [awake], { maxHp: 90000 }), opp: h.unit('E', 1000000, [h.wait()]) });
    assert.equal(low.self.currentHp, 90000); assert.equal(low.opp.currentHp, 940000); checks++;
    const timerAwake = { ...awake, kit: [awake.kit[0], awake.kit[2]] };
    const chip = { ...h.kitSkill('消耗', [{ op: 'dmg', p: { flat: 30000, type: '固定' } }]), priority: 6 };
    const hist = await h.play(side, { self: h.unit('S', 75000, [timerAwake, miss], { maxHp: 90000 }), opp: h.unit('E', 1000000, [chip]),
      turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 5);
    assert.deepEqual(hist.map(r => r.self.currentHp), [75000, 75000, 75000, 75000, 45000]);
    assert.deepEqual(hist.map((r, i) => (i ? hist[i - 1].opp.currentHp : 1000000) - r.opp.currentHp), [30000, 30000, 30000, 30000, 0]); checks++;
    const control = { ...punch, isSureHit: true, accuracy: 100, kit: [punch.kit[0]] };
    const guaranteed = { ...punch, isSureHit: true, accuracy: 100 };
    const [base] = await h.play(side, { self: h.unit('S', 10000, [control]), opp: h.unit('E', 1000000, [h.wait()], { statStages: { accuracy: -1 } }) });
    const [boosted] = await h.play(side, { self: h.unit('S', 10000, [guaranteed]), opp: h.unit('E', 1000000, [h.wait()], { statStages: { accuracy: -1 } }) });
    assert.equal(1000000 - boosted.opp.currentHp, 2 * (1000000 - base.opp.currentHp), `${side}: 對手能力下降時50%翻倍為100%，不重複加成`); checks++;
    const clearOnly = { ...punch, category: '屬性', power: 0, isSureHit: true, kit: [punch.kit[1]] };
    const results = await h.play(side, { self: h.unit('S', 10000, [h.wait(), clearOnly]), opp: h.unit('E', 10000, [h.turnEffectSkill(), h.wait()]),
      turns: (_e, t) => [t === 2 ? 1 : 0, t === 1 ? 0 : 1] }, 4);
    const other = side === 'p1' ? 'p2' : 'p1';
    const timers = results[1].state[`${other}Timers`];
    assert.ok(timers.some((t: any) => t.payload?.block?.prio === -3 && t.ownerBattleId === results[1].opp.battleId), `${side}: 消回合成功綁對手先制`);
    assert.ok(!results[3].state[`${other}Timers`].some((t: any) => t.name.includes('先制-3')), `${side}: 只保留下回合，之後到期`); checks++;
  }
} finally { await h.close(); }
console.log(`${checks} next monkey/life migration checks passed`);
