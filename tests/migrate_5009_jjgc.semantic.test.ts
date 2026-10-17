// 5009 劫盡歸塵 Kit 引擎實戰驗收（DSH 20261017；counter_spend 新通用 op）。
// 覆蓋：Kit 單一來源切換／消回合+雙方三異常／免疫下2次＋每次免疫回饋（⅓回復+等量百分比傷害，次數用盡即停）／
//       隨機3技能PP歸0／上述異常結束時一次性痊癒。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const sk = h.find('5009', '劫盡歸塵');
  h.assertKitOnly(sk);
  checks++; console.log('✓ 劫盡歸塵 已是 Kit 單一來源（無舊 handler 分支）');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 60, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  // 場景一（雙側）：對手先立盾（回合類效果），自身出劫盡歸塵 → 消回合成功、雙方三異常、對手恰3個技能PP歸0、免疫2次建檔。
  const mkOpp = (speed = 100) => h.unit('E', 100000, [
    h.turnEffectSkill(), attack,
    { ...h.wait(), name: '技B', pp: 5, maxPp: 5 },
    { ...h.wait(), name: '技C', pp: 5, maxPp: 5 },
    { ...h.wait(), name: '技D', pp: 5, maxPp: 5 },
  ], { speed });
  for (const side of ['p1', 'p2'] as const) {
    // 回合1：對手先立盾（回合一類效果）；回合2：自身後手出劫盡歸塵（先制+2 但此測先讓效果存在）→ 消除對手回合類效果
    const r = await h.play(side, { self: h.unit('S', 100000, [sk, h.wait()]), opp: mkOpp(400),
      turns: (_e, t) => [t === 1 ? 1 : 0, t === 1 ? 0 : 1] }, 2);
    const t1 = r[1], other = side === 'p1' ? 'p2' : 'p1';
    assert.ok(t1.logs.some((l: string) => l.includes('消除了回合類效果')), `${side} 消除雙方回合類效果`);
    const selfS = h.statuses(t1.self), oppS = h.statuses(t1.opp);
    for (const s of ['中毒', '凍傷', '燒傷']) {
      assert.ok(selfS.includes(s), `${side} 自身 ${s}`);
      assert.ok(oppS.includes(s), `${side} 對手 ${s}`);
    }
    checks++;
    const zeroed = (t1.opp.skills as any[]).filter((s: any) => (s.pp ?? 0) === 0).length;
    assert.equal(zeroed, 3, `${side} 對手恰3個技能PP歸0（實際 ${zeroed}）`);
    checks++;
    assert.equal(t1.state[`${side}RegistryState`].blkImmuneStatusCount, 2, `${side} 免疫下2次建檔`);
    checks++;
  }
  console.log('✓ 消回合／雙方三異常／隨機PP歸0／免疫建檔 雙側通過');

  // 場景二：免疫回饋兩次為止、第三次異常正常附加；上述異常（中毒等）結束時一次性痊癒。
  const curse = h.kitSkill('詛咒', [{ op: 'status', p: { side: 'opp', status: '麻痺', chance: 100, turns: 3 } }]);
  const filler = (n: string) => ({ ...h.wait(), name: n, pp: 5, maxPp: 5 });
  const self2 = h.unit('S', 3000, [sk, h.wait()], { maxHp: 3000 });
  // 回合1：自身先制+2 出劫盡歸塵（免疫2次建檔、對手隨機3技能PP歸0）；回合2-4：對手連發詛咒、自身等待
  // 對手帶 6 技（詛咒＋普攻＋4填充）：隨機3個歸0後仍有可選技能，不會卡在選招。
  const r2 = await h.play('p1', { self: self2, opp: h.unit('E', 100000, [curse, attack, filler('技B'), filler('技C'), filler('技D'), filler('技E')]),
    turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 1 : 0] }, 5);
  // 日誌為全程累積快照：以最終回合快照斷言全程事實。
  const final = r2[4], allLogs: string[] = final.logs;
  const count = (frag: string) => allLogs.filter((l: string) => l.includes(frag)).length;
  // 前兩次詛咒被免疫：回饋計數各花用一次（剩餘1→0）；第三次不再回饋
  assert.equal(count('劫盡歸塵·免疫回饋】剩餘 1 次'), 1, '第一次免疫回饋花用');
  assert.equal(count('劫盡歸塵·免疫回饋】剩餘 0 次'), 1, '第二次免疫回饋花用');
  checks++;
  // 第一次回饋：恢復⅓（1000點）；第二次回饋時已滿血（0點，受已損失上限約束）
  assert.equal(count('恢復了 1000 點體力'), 1, '免疫回饋恢復⅓（1000點）一次');
  checks++;
  // 免疫回饋造成對手等量百分比傷害
  assert.ok(final.opp.currentHp < 100000, '免疫回饋造成對手百分比傷害');
  checks++;
  assert.equal(final.state.p1RegistryState.blkImmuneStatusCount, 0, '兩次免疫後計數歸零');
  assert.equal(final.state.p1RegistryState.delu_jjgc_immuneHealCharges, 0, '回饋計數同步歸零');
  checks++;
  // 第三次（及之後）詛咒正常附加麻痺（不再免疫、不再回饋）
  assert.ok(count('陷入了【麻痺】') >= 1, '第三次詛咒正常附加麻痺');
  assert.ok(h.statuses(final.self).includes('麻痺'), '最終仍處於麻痺');
  checks++;
  // 上述異常（中毒/凍傷/燒傷）結束時：一次性痊癒（本場僅一次；once 鍵已消耗、滿血）
  assert.equal(final.state.p1RegistryState['blockOnce::delu_jjgc_statusEndHeal'], true, '一次性痊癒已觸發並消耗');
  assert.equal(final.self.currentHp, 3000, '痊癒後滿血');
  checks++;
  console.log('✓ 免疫回饋×2（⅓回復＋等量百分比傷害）／第三次正常附加／一次性痊癒');

  console.log(`劫盡歸塵：${checks} 項通過`);
} finally { await h.close(); }
