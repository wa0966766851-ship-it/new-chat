import assert from 'node:assert/strict';
import { runNode } from '../src/effects/effectRunner';
import { atomEntryToSequence, kitToSequences } from '../src/effects/atomToSequence';
import { resetPrd } from '../src/utils/prd';
import type { KitEntry, Node } from '../src/effects/effectSystem.schema';

let count = 0;
const check = (name: string, run: () => void) => { run(); count++; console.log(`✓ ${name}`); };
const skill = (name: string, pp: number) => ({ name, pp, currentPp: pp, maxPp: 20, category: '屬性', type: '普通', power: 0 });

/** 同一個模擬戰鬥：記錄所有會影響戰局的呼叫（不含日誌）。 */
function world(actor: 'p1' | 'p2') {
  const other = actor === 'p1' ? 'p2' : 'p1';
  const self: any = { id: 'self', battleId: 'self', name: '我方', currentHp: 400, maxHp: 1000, statStages: { atk: 0, def: -2, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }, skills: [skill('甲', 5), skill('乙', 9)] };
  const enemy: any = { id: 'enemy', battleId: 'enemy', name: '對手', currentHp: 900, maxHp: 1000, statStages: { atk: 2, def: 0, spatk: 0, spdef: -1, speed: 0, accuracy: 0 }, skills: [skill('丙', 4), skill('丁', 1)] };
  const teams: any = { [actor]: [self], [other]: [enemy] };
  const calls: any[] = [];
  const rec = (name: string, ...args: any[]) => calls.push([name, ...args]);
  const ctx: any = {
    actor, targetSide: other, goesFirst: true,
    get self() { return teams[actor][0]; }, get target() { return teams[other][0]; },
    get activeP1() { return teams.p1[0]; }, get activeP2() { return teams.p2[0]; },
    getFullTeam: (s: string) => teams[s], getStatuses: (e: any) => e.battleStatuses || {}, getMarks: () => [],
    addLog() {}, emitElfEvent: (...a: any[]) => rec('event', a[0], a[2], a[3]?.reason), showPopup() {},
    getPlayerState: () => undefined, getOpponentState: () => undefined, setPlayerState() {}, setOpponentState() {},
    updateElf: (s: string, p: any) => { rec('updateElf', s, p); teams[s][0] = { ...teams[s][0], ...p }; },
    updateAnyElf: (s: string, _id: string, p: any) => { rec('updateAnyElf', s, p); teams[s][0] = { ...teams[s][0], ...p }; },
    applyHeal: (s: string, n: number) => { rec('heal', s, n); return n; },
    applyShield: (s: string, n: number) => { rec('shield', s, n); },
    applyFixedDamage: (s: string, n: number) => { rec('fixed', s, n); return n; },
    applyTrueDamage: (s: string, n: number) => { rec('true', s, n); return n; },
    applyPinkDamage: (s: string, n: number) => { rec('pink', s, n); return n; },
    applyPercentDamage: (s: string, r: number) => { rec('percent', s, r); return 0; },
    applySkillTypeDamage: (s: string, n: number) => { rec('skilltype', s, n); return n; },
    applyStatusWithImmunityCheck: (s: string, st: string, turns: number) => { rec('status', s, st, turns); return { success: true, immune: false }; },
    applyStatChange: (s: string, ch: any) => { rec('stat', s, ch); return { success: true, applied: ch }; },
    clearTurnEffectsOf: () => false, addTimerTo() {}, p1Timers: [], p2Timers: [], roundNumber: 1, moveIndex: 0, skill: { name: '測試', category: '屬性' },
  };
  return { ctx, calls };
}

const entry = (codeId: string, params: any, node: Node = 'on_skill_use', role: any = 'attached'): KitEntry =>
  ({ codeId, params, node, source: 'skill', role, order: 0, customText: `測試${codeId}` }) as KitEntry;

const cases: Array<[string, string, any]> = [
  ['heal', 'heal', { amount: 50, target: 'self' }], ['heal', 'heal', { ratio: 0.25 }], ['heal', 'heal', { mode: 'percent', amount: 12.5 }],
  ['extra_damage', 'fixed 80', { dmgType: 'fixed', amount: 80 }], ['extra_damage', 'true 30', { damageType: 'true', amount: 30 }],
  ['apply_status', '對手中毒2', { status: '中毒', duration: 2 }], ['apply_status', '自身麻痺', { status: '麻痺', turns: 3, target: 'self' }],
  ['apply_status', '預設3回合', { status: '燒傷' }],
  ['stat_change', '全+1自身', { stat: 'all', stages: 1, target: 'self' }], ['stat_change', '全-1對手', { all: -1, target: 'opponent' }],
  ['stat_change', '攻+2', { stat: 'atk', value: 2, target: 'self' }], ['stat_change', '特防-2', { stat: 'spDef', stages: -2, target: 'opponent' }],
  ['clear_stat', '消對手強化', { type: 'buff', target: 'opponent' }], ['clear_stat', '消自身弱化', { statType: 'drop', target: 'self' }],
  ['clear_stat', '全消對手', { type: 'all', target: 'opponent' }],
  ['shield', '120', { amount: 120 }],
  ['pp_op', '對手減2', { op: 'reduce', amount: 2 }], ['pp_op', '吸取2', { op: 'drain', amount: 2 }], ['pp_op', '自身加3', { op: 'add', amount: 3, target: 'self' }],
  ['pp_op', '對手歸零', { op: 'zero' }], ['pp_op', '自身補滿', { op: 'recover', target: 'self' }],
];
const nodes: Node[] = ['on_skill_use', 'on_hit', 'round_start', 'round_end', 'battle_start'];

