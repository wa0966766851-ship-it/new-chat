import assert from 'node:assert/strict';
import { runRelicEffects } from '../src/effects/relicEffectRegistry';
import { EffectTiming } from '../src/effects/types';
import { getDefaultNature } from '../src/utils/seerNatures';
const comp = (incoming: boolean, cat = 'skill_attack') => ({ isIncoming: incoming, damageCategory: cat, increasePercent: 0, decreasePercent: 0 });
const healed: number[] = []; const ctx: any = { actor: 'p1', self: { currentHp: 100, maxHp: 1000 }, applyHeal: (_s: string, n: number) => healed.push(n), addLog: () => {} };
let c: any = comp(false); runRelicEffects(['justin_arm', 'silver_wing'], ctx, EffectTiming.BEFORE_DAMAGE, { damageComp: c }); assert.ok(Math.abs(c.increasePercent - 0.35) < 1e-9);
c = comp(false, 'fixed'); runRelicEffects(['justin_arm'], ctx, EffectTiming.BEFORE_DAMAGE, { damageComp: c }); assert.equal(c.increasePercent, 0);
c = comp(true, 'percent'); runRelicEffects(['dmg_reduction_bead'], ctx, EffectTiming.BEFORE_DAMAGE, { damageComp: c }); assert.equal(c.decreasePercent, 0.1);
c = comp(true, 'true'); runRelicEffects(['dmg_reduction_bead'], ctx, EffectTiming.BEFORE_DAMAGE, { damageComp: c }); assert.equal(c.decreasePercent, 0);
const st: any = { status: '麻痺', duration: 2, prevented: false }; runRelicEffects(['ray_wing'], ctx, EffectTiming.BEFORE_STATUS_APPLY, st); assert.equal(st.prevented, true);
runRelicEffects(['six_wing'], ctx, EffectTiming.BATTLE_PHASE_END, { killedOpponent: false }); runRelicEffects(['six_wing'], ctx, EffectTiming.BATTLE_PHASE_END, { killedOpponent: true }); assert.deepEqual(healed, [200]);
// 預設性格：種族值最高項
assert.equal(getDefaultNature({ hp: 165, atk: 155, def: 115, spatk: 85, spdef: 115, speed: 135 }).name, '固執');
assert.equal(getDefaultNature({ hp: 100, atk: 100, def: 90, spatk: 120, spdef: 90, speed: 130 }).name, '膽小');
assert.equal(getDefaultNature({ hp: 100, atk: 80, def: 150, spatk: 90, spdef: 100, speed: 80 }).name, '大膽');
console.log('星際藏品戰鬥效果與預設性格通過');
