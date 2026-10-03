import assert from 'node:assert/strict';
import { calculateDamage } from '../src/utils/damageCalculator';
import { getTypeMatchup } from '../src/utils/statCalculator';
const st = (atk: number, def: number) => ({ hp: 1000, atk, def, spatk: atk, spdef: def, speed: 100 });
const zero = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
const ice: any = { id: 'ice', name: '冰王', type: '冰', level: 100, calculatedStats: st(602, 100), statStages: { ...zero }, critValue: 0 };
const puni: any = { id: 'puni', name: '譜尼', type: '聖靈', level: 100, calculatedStats: st(100, 393), statStages: { ...zero }, currentHp: 1000, maxHp: 1000 };
const skill: any = { name: '先三', type: '冰', category: '物理', power: 1, pp: 5, priority: 3 };
assert.equal(getTypeMatchup('冰', '聖靈'), 0.5, '冰打聖靈微弱');
const dmg = (roll: number, crit = false, hits = 90) => calculateDamage(ice, puni, skill, 'p1', undefined, undefined, roll / 255, crit, [], [], { hitCount: hits }).damage;
// [42×602÷393÷50+2]×1.5×0.5 = 2.465 → 2；×浮動 → 1 或 2；×90
assert.equal(dmg(217), 90); assert.equal(dmg(254), 90); assert.equal(dmg(255), 180);
assert.equal(dmg(255, false, 1), 2);
console.log('連擊公式（逐步取整×連擊次數）通過');