for (const actor of ['p1', 'p2'] as const) for (const node of nodes) {
  check(`${actor}/${node}：${cases.length} 種原子轉成連鎖後，結算呼叫與原子完全一致`, () => {
    let converted = 0;
    for (const [atom, label, params] of cases) {
      const e = entry(atom, params, node);
      const seq = atomEntryToSequence(e);
      if (!seq) continue;
      converted++;
      assert.equal(seq.codeId, 'effect_sequence'); assert.equal(seq.node, node); assert.equal(seq.role, e.role);
      const a = world(actor), b = world(actor);
      runNode(node, [e], {}, a.ctx); runNode(node, [seq], {}, b.ctx);
      assert.ok(a.calls.length > 0, `${atom} ${label} 原子路徑沒有任何結算（測試本身無效）`);
      assert.deepEqual(b.calls, a.calls, `${atom} ${label} @${node}`);
    }
    assert.ok(converted >= 18, `可轉換數量不足：${converted}`);
  });
}

for (const actor of ['p1', 'p2'] as const) for (const rng of [0, 0.999]) {
  check(`${actor} 機率異常 rng=${rng}：轉換前後是否施加一致`, () => {
    for (const chance of [30, 70]) {
      const e = entry('apply_status', { status: '中毒', duration: 2, chance });
      const seq = atomEntryToSequence(e)!; assert.ok(seq);
      resetPrd(() => rng); const a = world(actor); runNode('on_skill_use', [e], {}, a.ctx);
      resetPrd(() => rng); const b = world(actor); runNode('on_skill_use', [seq], {}, b.ctx);
      assert.deepEqual(b.calls, a.calls, `chance=${chance}`);
    }
  });
}

check('不能完全等價的原子一律保留原樣（不近似替代）', () => {
  const keep: Array<[string, any, Node?]> = [
    ['heal', { amount: 50, target: 'opponent' }], ['heal', { amount: 12.5 }], ['heal', { amount: 0 }],
    ['extra_damage', { dmgType: 'percent', ratio: 0.1 }], ['extra_damage', { dmgType: 'skill', amount: 50, elem: '火' }],
    ['extra_damage', { dmgType: 'fixed', amount: 50, incremental: { stateKey: 'k', base: 1, step: 1, max: 5 } }],
    ['extra_damage', { dmgType: 'fixed', amount: 0 }], ['extra_damage', { dmgType: 'fixed', amount: 50, target: 'self' }],
    ['apply_status', { status: '中毒', duration: 0 }], ['stat_change', { atk: 1, def: 2 }], ['stat_change', { stat: 'all', stages: 0 }],
    ['shield', { amount: 100, shieldType: 'barrier' }], ['shield', { amount: 100, target: 'opponent' }],
    ['pp_op', { op: 'reduce', amount: 0 }], ['turn_effect_clear', {}], ['cure_status', {}], ['damage_multiplier', { multiplier: 2 }],
    ['heal', { amount: 50 }, 'before_damage'], ['heal', { amount: 50 }, 'on_damaged'], ['heal', { amount: 50 }, 'after_action'],
  ];
  for (const [atom, params, node] of keep) {
    const e = entry(atom, params, node ?? 'on_skill_use');
    assert.equal(atomEntryToSequence(e), null, `${atom} ${JSON.stringify(params)} @${node ?? 'on_skill_use'} 不應被轉換`);
  }
});

check('kitToSequences：混合清單只換可轉項、順序與角色不變、原資料不被修改', () => {
  const kit = [entry('heal', { amount: 10 }), entry('turn_effect_clear', {}), entry('shield', { amount: 5 }, 'on_skill_use', 'innate')];
  kit.forEach((e, i) => { e.order = i; });
  const before = JSON.stringify(kit);
  const out = kitToSequences(kit);
  assert.equal(JSON.stringify(kit), before);
  assert.deepEqual(out.map(e => e.codeId), ['effect_sequence', 'turn_effect_clear', 'effect_sequence']);
  assert.deepEqual(out.map(e => e.order), [0, 1, 2]); assert.equal(out[2].role, 'innate');
  assert.equal(kitToSequences([entry('turn_effect_clear', {})]).length, 1);
});
console.log(`原子→連鎖等價性 ${count} 項通過（P1/P2×5 節點、機率 PRD、保留清單）。`);
