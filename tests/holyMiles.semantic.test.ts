import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHarness } from './helpers/migrationHarness';
import { HOLY_MILES_SEED, HOLY_MILES_SKILLS } from '../src/data/holyMiles';
import { MIGRATED_HOLY_MILES_SOUL_KIT as holy } from '../src/data/migratedHolyMilesKits';
import { sequenceIssue } from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock, createKitBlockParser, defineCustomBlocks } from '../src/components/BlocklyBuilder';

// 以正式 Kit 與 P1/P2 引擎取代已除名的 handler；保留數值與傷害分類要求。
const h = await createHarness();
try {
  assert.equal(Object.values(HOLY_MILES_SEED.baseStats).reduce((a, b) => a + b, 0), 815);
  assert.equal(HOLY_MILES_SEED.seerId, 1204);
  assert.deepEqual([HOLY_MILES_SEED.height, HOLY_MILES_SEED.weight], [178, 87]);
  assert.equal(HOLY_MILES_SKILLS.length, 5);
  for (const kind of ['head', 'body']) assert.ok(readFileSync(`public/seer/${kind}/1204.png`).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  for (const skill of HOLY_MILES_SKILLS) h.assertKitOnly(h.find('5030', skill.name));
  for (const e of holy.kit) assert.equal(sequenceIssue(e.params.clause, e.node), null, e.customText);
  const soul = (orders: number[]) => ({ name: holy.name, description: holy.description, effectMode: 'kit', kit: holy.kit.filter(e => orders.includes(e.order!)) });
  const { addStatusEffect, getStatuses } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const loaded = DEFAULT_ELVES.find((e: any) => e.id === '5030');
  assert.equal(loaded.soulMark.effectMode, 'kit');
  assert.equal(loaded.soulMark.kit.length, holy.kit.length, '正式載入魂印完整圖紙，不允許空kit標記攔住套用');
  defineCustomBlocks();
  for (const [source, kit] of [['soul', loaded.soulMark.kit], ['skill', h.find('5030', '淨世洗禮頌').kit]] as const) {
    const ws = new Blockly.Workspace(), reload = new Blockly.Workspace();
    try {
      const sequences = kit.filter((e: any) => e.codeId === 'effect_sequence');
      for (const e of sequences) { const b = buildEntryBlock(ws as any, e); assert.ok(b); assert.notEqual(b.type, 'native_effect_reference'); }
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws), reload);
      const restored = reload.getTopBlocks(false).map(b => { const e = JSON.parse(b.data!).entry; return createKitBlockParser(source)(b, e.node, e.order); }).sort((a, b) => a!.order - b!.order);
      assert.deepEqual(restored, sequences.map((e: any) => ({ ...e, source })).sort((a: any, b: any) => a.order - b.order), '魂印／淨世新結算節點和參數完整保存重載');
    } finally { ws.dispose(); reload.dispose(); }
  }
  for (const side of ['p1', 'p2'] as const) {
    {
      const self = h.unit('holy', 500, [h.wait()], { maxHp: 1000, extra: { soulMark: soul([3]) } });
      const [r] = await h.play(side, { self, opp: h.unit('enemy', 5000, [h.wait()]) });
      assert.equal(r.self.currentHp, 1000);
      assert.equal(r.opp.currentHp, 4400, '天佑六次各100，不能使用對手最大體力');
    }
    for (const type of ['固定', '真實']) {
      const self = h.unit('holy', 500, [h.wait()], { maxHp: 1000, extra: { soulMark: soul([1, 2]) } });
      const hit = h.kitSkill('測試傷害', [{ op: 'dmg', p: { flat: type === '固定' ? 640 : 64, type } }]);
      const [r] = await h.play(side, { self, opp: h.unit('enemy', 5000, [hit]) });
      assert.equal(r.self.currentHp, type === '固定' ? 490 : 436, '基礎1+5次減半＝1/64；真傷不減半');
    }
    for (const abnormal of [false, true]) {
      const skill = structuredClone(h.find('5030', '淨世洗禮頌'));
      const self = h.unit('holy', 1000, [skill], { maxHp: 1_000_000, speed: 300 });
      const opp = h.unit('enemy', 800000, [h.wait()], { maxHp: 1_000_000 });
      if (abnormal) addStatusEffect(opp, '疲憊', 2);
      const [r] = await h.play(side, { self, opp });
      const floor = 280 * 2 ** 8;
      assert.equal(r.self.currentHp, 1000 + floor, '淨世恢復實際技能傷害');
      assert.equal(r.opp.currentHp, 800000 - floor * (abnormal ? 2 : 1), `正常保底及附加等量百分比\n${r.logs.join('\n')}`);
      if (!abnormal) assert.ok(getStatuses(r.opp)['燒傷'] > 0, '持續效果須有實際屬性技能事件讀取端');
    }
    {
      const skill = structuredClone(h.find('5030', '淨世洗禮頌'));
      const invalid = h.kitSkill('先封攻擊', [{ op: 'invalid_next', p: { kind: '攻擊', uses: 1 } }], { priority: 10 });
      const self = h.unit('holy', 1000, [skill], { maxHp: 1_000_000 });
      const [r] = await h.play(side, { self, opp: h.unit('enemy', 1_000_000, [invalid], { speed: 500 }) });
      const floor = 280 * 2 ** 11;
      assert.equal(r.opp.currentHp, 1_000_000 - floor, `無效保底\n${r.logs.join('\n')}`);
      assert.equal(r.self.currentHp, 1000 + floor, '無效補償技能傷害也須恢復等量');
      assert.ok(r.logs.some((x: string) => x.includes('無效')), '確實走技能無效入口');
    }
    {
      const self = h.unit('holy', 500, [h.wait()], { maxHp: 1000, extra: { soulMark: soul([0, 1, 2]) } });
      addStatusEffect(self, '疲憊', 5);
      const hit = h.kitSkill('固定64', [{ op: 'dmg', p: { flat: 64, type: '固定' } }]);
      const history = await h.play(side, { self, opp: h.unit('enemy', 5000, [hit, h.wait()]), turns: (_engine: any, turn: number) => [0, turn === 1 ? 0 : 1] }, 2);
      assert.ok(getStatuses(history[0].self)['疲憊'] > 0, '不在獲得效果當下提前解除');
      assert.equal(getStatuses(history[1].self)['疲憊'] || 0, 0, '下一回合開始解除');
    }
    // 真正百分比傷害被免疫，來源側收到扣血0事件；隊伍最高比例決定2的次方。
    for (const bench of [false, true]) {
      const losses: number[] = [];
      for (const enabled of [false, true]) {
        const skill = { ...h.wait(), name: '普通攻擊', category: '物理', power: 50 };
        const s: any = soul(enabled ? [5] : []);
        s.kit = [...s.kit, { codeId: 'effect_sequence', node: 'before_skill', source: 'soulmark', role: 'innate', order: 100,
          params: { clause: { raw: '測試百分比結算', trig: 'before_skill', parsed: true, body: [{ acts: [{ op: 'dmg', p: { flat: 10, type: '百分比' }, label: '百分比' }] }] } } }];
        const guard: any = { name: '免疫百分比', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'before_damage', source: 'soulmark', role: 'innate', order: 0,
          params: { clause: { raw: '測試免疫', trig: 'incoming_nontrue', parsed: true, body: [{ cond: [{ c: 'event_damage_kind', p: { kind: '百分比' } }], acts: [{ op: 'dmg_mod', p: { dir: 'in', kind: '百分比', reduce: 1 }, label: '免疫' }] }] } } }] };
        const self = h.unit('holy', 1000, [skill], { speed: 300, extra: { soulMark: s } });
        const opp = h.unit('enemy', 100000, [h.wait()], { maxHp: 1_000_000, extra: { soulMark: guard } });
        const [r] = await h.play(side, { self, opp, oppBench: bench ? [h.unit('bench', 800000, [h.wait()], { maxHp: 1_000_000 })] : [] });
        losses.push(100000 - r.opp.currentHp);
        assert.ok(!(r.state[`${side}Timers`] || []).some((t: any) => t.name === '本回合階梯傷害倍率' && t.remaining > 0), '聖怒不延續至下一回合');
      }
      const mult = bench ? 2 ** 9 : 4;
      assert.ok(losses[0] > 0);
      assert.ok(Math.abs(losses[1] - losses[0] * mult) <= mult, `聖怒倍率${mult}，傷害${losses}`);
    }
    // 第五技能使用計數只加一次，依序200/300/400/500/500；保留原先累進與全技能扣PP驗收。
    {
      const skill = structuredClone(h.find('5030', '聖靈乾坤斷'));
      skill.power = 0;
      const self = h.unit('holy', 1000, [skill], { maxHp: 10000, speed: 300 });
      const opp = h.unit('enemy', 100000, [h.wait(), { ...h.wait(), name: '未使用' }]);
      const history = await h.play(side, { self, opp }, 5);
      assert.deepEqual(history.map((r: any) => r.self.currentHp), [1200, 1500, 1900, 2400, 2900]);
      assert.equal(history[4].opp.skills[1].pp, 94, '對手未選用技能也須吸取PP');
    }
    {
      const skill = structuredClone(h.find('5030', '聖靈乾坤斷'));
      skill.power = 0;
      const self = h.unit('holy', 1000, [skill], { maxHp: 10000, speed: 300 });
      const selected = { ...h.wait(), pp: 1, maxPp: 1 };
      const [r] = await h.play(side, { self, opp: h.unit('enemy', 100000, [selected, { ...h.wait(), name: '未使用' }]) });
      assert.equal(r.opp.skills[0].pp, 0);
      assert.equal(r.opp.skills[1].pp, 98);
      assert.equal(r.opp.currentHp, 99500, '吸取200加選招PP歸零300真傷');
      assert.ok(!r.logs.some((x: string) => x.includes('【enemy】使用了')), 'PP歸零當回合不得行動');
    }
    {
      const skill = structuredClone(h.find('5030', '八荒憫淚'));
      const self = h.unit('holy', 1000, [skill, h.wait()], { speed: 300 });
      const history = await h.play(side, { self, opp: h.unit('enemy', 5000, [h.wait()]), turns: (_e: any, n: number) => [n === 1 ? 0 : 1, 0] }, 3);
      assert.deepEqual(history.map((r: any) => r.opp.currentHp), [4700, 4400, 4400], '只懲罰下兩次屬性技能');
      assert.equal(history[0].state[`${side}RegistryState`].blockAttackCount, 1, '八荒仍有下一次攻擊免疫');
    }
    console.log(`✓ ${side} 邁爾斯：天佑、八荒、真傷、淨世正常／異常／無效及四象`);
  }
} finally { await h.close(); }
