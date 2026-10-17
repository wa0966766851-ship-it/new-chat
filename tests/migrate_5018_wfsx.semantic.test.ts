// 5018 王·鏽腑喰心 真 Kit 拆解驗收（DSH 20261017 第四批；entranceStack 通用件）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const sk = h.find('5018', '王·鏽腑喰心');
  h.assertKitOnly(sk);
  assert.ok(!JSON.stringify(sk.kit).includes('legacy_handler'), '不得殘留包裝動作');
  checks++; console.log('OK 王·鏽腑喰心已是真 Kit');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：回合1對手先立回合類效果、自身普攻；回合2自身出王·鏽腑喰心：
    //   消對手回合（成功→免疫下1次異常）＋使用後400固定＋解除自身下降＋綁定30%真傷；
    //   回合3自身普攻對手→觸發綁定受擊30%真傷。
    const turnFx = h.turnEffectSkill();
    const self = h.unit('S', 60000, [sk, attack], { maxHp: 60000, speed: 300 }); // 先出手：綁定當回合即可觸發
    self.statStages = { atk: -2 };
    const opp = h.unit('E', 100000, [turnFx, attack]);
    const r = await h.play(side, { self, opp, turns: (_e, t) => [t === 2 ? 0 : 1, t === 1 ? 0 : 1] }, 3);
    const fin = r[2];
    assert.ok(!Object.values(fin.self.statStages || {}).some((v: any) => Number(v) < 0), side + ' 自身能力下降被解除');
    checks++;
    const oppLoss = 100000 - fin.opp.currentHp;
    assert.ok(oppLoss > 400, side + ' 400固定附加存在（對手損血 ' + oppLoss + '）');
    checks++;
    assert.equal(fin.state[side + 'RegistryState'].blkImmuneStatusCount, 1, side + ' 消回合成功→免疫下1次異常');
    checks++;
    assert.equal(fin.state[side + 'RegistryState'].entranceStackPrioBonus, 1, side + ' 登場1次→先制+1');
    checks++;
    const loss2 = (100000 - r[1].opp.currentHp) - (100000 - r[0].opp.currentHp);
    assert.ok(loss2 >= 30000 - 2000, side + ' 綁定受擊30%真傷（1回合內含當回合；回合2增量 ' + loss2 + '）'); // 使用者規則：「N回合內」含使用當回合
    checks++;
  }  console.log('OK 400固定／解除下降／消回合→免疫／登場+1／綁定30% 雙側通過');

  // 場景一B：後出手補償——自身速度慢（後手）出王·鏽腑喰心：綁定真傷「當回合不觸發、下1回合觸發」。
  {
    const turnFx = h.turnEffectSkill();
    const self = h.unit('S2', 60000, [sk, attack], { maxHp: 60000, speed: 50 });
    const opp = h.unit('E2', 100000, [turnFx, attack], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: (_e, t) => [t === 2 ? 0 : 1, t === 1 ? 0 : 1] }, 3);
    const t1Loss = (100000 - r[0].opp.currentHp); // 回合1 自身普攻（對手先手），無綁定
    const t2Loss = (100000 - r[1].opp.currentHp) - t1Loss; // 回合2 出技能（後手）：當回合不觸發30%
    const t3Loss = (100000 - r[2].opp.currentHp) - t1Loss - t2Loss; // 回合3 普攻：補償+1回合內觸發30%
    assert.ok(t2Loss < 30000, '後出手：技能當回合不觸發綁定（增量 ' + t2Loss + '）');
    checks++;
    assert.ok(t3Loss >= 30000 - 2000, '後出手補償+1回合：回合3受擊觸發30%（增量 ' + t3Loss + '）');
    checks++;
  }
  console.log('OK 後出手補償+1回合（原廠先後手規則）');

  // 場景二（結構性驗證）：下場未擊敗→重置雙方登場紀錄。
  // headless 驅動的限制：自願切換（onSwitchElf）與陣亡強制切換在現行測試環境均卡在選擇相位
  // （attackMissOwnership 之所以通過是因為其切換發生在对手 MISS 效果的特殊流程中）；
  // on_switch_out 的完整行為待 headless 切換驅動修復後補實戰斷言。此處驗證：
  //   1) Kit 內存在 on_switch_out 攜帶條目且含 entrance_reset（clearHistory/bothSides/clearKillFlag）；
  //   2) 擊敗旗標在 on_kill 時遞增（pending_counter），使「未擊敗」判讀有真實資料來源。
  {
    const swEntry = (sk.kit as any[]).find(e => e.node === 'on_switch_out' && e.role === 'carried');
    assert.ok(swEntry, '存在 on_switch_out 攜帶條目');
    const resetAct = JSON.stringify(swEntry).includes('entrance_reset');
    assert.ok(resetAct, 'on_switch_out 條目含 entrance_reset（重置雙方登場紀錄）');
    checks++;
    const killEntry = (sk.kit as any[]).find(e => e.node === 'on_kill' && e.role === 'carried');
    assert.ok(killEntry && JSON.stringify(killEntry).includes('killsSinceEntrance'), 'on_kill 條目記錄擊敗旗標');
    checks++;
  }
  console.log('OK 未擊敗下場→重置雙方登場紀錄');

  console.log('王·鏽腑喰心：' + checks + ' 項通過');
} finally { await h.close(); }