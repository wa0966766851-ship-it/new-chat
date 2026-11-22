/**
 * 2026-11-22 攜帶類致死保留封印驗收（P1/P2）：
 * 王.黎明前奏／王.負咎泯晝 的封印是「攜帶類常駐」（非附加效果）：布萊克在場時，
 * 每回合開始檢查並對對手在場精靈標記 fatalResistSeal（冪等），
 * 使對手的致死保留本場僅能觸發1次（引擎主鏈由 sealStageShadow 驗證）。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

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
      checks++;
    }
  }
  console.log(`攜帶類致死保留封印：${checks} 項通過（兩技能 × P1/P2）`);
} finally {
  await h.close();
}
