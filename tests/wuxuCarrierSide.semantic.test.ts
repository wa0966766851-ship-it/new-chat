// wuxu 掛載方修復驗收：載體＝受影響者（掛在誰身上 vs 影響誰是兩件事）。
// 高血量假精靈撐住六刃真實傷害，場景才活得夠久供遞減觀察。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import type { BattleEngine } from '../src/engine/battleEngine';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
assert.equal(typeof (globalThis as any).window, 'undefined', '沒有 DOM');
const R = getBattleSkillRegistry();
assert.ok(R['六刃碎界斷'], '真實六刃碎界斷 handler 須存在');
assert.ok(R['靜刃止水'], '真實靜刃止水 handler 須存在');

const skill = (name: string, power = 0) => ({ name, category: power ? '物理' : '屬性', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '' });
const elf = (id: string, hp: number, skills: any[], speed = 100): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills });
function battle(p1: any[], p2: any[]) {
  const engine: BattleEngine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].id, p2StarterId: p2[0].id, battleMode: 'PVP', preparedTeams: true,
    isFast: () => true, onNode: () => {} });
  engine.mount(); engine.start();
  return engine;
}
async function turn(e: BattleEngine, a: (e: BattleEngine) => void, b: (e: BattleEngine) => void) { await e.idle(); a(e); b(e); await e.idle(); }
const use = (side: 'p1' | 'p2', i: number) => (e: BattleEngine) => e.onSkillSelect(side, e.getState()[side].skills[i]);
const use0 = (side: 'p1' | 'p2') => use(side, 0);
const use1 = (side: 'p1' | 'p2') => use(side, 1);
const reg = (e: BattleEngine, side: 'p1' | 'p2') => (e.getState() as any)[side + 'RegistryState'] || {};
const BIG = 1_000_000_000;

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + name); };

await check('六刃碎界斷補償分支：攻擊封鎖掛對手 registry 且特質引擎每回合遞減歸零', async () => {
  const X = elf('X', BIG, [skill('打', 1)], 100);
  X.calculatedStats.def = 0; X.baseStats.def = 0; X.calculatedStats.spdef = 0; X.baseStats.spdef = 0;
  const e = battle([elf('W', BIG, [skill('六刃碎界斷', 1), skill('普攻', 1)], 200)], [X]);
  await turn(e, use0('p1'), use0('p2'));
  assert.ok(reg(e, 'p2').attackSkillInvalidTurns > 0, '補償分支應把攻擊封鎖掛到對手 registry');
  assert.equal(reg(e, 'p1')['p2_attackSkillInvalidTurns'], undefined, '施術者身上不應有交叉前綴鍵');
  await turn(e, use1('p1'), use0('p2'));
  await turn(e, use1('p1'), use0('p2'));
  assert.equal(reg(e, 'p2').attackSkillInvalidTurns || 0, 0, '攻擊封鎖應已遞減歸零（修正前為掛錯邊＋無人遞減＝永久封鎖）');
  assert.ok(reg(e, 'p2').p2_noHealTurns > 0 && reg(e, 'p2').p2_noHealTurns < 6, '禁療掛對手且隨回合遞減');
  e.unmount();
});

await check('靜刃止水：雙方 protectStatus、對手 seal 掛載正確且會遞減', async () => {
  const X = elf('X', BIG, [skill('打', 1), skill('普攻', 1)], 100);
  X.effects = [{ id: '燒傷', name: '燒傷', duration: 3, isLateMover: false, stacks: 1 }];
  X.battleStatuses = { 燒傷: {} }; X.battleStatus = '燒傷';
  const e = battle([elf('W', BIG, [skill('靜刃止水', 1), skill('普攻', 1)], 200)], [X]);
  await turn(e, use0('p1'), use0('p2'));
  assert.ok((reg(e, 'p1')['p1_preventStatusInflict'] || 0) > 0, '施術者 protectStatus 掛自己');
  assert.ok((reg(e, 'p2')['p2_preventStatusInflict'] || 0) > 0, '對手 protectStatus 掛對手');
  assert.ok((reg(e, 'p2')['p2_sealSkillAdditionalEffects'] || 0) > 0, 'seal 附加失效掛對手');
  assert.equal(reg(e, 'p1')['p2_sealSkillAdditionalEffects'], undefined, '施術者身上不應有對手前綴鍵');
  await turn(e, use1('p1'), use0('p2'));
  await turn(e, use1('p1'), use0('p2'));
  await turn(e, use1('p1'), use0('p2'));
  assert.equal((reg(e, 'p2')['p2_sealSkillAdditionalEffects'] || 0), 0, 'seal 應已遞減歸零');
  assert.equal((reg(e, 'p2')['p2_preventStatusInflict'] || 0), 0, 'protectStatus 應已遞減歸零');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
