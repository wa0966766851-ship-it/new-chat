import assert from 'node:assert/strict';
import { distillEffect } from '../src/effects/distillEffect';
import { kitEntryIssue } from '../src/effects/effectConnection';
import { skillBasePriority } from '../src/battle/conditionalPriority';
import { runNode } from '../src/effects/effectRunner';

let count = 0;
const check = (name: string, run: () => void) => { run(); count++; console.log(`✓ ${name}`); };

function world(side: 'p1' | 'p2') {
  const other = side === 'p1' ? 'p2' : 'p1';
  const me: any = { id: 'self', battleId: 'self', currentHp: 500, maxHp: 1000, statStages: {}, skills: [] };
  const foe: any = { id: 'enemy', battleId: 'enemy', currentHp: 900, maxHp: 1000, statStages: {}, skills: [] };
  const teams: any = { [side]: [me], [other]: [foe] };
  const state: any = {}; const timers: any[] = [];
  const ctx: any = {
    actor: side, targetSide: other, goesFirst: true, roundNumber: 1, moveIndex: 0, skill: { name: '測試', category: '屬性' },
    get self() { return teams[side][0]; }, get target() { return teams[other][0]; },
    get activeP1() { return teams.p1[0]; }, get activeP2() { return teams.p2[0]; },
    getFullTeam: (s: string) => teams[s], getStatuses: (e: any) => e.battleStatuses || {}, getMarks: () => [],
    addLog() {}, emitElfEvent() {}, showPopup() {},
    getPlayerState: (k: string) => state[`${side}:${k}`], getOpponentState: (k: string) => state[`${other}:${k}`],
    setPlayerState: (k: string, v: any) => { state[`${side}:${k}`] = v; }, setOpponentState: (k: string, v: any) => { state[`${other}:${k}`] = v; },
    updateElf: (s: string, p: any) => { teams[s][0] = { ...teams[s][0], ...p }; },
    updateAnyElf: (s: string, _i: string, p: any) => { teams[s][0] = { ...teams[s][0], ...p }; },
    clearTurnEffectsOf: () => false, addTimerTo: (s: string, t: any) => { timers.push([s, t]); }, p1Timers: [], p2Timers: [],
  };
  return { ctx, state, timers, other };
}
const kitOf = (description: string) => {
  const r = distillEffect({ name: '測試', description }, 'skill');
  assert.equal(r.complete, true, `${description}: ${JSON.stringify(r.issues)}`);
  assert.equal(r.kit.length, 1, description);
  assert.equal(kitEntryIssue(r.kit[0]), null, description);
  return r.kit;
};
const run = (description: string, side: 'p1' | 'p2') => {
  if (process.env.DBG) console.log(JSON.stringify(kitOf(description)));
  const w = world(side); runNode("on_skill_use", kitOf(description), {} as any, w.ctx); if (process.env.DBG) console.log(JSON.stringify([w.state, w.timers])); return w;
};

for (const side of ['p1', 'p2'] as const) {
  check(`${side} 下2回合先制+3 → 自身先制狀態`, () => {
    const w = run('下2回合先制+3', side);
    assert.equal(w.state[`${side}:priorityBoostValue`], 3);
    assert.ok(w.state[`${side}:priorityBoostTurns`] >= 2);
  });
  check(`${side} 免疫下2次異常 → 異常次數 2，只加在自己`, () => {
    const w = run('免疫下2次異常狀態', side);
    assert.equal(w.state[`${side}:blkImmuneStatusCount`], 2);
    assert.equal(w.state[`${w.other}:blkImmuneStatusCount`], undefined);
  });
  check(`${side} 下2回合對手所有技能先制-2 → 計時器掛在對手`, () => {
    const w = run('下2回合對手所有技能先制-2', side);
    const t = w.timers.find(([s]: any) => s === w.other); assert.ok(t, '對手計時器');
    assert.equal(t[1].payload.block.prio, -2); assert.equal(w.state[`${side}:priorityBoostValue`], undefined);
  });
  check(`${side} 3回合內免疫控制類異常狀態 → 分類守衛計時器掛在自己`, () => {
    const w = run('3回合內免疫控制類異常狀態', side);
    const t = w.timers.find(([s]: any) => s === side); assert.ok(t); assert.equal(t[1].payload.block.statusGuard.cls, '控制類');
  });
  check(`${side} 2回合內免疫能力下降 → immuneStatDownTurns`, () => {
    const w = run('2回合內免疫能力下降', side); assert.ok(w.state[`${side}:immuneStatDownTurns`] >= 2);
  });
  check(`${side} 免疫下1次攻擊 → blockAttackCount 1`, () => {
    const w = run('免疫下1次受到的攻擊', side);
    assert.equal(w.state[`${side}:blockAttackCount`], 1);
    assert.equal(w.state[`${w.other}:blockAttackCount`], undefined);
  });
}
check('下2回合免疫能力下降、3回合免疫控制類異常、對手先制-2 都可煉成且合約通過', () => {
  for (const d of ['2回合內免疫能力下降', '3回合內免疫控制類異常狀態', '下2回合對手所有技能先制-2']) kitOf(d);
});
check('不完整句不會被部分轉換', () => {
  const r = distillEffect({ name: '測試', description: '下2回合先制+3\n宇宙折疊沒有定義' }, 'skill');
  assert.equal(r.complete, false);
});
check('（無特殊效果）可煉成；必中／先制等屬性不能用空動作冒充', () => {
  assert.equal(distillEffect({ name: '測試', description: '（無特殊效果）' }, 'skill').complete, true);
  for (const d of ['必中', '先制+2', '自身處於能力下降狀態時先制+3']) assert.equal(distillEffect({ name: '測試', description: d }, 'skill').complete, false, d);
});
check('條件先制句 → skill_property：成立時加在欄位先制上，不成立不加；多句可疊加', () => {
  const kitOfSkill = (d: string, priority: number) => {
    const r = distillEffect({ name: '條件先制測試', description: d }, 'skill'); assert.equal(r.complete, true, d);
    return { name: '條件先制測試', effectMode: 'kit', priority, kit: r.kit } as any;
  };
  const down = { statStages: { atk: -1 } }, flat = { statStages: {} };
  const getStatuses = () => ({});
  const one = kitOfSkill('■ 自身處於能力下降狀態時先制+3', 0);
  assert.equal(one.kit[0].codeId, 'skill_property');
  assert.equal(skillBasePriority(one, down, flat, getStatuses), 3);
  assert.equal(skillBasePriority(one, flat, flat, getStatuses), 0);
  const withBase = kitOfSkill('■ 自身處於能力下降狀態時先制+3', 1);
  assert.equal(skillBasePriority(withBase, down, flat, getStatuses), 4);
  assert.equal(skillBasePriority(withBase, flat, flat, getStatuses), 1);
  const two = kitOfSkill('■ 先制+1\n■ 自身處於能力下降狀態時先制+3', 0);
  assert.equal(skillBasePriority(two, down, flat, getStatuses), 4);
  assert.equal(skillBasePriority(two, flat, flat, getStatuses), 1);
  assert.equal(distillEffect({ name: '測試', description: '🎯 自身處於能力下降狀態時先制+3' }, 'skill').complete, false);
});
console.log(`${count} checks`);
