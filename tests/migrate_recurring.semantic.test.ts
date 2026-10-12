import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let checks = 0;
try {
  const flame = h.find('5006', '星光·不滅之火');
  const dance = h.find('5008', '亂魂舞');
  const soul = h.find('5006', '星光·靈絕擊');
  for (const skill of [flame, dance, soul]) h.assertKitOnly(skill);
  for (const side of ['p1', 'p2'] as const) {
    // Strip unrelated clauses to isolate the real timer route, not a mocked runtime.
    const timerFlame = { ...flame, category: '屬性', power: 0, kit: [flame.kit[0], flame.kit[4]] };
    const miss = { ...h.wait(), name: '必定未命中', category: '物理', power: 1, accuracy: 0, isSureHit: false };
    const hist = await h.play(side, {
      self: h.unit('S', 100000, [timerFlame, miss, h.wait()], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100 }),
      turns: (_e, t) => [t === 1 ? 0 : t === 2 ? 1 : 2, 0],
    }, 4);
    assert.deepEqual(hist.map((r, i) => (i ? hist[i - 1].opp.currentHp : 100000) - r.opp.currentHp), [400, 400, 400, 0], `${side}: 當回合、後續miss及到期`);
    checks++;
    const withoutConfusion = structuredClone(dance);
    withoutConfusion.kit[1].params.clause.body.shift();
    const [r] = await h.play(side, {
      self: h.unit('S', 100000, [withoutConfusion], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100 }),
    });
    assert.equal(r.self.statStages.atk || 0, 0, `${side}: 未處於混亂不可強化`);
    checks++;
    const [confused] = await h.play(side, {
      self: h.unit('S', 100000, [dance], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100 }),
    });
    assert.equal(confused.self.statStages.atk, 2, `${side}: 當次混亂成功即強化`);
    checks++;
    const blocker = { ...h.kitSkill('封鎖', [{ op: 'invalid_turns', p: { turns: 1, kind: '屬性' } }]), priority: 6 };
    const invalid = await h.play(side, {
      self: h.unit('S', 100000, [timerFlame, h.wait()], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait(), blocker], { speed: 100 }),
      turns: (_e, t) => [t === 1 ? 0 : 1, t === 2 ? 1 : 0],
    }, 3);
    assert.deepEqual(invalid.map((r, i) => (i ? invalid[i - 1].opp.currentHp : 100000) - r.opp.currentHp), [400, 400, 400], `${side}: 已啟動後技能無效仍觸發`);
    checks++;
    const unstarted = await h.play(side, {
      self: h.unit('S', 100000, [timerFlame, h.wait()], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait(), blocker], { speed: 100 }),
      turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 1 : 0],
    }, 3);
    assert.ok(unstarted.every(r => r.opp.currentHp === 100000), `${side}: 首次無效不得啟動`);
    checks++;
    const fright = { ...h.kitSkill('驚嚇', [{ op: 'status', p: { side: 'opp', status: '害怕', turns: 1, chance: 100 } }]), priority: 6 };
    const interrupted = await h.play(side, {
      self: h.unit('S', 100000, [timerFlame, h.wait()], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait(), fright], { speed: 100 }),
      turns: (_e, t) => [t === 1 ? 0 : 1, t === 2 ? 1 : 0],
    }, 4);
    assert.deepEqual(interrupted.map((r, i) => (i ? interrupted[i - 1].opp.currentHp : 100000) - r.opp.currentHp), [400, 0, 400, 0], `${side}: 被打斷回合跳過，後續繼續但不延長期限`);
    checks++;
    const late = await h.play(side, {
      self: h.unit('S', 100000, [timerFlame, h.wait()], { speed: 50 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100 }),
      turns: (_e, t) => [t === 1 ? 0 : 1, 0],
    }, 4);
    assert.deepEqual(late.map((r, i) => (i ? late[i - 1].opp.currentHp : 100000) - r.opp.currentHp), [400, 400, 400, 0], `${side}: 後手也不多一回合`);
    checks++;
    const barrier = await h.play(side, {
      self: h.unit('S', 100000, [timerFlame], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100, extra: { barrier: 10000 } }),
    });
    assert.equal(barrier[0].opp.currentHp, 99600, `${side}: 固傷被護罩吸收後追加400真傷`);
    assert.equal(barrier[0].opp.barrier, 9600, `${side}: 固傷扣護罩而非體力`);
    checks++;
    const [a] = await h.play(side, {
      self: h.unit('S', 100000, [{ ...soul, kit: [soul.kit[1]] }], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100, statStages: { def: -1 } }),
    });
    const [b] = await h.play(side, {
      self: h.unit('S', 100000, [{ ...soul, kit: [] }], { speed: 200 }),
      opp: h.unit('E', 100000, [h.wait()], { speed: 100, statStages: { def: -1 } }),
    });
    assert.equal(b.opp.currentHp - a.opp.currentHp, 300, `${side}: 靈絕击為300固定傷害`);
    checks++;
    const ygg = h.find('5019', 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ');
    const yggTimer = { ...ygg, kit: [ygg.kit[0], ygg.kit[2]] };
    const reduce = { ...h.kitSkill('體力降低', [{ op: 'dmg', p: { flat: 20000, type: '真實' } }]), priority: 6 };
    const [live] = await h.play(side, {
      self: h.unit('S', 60000, [yggTimer], { maxHp: 100000, speed: 200 }),
      opp: h.unit('E', 60000, [reduce], { speed: 100 }),
    });
    assert.equal(live.opp.currentHp, 20000, `${side}: 出招時60%→吸取當下40%，即時翻倍`);
    checks++;
    const danceTimer = { ...dance, kit: [dance.kit[0], dance.kit[3]] };
    const chip = { ...h.kitSkill('消耗', [{ op: 'dmg', p: { flat: 50000, type: '固定' } }]), priority: 6 };
    const recovery = await h.play(side, {
      self: h.unit('S', 80000, [danceTimer, h.wait()], { maxHp: 100000, speed: 200 }),
      opp: h.unit('E', 1000000, [chip], { speed: 100 }),
      turns: (_e, t) => [t === 1 ? 0 : 1, 0],
    }, 5);
    assert.deepEqual(recovery.map(r => r.self.currentHp), [80000, 80000, 80000, 80000, 30000], `${side}: 亂魂舞當回合起4回合恢復，第5回合停止`);
    assert.deepEqual(recovery.map((r, i) => (i ? recovery[i - 1].opp.currentHp : 1000000) - r.opp.currentHp), [50000, 50000, 50000, 50000, 0], `${side}: 等量百分比傷害共4回合`);
    checks++;
  }
  console.log(`${checks} recurring migration checks passed`);
} finally { await h.close(); }
