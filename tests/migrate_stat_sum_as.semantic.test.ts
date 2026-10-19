// 通用 op stat_sum_as／stat_sum_as_restore（組1擁有；雙攻總和視為特攻）P1/P2 雙側正式引擎測試。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { sequenceIssue } = await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const bad = (p: any) => sequenceIssue({ raw: 'x', trig: 'use', parsed: true, body: [{ acts: [{ op: 'stat_sum_as', p, label: 'x' }] }] });
  assert.equal(bad({ from: ['atk', 'spatk'], as: 'spatk' }), null, '合法參數通過合約');
  assert.ok(bad({ from: ['atk'], as: 'atk' }), '少於兩項拒絕');
  assert.ok(bad({ from: ['atk', 'spatk'], as: 'def' }), 'as 不在 from 拒絕');
  assert.ok(bad({ from: ['atk', 'spatk'], as: 'spatk', side: 'x' }), '非法 side 拒絕');
  assert.ok(bad({ from: ['atk', 'foo'], as: 'atk' }), '非法能力鍵拒絕');
  checks++; console.log('OK 合約檢查');

  const sumSkill = (p: any) => h.kitSkill('合算', [{ op: 'stat_sum_as', p }]);
  const restore = (p: any) => h.kitSkill('還原', [{ op: 'stat_sum_as_restore', p }]);
  for (const side of ['p1', 'p2'] as const) {
    // 自身：特攻 = 攻擊+特攻；重複觸發不複利；還原回原值；對手不受影響
    {
      const self = h.unit('S', 10000, [sumSkill({ from: ['atk', 'spatk'], as: 'spatk' }), restore({ as: 'spatk' })]);
      self.calculatedStats.atk = 400; self.calculatedStats.spatk = 250;
      const opp = h.unit('E', 10000, [h.wait()]);
      const [r1, r2, r3] = await h.play(side, { self, opp, turns: (_e, t) => [t === 3 ? 1 : 0, 0] }, 3);
      assert.equal(r1.self.calculatedStats.spatk, 650, side + ' 特攻視為雙攻總和');
      assert.equal(r1.self.calculatedStats.atk, 400, side + ' 攻擊本身不變');
      assert.equal(r1.opp.calculatedStats.spatk, 300, side + ' 對手不受影響');
      assert.equal(r2.self.calculatedStats.spatk, 650, side + ' 重複觸發不複利');
      assert.equal(r3.self.calculatedStats.spatk, 250, side + ' 還原回原特攻');
      checks++;
    }
    // 對手側 side:'opp'
    {
      const self = h.unit('S', 10000, [sumSkill({ from: ['def', 'spdef'], as: 'spdef', side: 'opp' })]);
      const opp = h.unit('E', 10000, [h.wait()]);
      opp.calculatedStats.def = 500; opp.calculatedStats.spdef = 100;
      const [r] = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.equal(r.opp.calculatedStats.spdef, 600, side + ' 對手特防視為雙防總和');
      assert.equal(r.self.calculatedStats.spdef, 300, side + ' 自身不受影響');
      checks++;
    }
  }
  console.log(`stat_sum_as: ${checks} checks passed`);
} finally { await h.close(); }
