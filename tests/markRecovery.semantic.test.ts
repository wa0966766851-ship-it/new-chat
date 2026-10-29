import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { validateKit } from '../src/effects/kitValidation';
import { markRecoveryReduction } from '../src/battle/markRecovery';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness(); let checks = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); checks++; console.log(`✓ ${name}`); };
const mark = (o: any = {}) => ({ op: 'mark_program', p: {
  id: 'test:recovery', name: '恢復限制', displayChar: '限', description: '持有者恢復效果減少',
  side: 'opp', mode: 'set', count: 1, maxCount: 4, scope: 'elf', persistsOffField: false, unit: '層',
  turns: 2, rules: [], recoveryReduction: { ratio: 1, perStack: false, includePotions: false }, ...o,
} });
const reduced = (ratio: number, perStack = false, includePotions = false) => ({ ratio, perStack, includePotions });
try {
  await check('限制參數需有效比例、明確層數及藥劑範圍；空印記和死鍵被拒絕', () => {
    validateKit(h.kitSkill('有效', [mark()]).kit);
    for (const recoveryReduction of [null, [], {}, reduced(0), reduced(-1), reduced(1.1), reduced(NaN),
      { ratio: .5, perStack: false }, { ...reduced(.5), ignoredFlag: true }, { ...reduced(.5), perStack: 'true' },
    ]) assert.throws(() => validateKit(h.kitSkill('無效', [mark({ recoveryReduction })]).kit));
    assert.throws(() => validateKit(h.kitSkill('空容器', [mark({ recoveryReduction: undefined })]).kit));
  });
  await check('同ID不同持有者隔離；新舊比例累加、按層與藥劑規則可查詢', () => {
    const marks: any[] = [
      { id: 'same', ownerBattleId: 'A', count: 2, effects: { recoveryReduction: reduced(.25, true) } },
      { id: 'same', ownerBattleId: 'B', count: 4, effects: { recoveryReduction: reduced(1) } },
      { id: 'legacy', count: 1, effects: { blkHealReduce: .25 } },
      { id: 'potions', count: 1, effects: { recoveryReduction: reduced(.1, false, true) } },
    ];
    assert.equal(markRecoveryReduction(marks, { battleId: 'A' }), .85);
    assert.equal(markRecoveryReduction(marks, { battleId: 'A' }, true), .1);
    assert.equal(markRecoveryReduction(marks, { battleId: 'N' }), .35);
    assert.equal(markRecoveryReduction([{ id: 'legacy', count: 2, effects: { blkHealReduce: .25, blkHealPerStack: true } }] as any, { id: 'A' }), .5);
    assert.equal(markRecoveryReduction([{ id: 'broken', count: 1, effects: { recoveryReduction: { ratio: 5 }, blkHealReduce: .25 } }] as any, { id: 'A' }), 0);
  });
  await check('Blockly修改恢復限制並保存重載，正式雙側引擎依新數值執行', async () => {
    defineCustomBlocks(); const ws = new Blockly.Workspace(), reload = new Blockly.Workspace();
    try {
      const entry = h.kitSkill('可編輯', [mark()]).kit[0], top = buildEntryBlock(ws as any, entry)!;
      const action = top.getInputTargetBlock('BODY')!.getInputTargetBlock('ACTS')!;
      const p = JSON.parse(action.getFieldValue('PARAMS')); p.recoveryReduction.ratio = .25;
      action.setFieldValue(JSON.stringify(p), 'PARAMS');
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws), reload);
      const back = createKitBlockParser('skill')(reload.getTopBlocks(false)[0], entry.node, entry.order)!;
      validateKit([back]); assert.equal(back.params.clause.body[0].acts[0].p.recoveryReduction.ratio, .25);
      for (const side of ['p1', 'p2'] as const) {
        const [r] = await h.play(side, { self: h.unit('來源已改名', 10000, [{ ...h.wait(), name: '編輯後', effectMode: 'kit', kit: [back] }], { speed: 200 }),
          opp: h.unit('E', 4000, [h.healSkill(1000)], { maxHp: 10000 }) });
        assert.equal(r.opp.currentHp, 4750);
      }
    } finally { ws.dispose(); reload.dispose(); }
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 等量後續使用受限制後實際恢復量`, async () => {
      for (const ratio of [.5, 1]) {
        const skill = h.kitSkill('回復並造成等量傷害', [mark({ side: 'self', recoveryReduction: reduced(ratio) }),
          { op: 'heal_flat', p: { amount: 1000 } }, { op: 'dmg_equal', p: { type: '百分比' } }]);
        const [r] = await h.play(side, { self: h.unit('S', 4000, [skill], { maxHp: 10000 }), opp: h.unit('E', 10000, [h.wait()]) });
        assert.equal(r.self.currentHp, 4000 + 1000 * (1 - ratio));
        assert.equal(r.opp.currentHp, 10000 - 1000 * (1 - ratio));
      }
    });
    await check(`${side} 100%限制含施放回合、第二回合；第三回合恢復且原來源不需存在`, async () => {
      const hist = await h.play(side, { self: h.unit('自訂來源', 10000, [h.kitSkill('附加', [mark()]), h.wait()], { speed: 200 }),
        opp: h.unit('E', 4000, [h.healSkill(1000)], { maxHp: 10000 }), turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 3);
      assert.deepEqual(hist.map(r => r.opp.currentHp), [4000, 4000, 5000]);
      const key = `${side === 'p1' ? 'p2' : 'p1'}Marks`;
      assert.equal(hist[0].state[key][0].effects.blkDef, undefined);
      assert.deepEqual(hist.map(r => r.state[key].length), [1, 0, 0]);
    });
    await check(`${side} 重複獲取重新計時，不累加固定限制`, async () => {
      const hist = await h.play(side, { self: h.unit('S', 10000, [h.kitSkill('重置', [mark()]), h.wait()], { speed: 200 }),
        opp: h.unit('E', 4000, [h.healSkill(1000)], { maxHp: 10000 }), turns: (_e, t) => [t <= 2 ? 0 : 1, 0] }, 4);
      assert.deepEqual(hist.map(r => r.opp.currentHp), [4000, 4000, 4000, 5000]);
    });
    await check(`${side} 按層減少、上限和多種印記累加；比例不會使恢復變扣血`, async () => {
      const perLayer = h.kitSkill('累加', [mark({ mode: 'add', count: 2, turns: 10, recoveryReduction: reduced(.25, true) })]);
      const hist = await h.play(side, { self: h.unit('S', 10000, [perLayer], { speed: 200 }),
        opp: h.unit('E', 1000, [h.healSkill(1000)], { maxHp: 10000 }) }, 3);
      assert.deepEqual(hist.map(r => r.opp.currentHp), [1500, 1500, 1500]);
      const combo = h.kitSkill('疊加不同限制', [mark({ id: 'one', recoveryReduction: reduced(.5) }), mark({ id: 'two', recoveryReduction: reduced(.75) })]);
      const [r] = await h.play(side, { self: h.unit('S', 10000, [combo], { speed: 200 }),
        opp: h.unit('E', 1000, [h.healSkill(1000)], { maxHp: 10000 }) });
      assert.equal(r.opp.currentHp, 1000);
    });
    await check(`${side} 持有者下場規則與陣營範圍明確，保留印記不阻止下一隻恢復`, async () => {
      for (const scope of ['elf', 'team']) {
        const hist = await h.play(side, { self: h.unit('S', 10000, [h.kitSkill('附加', [mark({ scope, persistsOffField: true, turns: 5 })]), h.wait()], { speed: 200 }),
          opp: h.unit('E', 4000, [h.healSkill(1000)], { maxHp: 10000 }), oppBench: [h.unit('N', 4000, [h.healSkill(1000)], { maxHp: 10000 })],
          turns: (_e, t) => [t === 1 ? 0 : 1, t === 2 ? { switch: 1 } : 0] }, 3);
        assert.equal(hist[2].opp.id, 'N'); assert.equal(hist[2].opp.currentHp, scope === 'elf' ? 5000 : 4000);
      }
      const hist = await h.play(side, { self: h.unit('S', 10000, [h.kitSkill('下場消失', [mark()]), h.wait()], { speed: 200 }),
        opp: h.unit('E', 4000, [h.wait()], { maxHp: 10000 }), oppBench: [h.unit('N', 4000, [h.wait()], { maxHp: 10000 })],
        turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 0 : { switch: 1 }] }, 2);
      assert.equal(hist[1].state[`${side === 'p1' ? 'p2' : 'p1'}Marks`].length, 0);
    });
  }
  console.log(`印記恢復限制 ${checks} 項驗證通過`);
} finally { await h.close(); }
