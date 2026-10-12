// 原廠設定：精靈下場時異常狀態與能力等級消失；直接清除，不經「異常結束／解除」流程（窒息不會因此致死）。
import assert from 'node:assert/strict';
import { switchBattleSide } from '../src/battle/stateScopes';

const elf = (id: string, extra: any = {}): any => ({ id, battleId: id, name: id, type: '普通', currentHp: 500, maxHp: 1000, marks: [], ...extra });
for (const side of ['p1', 'p2'] as const) {
  const out = elf('out', {
    battleStatus: '窒息', battleStatusDuration: 2, battleStatuses: { 窒息: 2, 麻痺: 1 },
    effects: [{ id: '窒息', name: '窒息', duration: 2 }, { id: 'shield', name: '護盾', type: 'shield' }],
    statStages: { atk: 2, def: -1, spatk: 0, spdef: 0, speed: 3, accuracy: 0 },
  });
  const inc = elf('in', { statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 } });
  const st: any = { [side]: out, [`${side}Team`]: [out, inc], [`${side}ActiveIndex`]: 0, [`${side}RegistryState`]: {},
    [`${side}ElfState`]: {}, [`${side}Timers`]: [], [`${side}Marks`]: [] };
  const next = switchBattleSide(st, side, 1);
  const benched = next[`${side}Team`][0];
  assert.equal(benched.currentHp, 500, `${side} 體力不變（窒息不會因清除而致死）`);
  assert.deepEqual(benched.battleStatuses, {}, `${side} 異常清除`);
  assert.equal(benched.battleStatus, 'normal');
  assert.deepEqual(benched.effects.map((e: any) => e.id), ['shield'], `${side} 只移除異常類 effects`);
  assert.deepEqual(Object.values(benched.statStages), [0, 0, 0, 0, 0, 0], `${side} 能力等級歸零`);
  assert.equal(next[side].name, 'in');
}
console.log('下場清除異常與能力等級：P1/P2 通過');
