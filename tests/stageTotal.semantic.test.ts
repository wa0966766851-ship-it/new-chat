import assert from 'node:assert/strict';
import { sequenceIssue } from '../src/effects/sequenceContract';
import { stageDamageEvalCond } from '../src/blocks/ops/stageDamage';
import { createHarness } from './helpers/migrationHarness';

const condition = (side = 'both', op = '不高於', amount = 10) => ({ c: 'stage_total', p: { side, op, amount }, label: '六維能力等級總和' });
const clause = (cond: any) => ({ raw: '能力等級總和不高於10時恢復17點體力', trig: 'use', parsed: true,
  body: [{ cond: [cond], acts: [{ op: 'heal_flat', p: { amount: 17 }, label: '恢復17' }] }] });

assert.equal(sequenceIssue(clause(condition())), null);
for (const invalid of [condition('team'), condition('both', '未知'), condition('both', '不高於', -1), condition('both', '不高於', 73), condition('both', '不高於', 0.5)]) {
  assert.ok(sequenceIssue(clause(invalid)), JSON.stringify(invalid));
}

const h = await createHarness();
try {
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const oldSelf = { id: 'self', statStages: {} }, oldOpp = { id: 'opp', statStages: {} };
    const liveSelf = { ...oldSelf, statStages: { atk: 2, def: -3, hp: 99 } };
    const liveOpp = { ...oldOpp, statStages: { spatk: -4, speed: 1 } };
    const ctx: any = { actor: side, targetSide: other, self: oldSelf, target: oldOpp,
      activeP1: side === 'p1' ? oldSelf : oldOpp, activeP2: side === 'p2' ? oldSelf : oldOpp,
      getFullTeam: (s: string) => [s === side ? liveSelf : liveOpp] };
    assert.equal(stageDamageEvalCond(ctx, condition()), true, `${side}: 從即時隊伍讀取正負絕對值10，忽略HP`);
    assert.equal(stageDamageEvalCond(ctx, condition('both', '低於', 10)), false);
    assert.equal(stageDamageEvalCond(ctx, condition('both', '等於', 10)), true);
    assert.equal(stageDamageEvalCond(ctx, condition('self', '等於', 5)), true);
    assert.equal(stageDamageEvalCond(ctx, condition('opp', '等於', 5)), true);
    liveOpp.statStages.speed = 2;
    assert.equal(stageDamageEvalCond(ctx, condition()), false, `${side}: 不沿用條件判斷前的舊快照`);

    // 正式引擎：同一段積木先變更能力，再以新值決定後續恢復。
    for (const initialTotal of [9, 10]) {
      const sk = h.kitSkill('能力總和門檻', []);
      const seq = sk.kit[0].params.clause;
      seq.body = [
        { acts: [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 1 }, label: '攻擊+1' }] },
        ...clause(condition()).body.map(stmt => ({ ...stmt, live: true })),
      ];
      assert.equal(sequenceIssue(seq), null);
      const self = h.unit('self', 100, [sk], { maxHp: 1000, speed: 300, statStages: { atk: 2, def: -3 } });
      const opp = h.unit('opp', 1000, [h.wait()], { statStages: { spatk: -(initialTotal - 5) } });
      const [result] = await h.play(side, { self, opp });
      assert.equal(result.self.statStages.atk, 3);
      assert.equal(result.self.currentHp, initialTotal === 9 ? 117 : 100,
        `${side}: 變更後總和${initialTotal + 1}的實際回血`);
    }
  }
  console.log('stage_total: 契約、即時六維絕對值、10/11邊界與P1/P2正式引擎通過');
} finally { await h.close(); }
