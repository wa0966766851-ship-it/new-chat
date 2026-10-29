// 行動閘門（入戰動畫期間）：閘門關閉時，托管與對手 AI 都不出手；放開後才照常進行。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createActionGate } from '../src/battle/introPlan';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const quiet = console.error; console.error = () => {};
const skill = (name: string, power = 60) => ({ name, category: '物理', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '' });
const elf = (id: string, speed: number): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: 5000, maxHp: 5000,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp: 5000, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills: [skill('打')] });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const make = (gate: ReturnType<typeof createActionGate>) => {
  const e = createBattleEngine({ initialP1Team: [elf('A', 200)], initialP2Team: [elf('X', 100)], p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVE', preparedTeams: true,
    isFast: () => true, actionGate: () => gate.wait() });
  e.mount(); e.start(); return e;
};
let n = 0; const check = async (name: string, run: () => Promise<void>) => { await run(); n++; console.log(`✓ ${name}`); };

await check('閘門關閉時，托管（P1 AI）不出手；放開後才出手', async () => {
  const gate = createActionGate(); gate.hold();
  const e = make(gate); await e.idle();
  e.dispatch({ type: 'SET_AUTO_BATTLE', isAuto: true });
  await sleep(1300);
  assert.equal(e.getState().turnNumber, 1, '動畫期間沒有出手');
  assert.equal(e.getState().phase, 'p1_select');
  gate.open();
  for (let i = 0; i < 40 && e.getState().turnNumber === 1; i++) await sleep(100);
  assert.ok(e.getState().turnNumber >= 2, '放開後托管出手');
});

await check('閘門關閉時，P1 出手後對手 AI 也要等閘門；放開後才結算', async () => {
  const gate = createActionGate(); gate.hold();
  const e = make(gate); await e.idle();
  e.onSkillSelect('p1', e.getState().p1.skills[0]);
  await sleep(1000);
  assert.equal(e.getState().p2.currentHp, 5000, '對手尚未行動，沒有被結算');
  assert.equal(e.getState().turnNumber, 1);
  gate.open();
  for (let i = 0; i < 40 && e.getState().turnNumber === 1; i++) await sleep(100);
  assert.ok(e.getState().turnNumber >= 2 && e.getState().p2.currentHp < 5000, '放開後對手 AI 出手並結算');
});

await check('沒有閘門（動畫關閉）時照常，不延遲', async () => {
  const gate = createActionGate();
  const e = make(gate); await e.idle();
  e.onSkillSelect('p1', e.getState().p1.skills[0]);
  for (let i = 0; i < 20 && e.getState().turnNumber === 1; i++) await sleep(50);
  assert.ok(e.getState().turnNumber >= 2);
});
console.error = quiet;
console.log(`battleActionGate: ${n} checks passed`);
await server.close();
process.exit(0);
