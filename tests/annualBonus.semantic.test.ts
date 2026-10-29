import assert from 'node:assert/strict';
import { calculateElfStats, normalizeElfStats, withAnnualBonus } from '../src/utils/elfStats';

const base = { hp: 150, atk: 125, def: 110, spatk: 80, spdef: 110, speed: 125 };
const evs = { hp: 255, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 0 };
const nature = { atk: 1.1, spatk: .9 };
let checks = 0;
for (const level of [1, 50, 100]) {
  const off = calculateElfStats(base, level, undefined, evs, nature, undefined, undefined, false);
  const on = calculateElfStats(base, level, undefined, evs, nature, undefined, undefined, true);
  for (const key of Object.keys(base) as (keyof typeof base)[]) {
    assert.equal(on[key] - off[key], 10, `Lv${level} ${key}: annual bonus is fixed +10`);
    checks++;
  }
  const first = normalizeElfStats({ baseStats: base, level, evs, natureModifiers: nature, hasAnnualBonus: true });
  const again = normalizeElfStats(first);
  assert.deepEqual(first.calculatedStats, on);
  assert.deepEqual(again.calculatedStats, on, 'recalculating must not stack annual bonus');
  assert.deepEqual(withAnnualBonus(first, true).calculatedStats, on, 'preview and launch share the same calculation');
  assert.deepEqual(withAnnualBonus(first, false).calculatedStats, off, 'turning off removes exactly the annual bonus');
  assert.deepEqual(withAnnualBonus(withAnnualBonus(first, false), true).calculatedStats, on, 'off/on must not stack');
  checks += 5;
}
console.log(`annual bonus: ${checks} assertions passed (+10 points, no percentage or duplicate addition)`);
