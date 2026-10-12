// 5020 皮皮：撞擊、飛翼拍擊（無特殊效果）、鳴叫、誘惑 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 鳴叫／誘惑（使用者決定 2026-10-12）：「技能使用後」＝技能使用成功後；技能無效、未命中、無法行動不觸發。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
try {
  const tackle = h.find('5020', '撞擊'), wing = h.find('5020', '飛翼拍擊');
  for (const s of [tackle, wing]) h.assertKitOnly(s);
  await check('原文保護：描述為（無特殊效果），Kit 只有一句空動作', async () => {
    for (const s of [tackle, wing]) {
      assert.equal(s.description, '（無特殊效果）'); assert.equal(s.kit.length, 1);
      assert.equal(s.kit[0].params.clause.body[0].acts[0].op, 'noop');
    }
    assert.equal(h.find('5020', '電光火石').effectMode, 'kit');
  });
  for (const side of ['p1', 'p2'] as const) for (const [name, skill] of [['撞擊', tackle], ['飛翼拍擊', wing]] as const) {
    await check(`${side} ${name}：只造成技能傷害，不附帶回復／能力變化／異常；多回合傷害穩定`, async () => {
      const hist = await h.play(side, { self: h.unit('S', 8000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, statStages: { atk: -1 } }),
        opp: h.unit('E', 20000, [h.wait()], { maxHp: 20000, speed: 100 }), turns: () => [0, 0] } as any, 2);
      for (const r of hist) {
        assert.equal(r.self.currentHp, 8000, '自身不回復'); assert.equal(r.self.statStages.atk, -1); assert.deepEqual(r.opp.statStages, {});
        assert.deepEqual(h.statuses(r.opp), []); assert.deepEqual(h.statuses(r.self), []);
        assert.ok(!r.logs.some((l: string) => l.includes('效果待接通')));
      }
      const d1 = 20000 - hist[0].opp.currentHp, d2 = hist[0].opp.currentHp - hist[1].opp.currentHp;
      assert.ok(d1 > 0 && d2 > 0 && Math.abs(d1 - d2) / d1 < 0.2, `傷害 ${d1}/${d2}`);
    });
  }
  const tweet = h.find('5020', '鳴叫'), charm = h.find('5020', '誘惑');
  for (const s of [tweet, charm]) h.assertKitOnly(s);
  await check('鳴叫／誘惑 原文保護與 Kit 對應：成功行動結束（after_action）時點，100% 令對手攻擊／命中等級-1', async () => {
    assert.equal(tweet.description, '🎯 技能使用後100%改變對方攻擊等級-1'); assert.equal(charm.description, '🎯 技能使用後100%改變對方命中等級-1');
    for (const [s, stat] of [[tweet, '攻擊'], [charm, '命中']] as const) {
      assert.equal(s.kit.length, 1);
      const e = s.kit[0], c = e.params.clause;
      assert.deepEqual([e.codeId, e.node, c.trig], ['effect_sequence', 'after_action', 'self_after_skill']);
      assert.deepEqual(c.body[0].acts[0].p, { chance: 100, side: 'opp', stats: [stat], v: -1 });
    }
  });
  await check('解析規則：「技能使用後…」整句解析為 self_after_skill，distillEffect 整份 complete 且與定義逐項相同（不計顯示名稱）', async () => {
    const { distillEffect } = await h.server.ssrLoadModule('/src/effects/distillEffect.ts');
    for (const s of [tweet, charm]) {
      const r = distillEffect({ name: s.name, description: s.description, effectMode: 'description' }, 'skill');
      assert.equal(r.complete, true, JSON.stringify(r.issues));
      const bare = (e: any) => JSON.parse(JSON.stringify([e.node, e.params.clause.trig, e.params.clause.body], (k, v) => (k === 'label' ? undefined : v)));
      assert.deepEqual(r.kit.map(bare), s.kit.map(bare));
    }
  });
  const stageOf = (r: any, k: string) => r.opp.statStages[k] || 0;
  const missCount = (r: any) => r.logs.filter((l: string) => l.includes('沒有命中')).length;
  for (const side of ['p1', 'p2'] as const) for (const [name, skill, key] of [['鳴叫', tweet, 'atk'], ['誘惑', charm, 'accuracy']] as const) {
    const go = (o: { n?: number; sealed?: boolean; selfStages?: any; before?: (e: any, t: number) => void; oppStages?: any; selfExtra?: any }) => h.play(side, {
      self: h.unit('S', 8000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, statStages: o.selfStages, extra: { ...(o.sealed ? { isAdditionalInvalid: true } : {}), ...o.selfExtra } }),
      opp: h.unit('E', 20000, [h.wait()], { maxHp: 20000, speed: 100, statStages: o.oppStages }),
      turns: (e: any, t: number) => { o.before?.(e, t); return [0, 0]; } } as any, o.n ?? 1);
    await check(`${side} ${name}：使用成功後 100% 令對手${key === 'atk' ? '攻擊' : '命中'}等級-1，可累積；只動對手，自身與傷害不變`, async () => {
      const hist = await go({ n: 3, selfStages: { accuracy: 6 } });
      assert.deepEqual(hist.map((r: any) => stageOf(r, key)), [-1, -2, -3]);
      for (const r of hist) {
        assert.equal(r.self.currentHp, 8000); assert.equal(r.opp.currentHp, 20000, '屬性技能無傷害');
        assert.deepEqual(Object.keys(r.self.statStages).filter(k => r.self.statStages[k] !== 0 && k !== 'accuracy'), []);
        assert.deepEqual(h.statuses(r.opp), []);
      }
      const capped = await go({ n: 2, oppStages: { [key]: -6 }, selfStages: { accuracy: 6 } });
      assert.equal(stageOf(capped[1], key), -6, '下限-6');
    });
    await check(`${side} ${name}：附加效果被封印 → 不改變能力等級`, async () => {
      const hist = await go({ n: 2, sealed: true, selfStages: { accuracy: 6 } });
      assert.deepEqual(hist.map((r: any) => stageOf(r, key)), [0, 0]);
    });
    await check(`${side} ${name}：技能無效（屬性技能失效）的那一回合不觸發`, async () => {
      const hist = await go({ n: 3, selfStages: { accuracy: 6 }, before: (e, t) => e.dispatch({ type: 'UPDATE_REGISTRY_STATE', side, state: { utilitySkillInvalidTurns: t === 2 ? 3 : 0, utilitySkillInvalidReason: '測試無效' } }) });
      assert.deepEqual(hist.map((r: any) => stageOf(r, key)), [-1, -1, -2], '第2回合技能無效 → 不下降；第3回合恢復有效 → 再下降');
    });
    await check(`${side} ${name}：未命中時不觸發；命中時才觸發（逐回合對照命中與否）`, async () => {
      const hist = await go({ n: 12, selfStages: { accuracy: -6 } });
      let hits = 0, misses = 0;
      for (const [i, r] of hist.entries()) {
        const missed = missCount(r) - (i ? missCount(hist[i - 1]) : 0);
        if (missed === 0) hits++; else misses++;
        assert.equal(stageOf(r, key) + 0, hits ? -hits : 0, `第${i + 1}回合：命中${hits}次、未命中${misses}次`);
      }
      assert.ok(hits > 0 && misses > 0, `需同時出現命中與未命中：${hits}/${misses}`);
    });
    await check(`${side} ${name}：無法行動（睡眠）時技能未使用，不觸發`, async () => {
      const hist = await go({ n: 2, selfExtra: { battleStatuses: { 睡眠: 9 }, effects: [{ id: '睡眠', name: '睡眠', duration: 9, isLateMover: false, stacks: 1 }] } });
      assert.deepEqual(hist.map((r: any) => stageOf(r, key)), [0, 0]);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
