import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
try {
  const meditate = h.find('5006', '星光·冥想'), praise = h.find('5008', '贖魂讚詩'), song = h.find('5008', '引魂咏');
  const basic = ['衝頂', '縮頭', '熱量集合'].map(n => h.find('5006', n));
  const { validateKit } = await h.server.ssrLoadModule('/src/effects/kitValidation.ts');
  const { sequenceIssue } = await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  for (const skill of [meditate, praise, song, ...basic]) { h.assertKitOnly(skill); validateKit(skill.kit); }
  await check('六份真實資料已接入完整Kit；無同名handler與fallback', async () => {
    const { applyReviewedSkillKits } = await h.server.ssrLoadModule('/src/data/reviewedSkillKits.ts');
    const modified = { ...meditate, description: meditate.description + '\n自訂效果', effectMode: undefined, kit: undefined };
    const result = applyReviewedSkillKits({ id: '5006', skills: [modified], skillPool: [] });
    assert.ok(!result.skills[0].kit, '不同原文不能套舊定義');
  });
  await check('能力值基數明確白名單、異常轉化需期限與單一目標', async () => {
    const clause = (op: string, p: any) => ({ raw: 'x', trig: 'use', parsed: true, body: [{ acts: [{ op, p }] }] });
    assert.equal(sequenceIssue(clause('dmg', { base: 'stat:攻擊和特攻', of: 'self', ratio: .5, type: '百分比' })), null);
    assert.ok(sequenceIssue(clause('dmg', { base: 'stat:不存在', of: 'self', ratio: .5, type: '百分比' })));
    assert.ok(sequenceIssue(clause('convert_status', { side: 'both', status: '害怕', turns: 3 })));
    assert.ok(sequenceIssue(clause('convert_status', { side: 'opp', status: '害怕' })));
  });
  const attack = { ...h.wait(), name: '普攻', category: '物理', power: 0, isSureHit: true };
  const miss = { ...attack, name: '落空', power: 30, isSureHit: false, accuracy: 0 };
  const attempt = h.kitSkill('狀態與降能力', [{ op: 'status', p: { side: 'opp', status: '中毒', chance: 100, turns: 3 } },
    { op: 'stat', p: { side: 'opp', stats: ['攻擊'], v: -1 } }]);
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 冥想整招：焚燼成功、免疫反彈異常與免降能力`, async () => {
      const [whole] = await h.play(side, { self: h.unit('S', 1000000, [meditate], { speed: 200 }), opp: h.unit('E', 1000000, [h.wait()], { speed: 100 }) });
      assert.ok(h.statuses(whole.opp).includes('焚燼'));
      assert.equal(whole.opp.currentHp, 1000000, '屬性招當回合不憑空觸發攻擊附加');
      const guarded = { ...meditate, kit: meditate.kit.slice(0, 3) };
      const history = await h.play(side, { self: h.unit('S', 1000000, [guarded, h.wait()], { speed: 200 }), opp: h.unit('E', 1000000, [h.wait(), attempt], { speed: 100 }),
        turns: (_e, t) => [t === 1 ? 0 : 1, t === 4 ? 1 : 0] }, 4);
      assert.ok(!h.statuses(history[3].self).includes('中毒'));
      assert.ok(h.statuses(history[3].opp).includes('中毒'));
      assert.equal(history[3].self.statStages.atk || 0, 0);
      const expired = await h.play(side, { self: h.unit('S', 1000000, [guarded, h.wait()], { speed: 200 }), opp: h.unit('E', 1000000, [h.wait(), attempt], { speed: 100 }),
        turns: (_e, t) => [t === 1 ? 0 : 1, t === 5 ? 1 : 0] }, 5);
      assert.ok(h.statuses(expired[4].self).includes('中毒'));
      assert.equal(expired[4].self.statStages.atk, -1);
    });
    await check(`${side} 冥想3回合面板雙攻附加：期限、屬性招排除與百分比傷害`, async () => {
      const timed = { ...meditate, kit: [meditate.kit[0], meditate.kit[4]] };
      const history = await h.play(side, { self: h.unit('S', 1000000, [timed, attack, h.wait()], { speed: 200,
        extra: { calculatedStats: { hp: 1000000, atk: 450, spatk: 650, def: 300, spdef: 300, speed: 200 } } }),
        opp: h.unit('E', 1000000, [h.wait()]), turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 4);
      assert.deepEqual(history.map((r, i) => (i ? history[i - 1].opp.currentHp : 1000000) - r.opp.currentHp), [0, 550, 550, 0]);
      const warded = await h.play(side, { self: h.unit('S', 100000, [timed, attack]), opp: h.unit('E', 100000, [h.wait()], { extra: { barrier: 2000 } }),
        turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 2);
      assert.equal(warded[1].opp.currentHp, 100000); assert.equal(warded[1].opp.barrier, 1700, '百分比傷害由護罩吸收');
      const late = await h.play(side, { self: h.unit('S', 1000000, [timed, attack], { speed: 50 }), opp: h.unit('E', 1000000, [h.wait()], { speed: 200 }),
        turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 4);
      assert.deepEqual(late.map((r, i) => (i ? late[i - 1].opp.currentHp : 1000000) - r.opp.currentHp), [0, 300, 300, 0], '後手不得多算第4回合');
    });
    await check(`${side} 冥想焚燼失敗：只在下兩回合使用時附加害怕`, async () => {
      const failing = { ...meditate, kit: [meditate.kit[0], meditate.kit[3]] };
      const initialGuard = { ...h.kitSkill('一次抵抗', [{ op: 'immune_status_count', p: { count: 1, reflect: false } }]), priority: 6 };
      const history = await h.play(side, { self: h.unit('S', 1000000, [failing, h.wait()]), opp: h.unit('E', 1000000, [initialGuard, h.wait()]),
        turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] }, 4);
      assert.ok(!h.statuses(history[0].opp).includes('害怕'));
      assert.ok(h.statuses(history[1].opp).includes('害怕'));
      assert.ok(h.statuses(history[2].opp).includes('害怕'));
      const timers = history[3].state[`${side}Timers`];
      assert.ok(!timers.some((t: any) => t.payload?.block?.trig === 'self_skill'), '下兩回合後停止');
    });
    await check(`${side} 贖魂成功消回合後流血被轉害怕；沒有回合效果不無條件流血`, async () => {
      const only = { ...praise, category: '屬性', power: 0, isSureHit: true, kit: praise.kit.slice(2, 4) };
      const hist = await h.play(side, { self: h.unit('S', 1000000, [h.wait(), only]), opp: h.unit('E', 1000000, [h.turnEffectSkill(), h.wait()]),
        turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] }, 2);
      assert.ok(h.statuses(hist[1].opp).includes('害怕')); assert.ok(!h.statuses(hist[1].opp).includes('流血'));
      assert.ok(!hist[1].state[`${side === 'p1' ? 'p2' : 'p1'}Timers`].length);
      const [no] = await h.play(side, { self: h.unit('S', 1000000, [only]), opp: h.unit('E', 1000000, [h.wait()]) });
      assert.ok(!h.statuses(no.opp).includes('流血')); assert.ok(!h.statuses(no.opp).includes('害怕'));
    });
    await check(`${side} 贖魂對手攻擊監控：屬性招不窒息、4回合內攻擊觸發、到期停止`, async () => {
      const only = { ...praise, category: '屬性', power: 0, isSureHit: true, kit: [praise.kit[4]] };
      const run = (at: number) => h.play(side, { self: h.unit('S', 1000000, [only, h.wait()], { speed: 200 }), opp: h.unit('E', 1000000, [h.wait(), attack], { speed: 100 }),
        turns: (_e, t) => [t === 1 ? 0 : 1, t === at ? 1 : 0] }, at);
      const hist = await run(4);
      assert.ok(!h.statuses(hist[0].opp).includes('窒息'));
      assert.ok(h.statuses(hist[3].opp).includes('窒息'));
      assert.ok(!h.statuses((await run(5))[4].opp).includes('窒息'));
    });
    await check(`${side} 引魂25/35/45/50%遞增，穿插其他招不重置且正確恢復`, async () => {
      const only = { ...song, category: '屬性', power: 0, isSureHit: true, kit: [song.kit[3]] };
      const hist = await h.play(side, { self: h.unit('S', 100000, [only, h.wait()], { maxHp: 1000000 }), opp: h.unit('E', 1000000, [h.healSkill(1000000), h.wait()]),
        turns: (_e, t) => [t === 2 ? 1 : 0, t === 5 ? 1 : 0] }, 5);
      assert.deepEqual(hist.map(r => r.self.currentHp), [350000, 350000, 700000, 1000000, 1000000]);
      assert.equal(hist[4].opp.currentHp, 500000, '到上限50%，用真正扣血數值核對而非日誌');
    });
    await check(`${side} 引魂未命中：不執行吸取，仍消回合及附加流血／窒息`, async () => {
      const forcedMiss = { ...song, isSureHit: false, accuracy: 0, kit: song.kit.slice(2) };
      const hist = await h.play(side, { self: h.unit('S', 100000, [h.wait(), forcedMiss], { maxHp: 1000000 }), opp: h.unit('E', 1000000, [h.turnEffectSkill(), h.wait()]),
        turns: (_e, t) => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] }, 2);
      assert.ok(h.statuses(hist[1].opp).includes('流血')); assert.ok(h.statuses(hist[1].opp).includes('窒息'));
      assert.ok(!hist[1].state[`${side === 'p1' ? 'p2' : 'p1'}Timers`].length);
      assert.ok(hist[1].self.currentHp <= 100000, '未命中不吸取回血；對方窒息後撞擊的合法扣血不算失敗');
    });
    await check(`${side} 引魂整招：無異常才翻倍攻擊，吸取沒有因舊absorb重複`, async () => {
      const base = { ...song, isSureHit: true, kit: song.kit.filter((e: any) => e.order !== 2) };
      const run = (skill: any) => h.play(side, { self: h.unit('S', 100000, [skill], { maxHp: 1000000 }), opp: h.unit('E', 1000000, [h.wait()]) });
      const [normal] = await run(base), [boosted] = await run({ ...song, isSureHit: true });
      const main = (r: any) => 1000000 - r.opp.currentHp - 250000;
      assert.equal(main(boosted), main(normal) * 2);
      assert.equal(normal.self.currentHp, 350000); assert.equal(boosted.self.currentHp, 350000);
    });
    await check(`${side} 贖魂監控下場不傳給下一隻`, async () => {
      const only = { ...praise, category: '屬性', power: 0, isSureHit: true, kit: [praise.kit[4]] };
      const hist = await h.play(side, { self: h.unit('S', 1000000, [only]), selfBench: [h.unit('B', 1000000, [h.wait()])],
        opp: h.unit('E', 1000000, [h.wait(), attack]), turns: (_e, t) => [t === 1 ? 0 : { switch: 1 }, t === 1 ? 0 : 1] }, 2);
      assert.equal(hist[1].self.id, 'B'); assert.ok(!h.statuses(hist[1].opp).includes('窒息'));
    });
    await check(`${side} 基本招確實強化，附加失效時不強化`, async () => {
      for (const [skill, stat] of [[basic[1], 'def'], [basic[2], 'spatk']]) {
        const [r] = await h.play(side, { self: h.unit('S', 10000, [skill]), opp: h.unit('E', 10000, [h.wait()]) });
        assert.equal(r.self.statStages[stat], 1);
        const [sealed] = await h.play(side, { self: h.unit('S', 10000, [skill], { extra: { isAdditionalInvalid: true } }), opp: h.unit('E', 10000, [h.wait()]) });
        assert.equal(sealed.self.statStages[stat] || 0, 0);
      }
    });
    await check(`${side} 衝頂只有主攻擊傷害，不產生額外體力／狀態效果`, async () => {
      const actual = basic[0], control = { ...actual, name: '基準衝頂', description: '', kit: undefined, effectMode: undefined };
      const run = (skill: any) => h.play(side, { self: h.unit('S', 1000000, [skill]), opp: h.unit('E', 1000000, [h.wait()]) });
      const [a] = await run(actual), [b] = await run(control);
      assert.equal(a.opp.currentHp, b.opp.currentHp); assert.ok(a.opp.currentHp < 1000000);
      assert.equal(a.self.currentHp, 1000000); assert.deepEqual(a.self.statStages, b.self.statStages);
      assert.deepEqual(h.statuses(a.self), []); assert.deepEqual(h.statuses(a.opp), []);
    });
    await check(`${side} 引魂及贖魂條件式先制／必中走正式查詢，不寫死`, async () => {
      const { readBasePriority, readSkillProperty } = await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
      const getStatuses = (e: any) => e.battleStatuses || {};
      for (const skill of [praise, song]) {
        const ctx: any = { self: { battleStatuses: {} }, target: {}, actor: side, targetSide: side === 'p1' ? 'p2' : 'p1', getStatuses };
        assert.equal(readBasePriority(skill, ctx), skill.priority);
        assert.equal(readSkillProperty(skill, 'sure_hit', ctx), undefined);
        ctx.self.battleStatuses = { 中毒: 3 };
        assert.equal(readBasePriority(skill, ctx), skill.priority + 1);
        assert.equal(readSkillProperty(skill, 'sure_hit', ctx), true);
      }
    });
  }
  await check('異常轉化保留BOSS狀態、印記及其他效果，期限明確', async () => {
    const { runAct } = await h.server.ssrLoadModule('/src/blocks/runtime.ts');
    const { getStatuses, addStatusEffect } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
    for (const side of ['p1', 'p2']) {
      const target = { battleStatuses: { 中毒: 4, 神話: 1 }, effects: [{ id: '中毒', duration: 4 }, { id: '神話', duration: 1 }, { id: '技能增益', duration: 2 }], marks: [{ id: 'mark', count: 2 }] };
      const ctx: any = { actor: side, targetSide: side === 'p1' ? 'p2' : 'p1', self: {}, target, getStatuses,
        // convert_status 現讀 status_conversion_ban 常駐狀態（5015 夜）：mock 補玩家／對手狀態查詢，未設保護即回傳 undefined。
        getPlayerState: (_k: string) => undefined, getOpponentState: (_k: string) => undefined,
        updateElf: (_s: string, changes: any) => Object.assign(target, changes), addLog: () => {},
        applyStatusWithImmunityCheck: (_s: string, status: string, turns: number) => { addStatusEffect(target, status, turns); return { success: true }; } };
      assert.equal(runAct(ctx, { op: 'convert_status', p: { side: 'opp', status: '害怕', turns: 3 }, label: 'x' }, { last: null, lastAmount: 0 }), true);
      assert.equal(getStatuses(target).中毒, undefined); assert.equal(getStatuses(target).神話, 1); assert.equal(getStatuses(target).害怕, 3);
      assert.ok(target.effects.some(e => e.id === '技能增益')); assert.equal(target.marks[0].count, 2);
    }
  });
} finally { await h.close(); }
console.log(`${count} monkey/baphomet migration checks passed`);
