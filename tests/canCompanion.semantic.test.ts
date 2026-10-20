import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { MIGRATED_5014_CAN_SOUL_KIT as can } from '../src/data/migrated5014CanSoulKit';
import { sequenceIssue } from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';

const h = await createHarness();
const soul = (orders: number[]) => ({ name: '燦條款', description: can.description, effectMode: 'kit', kit: can.kit.filter(e => orders.includes(e.order!)) });
try {
  for (const e of can.kit) assert.equal(sequenceIssue(e.params.clause, e.node), null, e.customText);
  defineCustomBlocks();
  const workspace = new Blockly.Workspace(), reload = new Blockly.Workspace();
  try {
    for (const entry of can.kit) { const block = buildEntryBlock(workspace as any, entry); assert.ok(block); assert.notEqual(block.type, 'native_effect_reference'); }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace), reload);
    const restored = reload.getTopBlocks(false).map(block => { const original = JSON.parse(block.data!).entry; return createKitBlockParser('soul')(block, original.node, original.order); }).sort((a, b) => a!.order - b!.order);
    assert.deepEqual(restored, [...can.kit].map(e => ({ ...e, source: 'soul' })).sort((a, b) => a.order! - b.order!), '全部魂印圖紙可編輯保存重載，不借專屬handler；編輯器將魂印來源正規化為soul');
  } finally { workspace.dispose(); reload.dispose(); }
  const { addStatusEffect, getStatuses } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
  for (const side of ['p1', 'p2'] as const) for (const stopped of [false, true]) {
    const self = h.unit('source', 900, [h.wait()], { extra: { soulMark: soul([12, 13]) } });
    if (stopped) addStatusEffect(self, '疲憊', 2);
    const opp = h.unit('enemy', 10000, [h.wait()]);
    const [r] = await h.play(side, { self, opp, selfBench: [h.unit('large-bench', 90000, [h.wait()])] });
    const extra = r.state[`${side}Team`].find((e: any) => e.isExtra);
    assert.ok(extra, r.logs.join('\n'));
    assert.equal(extra.name, '珀妮');
    assert.equal(extra.type, '光');
    assert.equal(extra.summonerId, 'source');
    assert.equal(extra.maxHp, 300, '只讀召喚者，不能把場下精靈的能力加進來');
    for (const key of ['atk', 'def', 'spatk', 'spdef', 'speed']) assert.equal(extra.calculatedStats[key], Math.floor(self.calculatedStats[key] / 3));
    assert.equal(r.opp.currentHp, 6667, `${side} ${stopped ? '不能出手' : '使用技能'}仍有一次光系額外傷害\n${r.logs.join('\n')}`);
    assert.ok(getStatuses(r.opp)['失明'] > 0);
    console.log(`✓ ${side} 珀妮召喚者⅓能力、${stopped ? '不能出手' : '正常出手'}後獨立額外行動與失明`);
  }
  for (const side of ['p1', 'p2'] as const) for (const incoming of ['麻痺', '失明']) {
    const grant = { codeId: 'effect_sequence', node: 'battle_start', source: 'soulmark', role: 'innate', order: 1000,
      params: { clause: { raw: '測試聖芒', trig: 'battle_start', parsed: true, body: [{ acts: [{ op: 'resource_mark_add', p: {
        id: 'canGlory', name: '聖芒', displayChar: '芒', unit: '層', side: 'self', scope: 'team', persistsOffField: true, amount: 1, maxCount: 3, description: '轉化',
      }, label: '聖芒' }] }] } } };
    const s = soul([13, 14, 15]);
    s.kit = [...s.kit, grant as any];
    const self = h.unit('source', 900, [h.wait()], { speed: 100, extra: { soulMark: s } });
    addStatusEffect(self, '燒傷', 3);
    const status = h.kitSkill('施加異常', [{ op: 'status', p: { side: 'opp', status: incoming, turns: 2, chance: 100 } }]);
    const [r] = await h.play(side, { self, opp: h.unit('enemy', 10000, [status], { speed: 300 }) });
    assert.deepEqual(getStatuses(r.self), { 星贖: 5 }, `${side} ${incoming}與原有燒傷合併回合\n${r.logs.join('\n')}`);
    console.log(`✓ ${side} ${incoming}與全部現有異常合併為星贖5回合`);
  }
  for (const side of ['p1', 'p2'] as const) for (const layers of [0, 3]) {
    const s = soul([10, 11, 13]);
    if (layers) s.kit = [...s.kit, { codeId: 'effect_sequence', node: 'battle_start', source: 'soulmark', role: 'innate', order: 1000,
      params: { clause: { raw: '聖芒', trig: 'battle_start', parsed: true, body: [{ acts: [{ op: 'resource_mark_add', p: {
        id: 'canGlory', name: '聖芒', displayChar: '芒', unit: '層', side: 'self', scope: 'team', persistsOffField: true, amount: layers, maxCount: 3, description: '縮短重生',
      }, label: '聖芒' }] }] } } } as any];
    const self = h.unit('source', 900, [h.wait()], { speed: 100, extra: { soulMark: s } });
    const hit = h.kitSkill('致死', [{ op: 'dmg', p: { flat: 5000, type: '真實' } }]);
    const rounds = 4 - layers;
    const history = await h.play(side, { self, selfBench: [h.unit('survivor', 10000, [h.wait()])], opp: h.unit('enemy', 10000, [hit, h.wait()], { speed: 300 }),
      turns: async (engine: any, turn: number) => {
        if (turn === 2) { engine.onSwitchElf(side, 1); await engine.idle(); }
        return [0, turn === 1 ? 0 : 1];
      },
    }, rounds + 1);
    for (let i = 0; i < history.length; i++) {
      const source = history[i].state[`${side}Team`].find((e: any) => e.battleId === 'source');
      assert.equal(source.currentHp, i < rounds ? 0 : 900, `${side} ${layers}層死亡後第${i}回合`);
      if (i > 0) assert.equal(history[i].self.battleId, 'survivor', '背包重生不替換在場隊友');
    }
    console.log(`✓ ${side} ${layers}層：死亡當回合不復活，場下${rounds}回合滿血重生`);
  }
} finally { await h.close(); }
