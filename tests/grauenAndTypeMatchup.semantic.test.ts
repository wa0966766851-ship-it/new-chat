import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { advanceStatusEffect } from '../src/battle/statusLifecycle';
import { validateKit } from '../src/effects/kitValidation';
import { GRAUEN_SEED } from '../src/data/grauen';
import { SEER_TYPES, getTypeMatchup } from '../src/utils/statCalculator';
import { battleTypeKey, typeQueryKey } from '../src/utils/typeQuery';

const outgoing: Record<string, number> = { 光: 2, 暗影: 2, 聖靈: 2, 次元: 2, 邪靈: 2, 混沌: 2, 冰: .5, 超能: .5, 自然: .5, 虛空: .5 };
const incoming: Record<string, number> = { 地面: 2, 冰: 2, 神秘: 2, 自然: 2, 虛空: 2, 光: .5, 聖靈: .5, 次元: .5, 遠古: .5, 邪靈: .5, 混沌: .5 };
for (const type of SEER_TYPES) {
  assert.equal(getTypeMatchup('轮回系', type), outgoing[type] ?? 1, '輪迴 → ' + type);
  assert.equal(getTypeMatchup(type, '轮回系'), incoming[type] ?? 1, type + ' → 輪迴');
}
assert.equal(typeQueryKey('水．混沌', SEER_TYPES), typeQueryKey('混沌水', SEER_TYPES));
assert.equal(typeQueryKey('电火系', SEER_TYPES), typeQueryKey('火/電', SEER_TYPES));
assert.equal(typeQueryKey('電.電', SEER_TYPES), undefined);
assert.equal(getTypeMatchup('轮回.火', '水.混沌'), getTypeMatchup('火輪迴', '混沌 / 水'));

const { loadSeerIndex, typeComboId, typeIconUrls } = await import('../src/battle/seerAssets');
await loadSeerIndex();
const singles = SEER_TYPES.filter(type => type !== '無屬性');
let pairs = 0;
for (const [index, first] of singles.entries()) {
  for (const second of singles.slice(index + 1)) {
    const forward = first + '·' + second, reverse = second + '／' + first;
    assert.equal(battleTypeKey(forward), battleTypeKey(reverse), forward + ' canonical identity');
    assert.equal(typeComboId(forward), typeComboId(reverse), forward + ' icon ID');
    assert.deepEqual(typeIconUrls(forward), typeIconUrls(reverse), forward + ' icon routes');
    for (const other of singles) {
      assert.equal(getTypeMatchup(forward, other), getTypeMatchup(reverse, other), forward + ' attack');
      assert.equal(getTypeMatchup(other, forward), getTypeMatchup(other, reverse), forward + ' defense');
    }
    pairs++;
  }
}
assert.equal(pairs, 325);
assert.ok(typeIconUrls('水·混沌').length > 0);
assert.ok(typeIconUrls('電火').length > 0);
const ember = { id: '焚燼', name: '焚燼', duration: 1, isLateMover: false, stacks: 1 } as const;
assert.equal(advanceStatusEffect(ember, {}, () => 0).transformed?.duration, 2);
assert.equal(advanceStatusEffect(ember, {}, () => .999).transformed?.duration, 3);

validateKit(GRAUEN_SEED.soulMark.kit, '格勞恩斯魂印');
assert.match(GRAUEN_SEED.soulMark.description, /【登場與任一方體力變動時】\n>自身.*\n>>下2次.*\n>>>觸發成功/);
assert.match(GRAUEN_SEED.skills[0].description, /^■ 必中\n🎯 /u);
assert.match(GRAUEN_SEED.skills[1].description, /🎯 附加自身當前體力1\/3的百分比傷害/u);
assert.match(GRAUEN_SEED.skills[1].description, /攻擊傷害提升75%。先出手時，增傷幅度翻倍至150%/u);
for (const skill of GRAUEN_SEED.skills) validateKit(skill.kit, skill.name);

