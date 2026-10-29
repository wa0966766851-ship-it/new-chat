// 星蝕回廊：局種子衍生的 randomSeed 讓同一場戰鬥逐回合完全重現（引擎亂數由 randomSeed 決定，不依賴全域或時間）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const E = await server.ssrLoadModule('/src/modes/interstellar/v2/engine.ts');
const skill = (name: string, power: number) => ({ name, category: '物理', type: '普通', power, pp: 99, maxPp: 99, isSureHit: false, accuracy: 70, description: '', critRate: 1 });
const elf = (id: string, speed: number): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: 6000, maxHp: 6000,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp: 6000, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills: [skill('打', 60), skill('擊', 90)], soulMark: { name: '', description: '' }, effects: [] });
async function fight(seed: number | undefined) {
  delete (globalThis as any).__BATTLE_SEED__;
  const engine = createBattleEngine({ initialP1Team: [elf('A', 200)], initialP2Team: [elf('X', 100)], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, randomSeed: seed });
  engine.mount(); engine.start();
  const hp: number[][] = [];
  for (let t = 0; t < 8; t++) {
    await engine.idle();
    engine.onSkillSelect('p1', engine.getState().p1.skills[t % 2]); engine.onSkillSelect('p2', engine.getState().p2.skills[(t + 1) % 2]);
    await engine.idle(); const st = engine.getState(); hp.push([st.p1.currentHp, st.p2.currentHp]);
  }
  const logs = engine.getState().logs.map((l: any) => l.text); engine.unmount();
  return JSON.stringify({ hp, logs });
}
const a = await fight(12345), b = await fight(12345), c = await fight(54321);
assert.equal(a, b, '同一個 randomSeed：逐回合體力與日誌完全相同');
assert.notEqual(a, c, '不同 randomSeed：戰況不同（亂數確實來自種子）');
// 由局種子衍生：同局同進度同種子
const run = E.createRun({ pool: [], equipType: 'suit', equipId: '', modifiers: [], startingShards: 0, seed: 777 });
assert.equal(E.battleSeedOf(run), E.battleSeedOf({ ...run }));
assert.notEqual(E.battleSeedOf(run), E.battleSeedOf({ ...run, stats: { ...run.stats, fights: 1 } }), '打過幾場也會改變戰鬥種子');
await server.close();
console.log('戰鬥亂數種子：同種子重現、不同種子不同、由局種子衍生通過');
