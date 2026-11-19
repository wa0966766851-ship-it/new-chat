import assert from 'node:assert/strict';
import { LEONIDAS_SEED } from '../src/data/leonidas';
import { ANCIENT_SONG } from '../src/data/leonidasSkills';
import { validateKit } from '../src/effects/kitValidation';
import { descriptionStructure } from '../src/utils/descriptionStructure';
import { ageRates } from '../src/battle/ageMarks';
import { createHarness } from './helpers/migrationHarness';

const invalid: string[] = [];
for (const item of [LEONIDAS_SEED.soulMark, ...LEONIDAS_SEED.skillPool, ANCIENT_SONG]) {
  for (const [index, clause] of (item.kit || []).entries()) {
    try { validateKit([clause], item.name + '/' + index); }
    catch (error) { invalid.push(String(error)); }
  }
}
assert.deepEqual(invalid, []);
const sourceTree = descriptionStructure(LEONIDAS_SEED.soulMark.description);
const roundStart = sourceTree.nodes.find(node => node.text === '回合開始時')!;
assert.equal(roundStart.children[0].children.length, 2);
assert.match(roundStart.children[1].text, /戰鬥階段結束時/);
assert.match(sourceTree.nodes.find(node => node.text === '常駐效果')!.children[1].children[0].children[0].text, /曠古長眠/);
assert.equal(Object.values(LEONIDAS_SEED.baseStats).reduce((a, b) => a + b, 0), 790);
assert.equal(ageRates(25, 200).atk, .1);
assert.equal(ageRates(26, 200).atk, .3);
assert.ok(Math.abs(ageRates(26, 200).def + .3) < 1e-10);