const harness = await createHarness();
try {
  const { DEFAULT_ELVES } = await harness.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { shouldMirrorBattleSprite, petImageUrls } = await harness.server.ssrLoadModule('/src/battle/seerAssets.ts');
  const { signIconFor } = await harness.server.ssrLoadModule('/src/battle/effectIcons.ts');
  const elf = DEFAULT_ELVES.find((item: any) => item.id === '5049');
  assert.ok(elf);
  assert.equal(Object.values(elf.baseStats).reduce((a: number, b: any) => a + b, 0), 790);
  assert.equal(signIconFor('九劫之痕'), '/seer/signbuff/174.png');
  assert.equal(signIconFor('百煉之炎'), '/seer/signbuff/175.png');
  assert.ok(petImageUrls(elf, 'body').includes('/seer/body/3407.png'));
  assert.ok(petImageUrls(elf, 'head').includes('/seer/head/3407.png'));
  assert.ok(shouldMirrorBattleSprite(elf.name, 'p1', false, '/seer/body/3407.png'));
  assert.ok(!shouldMirrorBattleSprite(elf.name, 'p2', false, '/seer/body/3407.png'));
  const { petAnimationBinding } = await harness.server.ssrLoadModule('/src/battle/petAnimationRegistry.ts');
  for (const [id, binding] of [['5049', 'grauen'], ['5050', 'leonidas']]) {
    const official = DEFAULT_ELVES.find((item: any) => item.id === id);
    assert.equal(petAnimationBinding(official), binding);
    const source = '/api/pet-animations/bundle/' + binding;
    assert.equal(shouldMirrorBattleSprite(official.name, 'p1', false, source), false);
    assert.equal(shouldMirrorBattleSprite(official.name, 'p2', false, source), true);
  }

  for (const side of ['p1', 'p2'] as const) {
    const sameTypeSkill = harness.kitSkill('同系判定', [{ op: 'dmg', p: { flat: 200, type: '真實' } }]);
    sameTypeSkill.kit[0].params.clause.cond = [{ c: 'types_equal', label: '同屬性' }];
    for (const [ownType, otherType] of [['水·混沌', '混沌／水'], ['电火系', '火.電'], ['輪迴神秘', '神秘·轮回']]) {
      const [match] = await harness.play(side, {
        self: harness.unit('same-type-' + side, 1000, [sameTypeSkill], { type: ownType }),
        opp: harness.unit('same-type-other-' + side, 1000, [harness.wait()], { type: otherType }),
      });
      assert.equal(match.opp.currentHp, 800, side + ' 實戰同系判定 ' + ownType + ' / ' + otherType);
    }
    const self = { ...structuredClone(elf), ...harness.unit('grauen-' + side, 1000, [harness.wait()], { speed: 200, type: '電.火' }), name: elf.name };
    const target = harness.unit('target-' + side, 1000, [harness.wait()]);
    const [round] = await harness.play(side, { self, opp: target });
    assert.ok(round.state[side + 'Marks'].some((mark: any) => mark.name === '九劫之痕'), side + ' 登場印記');
    assert.ok(round.state[side + 'Marks'].some((mark: any) => mark.name === '百煉之炎'), side + ' 登場印記');
    assert.ok(harness.statuses(round.self).includes('雷解'), side + ' 同體力觸發回合開始效果');
    assert.ok(harness.statuses(round.opp).includes('麻痺'), side + ' 同體力觸發戰鬥階段結束效果');
    assert.ok(!round.logs.some((line: string) => line.includes('效果待接通')), round.logs.join('\n'));

    const lethal = { ...harness.wait(), name: '致命攻擊', type: '普通', category: '物理', power: 3000, priority: 6 };
    const [survival] = await harness.play(side, {
      self,
      opp: harness.unit('lethal-' + side, 3000, [lethal]),
    });
    assert.ok(survival.self.currentHp > 0, side + ' 配對印記抵擋致死');
    assert.ok(!survival.state[side + 'Marks'].some((mark: any) => mark.name === '百煉之炎'), side + ' 保命消耗百煉之炎');
    assert.ok(harness.statuses(survival.opp).includes('易燃'), side + ' 保命後附加異常');

    const ally = harness.unit('ally-' + side, 1000, [harness.wait()]);
    const gift = await harness.play(side, {
      self, opp: target, selfBench: [ally],
      turns: (_engine, turn) => turn === 1 ? [{ switch: 1 }, 0] : [0, 0],
    }, 2);
    assert.ok(gift[0].logs.some((line: string) => line.includes('成對印記已交付')), side + ' 轉贈給下隻精靈');
    assert.ok(gift[0].state[side + 'Marks'].some((mark: any) => mark.ownerBattleId === self.id && mark.name === '百煉之炎'), side + ' 原持有者保留配對層數');

    const utility = (name: string, skillIndex: number, options: any = {}) => ({
      ...harness.unit(name, 1000, [structuredClone(elf.skills[skillIndex])], { speed: 300, type: '電.火' }),
      ...options,
    });
    const attack = utility('attacker-' + side, 1);
    const [hit] = await harness.play(side, {
      self: attack,
      opp: harness.unit('boosted-' + side, 3000, [harness.wait()], { statStages: { atk: 2 } }),
    });
    assert.equal(hit.opp.statStages.atk, 0, side + ' 雲燁竭天消除能力提升');
    const withoutPercent = utility('attacker-' + side, 1);
    withoutPercent.skills[0].kit = withoutPercent.skills[0].kit.filter((entry: any) => !entry.customText.includes('當前體力1/3'));
    const [reference] = await harness.play(side, {
      self: withoutPercent,
      opp: harness.unit('boosted-' + side, 3000, [harness.wait()], { statStages: { atk: 2 } }),
    });
    assert.equal(reference.opp.currentHp - hit.opp.currentHp, 333, side + ' 雲燁竭天附加自身當前體力1/3粉傷');

    const resistantName = 'resistant-' + side;
    harness.S[resistantName] = (_ctx: any, event: string, data: any) => {
      if (event === 'BEFORE_STATUS_APPLY' && data.status === '麻痺') data.prevented = true;
    };
    const incomingAttack = harness.kitSkill('封鎖驗收', [{ op: 'dmg', p: { flat: 200, type: '真實' } }],
      { type: '普通', category: '物理', power: 500 });
    const [suppressed] = await harness.play(side, {
      self: utility('suppressing-' + side, 1),
      opp: harness.unit(resistantName, 5000, [incomingAttack], { statStages: { atk: 2 } }),
    });
    delete harness.S[resistantName];
    assert.ok(suppressed.logs.some((line: string) => line.includes('使用了【封鎖驗收】')), side + ' 對手確實出手');
    assert.equal(suppressed.self.currentHp, 1000, side + ' 紅傷與攻擊技能的附加效果都被封鎖');

    const clearsBoost = utility('utility-block-' + side, 1);
    clearsBoost.skills[0].kit = clearsBoost.skills[0].kit.filter((entry: any) => entry.order === 0 || entry.order === 1);
    const utilityDamage = harness.kitSkill('附加效果封鎖驗收', [{ op: 'dmg', p: { flat: 200, type: '固定' } }]);
    const [utilitySuppressed] = await harness.play(side, {
      self: clearsBoost,
      opp: harness.unit('utility-damage-' + side, 5000, [utilityDamage], { statStages: { atk: 2 } }),
    });
    assert.ok(utilitySuppressed.logs.some((line: string) => line.includes('使用了【附加效果封鎖驗收】')));
    assert.equal(utilitySuppressed.self.currentHp, 1000, side + ' 技能本身可用時，屬性技能的附加效果也被封鎖');

    const [equal] = await harness.play(side, {
      self: utility('balance-' + side, 2, { currentHp: 400 }),
      opp: harness.unit('higher-' + side, 1000, [harness.wait()]),
    });
    assert.equal(equal.opp.currentHp, 367, side + ' 平均體力700後，當次吸取333（整數結算）' + JSON.stringify({ us: equal.self.currentHp, them: equal.opp.currentHp, max: equal.self.maxHp, logs: equal.logs, timers: harness.timers(equal.state, side) }));
    assert.ok(harness.statuses(equal.self).includes('雷解'), side + ' 雷之脈動給自身雷解');

    const countTarget = 'status-count-' + side;
    harness.S[countTarget] = (ctx: any, event: string) => {
      if (event === 'ROUND_START') ctx.applyStatusWithImmunityCheck(ctx.actor, '雷解', 3);
    };
    const normal = utility('status-hit-' + side, 3);
    const countedTarget = () => harness.unit(countTarget, 10000, [harness.wait()]);
    const [counted] = await harness.play(side, { self: normal, opp: countedTarget() });
    const referenceAttack = utility('status-hit-' + side, 3);
    referenceAttack.skills[0].kit = referenceAttack.skills[0].kit.filter((item: any) => item.order !== 3 && item.order !== 4);
    const [ordinary] = await harness.play(side, { self: referenceAttack, opp: countedTarget() });
    delete harness.S[countTarget];
    const baselineDamage = 10000 - ordinary.opp.currentHp;
    assert.ok(baselineDamage > 0);
    assert.ok(Math.abs((10000 - counted.opp.currentHp) - 6000 - 3 * baselineDamage) <= 3,
      side + ' 同項異常分別按本回合附加與現存計數，增傷+200%、加兩段3000粉傷 ' +
      JSON.stringify({ counted: counted.opp.currentHp, ordinary: ordinary.opp.currentHp, logs: counted.logs }));

    const [zero] = await harness.play(side, {
      self: utility('king-' + side, 4),
      opp: harness.unit('pp-' + side, 10000, [harness.wait()]),
    });
    assert.equal(zero.opp.skills[0].pp, 0, side + ' 第五技無可消回合時PP歸零');
    const other = side === 'p1' ? 'p2' : 'p1';
    const [knockout] = await harness.play(side, {
      self: { ...self, skills: [structuredClone(elf.skills[4])] },
      opp: harness.unit('knockout-' + side, 60, [harness.wait()], { maxHp: 1000 }),
      oppBench: [harness.unit('incoming-' + side, 5000, [harness.wait()])],
    });
    assert.equal(knockout.opp.currentHp, 0, side + ' 第五技在施放當次完成擊敗');
    const pending = knockout.state[other + 'RegistryState'].nextElfEntryProgram;
    assert.deepEqual(pending?.statuses, ['束縛'], side + ' 擊敗時按配對印記為下一隻預定異常');
    assert.equal(pending?.drainRatio, .15);
    assert.equal(pending?.drainCount, 1);
    assert.ok(![...survival.logs, ...gift.at(-1).logs, ...hit.logs, ...equal.logs, ...zero.logs].some((line: string) => line.includes('效果待接通')));
  }
} finally {
  await harness.close();
}
console.log('格勞恩斯雙方登場、魂印、素材與輪迴攻防倍率通過');

