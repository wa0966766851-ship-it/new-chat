// 5019 眾神之父·奧丁：ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ（岡格尼爾）轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ（世界樹）：使用者 2026-10-12 決定「當回合使用也算」→ 已轉 Kit，測試在檔尾；其餘兩招（ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ、ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ）、ᚱᚨᚷᚾᚨᚱᛟᚲ 與魂印含 B 缺口，未轉，見交接單 §4。
// 吸取＝百分比吸取（queueHpDrain 'percent'）：實際扣除量＝對手最大體力×比例，並恢復等量。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
const stagesAll = (e: any, v: number, label: string) => { for (const k of STAGES) assert.equal(e.statStages[k] || 0, v, `${label}:${k}=${e.statStages[k]}`); };
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const timersOf = (state: any, side: string) => h.timers(state, side);
const HP = 400000, OPP = 120000;
try {
  const gung = h.find('5019', 'ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ');
  h.assertKitOnly(gung);
  const prop = (s: any) => s.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`);
  await check('固有屬性與原文逐句對應', async () => {
    assert.deepEqual(prop(gung), ['base_priority=3', 'sure_hit=true']);
    assert.equal(gung.kit.length, 5);
  });
  const strike = { ...h.wait(), name: '重擊', category: '物理', power: 100, isSureHit: true };
  const counter = { ...h.wait(), name: '還擊', category: '物理', power: 100, isSureHit: true };
  const duel = (side: 'p1' | 'p2', selfSkills: any[], o: { selfHp?: number; stages?: any; oppStages?: any; oppHp?: number; sealed?: boolean; selfSpeed?: number; oppSkills?: any[]; oppExtra?: any; n: number; pick: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? HP, selfSkills, { maxHp: HP, speed: o.selfSpeed ?? 200, statStages: o.stages || {}, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', o.oppHp ?? OPP, o.oppSkills ?? [h.wait(), strike], { maxHp: o.oppHp ?? OPP, speed: 100, statStages: o.oppStages || {}, extra: o.oppExtra || {} }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n);
  // 威力 90 的攻擊另外造成傷害；吸取量以自身恢復量觀察（對手只等待，自身不受傷）。
  const noAtk = (s: any) => ({ ...s, power: 0, category: '屬性' });
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 岡格尼爾：解除自身能力下降→恢復全部體力；吸取翻倍條件看「使用前」體力（連鎖條件快照）`, async () => {
      const [r] = await duel(side, [noAtk(gung), h.wait()], { selfHp: 100000, stages: { atk: -2, def: -1 }, n: 1, pick: () => [0, 0] });
      stagesAll({ statStages: r.self.statStages }, 0, '能力下降已解除');
      assert.equal(r.self.currentHp, HP, '恢復全部體力');
      assert.equal(OPP - r.opp.currentHp, Math.floor(OPP / 2), '使用前體力 100000 < ½ → 吸取翻倍，不因本招先回滿而改變');
    });
    await check(`${side} 岡格尼爾：沒有能力下降→不恢復全部體力；自身低於½→吸取翻倍並恢復等量`, async () => {
      const [r] = await duel(side, [noAtk(gung), h.wait()], { selfHp: 100000, n: 1, pick: () => [0, 0] });
      assert.equal(OPP - r.opp.currentHp, Math.floor(OPP / 2), '吸取 ¼×2');
      assert.equal(r.self.currentHp, 100000 + Math.floor(OPP / 2), '恢復等量，未額外回滿');
      const [q] = await duel(side, [noAtk(gung), h.wait()], { selfHp: 300000, n: 1, pick: () => [0, 0] });
      assert.equal(OPP - q.opp.currentHp, Math.floor(OPP / 4), '不低於½ → 只吸 ¼');
      assert.equal(q.self.currentHp, 300000 + Math.floor(OPP / 4));
    });
    await check(`${side} 岡格尼爾：消除對手能力提升→100%令對手害怕；沒有提升則不害怕`, async () => {
      const [a] = await duel(side, [noAtk(gung), h.wait()], { oppStages: { atk: 2, speed: 1 }, n: 1, pick: () => [0, 0] });
      stagesAll({ statStages: a.opp.statStages }, 0, '提升被消除'); assert.ok(h.statuses(a.opp).includes('害怕'));
      const [b] = await duel(side, [noAtk(gung), h.wait()], { n: 1, pick: () => [0, 0] });
      assert.ok(!h.statuses(b.opp).includes('害怕'), '沒有可消除的提升 → 不觸發');
      const [c] = await duel(side, [noAtk(gung), h.wait()], { oppStages: { atk: -1 }, n: 1, pick: () => [0, 0] });
      assert.equal(c.opp.statStages.atk, -1, '只消除提升，不動下降'); assert.ok(!h.statuses(c.opp).includes('害怕'));
    });
    await check(`${side} 岡格尼爾：先制+3（速度較慢仍先出手）；附加效果失效時只剩攻擊本身`, async () => {
      const hist = await duel(side, [gung, h.wait()], { selfSpeed: 50, oppSkills: [strike, h.wait()], n: 1, pick: () => [0, 0] });
      const l = hist[0].logs.filter((x: string) => /使用了【/.test(x));
      assert.ok(/岡格尼爾|ᚷᚢᚾᚷᚾᛁᚱ/.test(l[0]), '自身先出手：' + l.join(' / '));
      const [s] = await duel(side, [gung, h.wait()], { selfHp: 100000, stages: { atk: -1 }, oppStages: { atk: 1 }, sealed: true, n: 1, pick: () => [0, 0] });
      assert.equal(s.self.statStages.atk, -1); assert.equal(s.opp.statStages.atk, 1);
      assert.ok(!h.statuses(s.opp).includes('害怕')); assert.equal(s.self.currentHp, 100000);
    });
  }
  // ───────── ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ（世界樹）─────────
  const ygg = h.find('5019', 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ');
  h.assertKitOnly(ygg);
  await check('世界樹 固有屬性與原文逐句對應（必中＋4 連鎖）', async () => {
    assert.deepEqual(prop(ygg), ['sure_hit=true']);
    assert.equal(ygg.kit.length, 5);
    assert.deepEqual(ygg.kit.filter((e: any) => e.codeId === 'effect_sequence').map((e: any) => e.params.clause.raw), ygg.description.split('\n').filter((l: string) => l.startsWith('🎯')));
  });
  await check('世界樹 5回合計時連鎖掛在「命中後」(on_hit／after_hit)，其餘三句仍在使用時(on_skill_use)', async () => {
    const seq = ygg.kit.filter((e: any) => e.codeId === 'effect_sequence');
    const timed = seq.filter((e: any) => JSON.stringify(e.params.clause.body).includes('"timed"'));
    assert.equal(timed.length, 1);
    assert.equal(timed[0].node, 'on_hit'); assert.equal(timed[0].params.clause.trig, 'after_hit');
    assert.deepEqual(seq.filter((e: any) => e !== timed[0]).map((e: any) => e.node), ['on_skill_use', 'on_skill_use', 'on_skill_use']);
  });
  // 對手只有 30000 最大體力：吸取 ⅓＝10000／次。對手每回合以高先制補滿體力（世界樹的禁療 2 回合內補不了），自身體力 300000/400000（不低於½、不翻倍）。
  const M = 30000, YHP = 300000, GAIN = Math.floor(M / 3);
  const refill = { ...h.healSkill(M * 10), priority: 6, name: '補滿' };
  const fear = { ...h.kitSkill('嚇', [{ op: 'status', p: { chance: 100, side: 'opp', status: '害怕' } }]), priority: 6 };
  const yduel = (side: 'p1' | 'p2', o: { n: number; selfHp?: number; oppHp?: number; sealed?: boolean; pick: (t: number) => [number, number]; oppSkills?: any[]; selfSkills?: any[]; oppExtra?: any }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? YHP, o.selfSkills ?? [{ ...ygg }, h.wait(), noAtk(strike)], { maxHp: HP, speed: 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', o.oppHp ?? M, o.oppSkills ?? [h.wait(), refill, fear], { maxHp: M, speed: 100, extra: o.oppExtra || {} }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n);
  const gains = (hist: any[], start: number) => hist.map((r: any, i: number) => r.self.currentHp - (i ? hist[i - 1].self.currentHp : start));
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 世界樹：使用當回合即算第1回合吸取；之後第2~5回合每回合使用技能都吸取並回血；第6回合起不再吸取`, async () => {
      // t1 使用世界樹；t2~t8 對手每回合先補滿，自身用等待（成功使用技能）
      const hist = await yduel(side, { n: 8, pick: t => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] });
      const g = gains(hist, YHP);
      assert.deepEqual(g, [GAIN, GAIN, GAIN, GAIN, GAIN, 0, 0, 0], g.join());
      // 吸取＝百分比吸取，自身回血 ＝ 對手實際損失
      assert.equal(hist[0].opp.currentHp, M - GAIN, '第1回合對手被吸走 ⅓');
      assert.equal(hist[0].self.statStages.atk, 2, '自身體力高於對手 → 全屬性+1 翻倍為 +2');
      const weak = await yduel(side, { n: 1, selfHp: 20000, pick: () => [0, 0] });
      assert.equal(weak[0].self.statStages.atk, 1, '自身體力不高於對手 → 只有 +1');
    });
    await check(`${side} 世界樹：被打斷（害怕 3 回合、沒出招）的回合不吸取，但回合計數照走、效果不終止；恢復行動後續吸，仍到第5回合為止`, async () => {
      // t1 使用世界樹；t2 對手高先制令自身害怕（害怕持續 t2~t4，自身無法行動）；t5 恢復行動
      const hist = await yduel(side, { n: 8, pick: t => [t === 1 ? 0 : 1, t === 2 ? 2 : 1] });
      const acted = (t: number) => hist[t].logs.slice(t ? hist[t - 1].logs.length : 0).some((l: string) => /【S】使用了/.test(l));
      assert.deepEqual([1, 2, 3, 4].map(acted), [false, false, false, true], '第2~4回合因害怕沒有出招，第5回合恢復');
      const g = gains(hist, YHP);
      assert.deepEqual(g, [GAIN, 0, 0, 0, GAIN, 0, 0, 0], g.join());
    });
    await check(`${side} 世界樹：第一次使用就被打斷（害怕、沒出招）→ 不建立計時，之後恢復行動也不吸取；改在恢復後首次成功使用才啟動`, async () => {
      // t1 對手高先制令自身害怕（t1~t3 無法行動），自身選世界樹但沒出招；t4 起可行動：先用等待（成功使用技能但沒有啟動計時）
      const hist = await yduel(side, { n: 8, pick: t => [t <= 4 ? 0 : 1, t === 1 ? 2 : 1] });
      const acted = (t: number) => hist[t].logs.slice(t ? hist[t - 1].logs.length : 0).some((l: string) => /【S】使用了/.test(l));
      assert.deepEqual([0, 1, 2].map(acted), [false, false, false], '害怕期間世界樹未使用');
      for (let t = 0; t < 3; t++) assert.deepEqual(timersOf(hist[t].state, side), [], `第${t + 1}回合沒有任何計時器`);
      const g = gains(hist, YHP);
      assert.deepEqual(g.slice(0, 3), [0, 0, 0]);
      // t4 才第一次成功使用（命中）→ 計時從 t4 起算 5 次（t4~t8），證明被打斷的第一次沒有偷偷佔用回合數
      assert.deepEqual(g.slice(3), [GAIN, GAIN, GAIN, GAIN, GAIN], g.join());
      // 對照：同樣被打斷但之後只用等待 → 全程不吸取
      const never = await yduel(side, { n: 8, pick: t => [t === 1 ? 0 : 1, t === 1 ? 2 : 1] });
      assert.deepEqual(gains(never, YHP), [0, 0, 0, 0, 0, 0, 0, 0]);
      assert.ok(never.every((r: any) => !timersOf(r.state, side).some((x: string) => /持續|吸取/.test(x))), '從未建立計時');
    });
    await check(`${side} 世界樹：本招被對手「屬性技能無效」擋下（未成功使用）→ 不建立計時，之後使用技能不吸取、不禁療、不加先制`, async () => {
      const blocker = { ...h.kitSkill('封', [{ op: 'invalid_turns', p: { turns: 1, kind: '屬性' } }]), priority: 6 };
      const hist = await yduel(side, { n: 4, oppSkills: [h.wait(), blocker], pick: t => [t === 1 ? 0 : 1, t === 1 ? 1 : 0] });
      // t1 對手高先制令自身屬性技能無效；t2 起對手改用等待、自身用等待
      assert.equal(hist[0].self.statStages.atk || 0, 0, '世界樹被無效，沒有能力提升');
      assert.deepEqual(gains(hist, YHP), [0, 0, 0, 0], '之後任何回合都不吸取');
      assert.equal(hist[0].opp.currentHp, M, '對手體力不變');
    });
    await check(`${side} 世界樹（去掉必中的對照版）：本招被閃避（未命中）→ 不建立計時，之後不吸取；命中則照常 5 次`, async () => {
      const unsure = { ...ygg, isSureHit: false, accuracy: 100, kit: ygg.kit.filter((e: any) => !(e.codeId === 'skill_property' && e.params.property === 'sure_hit')) };
      // 對手魂印「100%閃避對手所有技能」（常駐閃避）：t1 世界樹（非必中）落空；之後自身改用等待（必中，不受閃避影響）
      const miss = await yduel(side, { n: 8, selfSkills: [{ ...unsure }, h.wait(), noAtk(strike)], oppExtra: { soulMark: { name: '測試閃避', description: '🎯 100%閃避對手所有技能', effectMode: 'description' } }, pick: t => [t === 1 ? 0 : 1, 0] });
      assert.equal(miss[0].self.statStages.atk || 0, 0, '落空 → 附加效果未執行');
      assert.deepEqual(gains(miss, YHP), [0, 0, 0, 0, 0, 0, 0, 0], '落空後任何回合都不吸取');
      assert.ok(miss.every((r: any) => !timersOf(r.state, side).some((x: string) => /先制\+2|禁療/.test(x))));
      // 對照：沒有閃避 → 命中 → 原有 5 次
      const hit = await yduel(side, { n: 8, selfSkills: [{ ...unsure }, h.wait(), noAtk(strike)], pick: t => [t === 1 ? 0 : 1, t === 1 ? 0 : 1] });
      assert.deepEqual(gains(hit, YHP), [GAIN, GAIN, GAIN, GAIN, GAIN, 0, 0, 0]);
    });
    await check(`${side} 世界樹：自身後手出招（對手高先制先動）仍只吸取 5 次，不因後手補償變 6 次`, async () => {
      const hist = await yduel(side, { n: 8, pick: t => [t === 1 ? 0 : 1, 1] });
      assert.equal(hist[0].logs.findIndex((l: string) => /【E】使用了/.test(l)) < hist[0].logs.findIndex((l: string) => /【S】使用了/.test(l)), true, '對手先出手');
      assert.deepEqual(gains(hist, YHP), [GAIN, GAIN, GAIN, GAIN, GAIN, 0, 0, 0]);
    });
    await check(`${side} 世界樹：附加效果失效 → 整份連鎖不生效（無能力提升、無吸取、無禁療／先制）`, async () => {
      const hist = await yduel(side, { n: 3, sealed: true, pick: t => [t === 1 ? 0 : 1, 1] });
      assert.deepEqual(gains(hist, YHP), [0, 0, 0]);
      assert.equal(hist[0].self.statStages.atk || 0, 0);
      assert.deepEqual(timersOf(hist[0].state, side), []);
    });
    await check(`${side} 世界樹：自身體力低於½吸取翻倍（⅓×2）並回血等量；對手體力有減少時不附加 300 真實傷害`, async () => {
      const low = await yduel(side, { n: 1, selfHp: 100000, oppHp: M, pick: () => [0, 0] });
      assert.equal(M - low[0].opp.currentHp, GAIN * 2, '吸取 ⅓×2');
      assert.equal(low[0].self.currentHp - 100000, GAIN * 2, '回血＝吸取量');
      const norm = await yduel(side, { n: 1, pick: () => [0, 0] });
      assert.equal(M - norm[0].opp.currentHp, GAIN, '有減少 → 不再附加 300 真實傷害（對手只損失吸取量）');
      assert.ok(!norm[0].logs.some((l: string) => /300/.test(l)));
    });
    await check(`${side} 世界樹：2回合內對手無法恢復體力（含當回合），第3回合起可恢復；下2回合自身所有技能先制+2（第2、3回合先於高先制補滿出手，第4回合起不再）`, async () => {
      const hist = await yduel(side, { n: 4, pick: t => [t === 1 ? 0 : 1, t === 1 ? 0 : 1], oppSkills: [h.wait(), refill] });
      const hp = hist.map((r: any) => r.opp.currentHp);
      assert.equal(hp[0], M - GAIN);
      assert.equal(hp[1], M - GAIN * 2, '第2回合：對手想補滿但被禁療，只被吸取');
      assert.ok(hist[1].logs.some((l: string) => /禁療/.test(l)), '禁療日誌');
      const prioLeft = (t: number) => timersOf(hist[t].state, side).filter((x: string) => /先制\+2/.test(x)).map((x: string) => x.split(':')[1]).join();
      assert.deepEqual([0, 1, 2].map(prioLeft), ['2', '1', ''], [0, 1, 2].map(prioLeft).join('|'));
    });
    await check(`${side} 世界樹：下2回合自身所有技能先制+2（後手的自身第2回合起先出手；到期由上一項的計時器 2→1→無 驗證）`, async () => {
      const slow = h.unit('S', YHP, [{ ...ygg }, h.wait(), noAtk(strike)], { maxHp: HP, speed: 50 });
      const hist = await h.play(side, { self: slow, opp: h.unit('E', M, [h.wait(), strike], { maxHp: M, speed: 100 }), turns: (_e: any, t: number) => [t === 1 ? 0 : 1, 0] } as any, 2);
      const ord = (t: number) => hist[t].logs.slice(t ? hist[t - 1].logs.length : 0).filter((l: string) => /【(E|S)】使用了/.test(l)).map((l: string) => l.includes('【E】') ? 'E' : 'S').join('');
      assert.deepEqual([0, 1].map(ord), ['ES', 'SE']);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
