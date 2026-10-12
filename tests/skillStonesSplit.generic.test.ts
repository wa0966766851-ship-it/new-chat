// 5026 石之力-S 拆解時新增的通用能力（機率條件、PP歸0則無法行動、致命機率加成、機率先制、技能傷害轉化）與 21 份定義的資料核對。
// 通用能力以「非技能石」的一般技能驗證（不寫任何精靈／技能名稱），並跑 P1／P2 完整對戰。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { sequenceIssue, skillPropertyIssue } from '../src/effects/sequenceContract';
import { toSSStone, createSkillStone } from '../src/data/skillStones';
import { kitDrivenStone, stoneAfterHit, stoneBeforeDamage, stonePriorityBonus } from '../src/effects/skillStoneEffects';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void> | void) => { await run(); count++; console.log(`✓ ${name}`); };
const clause = (body: any[], trig = 'use') => ({ raw: '測試', trig, parsed: true, body });
const act = (op: string, p: any) => ({ op, p, label: op });
const entry = (body: any[]) => ({ codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, customText: '測試', params: { clause: clause(body) } });
const custom = (name: string, body: any[], o: any = {}) => ({ ...h.wait(), ...o, name, effectMode: 'kit', kit: [entry(body)] });
const withEntries = (name: string, kit: any[], o: any = {}) => ({ ...h.wait(), ...o, name, effectMode: 'kit', kit });
const other = (s: string) => s === 'p1' ? 'p2' : 'p1';
const attack = (name = '重擊', power = 120) => ({ ...h.wait(), name, category: '物理', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true });
try {
  await check('合約：機率條件需為 0～100 的百分比；100% 合法', () => {
    const body = (pct: any) => [{ cond: [{ c: 'chance', p: { pct }, label: 'x' }], acts: [act('heal_flat', { amount: 1 })] }];
    assert.equal(sequenceIssue(clause(body(10))), null); assert.equal(sequenceIssue(clause(body(100))), null);
    for (const bad of [0, -5, 101, '10', undefined]) assert.ok(sequenceIssue(clause(body(bad))), `機率 ${String(bad)} 應被拒絕`);
    assert.ok(sequenceIssue(clause([{ cond: [{ c: 'chance', p: { pct: 10, extra: 1 }, label: 'x' }], acts: [act('heal_flat', { amount: 1 })] }])), '多餘參數');
  });
  await check('合約：PP 扣除後「歸0則無法行動」只限對手的扣除／清空；致命機率加成需期限與 0～1 加成', () => {
    const one = (op: string, p: any) => sequenceIssue(clause([{ acts: [act(op, p)] }]));
    assert.equal(one('pp_op', { side: 'opp', mode: 'reduce', amount: 1, stopIfEmpty: true }), null);
    assert.ok(one('pp_op', { side: 'self', mode: 'reduce', amount: 1, stopIfEmpty: true }));
    assert.ok(one('pp_op', { side: 'opp', mode: 'add', amount: 1, stopIfEmpty: true }));
    assert.ok(one('pp_op', { side: 'opp', mode: 'reduce', amount: 1, stopIfEmpty: 'yes' }));
    assert.equal(one('crit_bonus_turns', { turns: 1, bonus: 1 / 16, next: true }), null);
    for (const bad of [{ bonus: 0.1 }, { turns: 1 }, { turns: 1, bonus: 0 }, { turns: 1, bonus: 1.5 }, { turns: 0, bonus: 0.1 }, { turns: 1, bonus: 0.1, extra: 1 }]) assert.ok(one('crit_bonus_turns', bad as any), JSON.stringify(bad));
  });
  await check('合約：技能傷害轉化必須指定屬性與比例（戰鬥系技能傷害）；機率先制只能是附加效果', () => {
    const conv = (p: any) => sequenceIssue(clause([{ acts: [act('dmg_from_last', p)] }]));
    assert.equal(conv({ ratio: 0.5, type: '技能', elem: '戰鬥' }), null);
    assert.equal(conv({ ratio: 1, type: '真實' }), null);
    assert.ok(conv({ ratio: 0.5, type: '技能' }), '缺屬性'); assert.ok(conv({ ratio: 0, type: '技能', elem: '戰鬥' }), '比例0'); assert.ok(conv({ ratio: 0.5, type: '未知' }));
    const prop = (role: string, p: any): any => ({ codeId: 'skill_property', node: 'modify_priority', source: 'skill', role, order: 0, customText: 'x', params: { property: 'chance_priority', value: 1, pct: 10, conditions: [], ...p } });
    assert.equal(skillPropertyIssue(prop('attached', {})), null);
    assert.ok(skillPropertyIssue(prop('innate', {}))); assert.ok(skillPropertyIssue(prop('attached', { pct: 0 }))); assert.ok(skillPropertyIssue(prop('attached', { value: 0 })));
    assert.ok(skillPropertyIssue(prop('attached', { conditions: [{ c: 'hp_full', p: { side: 'self' } }] }))); assert.ok(skillPropertyIssue({ ...prop('attached', {}), node: 'on_skill_use' }));
  });
  for (const side of ['p1', 'p2'] as const) {
    const opp = other(side);
    await check(`${side} 機率條件：100% 必定；50% 以偽隨機分布在 40 次中約半數（15～25 次）`, async () => {
      const proc = (pct: number) => custom('試', [{ cond: [{ c: 'chance', p: { pct }, label: `${pct}%` }], acts: [act('dmg', { flat: 10, type: '固定', both: false })] }], { pp: 99, maxPp: 99 });
      const run = async (pct: number, n: number) => {
        const hist = await h.play(side, { self: h.unit('S', 1e6, [proc(pct), h.wait()], { maxHp: 1e6, speed: 200 }), opp: h.unit('E', 1e6, [h.wait(), h.wait()], { maxHp: 1e6, speed: 100 }), turns: () => [0, 1] } as any, n);
        return (1e6 - hist[n - 1].opp.currentHp) / 10;
      };
      assert.equal(await run(100, 5), 5); const half = await run(50, 40); assert.ok(half >= 15 && half <= 25, `50% 觸發 ${half} 次`);
    });
    await check(`${side} PP歸0則無法行動：對手所選技能被清到0 → 當回合無法行動；其餘情況照常`, async () => {
      const reduce = custom('扣PP', [{ acts: [act('pp_op', { side: 'opp', mode: 'reduce', amount: 1, stopIfEmpty: true })] }], { pp: 99, maxPp: 99 });
      const run = async (oppPps: [number, number], pick: number, extra: any = {}) => {
        const [r] = await h.play(side, { self: h.unit('S', 1e6, [reduce, h.wait()], { maxHp: 1e6, speed: 200, extra }),
          opp: h.unit('E', 1e6, [{ ...attack('甲'), pp: oppPps[0], maxPp: 9 }, { ...attack('乙'), pp: oppPps[1], maxPp: 9 }], { maxHp: 1e6, speed: 100 }), turns: () => [0, pick] } as any, 1);
        return { self: r.self, opp: r.opp };
      };
      const stopped = await run([1, 5], 0); assert.equal(stopped.self.currentHp, 1e6, '所選技能PP歸0 → 無法行動'); assert.deepEqual(stopped.opp.skills.map((s: any) => s.pp), [0, 4]);
      const plenty = await run([2, 5], 0); assert.ok(plenty.self.currentHp < 1e6, 'PP尚有 → 照常行動'); assert.deepEqual(plenty.opp.skills.map((s: any) => s.pp), [0, 4], '被扣1點後出招再用掉1點');
      const otherSlot = await run([1, 5], 1); assert.ok(otherSlot.self.currentHp < 1e6, '別的槽歸0不影響所選技能'); assert.deepEqual(otherSlot.opp.skills.map((s: any) => s.pp), [0, 3]);
      const sealed = await run([1, 5], 0, { isAdditionalInvalid: true }); assert.ok(sealed.self.currentHp < 1e6); assert.deepEqual(sealed.opp.skills.map((s: any) => s.pp), [0, 5], '附加被封印：不扣PP（只剩出招用掉的1點）');
    });
    await check(`${side} 致命機率加成：下回合起 N 回合內攻擊必定致命（加成1），到期恢復；附加被封印不生效`, async () => {
      const boost = custom('蓄', [{ acts: [act('crit_bonus_turns', { turns: 2, bonus: 1, next: true })] }], { pp: 99, maxPp: 99 });
      const strike = { ...attack('還擊', 80), type: '普通' };
      const run = async (first: any, extra: any = {}) => {
        const hist = await h.play(side, { self: h.unit('S', 1e6, [first, strike, h.wait()], { maxHp: 1e6, speed: 200, extra }), opp: h.unit('E', 1e6, [h.wait(), h.wait()], { maxHp: 1e6, speed: 100 }), turns: (_e: any, t: number) => [t === 1 ? 0 : 1, 1] } as any, 5);
        return hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : 1e6) - r.opp.currentHp);
      };
      const withBoost = await run(boost), control = await run(h.wait()), sealed = await run(boost, { isAdditionalInvalid: true });
      assert.equal(withBoost[0], 0);
      for (const t of [1, 2]) assert.ok(withBoost[t] >= control[t] * 1.4, `第${t + 1}回合致命：${withBoost[t]} vs ${control[t]}`);
      // 必定致命時不消耗亂數，後續傷害浮動的亂數序列會錯開一格，所以到期後只比較「不再是致命等級」的傷害。
      for (const t of [3, 4]) assert.ok(withBoost[t] > control[t] * 0.85 && withBoost[t] < control[t] * 1.15, `第${t + 1}回合到期：${withBoost[t]} vs ${control[t]}`);
      assert.deepEqual(sealed, control, '封印');
    });
    await check(`${side} 機率先制：100% 時慢速方先出手；封印附加時不生效；50% 時約半數回合先手`, async () => {
      const prioEntry = (pct: number) => ({ codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 0, customText: '機率先制', params: { property: 'chance_priority', value: 1, pct, conditions: [] } });
      const order = async (pct: number, n: number, extra: any = {}) => {
        const hist = await h.play(side, { self: h.unit('S', 1e6, [withEntries('我擊', [prioEntry(pct)], { ...attack('我擊'), pp: 99, maxPp: 99 }), h.wait()], { maxHp: 1e6, speed: 50, extra }),
          opp: h.unit('E', 1e6, [attack('敵擊'), h.wait()], { maxHp: 1e6, speed: 100 }), turns: () => [0, 0] } as any, n);
        let seen = 0; return hist.map((r: any) => { const fresh = r.logs.slice(seen).filter((l: string) => /使用了【/.test(l)); seen = r.logs.length; return fresh[0].includes('我擊') ? 'S' : 'E'; });
      };
      assert.deepEqual(await order(100, 4), ['S', 'S', 'S', 'S']);
      assert.deepEqual(await order(100, 4, { isAdditionalInvalid: true }), ['E', 'E', 'E', 'E']);
      const half = (await order(50, 40)).filter(x => x === 'S').length; assert.ok(half >= 15 && half <= 25, `50% 先手 ${half} 次`);
    });
  }
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElves.ts');
  const { effectRoute } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const elf = DEFAULT_ELVES.find((e: any) => String(e.id) === '5026');
  const all: any[] = [...elf.skills, ...(elf.skillPool || [])].filter((s: any) => /石之力-S$/.test(s.name));
  const unique = all.filter((s, i) => all.findIndex(t => t.name === s.name && t.description === s.description) === i);
  const pctOf = (s: any) => Number(s.description.match(/使用時(\d+)%機率/)![1]);
  await check('21 份定義（含技能欄 4 筆、技能池 21 筆重複者）全部走 Kit：路由為 kit、與原文機率一致、各自獨立一筆、描述未改', () => {
    assert.equal(unique.length, 21); assert.equal(all.length, 25);
    for (const s of all) {
      assert.equal(s.effectMode, 'kit', s.name); assert.equal(effectRoute(s, true), 'kit', s.name); assert.ok(kitDrivenStone(s), s.name);
      assert.equal(s.kit.length, 1, `${s.name} 一份定義一筆`);
      const e = s.kit[0], first = s.description.split('\n')[0];
      assert.equal(e.customText, first, `${s.name} 句子與原文逐字相同`);
      if (s.skillStoneEffect === 'attr_evil_prio') { assert.equal(e.codeId, 'skill_property'); assert.equal(e.params.pct, pctOf(s)); assert.equal(e.params.value, 1); }
      else { assert.equal(e.codeId, 'effect_sequence'); assert.equal(e.params.clause.body[0].cond[0].p.pct, pctOf(s), s.name); assert.equal(e.params.clause.body[0].acts.length, 1); }
      assert.ok(s.isSkillStone && s.isPerfectSkillStone && s.skillStoneEffect, '技能石標記保留，裝備／顯示不變');
    }
    // 技能欄與技能池的同名定義必須是相同內容
    for (const s of all) assert.deepEqual(s.kit, all.find(t => t.name === s.name && t.description === s.description).kit);
  });
  await check('資料表路徑不再重複結算這 21 份：stoneAfterHit／stoneBeforeDamage／stonePriorityBonus 對 Kit 版技能石不動作；一般技能石不受影響', () => {
    const ctx: any = { self: { id: 'x', skills: [] }, target: { id: 'y', skills: [] }, actor: 'p1', targetSide: 'p2', roundNumber: 1, isHit: true, calls: [] as any[],
      getPlayerState: () => undefined, setPlayerState() {}, getOpponentState: () => undefined, setOpponentState() {},
      applyStatChange: (...a: any[]) => ctx.calls.push(a), applyStatusWithImmunityCheck: (...a: any[]) => { ctx.calls.push(a); return { success: true }; },
      applyFixedDamage: (...a: any[]) => ctx.calls.push(a), applyTrueDamage: (...a: any[]) => ctx.calls.push(a), addTimerTo: (...a: any[]) => ctx.calls.push(a), addLog() {} };
    for (const s of unique) {
      ctx.skill = s; stoneAfterHit(ctx, () => true); assert.equal(ctx.calls.length, 0, s.name);
      assert.equal(stoneBeforeDamage(ctx, s, () => true), s); 
    }
    const plain = createSkillStone('草', 'S', '特殊', true, 'attr_grass_poison'); ctx.skill = plain; stoneAfterHit(ctx, () => true);
    assert.equal(ctx.calls.length, 1, '一般（非 Kit）技能石仍由資料表處理一次'); assert.ok(!kitDrivenStone(plain));
    assert.equal(stonePriorityBonus({ ...ctx, getPlayerState: () => undefined, setPlayerState() {} }, createSkillStone('邪靈', 'S', '特殊', true, 'attr_evil_prio'), () => true), 1);
  });
  await check('投石者轉化：Kit 版技能石的機率改為 100%（含機率先制），原定義不被改動；威力 240、名稱 SS', () => {
    for (const s of unique) {
      const before = JSON.stringify(s.kit), ss = toSSStone(s);
      assert.equal(JSON.stringify(s.kit), before, `${s.name} 原定義不可被轉化改動`);
      assert.equal(ss.power, 240); assert.ok(ss.name.endsWith('-SS')); assert.ok(kitDrivenStone(ss));
      const e = ss.kit[0], pct = e.codeId === 'skill_property' ? e.params.pct : e.params.clause.body[0].cond[0].p.pct;
      assert.equal(pct, 100, s.name); assert.ok(!/(?<![\d])(?:5|10|15)%機率/.test(ss.description.split('\n')[0]), ss.description);
    }
  });
  console.log(`${count} checks`);
} finally { await h.close(); }
