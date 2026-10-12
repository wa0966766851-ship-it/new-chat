// P2 第二批：vampire、pp_zero、dmg_cap_turns、at_round_end、遞增參數、結算後條件、印記條件的連鎖合約與執行。
import assert from 'node:assert/strict';
import { OPS } from '../src/blocks/runtime';
import { sequenceIssue } from '../src/effects/sequenceContract';

let count = 0;
const check = (name: string, run: () => void) => { run(); count++; console.log(`✓ ${name}`); };
const clause = (acts: any[], trig = 'use', cond: any[] = []) => ({ raw: '測試', trig, parsed: true, body: [{ acts, ...(cond.length ? { cond } : {}) }] });
const act = (op: string, p: any) => ({ op, p, label: op });

check('合約放行：吸血、PP歸零、受傷上限、回合結束時、遞增參數', () => {
  assert.equal(sequenceIssue(clause([act('vampire', { ratio: 0.5, kind: '攻擊' })])), null);
  assert.equal(sequenceIssue(clause([act('pp_zero', { kind: '屬性' })])), null);
  assert.equal(sequenceIssue(clause([act('pp_zero', {})])), null);
  assert.equal(sequenceIssue(clause([act('dmg_cap_turns', { turns: 3, cap: 200 })])), null);
  assert.equal(sequenceIssue(clause([act('at_round_end', { body: [{ acts: [act('heal_flat', { amount: 50 })] }], text: '恢復50' })])), null);
  assert.equal(sequenceIssue(clause([act('dmg', { flat: 100, type: '固定', rampInc: 50, rampCap: 300 })])), null);
});
check('合約拒絕：缺比例／範圍不明／缺期限／巢狀含未核對動作／遞增上限無增量', () => {
  assert.ok(sequenceIssue(clause([act('vampire', { ratio: 0, kind: '攻擊' })])));
  assert.ok(sequenceIssue(clause([act('vampire', { ratio: 0.5, kind: '宇宙' })])));
  assert.ok(sequenceIssue(clause([act('pp_zero', { kind: '全部' })])));
  assert.ok(sequenceIssue(clause([act('dmg_cap_turns', { cap: 200 })])));
  assert.ok(sequenceIssue(clause([act('at_round_end', { body: [{ acts: [act('custom', { key: 'x' })] }] })])));
  assert.ok(sequenceIssue(clause([act('dmg', { flat: 100, type: '固定', rampCap: 300 })])));
  assert.ok(sequenceIssue(clause([act('heal_flat', { amount: 1, rampInc: -5 })])));
});
check('擊敗／未擊敗／致命一擊只在結算後事件判斷；印記條件需名稱', () => {
  const heal = [act('heal_flat', { amount: 10 })];
  for (const c of ['kill', 'nokill', 'crit']) {
    assert.ok(sequenceIssue(clause(heal, 'use', [{ c, p: {}, label: '' }])), `${c} 在使用技能時拒絕`);
    assert.equal(sequenceIssue(clause(heal, 'after_hit', [{ c, p: {}, label: '' }])), null, `${c} 在命中後放行`);
  }
  assert.equal(sequenceIssue(clause(heal, 'use', [{ c: 'has_mark', p: { side: 'opp', name: '星火之灼' }, label: '' }])), null);
  assert.ok(sequenceIssue(clause(heal, 'use', [{ c: 'has_mark', p: { side: 'opp' }, label: '' }])));
});

const skill = (name: string, pp: number, category: string) => ({ name, pp, currentPp: pp, maxPp: 20, category, type: '普通', power: 0 });
function context(actor: 'p1' | 'p2', protect = false) {
  const other = actor === 'p1' ? 'p2' : 'p1';
  const self: any = { id: 'self', battleId: 'self', skills: [skill('自', 10, '物理')] };
  const enemy: any = { id: 'enemy', battleId: 'enemy', skills: [skill('攻', 10, '物理'), skill('屬', 10, '屬性'), skill('特', 7, '特殊')] };
  const teams: any = { [actor]: [self], [other]: [enemy] };
  const events: any[] = [];
  const ctx: any = {
    actor, targetSide: other, self, get target() { return teams[other][0]; },
    activeP1: actor === 'p1' ? self : enemy, activeP2: actor === 'p2' ? self : enemy,
    getFullTeam: (s: string) => teams[s], updateElf: (s: string, p: any) => { teams[s][0] = { ...teams[s][0], ...p }; },
    addLog() {}, emitElfEvent: (...a: any[]) => events.push(a), p1Timers: [], p2Timers: [],
  };
  ctx.updateAnyElf = (s: string, _id: string, p: any) => ctx.updateElf(s, p);
  void protect;
  return { ctx, pp: (s: string) => teams[s][0].skills.map((k: any) => k.pp), other, events };
}
for (const actor of ['p1', 'p2'] as const) {
  check(`${actor} pp_zero 走 PP 操作入口：只歸零指定範圍並派發 PP 變化`, () => {
    const h = context(actor);
    assert.equal(OPS.pp_zero(h.ctx, { kind: '屬性' }, {} as any), true);
    assert.deepEqual(h.pp(h.other), [10, 0, 7]);
    assert.ok(h.events.length > 0, '派發 PP_CHANGED');
    const g = context(actor);
    OPS.pp_zero(g.ctx, { kind: '攻擊' }, {} as any);
    assert.deepEqual(g.pp(g.other), [0, 10, 0]);
    const f = context(actor);
    OPS.pp_zero(f.ctx, {}, {} as any);
    assert.deepEqual(f.pp(f.other), [0, 0, 0]);
    assert.deepEqual(f.pp(actor), [10], '不影響自身');
  });
}
console.log(`${count} checks`);
