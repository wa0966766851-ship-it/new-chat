import assert from 'node:assert/strict';
import { OPS } from '../src/blocks/runtime';
import { parseSkill } from '../src/blocks/parse';

let count = 0;
const check = (name: string, run: () => void) => { run(); count++; console.log(`✓ ${name}`); };
const skill = (name: string, pp: number, maxPp = 20) => ({ name, pp, currentPp: pp, maxPp, category: '屬性', type: '普通', power: 0 });

function context(actor: 'p1' | 'p2', selfPp: number[], oppPp: number[], restriction = 0) {
  const other = actor === 'p1' ? 'p2' : 'p1';
  const self: any = { id: 'self', battleId: 'self', skills: selfPp.map((n, i) => skill(`自${i}`, n)) };
  const enemy: any = { id: 'enemy', battleId: 'enemy', skills: oppPp.map((n, i) => skill(`敵${i}`, n)) };
  const teams: any = { [actor]: [self], [other]: [enemy] };
  const ctx: any = {
    actor, targetSide: other, self, target: enemy,
    activeP1: actor === 'p1' ? self : enemy, activeP2: actor === 'p2' ? self : enemy,
    getFullTeam: (s: string) => teams[s], updateElf: (s: string, p: any) => { teams[s][0] = { ...teams[s][0], ...p }; },
    addLog() {}, emitElfEvent() {}, p1Timers: [], p2Timers: [],
  };
  ctx.updateAnyElf = (s: string, _id: string, p: any) => ctx.updateElf(s, p);
  // 恢復限制掛在自己身上（與連鎖路徑相同的 payload 讀取端）
  if (restriction) ctx[`${actor}Timers`] = [{ id: '限', remaining: 2, ownerBattleId: 'self', payload: { ppRecoveryReductionPercent: restriction } }];
  const pp = (s: string) => teams[s][0].skills.map((k: any) => k.pp);
  return { ctx, pp, other };
}

for (const actor of ['p1', 'p2'] as const) {
  check(`${actor} 解析：沒寫數字＝recover，寫99點＝add 99，不再用99哨兵`, () => {
    const full = parseSkill('補滿', '🎯 恢復自身所有技能PP值');
    const n99 = parseSkill('九九', '🎯 恢復自身所有技能99點PP值');
    const a = (full as any).clauses[0].body[0].acts[0], b = (n99 as any).clauses[0].body[0].acts[0];
    assert.equal(a.op, 'pp_restore'); assert.deepEqual(a.p, { mode: 'recover' });
    assert.equal(b.op, 'pp_restore'); assert.deepEqual(b.p, { v: 99 });
  });
  check(`${actor} pp_restore recover 補滿；add 受上限限制`, () => {
    const h = context(actor, [3, 18], [5]);
    OPS.pp_restore(h.ctx, { mode: 'recover' }, {} as any);
    assert.deepEqual(h.pp(actor), [20, 20]);
    const g = context(actor, [3, 18], [5]);
    OPS.pp_restore(g.ctx, { v: 4 }, {} as any);
    assert.deepEqual(g.pp(actor), [7, 20]);
  });
  check(`${actor} pp_restore 受「PP恢復減少」限制（recover 與 add 都不得繞過）`, () => {
    const h = context(actor, [0, 10], [5], 0.5);
    OPS.pp_restore(h.ctx, { v: 10 }, {} as any);
    assert.deepEqual(h.pp(actor), [5, 15]);
    const g = context(actor, [0, 10], [5], 1);
    OPS.pp_restore(g.ctx, { mode: 'recover' }, {} as any);
    assert.deepEqual(g.pp(actor), [0, 10]);
  });
  check(`${actor} pp_drain：吸取＝對手-N且自己+N；降低只扣對手`, () => {
    const h = context(actor, [3, 3], [5, 1]);
    OPS.pp_drain(h.ctx, { v: 2, steal: true }, {} as any);
    assert.deepEqual(h.pp(h.other), [3, 0]); assert.deepEqual(h.pp(actor), [5, 5]);
    const g = context(actor, [3, 3], [5, 1]);
    OPS.pp_drain(g.ctx, { v: 2 }, {} as any);
    assert.deepEqual(g.pp(g.other), [3, 0]); assert.deepEqual(g.pp(actor), [3, 3]);
  });
  check(`${actor} pp_restore_opp 對手各技能 +N／補滿，且不動自己`, () => {
    const h = context(actor, [3], [5, 19]);
    OPS.pp_restore_opp(h.ctx, { v: 4 }, {} as any);
    assert.deepEqual(h.pp(h.other), [9, 20]); assert.deepEqual(h.pp(actor), [3]);
    const g = context(actor, [3], [5, 19]);
    OPS.pp_restore_opp(g.ctx, { mode: 'recover' }, {} as any);
    assert.deepEqual(g.pp(g.other), [20, 20]);
  });
}
console.log(`PP 積木操作語意 ${count} 項通過（P1/P2、上限、恢復限制、吸取與降低分離）。`);
