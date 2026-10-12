// 5011 星光·麗莎布布：星光·飛葉風暴、星光·花草護體 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 飛葉風暴原文見 elf_source_files/5011；花草護體是技能庫技能（不在 TXT），以資料庫描述為準（使用者 2026-10-12 點名轉換）。
// 使用者確認：附加量取主攻擊結算後已損失體力。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const BIG = 1e6;
try {
  const leaf = h.find('5011', '星光·飛葉風暴'), guard = h.find('5011', '星光·花草護體');
  h.assertKitOnly(leaf); h.assertKitOnly(guard);
  const without = (skill: any, idx: number) => ({ ...skill, kit: skill.kit.filter((_: any, i: number) => i !== idx) });
  await check('原文保護：描述與原文一致，Kit 條目與原文逐句對應', async () => {
    assert.equal(leaf.description, '■ 必中\n🎯 解除自身能力下降狀態，解除成功則恢復自身所有體力\n🎯 1回合內受到物理攻擊和特殊攻擊傷害減少50%\n🎯 附加對手已損失體力35%的百分比傷害');
    assert.deepEqual(leaf.kit.map((e: any) => e.customText), leaf.description.split('\n'));
    assert.equal(leaf.kit[0].params.property, 'sure_hit');
    assert.equal(guard.description, '技能使用成功時，100%改變自身防禦等級+2；技能使用成功時，100%改變自身特防等級+2；技能使用成功時，100%改變對手攻擊等級-1；技能使用成功時，100%改變對手特攻等級-1。');
    assert.equal(guard.kit.length, 1);
    assert.equal(guard.kit[0].params.clause.body.length, 4);
  });
  const strike = { ...h.wait(), name: '重擊', category: '物理', power: 100, isSureHit: true };
  const special = { ...h.wait(), name: '波動', category: '特殊', power: 100, isSureHit: true };
  const fixedHit = { ...h.kitSkill('固傷', [{ op: 'dmg', p: { flat: 5000, type: '固定', both: false } }]) };
  const duel = (side: 'p1' | 'p2', o: { skill: any; selfHp?: number; selfStages?: any; oppHp?: number; oppStages?: any; sealed?: boolean; oppSkills?: any[]; oppExtra?: any; n?: number; pick?: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? BIG, [{ ...o.skill }, h.wait()], { maxHp: BIG, speed: 200, statStages: o.selfStages || {}, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', o.oppHp ?? BIG, o.oppSkills ?? [h.wait()], { maxHp: BIG, speed: 100, statStages: o.oppStages || {}, extra: o.oppExtra || {} }),
    turns: (_e: any, t: number) => o.pick ? o.pick(t) : [0, 0],
  } as any, o.n ?? 1);
  const lost = (hist: any[], side: 'self' | 'opp', start = BIG) => hist.map((r: any, i: number) => (i ? hist[i - 1][side].currentHp : start) - r[side].currentHp);
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 飛葉風暴：解除自身能力下降→成功則恢復全部體力；沒有下降則不回血`, async () => {
      const [a] = await duel(side, { skill: leaf, selfHp: 300000, selfStages: { atk: -2, def: -1 } });
      assert.equal(a.self.statStages.atk || 0, 0); assert.equal(a.self.statStages.def || 0, 0);
      assert.equal(a.self.currentHp, BIG, '恢復全部體力');
      const [b] = await duel(side, { skill: leaf, selfHp: 300000 });
      assert.equal(b.self.currentHp, 300000, '沒有可解除的下降 → 不觸發回血');
      const [c] = await duel(side, { skill: leaf, selfHp: 300000, selfStages: { atk: 2 } });
      assert.equal(c.self.statStages.atk, 2); assert.equal(c.self.currentHp, 300000, '只解除下降，不動提升');
    });
    await check(`${side} 飛葉風暴：附加對手已損失體力 35% 的百分比傷害（此刻已損失量；滿血則為 0）`, async () => {
      const bare = without(leaf, 3);
      const [full] = await duel(side, { skill: leaf, oppHp: 600000 }), [ctl] = await duel(side, { skill: bare, oppHp: 600000 });
      assert.equal(ctl.opp.currentHp - full.opp.currentHp, Math.floor((BIG - ctl.opp.currentHp) * 0.35), '主攻擊結算後已損失體力 × 35%');
      const [f2] = await duel(side, { skill: leaf, oppHp: BIG }), [c2] = await duel(side, { skill: bare, oppHp: BIG });
      assert.equal(c2.opp.currentHp - f2.opp.currentHp, Math.floor((BIG - c2.opp.currentHp) * 0.35), '原先滿血也納入本次主攻擊扣血');
    });
    await check(`${side} 飛葉風暴：1回合內受到物理／特殊攻擊傷害減少 50%（第2回合恢復）；固定傷害不受影響`, async () => {
      const run = async (skill: any, foe: any) => lost(await duel(side, { skill, oppSkills: [h.wait(), foe], n: 2, pick: t => [t === 1 ? 0 : 1, 1] }), 'self');
      for (const foe of [strike, special]) {
        const g = await run(leaf, foe), c = await run(without(leaf, 2), foe);
        assert.ok(c[0] > 0 && g[0] / c[0] > 0.4 && g[0] / c[0] < 0.6, `第1回合減半：${g[0]} vs ${c[0]}`);
        assert.ok(g[1] / c[1] > 0.85 && g[1] / c[1] < 1.15, `第2回合恢復：${g[1]} vs ${c[1]}`);
      }
      const gf = await run(leaf, fixedHit), cf = await run(without(leaf, 2), fixedHit);
      assert.deepEqual(gf, cf, '固定傷害不受「物理／特殊攻擊傷害」減免影響');
    });
    await check(`${side} 飛葉風暴：附加效果失效 → 不解除、不回血、不減傷、不附加（只剩必中的攻擊本身）`, async () => {
      const [r] = await duel(side, { skill: leaf, selfHp: 300000, selfStages: { atk: -2 }, oppHp: 600000, sealed: true, oppSkills: [h.wait(), strike], n: 1 });
      const [ctl] = await duel(side, { skill: without(without(without(leaf, 3), 2), 1), selfHp: 300000, selfStages: { atk: -2 }, oppHp: 600000, oppSkills: [h.wait(), strike], n: 1 });
      assert.equal(r.self.statStages.atk, -2); assert.equal(r.self.currentHp, 300000);
      assert.equal(r.opp.currentHp, ctl.opp.currentHp, '只有主傷害');
      assert.deepEqual(h.timers(r.state, side), []);
    });
    await check(`${side} 花草護體：成功使用 → 自身防禦／特防 +2、對手攻擊／特攻 -1（各 100%）`, async () => {
      const [r] = await duel(side, { skill: guard });
      assert.equal(r.self.statStages.def, 2); assert.equal(r.self.statStages.spdef, 2);
      assert.equal(r.opp.statStages.atk, -1); assert.equal(r.opp.statStages.spatk, -1);
      assert.equal(r.self.statStages.atk || 0, 0); assert.equal(r.opp.statStages.def || 0, 0);
      const [q] = await duel(side, { skill: guard, selfStages: { def: 5 }, oppStages: { atk: -6 } });
      assert.equal(q.self.statStages.def, 6, '上限 +6'); assert.equal(q.opp.statStages.atk, -6, '下限 -6'); assert.equal(q.opp.statStages.spatk, -1);
    });
    await check(`${side} 花草護體：附加效果失效／被閃避未命中／被害怕打斷 → 不改變任何能力等級`, async () => {
      const [s] = await duel(side, { skill: guard, sealed: true });
      assert.equal(s.self.statStages.def || 0, 0); assert.equal(s.opp.statStages.atk || 0, 0);
      // 對手魂印「100%閃避對手所有技能」：花草護體命中率 95%（非必中）→ 未命中
      const [m] = await duel(side, { skill: guard, oppExtra: { soulMark: { name: '測試閃避', description: '🎯 100%閃避對手所有技能', effectMode: 'description' } } });
      assert.equal(m.self.statStages.def || 0, 0); assert.equal(m.opp.statStages.atk || 0, 0); assert.equal(m.self.statStages.spdef || 0, 0);
      const fear = { ...h.kitSkill('嚇', [{ op: 'status', p: { chance: 100, side: 'opp', status: '害怕' } }]), priority: 6 };
      const [f] = await duel(side, { skill: guard, oppSkills: [fear, h.wait()], pick: () => [0, 0] });
      assert.equal(f.self.statStages.def || 0, 0); assert.equal(f.opp.statStages.atk || 0, 0);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
