import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { MIGRATED_5014_CAN_SOUL_KIT } from '../src/data/migrated5014CanSoulKit';
import { sequenceIssue } from '../src/effects/sequenceContract';

const h = await createHarness();
try {
  const guard = MIGRATED_5014_CAN_SOUL_KIT.kit.find(e => e.order === 0)!;
  for (const entry of MIGRATED_5014_CAN_SOUL_KIT.kit) assert.equal(sequenceIssue(entry.params.clause, entry.node), null, entry.customText);
  for (const ratio of [NaN, Infinity, 0, -1, 2]) {
    assert.ok(sequenceIssue({ raw: '恢復轉傷', parsed: true, trig: 'damaged', body: [
      { acts: [{ op: 'heal_as_percent_damage', p: { ratio }, label: '恢復轉傷' }] },
    ] }));
  }
  const tests = [
    { name: '傷後恢復與回合末等量傷害', hp: 500, amount: 300, type: '固定', expected: 700, returned: 300, marks: 1 },
    { name: '滿血附近只計實際恢復', hp: 899, amount: 300, type: '百分比', expected: 900, returned: 101, marks: 1 },
    { name: '連續兩次結算各自保留實際恢復量', hp: 500, amount: 300, type: '固定', count: 2, expected: 900, returned: 600, marks: 2 },
    { name: '真實傷害不減免不恢復', hp: 500, amount: 300, type: '真實', expected: 200, returned: 0, marks: 0 },
    { name: '零傷害不憑空給聖芒', hp: 500, amount: 0, type: '固定', expected: 500, returned: 0, marks: 0 },
    { name: '致死後不恢復不產生反傷', hp: 500, amount: 3000, type: '固定', expected: 0, returned: 0, marks: 1 },
    { name: '禁療不產生等量傷害', hp: 500, amount: 300, type: '固定', blockedHeal: true, expected: 400, returned: 0, marks: 1 },
  ];
  for (const side of ['p1', 'p2'] as const) for (const spec of tests) {
    const soul = { name: '燦減傷結算條款', effectMode: 'kit', description: '', kit: [structuredClone(guard)] };
    const hit = h.kitSkill('傷害', Array.from({ length: spec.count ?? 1 }, () => ({ op: 'dmg', p: { flat: spec.amount, type: spec.type } })));
    const self = h.unit('guard', spec.hp, [h.wait()], { maxHp: 900, speed: 200, extra: { soulMark: soul } });
    const opp = h.unit('attacker', 10000, [hit]);
    const [r] = await h.play(side, { self, opp, turns: (engine: any) => {
      if (spec.blockedHeal) engine.getState()[`${side}RegistryState`].noHealTurns = 2;
      return [0, 0];
    } });
    assert.equal(r.self.currentHp, spec.expected, `${side} ${spec.name}:自身HP\n${r.logs.join('\n')}`);
    assert.equal(r.opp.currentHp, 10000 - spec.returned, `${side} ${spec.name}:回合末HP`);
    const marks = r.state[`${side}Marks`].find((m: any) => m.id === 'canGlory');
    assert.equal(marks?.count ?? 0, spec.marks, `${side} ${spec.name}:聖芒層數`);
    if (marks) assert.equal(marks.scope, 'team');
    assert.ok(!r.state[`${side}Timers`].some((t: any) => t.id.startsWith('heal_return:')), '一次性結算不可殘留');
    console.log(`✓ ${side} ${spec.name}`);
  }
  for (const side of ['p1', 'p2'] as const) for (const layers of [0, 1, 3]) {
    const grant = h.kitSkill('聖芒來源', layers ? [{ op: 'resource_mark_add', p: {
      id: 'canGlory', name: '燦界聖芒', displayChar: '芒', unit: '層', side: 'self', scope: 'team',
      persistsOffField: true, amount: layers, maxCount: 3, description: '下場保留',
    } }] : []);
    const self = h.unit('source', 900, [grant], { extra: { soulMark: { name: '交付條款', description: '', effectMode: 'kit', kit: [MIGRATED_5014_CAN_SOUL_KIT.kit.find(e => e.order === 1)!] } } });
    const bench = h.unit('recipient', 500, [h.wait()], { maxHp: 900 });
    const hit = h.kitSkill('傷害', [{ op: 'dmg', p: { flat: 300, type: '固定' } }]);
    const history = await h.play(side, { self, selfBench: [bench], opp: h.unit('enemy', 10000, [hit, h.wait()]),
      turns: (_, turn) => [turn === 2 ? { switch: 1 } : 0, turn === 1 ? 1 : 0],
    }, layers + 3);
    let hp = 500, targetHp = 10000;
    for (let i = 1; i < history.length; i++) {
      const active = i <= layers + 1;
      hp -= active ? 100 : 300;
      if (active) { const healed = Math.min(300, 900 - hp); hp += healed; targetHp -= healed; }
      assert.equal(history[i].self.currentHp, hp, `${side} ${layers}層繼承第${i}回合HP`);
      assert.equal(history[i].opp.currentHp, targetHp, `${side} ${layers}層繼承回合末傷害`);
    }
    assert.equal(history.at(-1).state[`${side}Marks`].find((m: any) => m.id === 'canGlory')?.count ?? 0, layers, '繼承者不增加聖芒');
    console.log(`✓ ${side} ${layers}層：下場後繼承${1 + layers}回合、到期恢復原傷害`);
  }
  for (const side of ['p1', 'p2'] as const) for (const initialDef of [0, 1]) {
    const entry = MIGRATED_5014_CAN_SOUL_KIT.kit.find(e => e.order === 2)!;
    const self = h.unit('source', 900, [h.wait()], { speed: 200, statStages: { def: initialDef }, extra: {
      soulMark: { name: '能力判定條款', effectMode: 'kit', description: '', kit: [entry] },
    } });
    const [r] = await h.play(side, { self, opp: h.unit('enemy', 10000, [h.wait()]) });
    assert.equal(r.self.statStages.spatk, 2);
    assert.equal(r.self.statStages.speed, 2);
    assert.equal(r.opp.statStages.spdef, -2);
    assert.equal(r.state[`${side}RegistryState`].weakPointDefenseTurns ?? 0, initialDef === 0 ? 1 : 0,
      `${side} 能力變更後六維總和${10 + initialDef}弱點期限`);
    console.log(`✓ ${side} 能力變更後${10 + initialDef}邊界與弱點實際期限`);
  }
  for (const side of ['p1', 'p2'] as const) for (const duration of [0, 2]) {
    const grant = h.kitSkill('聖芒來源', [{ op: 'resource_mark_add', p: {
      id: 'canGlory', name: '聖芒', displayChar: '芒', unit: '層', side: 'self', scope: 'team',
      persistsOffField: true, amount: 1, maxCount: 3, description: '回合判定',
    } }, { op: 'turn_key_set', p: { side: 'self', key: 'observedOpponentSkillTurns', turns: 1 } }]);
    // 直接驗證階段末條款；不讓其他技能的能力變更、珀妮或魂印子句混入數值。
    const phases = MIGRATED_5014_CAN_SOUL_KIT.kit.filter(e => e.order === 5 || e.order === 6);
    const self = h.unit('source', 900, [grant], { speed: 300, extra: {
      soulMark: { name: '階段末條款', description: '', effectMode: 'kit', kit: phases } } });
    // 控制會阻止出手，因此直接用開局積木授予資源；仍由正式引擎階段末結算。
    self.soulMark.kit = [{ codeId: 'effect_sequence', node: 'battle_start', source: 'soulmark', role: 'innate', order: 0,
      params: { clause: { raw: '測試資源', trig: 'battle_start', parsed: true, body: grant.kit[0].params.clause.body } } }, ...phases];
    const moves = [{ ...h.wait(), pp: 20, maxPp: 20 }, { ...h.wait(), name: '八點', pp: 8 }, { ...h.wait(), name: '一點', pp: 1 }, { ...h.wait(), name: '零點', pp: 0 }];
    const opp = h.unit('enemy', 10000, moves);
    const { getStatuses, addStatusEffect } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
    addStatusEffect(self, '疲憊', 20);
    if (duration) { addStatusEffect(self, '星贖', duration); addStatusEffect(opp, '星贖', 3); }
    const [r] = await h.play(side, { self, opp });
    // 星贖本身會令非限制類異常每回合+1，抵銷本次自然-1；須保留其真實效果。
    assert.equal(getStatuses(r.self)['疲憊'], duration ? 10 : 19, `${side} 控制回合按星贖總回合×層數×2縮短`);
    assert.deepEqual(r.opp.skills.map((s: any) => s.pp), duration ? [14, 3, 1, 0] : [19, 8, 1, 0]);
    assert.deepEqual(r.opp.skills.slice(2).map((s: any) => s.maxPp), duration ? [1, 1] : [99, 99]);
    console.log(`✓ ${side} 星贖總回合${duration ? 5 : 0}：控制減少、PP下限與上限`);
  }
} finally { await h.close(); }
