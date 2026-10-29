// 5002 帝皇之盾：盾先鋒制裁、聖盾裁決、帝·永恆守護 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 帝永壁令現由eventSkillKits.semantic.test.ts驗證完整Kit；盾碎同歸已於migratedQuerySkillKits轉為Kit；魂印「盾」仍未轉。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const hasTimer = (state: any, side: string, prefix: string) => h.timers(state, side).some((t: string) => t.startsWith(prefix));
try {
  const vanguard = h.find('5002', '盾先鋒制裁'), verdict = h.find('5002', '聖盾裁決'), eternal = h.find('5002', '帝·永恆守護');
  for (const s of [vanguard, verdict, eternal]) h.assertKitOnly(s);
  assert.equal(h.find('5002','帝永壁令').effectMode,'kit','已完成整份遷移，不再被舊待辦鎖住');
  assert.equal(h.find('5002','盾碎同歸').effectMode,'kit','盾碎同歸 已完成整份遷移');
  const prop = (s: any) => s.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`);
  await check('固有屬性與節點對應原文', async () => {
    assert.deepEqual(prop(vanguard), ['base_priority=3', 'sure_hit=true']);
    assert.deepEqual(prop(verdict), ['sure_hit=true']);
    assert.deepEqual(prop(eternal), ['sure_hit=true', 'base_priority=1']);
    assert.equal(eternal.kit[4].node, 'on_hit', '「未擊敗對手時恢復等量」整句在命中後');
  });
  // 回合1：self 等待、opp 立盾(0)或等待(2)；回合2 self 出招；之後 self 等待
  const duel = (side: 'p1' | 'p2', skill: any, o: { boosts?: boolean; turnEffect?: boolean; sealed?: boolean; shield?: number; selfHp?: number; oppHp?: number; n?: number; oppSkills?: any[]; pick?: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? 20000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, extra: { ...(o.sealed ? { isAdditionalInvalid: true } : {}), ...(o.shield ? { shield: o.shield } : {}) } }),
    opp: h.unit('E', o.oppHp ?? 20000, o.oppSkills ?? [h.turnEffectSkill(), h.healSkill(), h.wait()], { maxHp: 20000, speed: 100, statStages: o.boosts ? { atk: 2 } : {} }),
    turns: (_e: any, t: number) => o.pick ? o.pick(t) : t === 1 ? [1, o.turnEffect ? 0 : 2] : t === 2 ? [0, 2] : [1, 2],
  } as any, o.n ?? 2);
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 盾先鋒制裁：消除提升→全屬性-1；消除回合類→2回合屬性技能無效（到期）；各自失敗；封印附加`, async () => {
      const hist = await duel(side, vanguard, { boosts: true, turnEffect: true, n: 4, pick: t => t === 1 ? [1, 0] : t === 2 ? [0, 2] : [1, 2] });
      for (const k of STAGES) assert.equal(hist[1].opp.statStages[k] || 0, -1, k);
      assert.ok(hasTimer(hist[1].state, opp, '屬性技能無效:1'), h.timers(hist[1].state, opp).join());
      assert.ok(!hasTimer(hist[2].state, opp, '屬性技能無效'), '2回合後到期');
      const none = (await duel(side, vanguard, {}))[1];
      for (const k of STAGES) assert.equal(none.opp.statStages[k] || 0, 0);
      assert.ok(!hasTimer(none.state, opp, '屬性技能無效'));
      const onlyTurn = (await duel(side, vanguard, { turnEffect: true }))[1];
      for (const k of STAGES) assert.equal(onlyTurn.opp.statStages[k] || 0, 0, '無提升可消除');
      assert.ok(hasTimer(onlyTurn.state, opp, '屬性技能無效'));
      const sealed = (await duel(side, vanguard, { boosts: true, turnEffect: true, sealed: true }))[1];
      assert.equal(sealed.opp.statStages.atk, 2); assert.ok(hasTimer(sealed.state, opp, '免疫')); assert.ok(sealed.opp.currentHp < 20000);
    });
    await check(`${side} 聖盾裁決：吸血40%只算技能傷害；有護盾→附加護盾值70%百分比傷害；無護盾→威力×2；封印附加時全無`, async () => {
      const run = (o: any) => duel(side, verdict, { selfHp: 8000, pick: () => [0, 2], n: 1, ...o }).then(r => r[0]);
      const withShield = await run({ shield: 3000 }), noShield = await run({}), sealed = await run({ sealed: true });
      const total = 20000 - withShield.opp.currentHp, d = total - Math.floor(3000 * 0.7);
      assert.ok(d > 0, '主傷害 ' + d);
      assert.ok(Math.abs(withShield.self.currentHp - 8000 - d * 0.4) <= 1, `吸血 ${withShield.self.currentHp - 8000} vs 技能傷害 ${d} 的40%`);
      const dn = 20000 - noShield.opp.currentHp;
      assert.ok(dn / d > 1.8 && dn / d < 2.2, `無護盾威力×2：${d} → ${dn}`);
      assert.ok(Math.abs(noShield.self.currentHp - 8000 - dn * 0.4) <= 1, '無護盾仍吸血40%');
      const ds = 20000 - sealed.opp.currentHp;
      assert.ok(Math.abs(ds - d) / d < 0.1, `封印：威力不加倍、無追加：${d} vs ${ds}`); assert.equal(sealed.self.currentHp, 8000, '封印：不吸血');
    });
    await check(`${side} 帝·永恆守護：消回合成功→對手下1次技能無效；有護盾→護盾值等量真實傷害；最大體力1/3百分比傷害，未擊敗才恢復等量`, async () => {
      const attack = { ...h.wait(), name: '打', category: '物理', power: 100 };
      const mk = (o: any) => duel(side, eternal, { selfHp: 8000, ...o });
      // 對手回合1立盾；回合2 self 先制出招 → 對手回合2的技能（下1次）無效，回合3正常
      const hist = await mk({ turnEffect: true, oppSkills: [h.turnEffectSkill(), attack, h.wait()], n: 4, pick: (t: number) => t === 1 ? [1, 0] : t === 2 ? [0, 1] : [1, 1] });
      const taken = hist.map((r: any, i: number) => (i ? hist[i - 1].self.currentHp : 8000) - r.self.currentHp);
      assert.ok(hist[1].logs.some((l: string) => /無效/.test(l)), '日誌：技能無效');
      const control = await mk({ oppSkills: [h.turnEffectSkill(), attack, h.wait()], n: 2, pick: (t: number) => t === 1 ? [1, 2] : [0, 1] });
      assert.ok(hist[1].self.currentHp > control[1].self.currentHp, `回合2：對手攻擊被判無效（有清除）${hist[1].self.currentHp} 應高於未清除的對照 ${control[1].self.currentHp}`);
      assert.ok(taken[2] > 0, '回合3起對手技能正常：' + taken.join());
      // 真實傷害與恢復
      const ctl = (await mk({ pick: () => [0, 2], n: 1 }))[0], sh = (await mk({ shield: 3000, pick: () => [0, 2], n: 1 }))[0];
      assert.equal((20000 - sh.opp.currentHp) - (20000 - ctl.opp.currentHp), 3000, '護盾值等量真實傷害 3000');
      const dTotal = 20000 - ctl.opp.currentHp;
      assert.equal(dTotal >= 6666, true);
      assert.equal(ctl.self.currentHp - 8000, 6666, '未擊敗 → 恢復等於百分比傷害(最大體力1/3=6666)：' + (ctl.self.currentHp - 8000));
      assert.equal(ctl.opp.currentHp > 0, true);
      // 擊敗：不恢復
      const kill = (await duel(side, eternal, { selfHp: 8000, oppHp: 3000, pick: () => [0, 2], n: 1 }))[0];
      assert.equal(kill.state[`${opp}Team`][0].currentHp, 0); assert.equal(kill.self.currentHp, 8000, '擊敗對手 → 不恢復');
      // 沒有回合類效果 → 對手技能不無效
      assert.ok(!control[1].logs.some((l: string) => /無效/.test(l)), '無回合類效果：不無效');
      // 封印附加
      const sealed = (await mk({ shield: 3000, sealed: true, pick: () => [0, 2], n: 1 }))[0];
      assert.ok(Math.abs((20000 - sealed.opp.currentHp) - 0) < 20000 && sealed.self.currentHp === 8000, '封印：不恢復');
      assert.ok(20000 - sealed.opp.currentHp < dTotal - 6666 + 200, '封印：只有主傷害：' + (20000 - sealed.opp.currentHp));
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
