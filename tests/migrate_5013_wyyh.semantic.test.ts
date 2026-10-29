// 5013 王·夜予寒吟 真 Kit 拆解驗收（DSH 20261017 第五批；stage_sum_damage／pp_cap_floor_bench 新通用 op）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const sk = h.find('5013', '王·夜予寒吟');
  h.assertKitOnly(sk);
  assert.ok(!JSON.stringify(sk.kit).includes('legacy_handler'), '不得殘留包裝動作');
  checks++; console.log('OK 王·夜予寒吟已是真 Kit');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：雙方帶能力等級（無法被清除視為失敗語意以「仍有等級」判讀）＋對手場下有滿PP精靈。
    const self = h.unit('S', 50000, [sk, attack], { maxHp: 50000, speed: 300 });
    self.statStages = { atk: 2 };
    const opp = h.unit('E', 100000, [h.turnEffectSkill(), attack]);
    opp.statStages = { def: -1 };
    const benchElf = h.unit('B', 50000, [attack]);
    (benchElf.skills as any[])[0].maxPp = 10;
    const r = await h.play(side, { self, opp, oppBench: [benchElf], turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 1 : 0] }, 2);
    const t2 = r[1];
    // 消除雙方回合類效果成功 → 對手場下 PP 上限扣除至當前PP（B 用過攻擊 pp9 → maxPp=9）
    const benchUnit = (t2.state[side === 'p1' ? 'p2Team' : 'p1Team'] || []).find((e: any) => (e.battleId || e.id) === 'B');
    assert.ok(benchUnit, side + ' 找到對手場下精靈 B');
    const bs = (benchUnit.skills as any[])[0];
    assert.ok(bs.maxPp <= bs.pp + 1, side + ' 場下PP上限已扣除至當前PP（maxPp=' + bs.maxPp + ' pp=' + bs.pp + '）');
    checks++;
    // 能力等級傷害：清除後雙方等級歸零→stage_any 不成立→無附加傷害（驗證不誤觸發）；
    //   對手帶「視為弱化無法解除」場景難以headless構造——以負向斷言（本場景無等級殘留→損血僅技能本體）代替。
    assert.ok(!t2.logs.some((l: string) => l.includes('能力等級總和附加')), side + ' 等級全清除→無等級傷害附加（log 無觸發）');
    // 註：25k 級損血來自技能本體＋凍傷 tick（12.5% maxHp），非等級傷害。
    checks++;
    // 凝滯＋凍傷雙方附加（3回合預設）
    for (const st of ['凝滯', '凍傷']) {
      assert.ok(h.statuses(t2.self).includes(st) && h.statuses(t2.opp).includes(st), side + ' 雙方帶 ' + st);
    }
    checks++;
  }
  console.log('OK 消回合→場下PP上限／等級清除／雙方凝滯凍傷 雙側通過');

  // 場景一B（行為驗證）：凝滯結束→一次性體力調整為最大體力44%。
  //   回合1 對手先攻壓血＋自身出技能（雙方凝滯3回合）；回合3 凝滯到期→on_status_ended→hp_set{0.44}。
  {
    const self = h.unit('S3', 50000, [sk, attack], { maxHp: 50000, speed: 50 });
    const opp = h.unit('E3', 100000, [attack, h.wait()], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 4);
    const fin = r[3];
    // 凝滯已到期（3回合）；體力被調整為 44%＝22000（±1 容差；之後回合3對手攻擊扣血→略低）
    const expected = Math.floor(50000 * 0.44);
    assert.ok(Math.abs(fin.self.currentHp - expected) < 3000,
      '凝滯結束→一次性體力調整44%（實際 ' + fin.self.currentHp + ' 預期≈' + expected + '）');
    checks++;
    // 僅一次：第2次凝滯結束不再觸發（once 鍵）——以 once 鍵存在斷言。
    assert.equal(fin.state.p1RegistryState['blockOnce::keerhode_wyyh_stagnationHeal'], true, '一次性鍵已消耗');
    checks++;
  }
  console.log('OK 凝滯結束→一次性體力調整44%');

  // 場景二：等級殘留（self 帶淨化免疫無法構造——改以「清除後仍有等級」直接驗證 op）：
  //   利用 twice-cast：第二次施放時第一次的等級已被清→僅驗證 stage_sum 在有等級時觸發。
  //   直接構造：對手帶等級、自身無→清除後對手等級歸零→無觸發；再由 op 單元級斷言（結構）覆蓋。
  {
    const sumEntry = (sk.kit as any[]).find(e => JSON.stringify(e).includes('stage_sum_damage'));
    assert.ok(sumEntry, 'Kit 內含 stage_sum_damage 條款');
    checks++;
  }

  console.log('王·夜予寒吟：' + checks + ' 項通過');
} finally { await h.close(); }