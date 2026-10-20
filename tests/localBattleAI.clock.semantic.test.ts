import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
try {
  const { createBattleEngine } = await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { evaluatePosition } = await h.server.ssrLoadModule('/src/battle/ai/evaluation.ts');
  const { planDecision } = await h.server.ssrLoadModule('/src/battle/ai/search.ts');
  const { simulateAction } = await h.server.ssrLoadModule('/src/battle/ai/simulation.ts');
  const { DEFAULT_AI_SETTINGS } = await h.server.ssrLoadModule('/src/battle/ai/settings.ts');
  const skill = { name: '時鐘測試等待', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' };
  const elf = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: 800, maxHp: 800,
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
    calculatedStats: { hp: 800, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, statStages: {}, skills: [{ ...skill }] });
  const settings = { ...DEFAULT_AI_SETTINGS, style: 'attrition', difficulty: 'hard', budgetMs: 2000 };
  for (const side of ['p1', 'p2'] as const) {
    const foe = side === 'p1' ? 'p2' : 'p1';
    const own = [elf('own'), elf('reserve')], other = [elf('foe')];
    const engine = createBattleEngine({ initialP1Team: side === 'p1' ? own : other, initialP2Team: side === 'p2' ? own : other,
      preparedTeams: true, battleMode: 'PVP', battleFormat: 'peak_6v6', randomSeed: 7, isFast: () => true });
    const state = structuredClone(engine.getState()); engine.unmount();
    state.p1ItemInventory = {}; state.p2ItemInventory = {};
    const clock = (st: any, format: any = 'peak_6v6', prefs = settings) => evaluatePosition(st, side, prefs, format).parts.find((p: any) => p.key === 'clock')?.value ?? 0;
    // Real BattleState deliberately has no format field. The request supplies it.
    assert.equal(state.battleFormat, undefined);
    state.turnNumber = 45;
    assert.equal(clock(state), 400);
    assert.equal(clock(state, 'peak_6v6', { ...settings, style: 'balanced' }), 200);
    for (const format of ['normal_6v6', 'solo_1v1', 'peak_3v3']) assert.equal(clock(state, format), 0);
    state.turnNumber = 40; assert.equal(clock(state), 0);
    state.turnNumber = 50; assert.equal(clock(state), 800);
    state.turnNumber = 45;
    const activeDead = structuredClone(state);
    activeDead[side].currentHp = 0; activeDead[side].isAlive = false;
    assert.equal(activeDead[`${side}Team`][0].currentHp, 800);
    assert.equal(clock(activeDead), 0, 'active HP overrides stale team HP');
    state[`${foe}Team`].push({ ...elf('extra'), isExtra: true }); assert.equal(clock(state), 400);
    const finished = { ...state, winner: side }; assert.equal(clock(finished), 0);
    // Both the baseline and real simulated result must receive the request mode.
    const report = await planDecision({ state, side, seed: 7, battleFormat: 'peak_6v6', settings }, simulateAction);
    assert.equal(report.mode, 'planner');
    for (const candidate of report.candidates) {
      assert.ok(candidate.samples > 0);
      assert.equal(candidate.parts.find((p: any) => p.key === 'clock')?.value, 80);
    }
    console.log(`✓ ${side}: request format, active HP, extra exclusion, turn ramp, terminal state and real planner clock delta`);
  }
} finally { await h.close(); }
