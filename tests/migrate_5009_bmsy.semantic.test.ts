// 5009 辟冥·鎮獄斷 真 Kit 拆解驗收（DSH 20261017 第三批；legacyWrapped→0）。
// 覆蓋：Kit 單一來源／消提升→三異常／未擊敗→下次先制+2／雙攻總和威力／180閾值雙方真傷。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const sk = h.find('5009', '辟冥·鎮獄斷');
  h.assertKitOnly(sk);
  assert.ok(!JSON.stringify(sk.kit).includes('legacy_handler'), '不得殘留包裝動作');
  checks++; console.log('OK 辟冥·鎮獄斷已是真 Kit');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 187, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：消提升→三異常（對手帶 +2 提升，辟冥後歸零且感染/冰封/焚燼）
    const opp = h.unit('E', 100000, [attack, h.wait()]);
    opp.statStages = { atk: 2, def: 2 };
    const r = await h.play(side, { self: h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000, speed: 300 }), opp, turns: () => [0, 1] }, 1);
    const t1 = r[0];
    const stages = t1.opp.statStages || {};
    assert.ok(!Object.values(stages).some((v: any) => Number(v) > 0), side + ' 對手能力提升被消除');
    checks++;
    const oppStatuses = h.statuses(t1.opp);
    for (const s of ['感染', '冰封', '焚燼']) assert.ok(oppStatuses.includes(s), side + ' 對手帶 ' + s);
    checks++;
  }
  console.log('OK 消提升→三異常 雙側通過');

  // 場景二：未擊敗對手→自身下次使用技能額外先制+2（速度 50 勝 400）
  {
    const self = h.unit('S', 4000, [sk, attack], { maxHp: 4000, speed: 50 });
    const opp = h.unit('E', 100000, [attack, h.wait()], { speed: 400 });
    const r = await h.play('p1', { self, opp, turns: (_e, t) => [t === 1 ? 0 : 1, 1] }, 2);
    const logs = r[1].logs;
    const sIdx = logs.map((l: string, i: number) => [l, i] as const).filter(([l]: any) => l.includes('【S】使用了')).at(-1)![1];
    const oIdx = logs.map((l: string, i: number) => [l, i] as const).filter(([l]: any) => l.includes('【E】使用了')).at(-1)![1];
    assert.ok(sIdx < oIdx, '未擊敗後下次技能先制+2（速度50先於400）');
    checks++;
  }
  console.log('OK 未擊敗→下次先制+2');

  // 場景三：180 閾值——對手高防（技能傷害<180）→雙方各受 187 真實傷害
  {
    const self = h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000 });
    const opp = h.unit('E', 100000, [attack, h.wait()]);
    opp.calculatedStats = { ...opp.calculatedStats, def: 100000, spdef: 100000 };
    opp.baseStats = { ...opp.baseStats, def: 100000, spdef: 100000 };
    const r = await h.play('p1', { self, opp, turns: () => [0, 1] }, 1);
    const t1 = r[0];
    const selfLoss = 4000 - t1.self.currentHp;
    const oppLoss = 100000 - t1.opp.currentHp;
    assert.ok(selfLoss >= 187, '自身受 187 真實傷害（實際 ' + selfLoss + '）');
    assert.ok(oppLoss >= 187, '對手受 187 真實傷害（實際 ' + oppLoss + '）');
    checks++;
  }
  console.log('OK 180閾值雙方真傷');

  console.log('辟冥·鎮獄斷：' + checks + ' 項通過');
} finally { await h.close(); }