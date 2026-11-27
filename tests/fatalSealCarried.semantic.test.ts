/**
 * 2026-11-22 攜帶類致死保留封印驗收（P1/P2）：
 * 王.黎明前奏／王.負咎泯晝 的封印是「攜帶類常駐」（非附加效果）：布萊克在場時，
 * 每回合開始檢查並對對手在場精靈標記 fatalResistSeal（冪等），
 * 使對手的致死保留本場僅能觸發1次（引擎主鏈由 sealStageShadow 驗證）。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { activeEffectViews } from '../src/battle/activeEffectViews';
import { checkElfDead } from '../src/battle/elfAlive';
import { reyGodDescentRule } from '../src/battle/survivalRules';
import { timedInnateDisabled } from '../src/battle/timedConstraints';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { NB_DAWN, NB_KING } = await h.server.ssrLoadModule('/src/data/darkBlakeSkills.ts');
  for (const [skillObj, skillName] of [[NB_DAWN, '王.黎明前奏'], [NB_KING, '王.負咎泯晝']] as const) {
    for (const side of ['p1', 'p2'] as const) {
      const other = side === 'p1' ? 'p2' : 'p1';
      const d = structuredClone(DEFAULT_ELVES.find((e: any) => String(e.id) === '5053'));
      d.battleId = 'NB' + skillName + side;
      d.maxHp = 5000; d.currentHp = 5000;
      d.calculatedStats = { hp: 5000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 300 };
      d.soulMark = { name: '無', description: '', effectMode: 'kit', kit: [] };
      d.skills = [structuredClone(skillObj), h.wait()];
      const foe = h.unit('F' + side, 5000, [h.wait()]);
      const r = await h.play(side, { self: d, opp: foe, turns: () => [1, 0] }, 2);
      const seals = r.map((x: any) => x.state[`${other}Team`].find((e: any) => e.name.startsWith('F'))?.fatalResistSeal);
      assert.ok(seals.some((s: any) => s === 'armed'), `${side}/${skillName} 攜帶封印已標記對手：${JSON.stringify(seals)}`);
      assert.ok(r.flatMap((x: any) => x.logs).some((l: string) => l.includes('下次觸發致死保留後')), `${side}/${skillName} 封印日誌出現`);
      const last = r.at(-1)!;
      const marks = last.state[`${other}Marks`].filter((mark: any) => mark.name === '幻滅');
      assert.deepEqual(marks.map((mark: any) => mark.ownerBattleId), [foe.battleId]);
      const view = activeEffectViews(last.opp, marks).find(effect => effect.label === '幻滅');
      assert.ok(view?.description.startsWith('待觸發'));
      assert.equal(view?.icon, '/seer/signbuff/65.png');
      checks++;
    }
  }
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    for (const [type, status] of [['混沌.暗影', '眩暈'], ['火', '害怕']]) {
      const dawn = h.find('5053', '王.黎明前奏');
      const self = h.unit('出招者', 10000, [dawn], { type, speed: 300 });
      const opp = h.unit('受招者', 10000, [h.wait()]);
      const [turn] = await h.play(side, { self, opp });
      assert.ok(h.statuses(turn.opp).includes(status), `${side}/${type} 命中後觸發 ${status}`);
      assert.ok(!h.statuses(turn.opp).includes(status === '害怕' ? '眩暈' : '害怕'));
      const timers = turn.state[`${other}Timers`];
      assert.equal(timedInnateDisabled(timers, turn.opp, turn.opp.skills[0]), true);
      assert.equal(timedInnateDisabled(timers, turn.opp, dawn), false);
      assert.ok(!timers.some((timer: any) => timer.payload?.block?.addInvalid));
      checks++;
    }
  }
  const harm = (amount: number, type: '真實' | '固定') =>
    h.kitSkill(type + amount, [{ op: 'dmg', p: { flat: amount, type } }], { priority: 5 });
  for (const side of ['p1', 'p2'] as const) {
    for (const seal of ['armed', 'spent'] as const) {
      const attacker = h.unit('攻擊者', 1000, [harm(100, '真實'), harm(73, '固定'), harm(130, '真實')]);
      const god = h.unit('神降測試', 100, [h.wait()], {
        extra: { fatalResistSeal: seal, survivalRule: reyGodDescentRule(100, 2) },
      });
      const run = await h.play(side, { self: attacker, opp: god, turns: (_, t) => [t - 1, 0] }, 3);
      assert.deepEqual(run.map(round => round.opp.currentHp), [0, -70, -200], `${side}/${seal} 神降持續按負體力結算`);
      assert.deepEqual(run.map(round => checkElfDead(round.opp)), [false, false, true]);
      assert.deepEqual(run.map(round => round.opp.fatalResistSeal), ['spent', 'spent', 'spent']);
      checks++;
    }
  }
  console.log(`幻滅攜帶、顯示與神降：${checks} 項通過（P1/P2）`);
} finally {
  await h.close();
}