const harness = await createHarness();
const numbers = (bonus: number) => Math.round(bonus * 100);
const withOrders = (skill: any, orders: number[]) => ({
  ...structuredClone(skill), kit: structuredClone(skill.kit.filter((entry: any) => orders.includes(entry.order))),
});
try {
  const { runWeightEffectLifecycle } = await harness.server.ssrLoadModule('/src/effects/weightEffectLifecycle.ts');
  for (const [damageCategory, expected] of [['skill_attack', .2], ['skill_attribute', .2], ['skill_extra_action', .2],
    ['skill', .2], ['fixed', 0], ['percent', 0], ['true', 0]] as const) {
    const damageComp = { damageCategory, increasePercent: 0 };
    runWeightEffectLifecycle({ getPlayerState: () => .2 }, 'BEFORE_DAMAGE', { damageComp });
    assert.equal(damageComp.increasePercent, expected, damageCategory);
  }
  const { DEFAULT_ELVES } = await harness.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const elf = DEFAULT_ELVES.find((unit: any) => unit.id === '5050');
  assert.ok(elf);
  for (const side of ['p1', 'p2'] as const) {
    const foeSide = side === 'p1' ? 'p2' : 'p1';
    const ally = { ...harness.unit('leonidas-' + side, 2400, [structuredClone(elf.skills[2])], { type: '遠古', speed: 300 }),
      name: elf.name, weight: 100, soulMark: structuredClone(elf.soulMark) };
    const opponent = { ...harness.unit('opponent-' + side, 10000, [harness.wait()]), weight: 200 };
    const [round] = await harness.play(side, { self: ally, opp: opponent });
    const companion = round.state[side + 'Team'].find((member: any) => member.isExtra && member.name === '亙古遺獸');
    assert.ok(companion, round.logs.join('\n'));
    assert.equal(companion.maxHp, 300);
    assert.equal(companion.calculatedStats.def, 300);
    assert.ok(!round.logs.some((line: string) => line.includes('效果待接通')), round.logs.join('\n'));
    assert.equal(round.opp.weight, 250, side + ' 末法迪知未處於異常時增加對手50重量');
    assert.equal(round.state[foeSide + 'Marks'].find((mark: any) => mark.name === '歲月之痕')?.count, 1, side + ' 重量變動附加印記');

    const setup = [0, 11];
    const isolatedSoul = { ...ally.soulMark, kit: ally.soulMark.kit.filter((item: any) => setup.includes(item.order)) };
    const inflict = harness.kitSkill('異常判定', [{ op: 'status', p: { side: 'self', status: '燒傷', turns: 3, chance: 100 } }]);
    const foe = { ...harness.unit('protected-foe-' + side, 10000, [inflict]), weight: 200 };
    harness.S[foe.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'BEFORE_STATUS_APPLY' && data.status === '燒傷') data.prevented = true;
    };
    const holder = { ...ally, soulMark: isolatedSoul, skills: [{ ...harness.wait(), pp: 10, maxPp: 99 }] };
    const [protectedRound] = await harness.play(side, { self: holder, opp: foe });
    delete harness.S[foe.name];
    assert.ok(!harness.statuses(protectedRound.opp).includes('燒傷'));
    assert.equal(protectedRound.self.shield, 150, side + ' 異常判定失敗仍給護盾');
    assert.equal(protectedRound.self.barrier, 150, side + ' 異常判定失敗仍給護罩');
    assert.equal(protectedRound.self.skills[0].pp, 48, side + ' 同槽吸取敵方PP上限的2/5');

    const companionSetup = { ...ally.soulMark, kit: ally.soulMark.kit.filter((item: any) => [0, 8, 11, 12].includes(item.order)) };
    const guardAttack = harness.kitSkill('護罩保命驗收', [
      { op: 'status', p: { side: 'self', status: '燒傷', turns: 3, chance: 100 } },
      { op: 'dmg', p: { flat: 200, type: '固定' } },
    ]);
    const fatalAttack = harness.kitSkill('致死驗收', [{ op: 'dmg', p: { flat: 5000, type: '真實' } }]);
    const [chargedGuard, protectedAlly, revivedCompanion] = await harness.play(side, {
      self: { ...ally, soulMark: companionSetup },
      selfBench: [{ ...harness.unit('companion-ally-' + side, 1000, [harness.wait(), withOrders(elf.skills[0], [0, 2])]), weight: 0 }],
      opp: { ...harness.unit('companion-attacker-' + side, 10000, [guardAttack, fatalAttack, harness.wait()]), weight: 200 },
      turns: (_engine, round) => round === 1 ? [{ switch: 1 }, 0] : round === 2 ? [0, 1] : [1, 2],
    }, 3);
    assert.ok(chargedGuard.self.marks?.some((mark: any) => mark.id === 'recorded_weight_fatal_guard'), JSON.stringify({shield: chargedGuard.state[side + 'RegistryState'].teamRecordedWeightProtection, guard: chargedGuard.state[side + 'RegistryState'].recordedWeightFatalGuard, logs: chargedGuard.logs, marks: chargedGuard.state[side + 'Marks']}));
    assert.equal(protectedAlly.self.currentHp, 1, side + ' 額外精靈保命須涵蓋己方在場隊友 ' + JSON.stringify(protectedAlly.logs));
    assert.ok(protectedAlly.state[side + 'Team'].find((member: any) => member.isExtra)?.isVanished, side + ' 遺獸犧牲');

    assert.equal(revivedCompanion.opp.statStages.def, -6, side + ' 曠古長眠成功施加3次防禦下降');
    const revived = revivedCompanion.state[side + 'Team'].find((member: any) => member.isExtra);
    assert.ok(revived && !revived.isVanished && revived.currentHp === 300, side + ' 亙古遺獸重生後重新統計重量');

    const nodes: string[] = [];
    const songStages: string[] = [];
    const replacement = harness.unit('swap-' + side, 5000, [harness.wait()], { statStages: { atk: -2, def: 2, speed: -1 } });
    harness.S[replacement.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'EXTRA_ACTION_START' && data.action.skillId === 'ancient-weight-song') songStages.push(nodes.at(-1)!);
    };
    const [voluntary] = await harness.play(side, {
      self: ally, selfBench: [replacement], opp: opponent,
      onNode: node => nodes.push(node), turns: () => [{ switch: 1 }, 0],
    });
    assert.equal(voluntary.state[side + 'Team'][0].weight, 200, side + ' 主動換人仍屬於未選擇技能');
    const songs = voluntary.logs.filter((line: string) => line.includes('額外行動') && line.includes('亙古之歌'));
    assert.equal(songs.length, 1, JSON.stringify(voluntary.logs));
    assert.equal(voluntary.self.statStages.atk, 0, side + ' 亙古之歌解除換上來的隊友能力下降');
    assert.equal(voluntary.self.statStages.speed, 0);
    assert.equal(voluntary.self.statStages.def, 2, side + ' 能力提升保留');
    delete harness.S[replacement.name];
    assert.deepEqual(songStages, ['4.10'], side + ' 亙古之歌在戰鬥階段結束結算');
    assert.ok(nodes.indexOf('4.10') < nodes.indexOf('4.11'));
    assert.ok(voluntary.opp.weight >= 300, side + ' 遺獸先增加對手重量，再造成傷害');

    const songOwner = { ...ally, statStages: { def: -3, spatk: 2 }, soulMark: { ...ally.soulMark, kit: ally.soulMark.kit.filter((item: any) => [0, 4, 14].includes(item.order)) } };
    const controlledTarget = { ...harness.unit('song-effects-' + side, 10000, [harness.turnEffectSkill()], { statStages: { atk: 2 } }), weight: 200 };
    let extraDamage: import('../src/battle/damageLedger').DamageLedgerEntry[] = [];
    const [song] = await harness.play(side, {
      self: songOwner, opp: controlledTarget,
      turns: engine => { extraDamage = engine.ledger.entries; return ['pass', 0]; },
    });
    assert.equal(song.self.statStages.def, 0, side + ' 列奧尼達在場時解除其能力下降');
    assert.equal(song.self.statStages.spatk, 2);
    assert.equal(song.opp.weight, 300);
    assert.equal(song.self.shield, 300);
    assert.equal(song.opp.statStages.atk, 0);
    const hit = extraDamage.find(entry => entry.damageType === 'skill_extra_action');
    assert.equal(hit?.hpLost, 300, side + ' 亙古之歌按增重後的重量造成額外行動技能傷害');
    assert.equal(hit?.sourceName, '亙古遺獸', side + ' 傷害來源保留額外精靈');
    assert.ok(harness.statuses(song.opp).includes('疲憊'), JSON.stringify(song.logs));
    const songTimers = song.state[foeSide + 'Timers'];
    assert.ok(!songTimers.some((timer: any) => timer.payload?.block?.statusGuard), '亙古之歌消除原有回合效果');
    assert.ok(songTimers.some((timer: any) => timer.payload?.preventPositiveStages), '亙古之歌封鎖能力提升');
    assert.ok(songTimers.some((timer: any) => timer.payload?.recoveryReductionPercent === 1), '亙古之歌降低回復量100%');

    const fatalNodes: string[] = [];
    const [passed] = await harness.play(side, {
      self: { ...ally, soulMark: { ...ally.soulMark, kit: ally.soulMark.kit.filter((item: any) => [0, 4, 14].includes(item.order)) } },
      opp: { ...harness.unit('song-target-' + side, 200, [harness.wait()]), weight: 200 },
      turns: () => ['pass', 0], onNode: node => fatalNodes.push(node),
    });
    assert.equal(passed.opp.currentHp, 0, side + ' 空過後亙古之歌可以擊敗對手');
    assert.equal(passed.state.winner, side);
    assert.ok(fatalNodes.includes('4.11') && !fatalNodes.includes('5'), '擊敗歸入死亡節點二');

    const fallbackTarget = { ...harness.unit('no-companion-target-' + side, 10000, [harness.wait()]), weight: 200 };
    harness.S[fallbackTarget.name] = (ctx: any, event: string) => {
      if (event !== 'BEFORE_TURN_RESOLVE') return;
      const companion = ctx.getFullTeam(side).find((member: any) => member.isExtra);
      if (companion) ctx.killExtraElf(side, companion);
    };
    const [withoutCompanion] = await harness.play(side, {
      self: { ...ally, soulMark: { ...ally.soulMark, kit: ally.soulMark.kit.filter((item: any) => [0, 4, 14].includes(item.order)) } },
      opp: fallbackTarget, turns: () => ['pass', 0],
    });
    delete harness.S[fallbackTarget.name];
    assert.equal(withoutCompanion.opp.weight, 500, side + ' 遺獸死亡時改為增加對手300點重量');
    assert.equal(withoutCompanion.logs.some((line: string) => line.includes('額外行動') && line.includes('亙古之歌')), false);

    const debuff = harness.kitSkill('異常驗收', [
      { op: 'status', p: { side: 'opp', status: '雷解', turns: 3, chance: 100 } },
    ]);
    const [enhanced] = await harness.play(side, {
      self: harness.unit('boost-target-' + side, 2400, [withOrders(elf.skills[2], [0, 2])]),
      opp: harness.unit('boost-before-' + side, 10000, [debuff], { speed: 999 }),
    });
    assert.equal(enhanced.self.statStages.atk, 2, side + ' 末法迪知自身有異常時強化翻倍');

    const control = harness.kitSkill('控制驗收', [
      { op: 'status', p: { side: 'opp', status: '雷解', turns: 3, chance: 100 } },
      { op: 'status', p: { side: 'opp', status: '麻痺', turns: 3, chance: 100 } },
    ]);
    const [cleansed] = await harness.play(side, {
      self: { ...harness.unit('cleanse-target-' + side, 2400, [harness.wait(), withOrders(elf.skills[3], [1])]), weight: 200 },
      opp: { ...harness.unit('control-' + side, 10000, [control], { speed: 999 }), weight: 100 },
    });
    assert.deepEqual(harness.statuses(cleansed.self), [], side + ' 天衍破霜在控制命中後解除所有異常');

    const alreadyControlled = harness.unit('existing-control-' + side, 10000, [harness.wait()], { extra: { battleStatuses: { 麻痺: 3 } } });
    harness.S[alreadyControlled.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
    };
    const [failedRandomControl] = await harness.play(side, {
      self: harness.unit('random-control-' + side, 2400, [withOrders(elf.skills[0], [0, 4])], { speed: 999 }),
      opp: alreadyControlled,
    });
    delete harness.S[alreadyControlled.name];
    assert.ok(failedRandomControl.state[foeSide + 'RegistryState'].utilitySkillInvalidTurns >= 2,
      side + ' 對手原有控制異常、本次沒有附加成功，仍應令屬性技能無效');

    const corrode = harness.kitSkill('腐朽驗收', [
      { op: 'status', p: { side: 'opp', status: '腐朽', turns: 3, chance: 100 } },
      { op: 'dmg', p: { flat: 80, type: '固定' } },
    ]);
    const [corroded] = await harness.play(side, {
      self: harness.unit('corroded-' + side, 2400, [harness.wait()]),
      opp: harness.unit('corroder-' + side, 10000, [corrode], { speed: 999 }),
    });
    assert.equal(corroded.self.currentHp, 2020, side + ' 固定傷害不會抵銷腐朽的300真實傷害');
    assert.equal(corroded.self.effects.find((effect: any) => effect.id === '腐朽')?.duration, 4);

    const attack = { ...corrode, category: '物理', type: '普通', power: 90 };
    const [redHit] = await harness.play(side, {
      self: harness.unit('red-hit-' + side, 2400, [harness.wait()]),
      opp: harness.unit('red-corroder-' + side, 10000, [attack], { speed: 999 }),
    });
    assert.equal(redHit.self.effects.find((effect: any) => effect.id === '腐朽')?.duration, 2, side + ' 受到攻擊傷害後腐朽不追加傷害或回合');

    const ramp = withOrders(elf.skills[4], [0, 5]);
    const reserve = harness.unit('reserve-' + side, 10000, [harness.wait()]);
    for (const [weight, retained] of [[300, 0], [401, 20]]) {
      const [used, _away, returned] = await harness.play(side, {
        self: { ...harness.unit('ramp-' + side, 5000, [ramp], { speed: 300 }), weight },
        opp: harness.unit('ramp-foe-' + side, 10000, [harness.wait()]), selfBench: [reserve],
        turns: (_engine, round) => round === 1 ? [0, 0] : [{ switch: round === 2 ? 1 : 0 }, 0],
      }, 3);
      assert.equal(numbers(used.state[side + 'RegistryState'].weightedDamageBonus), 20);
      assert.equal(used.self.weight, weight > 300 ? weight - 100 : weight);
      assert.equal(returned.self.id, used.self.id);
      assert.equal(numbers(returned.state[side + 'RegistryState'].weightedDamageBonus || 0), retained, side + ' 換下再上保留消耗重量的增傷');
    }

    const highPower = withOrders(elf.skills[3], [0, 5]);
    const lowPower = { ...withOrders(elf.skills[3], [0]), power: 300 };
    const attacker = { ...harness.unit('power-' + side, 10000, [highPower], { type: '遠古', speed: 300 }), weight: 100 };
    const fullHealth = harness.unit('full-hp-' + side, 10000, [harness.wait()]);
    const [boosted] = await harness.play(side, { self: attacker, opp: fullHealth });
    const [baseline] = await harness.play(side, { self: { ...attacker, skills: [lowPower] }, opp: fullHealth });
    assert.equal(boosted.opp.currentHp, baseline.opp.currentHp, side + ' (150 + 100×50%)×1.5 應與300威力相同');
  }
} finally { await harness.close(); }
console.log('洪荒·列奧尼達強化版資料、歲月之痕倍率與雙方正式登場通過');

