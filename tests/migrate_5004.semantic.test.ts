// 5004 皮特薩拉羅：翎封禁之羽、翎羽風暴、千翎破陣 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 翎萬羽歸宗（使用者決定 2026-10-12）：第2、3句的「對手是否處於異常」即時判斷，第1句剛令對手疲憊也算進去。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
try {
  const feather = h.find('5004', '翎封禁之羽'), storm = h.find('5004', '翎羽風暴'), breaker = h.find('5004', '千翎破陣');
  for (const s of [feather, storm, breaker]) h.assertKitOnly(s);
  const wan = h.find('5004', '翎萬羽歸宗'); h.assertKitOnly(wan);
  const prop = (s: any) => s.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`);
  await check('固有屬性與原文逐句對應', async () => {
    assert.deepEqual(prop(feather), ['base_priority=3', 'sure_hit=true']);
    assert.deepEqual(prop(storm), ['sure_hit=true']);
    assert.deepEqual(prop(breaker), ['base_priority=1', 'sure_hit=true']);
    assert.equal(feather.description, '■ 先制+3\n■ 必中\n🎯 消除對手能力提升狀態，消除成功則對手全屬性-1\n🎯 消除對手回合類效果，消除成功則令對手麻痺');
    assert.equal(storm.kit.length, 5); assert.equal(breaker.kit.length, 4);
  });
  // turns: 第1回合 self 等待、opp 用 setup(0) 取得回合類效果；第2回合 self 出招
  const duel = (side: 'p1' | 'p2', skill: any, o: { boosts?: boolean; turnEffect?: boolean; sealed?: boolean; abnormal?: string; oppSkills?: any[]; n?: number }) => h.play(side, {
    self: h.unit('S', 20000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', 20000, o.oppSkills ?? [h.turnEffectSkill(), h.wait()], { speed: 100, statStages: o.boosts ? { atk: 2 } : {}, extra: o.abnormal ? { battleStatuses: { [o.abnormal]: 9 }, effects: [{ id: o.abnormal, name: o.abnormal, duration: 9, isLateMover: false, stacks: 1 }] } : {} }),
    turns: (_e: any, t: number) => t === 1 ? [1, o.turnEffect ? 0 : 1] : t === 2 ? [0, 1] : [1, 1],
  } as any, o.n ?? 2);
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 翎封禁之羽：兩句消除都成功 → 全屬性-1＋麻痺，回合類效果被清除`, async () => {
      const hist = await duel(side, feather, { boosts: true, turnEffect: true });
      assert.ok(h.timers(hist[0].state, side === 'p1' ? 'p2' : 'p1').some((t: string) => t.startsWith('免疫非附屬類異常')), '前置：對手有回合類效果');
      const r = hist[1];
      for (const k of STAGES) assert.equal(r.opp.statStages[k] || 0, -1, `全屬性-1：${k}（原本+2的攻擊先被消除）`);
      assert.ok(h.statuses(r.opp).includes('麻痺'));
      assert.ok(!h.timers(r.state, side === 'p1' ? 'p2' : 'p1').some((t: string) => t.startsWith('免疫')), '回合類效果已清除');
      assert.ok(r.opp.currentHp < 20000, '技能傷害');
    });
    await check(`${side} 翎封禁之羽：各自失敗不觸發各自的成功分支`, async () => {
      const none = (await duel(side, feather, {}))[1];
      for (const k of STAGES) assert.equal(none.opp.statStages[k] || 0, 0);
      assert.ok(!h.statuses(none.opp).includes('麻痺'));
      const onlyBoost = (await duel(side, feather, { boosts: true }))[1];
      for (const k of STAGES) assert.equal(onlyBoost.opp.statStages[k] || 0, -1);
      assert.ok(!h.statuses(onlyBoost.opp).includes('麻痺'), '沒有回合類效果可消除 → 不麻痺');
      const onlyTurn = (await duel(side, feather, { turnEffect: true }))[1];
      for (const k of STAGES) assert.equal(onlyTurn.opp.statStages[k] || 0, 0, '沒有提升可消除 → 不降屬性');
      assert.ok(h.statuses(onlyTurn.opp).includes('麻痺'));
    });
    await check(`${side} 翎封禁之羽：附加效果被封印 → 只有傷害`, async () => {
      const r = (await duel(side, feather, { boosts: true, turnEffect: true, sealed: true }))[1];
      assert.equal(r.opp.statStages.atk, 2); assert.ok(!h.statuses(r.opp).includes('麻痺'));
      assert.ok(h.timers(r.state, side === 'p1' ? 'p2' : 'p1').some((t: string) => t.startsWith('免疫非附屬類異常')));
      assert.ok(r.opp.currentHp < 20000);
    });
    await check(`${side} 千翎破陣：威力×2僅在對手異常時；清除成功才讓對手攻擊技能無效2回合（到期）`, async () => {
      const base = (await duel(side, breaker, { turnEffect: true }));
      const abn = (await duel(side, breaker, { turnEffect: true, abnormal: '疲憊' }));
      const d0 = base[0].opp.currentHp - base[1].opp.currentHp, d1 = abn[0].opp.currentHp - abn[1].opp.currentHp;
      assert.ok(d0 > 0 && d1 / d0 > 1.7 && d1 / d0 < 2.3, `異常時傷害約2倍：${d0} → ${d1}`);
      const opp = side === 'p1' ? 'p2' : 'p1';
      assert.ok(h.timers(base[1].state, opp).some((t: string) => t.startsWith('攻擊技能無效')), JSON.stringify(h.timers(base[1].state, opp)));
      // 沒有回合類效果可清 → 不施加無效
      const none = (await duel(side, breaker, {}))[1];
      assert.ok(!h.timers(none.state, opp).some((t: string) => t.startsWith('攻擊技能無效')));
      const exp = await duel(side, breaker, { turnEffect: true, n: 4 });
      assert.ok(!h.timers(exp[3].state, opp).some((t: string) => t.includes('攻擊技能無效')), '2回合後到期');
      const sealed = (await duel(side, breaker, { turnEffect: true, abnormal: '疲憊', sealed: true }));
      const ds = sealed[0].opp.currentHp - sealed[1].opp.currentHp;
      assert.ok(Math.abs(ds - d0) / d0 < 0.15, '封印附加後威力不加倍');
    });

    await check(`${side} 翎羽風暴：4回合免疫反彈異常（期間被反彈、到期）／屬性無效2回合到期／免疫下1次攻擊（用完即失效）／100%害怕`, async () => {
      const opp = side === 'p1' ? 'p2' : 'p1';
      const attack = { ...h.wait(), name: '打', category: '物理', power: 100 };
      const burn = { ...h.wait(), name: '點火', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, customText: '測試',
        params: { clause: { raw: '測試', marker: '🎯', trig: 'use', parsed: true, body: [{ acts: [{ op: 'status', p: { chance: 100, side: 'opp', status: '燒傷' }, label: 'x' }] }] } } }] };
      // 對手：第1回合立盾（取得回合類效果）；第2～4回合害怕無法行動；第5回合點火（免疫反彈仍在）；之後出攻擊
      const hist = await h.play(side, {
        self: h.unit('S', 20000, [{ ...storm }, h.wait()], { maxHp: 20000, speed: 200 }),
        opp: h.unit('E', 20000, [h.turnEffectSkill(), attack, burn, h.wait()], { speed: 100 }),
        turns: (_e: any, t: number) => [t === 2 ? 0 : 1, t === 1 ? 0 : t === 5 ? 2 : 1],
      } as any, 7);
      const use = hist[1];
      assert.ok(h.statuses(use.opp).includes('害怕'), '100%害怕');
      assert.ok(h.timers(use.state, side).some((t: string) => t.startsWith('免疫並反彈非附屬類異常:3')), h.timers(use.state, side).join());
      assert.ok(h.timers(use.state, opp).some((t: string) => t.startsWith('屬性技能無效:1')), '清除成功 → 屬性技能無效');
      assert.ok(!h.timers(use.state, opp).some((t: string) => t.startsWith('免疫非附屬類異常')), '對手回合類效果被清除');
      assert.equal(use.state[`${side}RegistryState`].blockAttackCount, 1);
      assert.ok(h.timers(hist[2].state, side).some((t: string) => t.startsWith('免疫並反彈非附屬類異常:2')));
      assert.ok(!h.timers(hist[2].state, opp).some((t: string) => t.startsWith('屬性技能無效')), '屬性技能無效2回合後到期');
      assert.ok(h.statuses(hist[4].opp).includes('燒傷') && !h.statuses(hist[4].self).includes('燒傷'), '對手附加的燒傷被反彈給自己');
      assert.ok(h.timers(hist[3].state, side).some((t: string) => t.startsWith('免疫並反彈非附屬類異常:1')));
      assert.ok(!h.timers(hist[4].state, side).some((t: string) => t.startsWith('免疫並反彈')), '4回合後免疫到期');
      const hp = hist.map((r: any) => r.self.currentHp);
      assert.equal(hp[5], 20000, '對手第一次攻擊被免疫：' + hp.join());
      assert.ok(hp[6] < 20000, '免疫次數用完後正常受傷：' + hp.join());
      assert.ok(!hist[5].state[`${side}RegistryState`].blockAttackCount, '免疫次數歸零');
    });
    await check(`${side} 翎羽風暴：對手無回合類效果時不施加屬性技能無效；附加被封印時全部不生效`, async () => {
      const opp = side === 'p1' ? 'p2' : 'p1';
      const run = (sealed: boolean) => h.play(side, {
        self: h.unit('S', 20000, [{ ...storm }, h.wait()], { maxHp: 20000, speed: 200, extra: sealed ? { isAdditionalInvalid: true } : {} }),
        opp: h.unit('E', 20000, [h.wait()], { speed: 100 }), turns: () => [0, 0],
      } as any, 1);
      const [r] = await run(false);
      assert.ok(h.statuses(r.opp).includes('害怕'));
      assert.ok(!h.timers(r.state, opp).some((t: string) => t.startsWith('屬性技能無效')));
      assert.equal(r.state[`${side}RegistryState`].blockAttackCount, 1);
      const [q] = await run(true);
      assert.ok(!h.statuses(q.opp).includes('害怕')); assert.deepEqual(h.timers(q.state, side), []);
      assert.ok(!q.state[`${side}RegistryState`]?.blockAttackCount);
    });
  }
  // ── 翎萬羽歸宗：第1句消除成功 → 疲憊；第2、3句「處於異常」即時判斷（含剛施加的疲憊）
  const wanRun = (side: 'p1' | 'p2', o: { turnEffect?: boolean; abnormal?: string; sealed?: boolean; n?: number }) => h.play(side, {
    self: h.unit('S', 100000, [{ ...wan }, h.wait()], { maxHp: 200000, speed: 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', 90000, [h.turnEffectSkill(), h.wait()], { maxHp: 90000, speed: 100, extra: o.abnormal ? { battleStatuses: { [o.abnormal]: 9 }, effects: [{ id: o.abnormal, name: o.abnormal, duration: 9, isLateMover: false, stacks: 1 }] } : {} }),
    turns: (_e: any, t: number) => t === 1 ? [1, o.turnEffect ? 0 : 1] : [0, 1],
  } as any, o.n ?? 2);
  await check('翎萬羽歸宗 原文保護與 Kit 對應（2 固有 + 3 附加，後兩句為即時判斷）', async () => {
    assert.equal(wan.description, '■ 必中\n■ 先制+1\n🎯 消除對手回合類效果，消除成功則令對手疲憊\n🎯 對手處於異常狀態時造成傷害提升100%並恢復等量體力\n🎯 對手不處於異常狀態時附加對手最大體力1/3百分比傷害');
    assert.deepEqual(prop(wan), ['sure_hit=true', 'base_priority=1']);
    const seq = wan.kit.filter((e: any) => e.codeId === 'effect_sequence').map((e: any) => e.params.clause);
    assert.equal(seq.length, 3);
    assert.deepEqual(seq[0].body.map((b: any) => b.chain ?? b.acts[0].op), ['clear_turn', 'success']);
    assert.equal(seq[1].body[0].live, true); assert.equal(seq[2].body[0].live, true);
    assert.deepEqual(seq[1].body[0].acts.map((a: any) => a.op), ['boost', 'heal_equal']);
    assert.equal(seq[2].body[0].acts[0].p.ratio, 1 / 3);
  });
  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 翎萬羽歸宗：無異常但清除成功 → 疲憊算進異常：傷害×2並恢復等量，不附加1/3百分比`, async () => {
      const opp = side === 'p1' ? 'p2' : 'p1';
      const base = await wanRun(side, {});                               // 無異常、無可清除：第3句百分比
      const cleared = await wanRun(side, { turnEffect: true });          // 無異常、清除成功：疲憊後視為異常
      const preAbn = await wanRun(side, { abnormal: '麻痺' });            // 原本就異常、無可清除
      const dBase = base[0].opp.currentHp - base[1].opp.currentHp - Math.floor(90000 / 3);
      const dClear = cleared[0].opp.currentHp - cleared[1].opp.currentHp, dPre = preAbn[0].opp.currentHp - preAbn[1].opp.currentHp;
      assert.ok(dBase > 0, '基礎技能傷害：' + dBase);
      assert.ok(!h.statuses(base[1].opp).includes('疲憊'), '沒有可清除 → 不疲憊');
      assert.equal(base[1].self.currentHp, 100000, '不處於異常 → 不恢復體力');
      assert.ok(h.statuses(cleared[1].opp).includes('疲憊'), '清除成功 → 疲憊');
      assert.ok(!h.timers(cleared[1].state, opp).some((t: string) => t.startsWith('免疫非附屬類異常')), '回合類效果已清除');
      assert.ok(dClear / dBase > 1.7 && dClear / dBase < 2.3 && dClear < dBase + 30000, `即時判斷：傷害約2倍而非加1/3：${dBase} → ${dClear}`);
      assert.equal(cleared[1].self.currentHp - 100000, dClear, '恢復等量體力');
      assert.equal(dPre, dClear, '原本異常與剛施加疲憊同樣視為異常');
      assert.equal(preAbn[1].self.currentHp - 100000, dPre);
    });
    await check(`${side} 翎萬羽歸宗：對手原本異常且有回合類效果 → 清除成功再疲憊（疊加異常），仍走增傷＋等量恢復`, async () => {
      const r = (await wanRun(side, { turnEffect: true, abnormal: '中毒' }))[1];
      assert.ok(h.statuses(r.opp).includes('疲憊'), h.statuses(r.opp).join());
      assert.ok(r.self.currentHp > 100000, '增傷＋等量恢復');
    });
    await check(`${side} 翎萬羽歸宗：附加效果被封印 → 只有技能傷害（無清除／疲憊／增傷／恢復／百分比）`, async () => {
      const base = await wanRun(side, {});
      const dBase = base[0].opp.currentHp - base[1].opp.currentHp - Math.floor(90000 / 3);
      const r = await wanRun(side, { turnEffect: true, sealed: true });
      const d = r[0].opp.currentHp - r[1].opp.currentHp;
      assert.equal(d, dBase, '只剩技能傷害'); assert.ok(!h.statuses(r[1].opp).includes('疲憊'));
      assert.equal(r[1].self.currentHp, 100000);
      assert.ok(h.timers(r[1].state, side === 'p1' ? 'p2' : 'p1').some((t: string) => t.startsWith('免疫非附屬類異常')), '回合類效果未被清除');
    });
    await check(`${side} 翎萬羽歸宗：固有 必中＋先制+1 不受封印附加影響；先制+1 先於同速對手`, async () => {
      const r = await h.play(side, { self: h.unit('S', 100000, [{ ...wan }, h.wait()], { maxHp: 200000, speed: 50, extra: { isAdditionalInvalid: true } }),
        opp: h.unit('E', 90000, [{ ...h.wait(), name: '慢招' }], { maxHp: 90000, speed: 300 }), turns: () => [0, 0] } as any, 1);
      const logs = r[0].logs.filter((l: string) => l.includes('使用了'));
      assert.ok(logs[0].includes('翎萬羽歸宗'), '先制+1：速度慢也先出手 ' + logs.join('|'));
      assert.ok(r[0].opp.currentHp < 90000, '必中且造成傷害');
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
