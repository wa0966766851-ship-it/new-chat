import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { MIGRATED_FINAL_C_TRAIT_KITS } from '../src/data/migratedFinalCKits';
import { validateKit } from '../src/effects/kitValidation';
import { sequenceIssue } from '../src/effects/sequenceContract';
import { groupCOperations } from '../src/blocks/ops/groupC';
import { GENERAL_TRAITS } from '../src/data/generalTraits';
import { readStatPercent } from '../src/effects/soulProperty';

const trait = { ...MIGRATED_FINAL_C_TRAIT_KITS[0], effectMode: 'kit' };
validateKit(trait.kit);
for (const k of trait.kit.filter(k => k.codeId === 'effect_sequence')) assert.equal(sequenceIssue(k.params.clause, k.node), null);
const h = await createHarness();
try {
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const attack = h.kitSkill('帶附加真傷的攻擊', [{ op: 'dmg', p: { flat: 6000, type: '真實' } }], { type: '水', category: '物理', power: 90, isSureHit: true });
    const equipped = { generalTrait: { ...GENERAL_TRAITS.亂舞 } };
    const both = h.unit('both', 1000, [attack], { extra: { trait, alienTraits: equipped } });
    assert.equal(readStatPercent(both, 'atk'), 12, '內建與自己裝備的同名效果只算一次');
    const unitWithChoice = { alienTraits: equipped, critValue: 0 };
    let selected = '';
    const [r] = await h.play(side, {
      self: h.unit('S', 100000, [attack], { type: '火', extra: unitWithChoice }),
      opp: h.unit('E', 100000, [h.wait()]),
      oppBench: [h.unit('B', 20000, [h.wait()], { type: '草' }), h.unit('X', 20000, [h.wait()], { type: '草', extra: { isExtra: true } })],
      turns(engine) {
        const s = engine.getState();
        selected = s[side].preparedExtraAttack?.ids[0];
        assert.ok(['B', 'X'].includes(selected), '登場完成、選招前已有預選目標');
        return [0, 0];
      },
    });
    const team = r.state[`${other}Team`];
    const chosen = team.find((e: any) => e.id === selected), untouched = team.find((e: any) => ['B', 'X'].includes(e.id) && e.id !== selected);
    assert.ok(chosen.currentHp < 20000 && chosen.currentHp > 19000, `只計技能傷害，不追加6000真傷：${chosen.currentHp}`);
    assert.ok(20000 - chosen.currentHp < 60, '水技對草只算一次微弱，不另乘火系持有者的克制');
    assert.equal(untouched.currentHp, 20000);
    assert.ok(r.state[side].preparedExtraAttack, '回合末已預選下一回合');
    console.log(`✓ ${side} 登場預選、正式技能傷害、場下／額外目標、排除附加真傷`);

    const [fixed] = await h.play(side, {
      self: h.unit('S', 100000, [h.kitSkill('純固定傷害', [{ op: 'dmg', p: { flat: 1000, type: '固定' } }])], { extra: { alienTraits: equipped } }),
      opp: h.unit('E', 100000, [h.wait()]), oppBench: [h.unit('B', 20000, [h.wait()])],
    });
    assert.equal(fixed.state[`${other}Team`][1].currentHp, 20000);

    const history = await h.play(side, {
      self: h.unit('S', 100000, [h.wait()], { extra: { alienTraits: equipped } }),
      selfBench: [h.unit('reserve', 100000, [h.wait()])], opp: h.unit('E', 100000, [h.wait()]), oppBench: [h.unit('B', 20000, [h.wait()])],
      turns: (_engine, t) => t === 1 ? [{ switch: 1 }, 0] : [{ switch: 0 }, 0],
    }, 2);
    assert.equal(history[0].state[`${side}Team`][0].preparedExtraAttack, undefined, '下場移除');
    assert.deepEqual(history[1].self.preparedExtraAttack?.ids, ['B'], '重新登場重新預選');
    console.log(`✓ ${side} 純固定傷害不波及、離場清除、重登場預選`);
  }
  // 固定亂數核對抽籤時點：連續攻擊不重抽，回合末才替換；失效目標不偷抽另一隻。
  let self: any = h.unit('S', 1000, [h.wait()]), active = h.unit('E', 1000, [h.wait()]);
  const bench = [h.unit('B', 1000, [h.wait()]), h.unit('C', 1000, [h.wait()])];
  let roll = 0, damageCalls = 0;
  const ctx: any = { actor: 'p1', targetSide: 'p2', skill: { ...h.wait(), category: '物理', power: 90 }, isHit: true, mainSkillSettledAmount: 100,
    getFullTeam: () => [active, ...bench], rng: () => roll, updateAnyElf: (_s: any, _id: any, p: any) => { self = { ...self, ...p }; },
    applyDamageToElf: () => { damageCalls++; }, addLog() {} };
  const op = groupCOperations({ liveElf: (_ctx, s) => s === 'p1' ? self : active, ops: () => ({}) }).extra_random_target;
  const p = { pool: ['foe_bench'], count: 1 };
  op(ctx, { ...p, mode: 'prepare' }, {} as any); assert.deepEqual(self.preparedExtraAttack.ids, ['B']);
  roll = .99;
  op(ctx, { ...p, prepared: true }, {} as any); op(ctx, { ...p, prepared: true }, {} as any);
  assert.deepEqual(self.preparedExtraAttack.ids, ['B']); assert.equal(damageCalls, 2);
  op(ctx, { ...p, mode: 'prepare' }, {} as any); assert.deepEqual(self.preparedExtraAttack.ids, ['C']);
  bench[1].currentHp = 0; op(ctx, { ...p, prepared: true }, {} as any); assert.equal(damageCalls, 2);
  bench[1].currentHp = 1000; bench[1].isVanished = true; op(ctx, { ...p, prepared: true }, {} as any); assert.equal(damageCalls, 2);
  bench[1].isVanished = false;
  bench[1].currentHp = 1000; active = bench[1]; op(ctx, { ...p, prepared: true }, {} as any); assert.equal(damageCalls, 2);
  active = h.unit('E', 1000, [h.wait()]); ctx.mainSkillSettledAmount = 0; op(ctx, { ...p, prepared: true }, {} as any); assert.equal(damageCalls, 2);
  op(ctx, { mode: 'clear' }, {} as any); assert.equal(self.preparedExtraAttack, undefined);
  console.log('✓ 預選穩定、回合末替換、陣亡／出戰／零技能傷害不觸發、清除');
} finally { await h.close(); }
process.exit(0);
