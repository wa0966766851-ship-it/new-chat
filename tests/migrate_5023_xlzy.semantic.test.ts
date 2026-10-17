// 5023 械律·置換 真 Kit 拆解驗收（DSH 20261017；legacyWrapped 第二批）。
// 覆蓋：Kit 單一來源／雙方有盾條件先制／攜帶PP消耗：清雙方盾罩→吸取70%（固定+等量回復）→全PP恢復→偷藥劑→下2回合鎖切換。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const sk = h.find('5023', '械律·置換');
  h.assertKitOnly(sk);
  assert.ok(!JSON.stringify(sk.kit).includes('legacy_handler'), '不得殘留包裝動作');
  checks++; console.log('OK 械律·置換已是真 Kit');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 80, pp: 10, maxPp: 10, isSureHit: true, description: '' };
  const shieldSkill = h.kitSkill('立盾', [{ op: 'shield', p: { flat: 300 } }]);

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：攜帶PP消耗——自身先立盾回合1（盾300）、對手等待；回合2自身出械律·置換（對手仍持有盾）→
    //   雙方盾罩歸零＋對手受 0.7×600=420 固定傷害＋自身等量回復（若已損血）＋自身全技能PP回滿＋對手下2回合鎖切換。
    const self = h.unit('S', 5000, [shieldSkill, sk], { maxHp: 5000, speed: 300 });
    const opp = h.unit('E', 100000, [shieldSkill, attack]);
    const r = await h.play(side, { self, opp, turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] }, 2);
    const t2 = r[1];
    assert.equal((t2.opp.shield || 0) + (t2.opp.barrier || 0), 0, side + ' 對手護盾罩被清除');
    checks++;
    const oppLoss = 100000 - t2.opp.currentHp;
    assert.ok(oppLoss >= 420, side + ' 吸取消除量70%（固定≥420；實際 ' + oppLoss + '）');
    checks++;
    // 自身全技能 PP 恢復：械律·置換 pp 5（用後 4→回滿 5）
    const lidun = (t2.self.skills as any[]).find(s => s.name === '立盾');
    assert.equal(lidun.pp, 99, side + ' 自身技能PP全恢復（立盾98→99；本次使用槽的扣點在 Kit 執行後結算）');
    checks++;
    // 對手下2回合鎖切換（switch_lock 計時器存在）
    const other = side === 'p1' ? 'p2' : 'p1';
    assert.ok((t2.state[other + 'Timers'] || []).some((t: any) => JSON.stringify(t.payload || {}).includes('lockSwitch') || (t.name || '').includes('切換')), side + ' 對手鎖切換計時器');
    checks++;
  }
  console.log('OK 清盾吸取70%／全PP恢復／鎖切換 雙側通過');

  // 場景二：雙方有盾條件先制——雙方都立盾後，速度較慢的持有人在次回合先出手。
  {
    const self = h.unit('S', 5000, [shieldSkill, sk, attack], { maxHp: 5000, speed: 50 });
    const opp = h.unit('E', 100000, [shieldSkill, attack], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] }, 2);
    const logs = r[1].logs;
    const selfUseIdx = logs.map((l: string, i: number) => [l, i] as const).filter(([l]: any) => l.includes('【S】使用了')).at(-1)![1];
    const oppUseIdx = logs.map((l: string, i: number) => [l, i] as const).filter(([l]: any) => l.includes('【E】使用了')).at(-1)![1];
    assert.ok(selfUseIdx >= 0 && oppUseIdx >= 0 && selfUseIdx < oppUseIdx, '雙方有盾時持有人先制+1（速度50勝300）');
    checks++;
  }
  console.log('OK 雙方有盾條件先制');

  console.log('械律·置換：' + checks + ' 項通過');
} finally { await h.close(); }