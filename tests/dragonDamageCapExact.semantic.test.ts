import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const dragon = DEFAULT_ELVES.find((e: any) => e.id === 'arena_13');
  let checks = 0;
  for (const side of ['p1', 'p2'] as const) {
    for (const [type, expectedLoss] of [['技能', 2500], ['固定', 9000], ['真實', 9000]] as const) {
      const self = h.unit('holder', 10000, [h.wait()]);
      self.name = dragon.name;
      self.soulMark = structuredClone(dragon.soulMark);
      const opp = h.unit('enemy', 100000, [h.kitSkill('測試傷害', [
        { op: 'dmg', p: { flat: 9000, type, elem: '普通' } },
      ])], { speed: 300 });
      const result = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      assert.equal(10000 - result[0].self.currentHp, expectedLoss, `${side} ${type}: actual HP settlement`);
      checks++;
    }
  }
  console.log(`龍錄天鋒精確扣血：${checks} cases passed (skill 2500, fixed/true 9000)`);
} finally { await h.close(); }
