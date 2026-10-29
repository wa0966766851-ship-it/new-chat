import assert from 'node:assert/strict';
import test from 'node:test';
import {TraitsEngine} from '../src/utils/traitsEngine';

// 2026-10-28 使用者裁定：
// 根性只在「該段傷害 >= 當前體力」時保留 1 點；
// 小於當前體力的多段傷害不觸發；消耗體力（adjust_hp，非傷害）不算數。

function makeCtx(opts: { hp: number; fatalDamage?: number; fatalIsDamage?: boolean }) {
  const elf: any = { id: 'x', name: '無序.墜星', currentHp: opts.hp, maxHp: 1000,
    alienTraits: { gen2Trait: { name: '豪邁 / 投石者', description: '', effectMode: 'kit',
      kit: [{ codeId: 'effect_sequence', source: 'trait', role: 'innate', node: 'passive_always', order: 0,
        customText: '遭受致死傷害保留1體力',
        params: { clause: { raw: '遭受致死傷害保留1體力', trig: 'passive', parsed: true,
          body: [{ acts: [{ op: 'advanced_mechanic', p: { key: 'firstFatalSurviveAt1Hp', value: true } }] }] } } }] } } };
  const logs: string[] = [];
  const ctx: any = {
    self: elf, actor: 'p1',
    getPlayerState: () => undefined, setPlayerState: () => {},
    updateElf: (_s: string, patch: any) => { Object.assign(elf, patch); },
    updateAnyElf: () => {},
    addLog: (t: string) => logs.push(t),
    rng: () => 0.5,
    fatalDamage: opts.fatalDamage,
    fatalIsDamage: opts.fatalIsDamage,
  };
  return { ctx, elf, logs };
}

test('根性：傷害 >= 當前體力 → 保留 1 點', () => {
  const { ctx, elf } = makeCtx({ hp: 300, fatalDamage: 300 });
  const res = TraitsEngine.triggerFatalResist(ctx);
  assert.equal(res, true, '傷害等於當前體力時必須保留');
  assert.equal(elf.currentHp, 1);
});

test('根性：傷害 > 當前體力 → 保留 1 點', () => {
  const { ctx, elf } = makeCtx({ hp: 300, fatalDamage: 5000 });
  assert.equal(TraitsEngine.triggerFatalResist(ctx), true);
  assert.equal(elf.currentHp, 1);
});

test('根性：單段傷害 < 當前體力 → 不保留', () => {
  const { ctx, elf } = makeCtx({ hp: 300, fatalDamage: 120 });
  const res = TraitsEngine.triggerFatalResist(ctx);
  assert.equal(res, false, '傷害小於當前體力時不得觸發根性');
  assert.equal(elf.currentHp, 300, '體力不得被改成 1');
});

test('根性：消耗體力（fatalIsDamage=false）→ 不保留', () => {
  const { ctx, elf } = makeCtx({ hp: 300, fatalDamage: 9999, fatalIsDamage: false });
  const res = TraitsEngine.triggerFatalResist(ctx);
  assert.equal(res, false, '消耗體力不得觸發根性');
  assert.equal(elf.currentHp, 300);
});

console.log('根性傷害比較：>=體力觸發、<體力不觸發、非傷害不觸發 全部通過');
