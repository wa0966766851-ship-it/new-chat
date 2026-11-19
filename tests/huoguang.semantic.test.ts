
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const harness = await createHarness();
const { server, play, unit, wait, kitSkill, find } = harness;
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { kitEntryIssue } = await server.ssrLoadModule('/src/effects/effectConnection.ts');
  const { isZeroPpExempt } = await server.ssrLoadModule('/src/battle/ppExemptions.ts');
  const { effectIcon } = await server.ssrLoadModule('/src/battle/effectIcons.ts');
  const elf = DEFAULT_ELVES.find((e: any) => e.id === '5051');
  assert.ok(elf, '霍光在正式名單內');
  assert.equal(elf.skillPool.length, 7);
  assert.equal(elf.groupIds.length, 7);
  assert.equal(elf.baseStats.hp, 170);
  assert.equal(effectIcon(undefined, '北冥狂刃'), '/seer/signbuff/53.png');
  for (const def of [elf.soulMark, ...elf.skillPool]) {
    for (const kit of def.kit) assert.equal(kitEntryIssue(kit), null, def.name + ': ' + kit.customText);
  }

  const get = (name: string) => structuredClone(find('5051', name));
  const fighter = (skills: any[], hp = 1000) => unit('5051', hp, skills, {
    maxHp: 1000, speed: 200, type: elf.type,
    extra: { name: elf.name, soulMark: elf.soulMark, resourceQueryRules: elf.resourceQueryRules },
  });
  const signs = (e: any) => Object.fromEntries((e.marks || []).map((m: any) => [m.name, m]));
  const emptyAttack = { ...get('鯤·千里擊濤'), pp: 0, currentPp: 0 };
  const form = get('無罔之心');
  const fifth = get('光·命問星天');

  for (const side of ['p1', 'p2'] as const) {
    const [attack] = await play(side, {
      self: fighter([emptyAttack]), opp: unit('target', 8000, [wait()], { type: '草' }),
      turns: (engine) => {
        assert.equal(isZeroPpExempt(engine.getState()[side], emptyAttack), true);
        assert.equal(isZeroPpExempt(engine.getState()[side], { ...form, pp: 0 }), false);
        return [0, 'pass'];
      },
    });
    assert.equal(attack.self.skills[0].pp, 0);
    assert.ok(attack.opp.currentHp < 4000);
    assert.ok(signs(attack.self)['強擊形態'].description.includes('主要形態'));
    assert.ok(attack.logs.some((line: string) => line.includes('暴擊') || line.includes('致命一擊')));

    const [quint] = await play(side, { self: fighter([fifth]), opp: unit('target', 8000, [wait()]),
      turns: () => [0, 'pass'] });
    assert.equal(quint.opp.currentHp, 5720, '第五消耗280固定與2000真傷，威力0');
    assert.equal(harness.statuses(quint.opp).length, 3);
    assert.equal(quint.opp.skills[0].pp, 98);
    assert.equal(quint.self.skills[0].pp, 5);

    const fatal = kitSkill('致命兩筆', Array.from({length: 2}, () => ({ op: 'dmg', p: { type: '真實', flat: 3500 } })));
    const [first, second] = await play(side, {
      self: fighter([form]), opp: unit('target', 8000, [fatal]),
      turns: (_engine, turn) => turn === 1 ? ['pass', 0] : [0, 'pass'],
    }, 2);
    assert.equal(first.self.currentHp, 1);
    assert.equal(signs(first.self)['強擊形態'], undefined);
    assert.ok(signs(first.self)['無罔形態'].description.includes('主要形態'));
    assert.ok(signs(second.self)['強擊形態'].description.includes('主要形態'));
    assert.equal(second.self.currentHp, 1000);
    assert.equal(second.opp.currentHp, 6000);

    const exhausted = await play(side, {
      self: fighter([form]), opp: unit('exhaustion', 8000, [fatal]),
      turns: () => ['pass', 0],
    }, 4);
    const forms = ['強擊形態', '無罔形態', '威破形態'];
    for (let round = 0; round < forms.length; round++) {
      assert.equal(exhausted[round].self.currentHp, 1);
      assert.deepEqual(forms.filter(name => !!signs(exhausted[round].self)[name]), forms.slice(round + 1));
    }
    assert.equal(exhausted[3].self.currentHp, 0, '失去三種形態後不再保命');

    const reflected = kitSkill('固定免疫', [{ op: 'noop', p: {} }]);
    const [blockedDrain] = await play(side, { self: fighter([fifth], 400),
      opp: unit('guard', 12000, [reflected], { extra: { barrier: 1000 } }), turns: () => [0, 'pass'] });
    assert.equal(blockedDrain.opp.currentHp, 6120, '護罩吸收560固定後附加2880真傷與3000真傷');

    const useless = kitSkill('低傷害', [{ op: 'dmg', p: { type: '真實', flat: 10 } }]);
    const attackSkill = { ...wait(), name: '普通攻擊', category: '物理', type: '普通', power: 20 };
    const [kill, entrant, firstAttack, expire] = await play(side, {
      self: fighter([emptyAttack]),
      opp: unit('target', 550, [wait()]),
      oppBench: [unit('entrant', 20000, [wait(), attackSkill])],
      turns: (engine, turn) => {
        if (turn === 1) return [0, 'pass'];
        if (turn === 2) {
          assert.ok(engine.getState().phase.includes('forced_switch'));
          return ['pass', { switch: 1 }];
        }
        if (turn === 3) return ['pass', 0];
        if (turn === 4) return ['pass', 1];
        return ['pass', 'pass'];
      },
    }, 5);
    assert.ok(signs(kill.self)['北冥狂刃']);
    assert.equal(signs(entrant.opp)['束縛'], undefined);
    assert.ok(firstAttack.state[side === 'p1' ? 'p2Timers' : 'p1Timers'].some((timer: any) => timer.payload?.block?.invalid === '攻擊'));
    assert.ok(expire.logs.some((line: string) => line.includes('無效') && line.includes('普通攻擊')));
    assert.equal(expire.self.currentHp, 1000);

    const [weaponKill, , weaponHit, weaponBench, weaponReturn, , backToBlade] = await play(side, {
      self: fighter([emptyAttack, form]),
      selfBench: [unit('backup', 3000, [wait()])],
      opp: unit('target', 550, [wait()]),
      oppBench: [unit('entrant', 20000, [wait()])],
      turns: (_engine, turn) => {
        if (turn === 1) return [0, 'pass'];
        if (turn === 2) return ['pass', { switch: 1 }];
        if (turn === 3 || turn === 7) return [1, 'pass'];
        if (turn === 4) return [{ switch: 1 }, 'pass'];
        if (turn === 5) return [{ switch: 0 }, 'pass'];
        return ['pass', 'pass'];
      },
    }, 7);
    const weapon = weaponKill.state[side === 'p1' ? 'p1RegistryState' : 'p2RegistryState'];
    const saved = Object.entries(weapon).find(([key]) => key.startsWith('weaponAndCombatForms:'))?.[1] as { killDamage: number };
    assert.ok(saved?.killDamage > 0, '狂刃應記錄擊敗回合的攻擊傷害');
    assert.equal(weaponHit.opp.currentHp, 15000 - saved.killDamage);
    const timerKey = side === 'p1' ? 'p1Timers' : 'p2Timers';
    assert.ok(weaponHit.state[timerKey].some((timer: any) => timer.payload?.statusImmunityCount && timer.remaining === 2));
    assert.ok(!weaponBench.state[timerKey].some((timer: any) => timer.payload?.statusImmunityCount));
    assert.ok(signs(weaponBench.state[side === 'p1' ? 'p1Team' : 'p2Team'][0])['北冥狂刃']);
    assert.ok(signs(weaponReturn.self)['無罔形態'].description.includes('主要形態'));
    assert.equal(backToBlade.opp.currentHp, 10000 - saved.killDamage, '三回合後回到北冥之刃');
    assert.ok(signs(backToBlade.self)['北冥之刃']);


    const [switching] = await play(side, {
      self: fighter([useless]), opp: unit('target', 10000, [wait()]),
      oppBench: [unit('switch-in', 10000, [wait()])],
      turns: () => ['pass', { switch: 1 }],
    });
    assert.ok(harness.statuses(switching.opp).includes('束縛'));

    const late = get('百舸爭流');
    const early = get('漫江碧透');
    const [lateHit] = await play(side, {
      self: fighter([late]),
      opp: unit('fast', 20000, [wait(), { ...wait(), name: '選用的技能' }], { speed: 300 }),
      turns: () => [0, 1],
    });
    assert.deepEqual(lateHit.opp.skills.map((sk: any) => sk.pp), [99, 94]);
    const [earlyHit] = await play(side, {
      self: fighter([early]), opp: unit('slow', 20000, [wait(), wait(), wait(), wait()]),
      turns: () => [0, 'pass'],
    });
    assert.equal(earlyHit.opp.skills.filter((sk: any) => sk.pp === 0).length, 2);

    const shield = kitSkill('免疫下五次攻擊', [{ op: 'immune_attack_count', p: { count: 5 } }]);
    const punches = await play(side, {
      self: fighter([form, early]), opp: unit('immune', 75000, [shield]),
      turns: (_engine, turn) => turn === 1 ? [0, 0] : [1, 'pass'],
    }, 4);
    assert.ok(punches[1].logs.some((line: string) => line.includes('無視了對手')));
    assert.equal(punches[2].logs.filter((line: string) => line.includes('無視了對手')).length, 2);
    assert.ok(punches[3].logs.some((line: string) => line.includes('免疫了【漫江碧透】')));
    assert.equal(punches[2].opp.currentHp - punches[3].opp.currentHp, Math.min(18750, punches[2].opp.currentHp), '攻擊被免疫時仍有魂印25%真傷');

  }
  console.log('霍光 P1/P2：五種印記、武器期限與傷害、離場保留、保命與恢復形態、三種異常、PP及技能無效通過');
} finally {
  await harness.close();
}

