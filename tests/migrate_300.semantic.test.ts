// 300 譜尼／5000 聖靈譜尼：極光、神聖之光、永恆 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥，兩個 ID 皆驗）。
// 旋滅裂空陣（使用當回合算第1次）、落芳天華（天敵＝能克制自身當前屬性）、神靈之觸（每次使用累計、下場重置）：使用者 2026-10-12 決定後轉換。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
try {
  for (const id of ['300', '5000']) for (const n of ['旋滅裂空陣', '落芳天華']) h.assertKitOnly(h.find(id, n));
  h.assertKitOnly(h.find('5000', '神靈之觸'));
  for (const id of ['300', '5000']) {
    const aurora = h.find(id, '極光'), holy = h.find(id, '神聖之光'), eternal = h.find(id, '永恆');
    for (const s of [aurora, holy, eternal]) h.assertKitOnly(s);
    await check(`${id} 原文保護與 Kit 對應`, async () => {
      assert.equal(aurora.description, '（無特殊效果）'); assert.equal(holy.description, '■ 必中\n（無特殊效果）'); assert.equal(eternal.description, '■ 必中\n🎯 回復自身所有PP值');
      assert.deepEqual(holy.kit.map((e: any) => e.codeId + ':' + (e.params.property || e.params.clause.body[0].acts[0].op)), ['skill_property:sure_hit', 'effect_sequence:noop']);
      assert.deepEqual(eternal.kit.map((e: any) => e.codeId + ':' + (e.params.property || e.params.clause.body[0].acts[0].op)), ['skill_property:sure_hit', 'effect_sequence:pp_op']);
      assert.deepEqual(eternal.kit[1].params.clause.body[0].acts[0].p, { side: 'self', mode: 'recover' });
    });
    for (const side of ['p1', 'p2'] as const) {
      await check(`${id} ${side} 極光／神聖之光：只造成技能傷害，無附帶效果`, async () => {
        for (const skill of [aurora, holy]) {
          const hist = await h.play(side, { self: h.unit('S', 8000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, statStages: { atk: -1 } }),
            opp: h.unit('E', 20000, [h.wait()], { maxHp: 20000, speed: 100 }), turns: () => [0, 0] } as any, 2);
          for (const r of hist) {
            assert.equal(r.self.currentHp, 8000); assert.equal(r.self.statStages.atk, -1); assert.deepEqual(r.opp.statStages, {});
            assert.deepEqual(h.statuses(r.opp), []); assert.ok(!r.logs.some((l: string) => l.includes('效果待接通')));
          }
          assert.ok(hist[0].opp.currentHp < 20000 && hist[1].opp.currentHp < hist[0].opp.currentHp, skill.name + ' 有傷害');
        }
      });
      await check(`${id} ${side} 永恆：恢復自身所有技能 PP（含自身），不影響對手；附加被封印時不恢復；傷害無（威力0）`, async () => {
        const low = (n: string, pp: number) => ({ ...h.wait(), name: n, pp, maxPp: 20 });
        const run = (sealed: boolean) => h.play(side, { self: h.unit('S', 8000, [{ ...eternal, pp: 2, maxPp: 5 }, low('低PP甲', 3), low('低PP乙', 0)], { maxHp: 20000, speed: 200, extra: sealed ? { isAdditionalInvalid: true } : {} }),
          opp: h.unit('E', 20000, [low('對手技', 1)], { maxHp: 20000, speed: 100 }), turns: () => [0, 0] } as any, 1).then(r => r[0]);
        const ok = await run(false);
        const pp = Object.fromEntries(ok.self.skills.map((s: any) => [s.name, s.pp]));
        assert.equal(pp['低PP甲'], 20); assert.equal(pp['低PP乙'], 20); assert.equal(pp[eternal.name], 5, '含自身的所有技能補滿');
        assert.equal(ok.opp.skills[0].pp >= 0 && ok.opp.skills[0].pp <= 1, true, '對手 PP 不被恢復');
        assert.equal(ok.self.currentHp, 8000);
        const sealed = await run(true);
        const sp = Object.fromEntries(sealed.self.skills.map((s: any) => [s.name, s.pp]));
        assert.equal(sp['低PP甲'], 3); assert.equal(sp['低PP乙'], 0);
      });
    }
  }
  // ───────── 旋滅裂空陣／落芳天華（300、5000）與神靈之觸（5000）─────────
  const FULL = 1e9;
  /** 對手 E 的受傷收據（傷害類型／請求量）。 */
  const spy = (opp: any) => { const got: any[] = []; h.S[opp.name] = (_c: any, ev: string, d: any) => { if (ev === 'ON_DAMAGED' && d?.receipt) got.push(d.receipt); return false; }; return got; };
  /** 以 power:0 的複製隔離「附加效果」傷害。picks[t] 為第 t 回合自身出招索引（0＝測試技能）；oppPicks 同理。 */
  const run = (side: 'p1' | 'p2', skill: any, o: { n: number; use?: (t: number) => number | { switch: number }; oppType?: string; selfType?: string; oppStages?: any; sealed?: boolean; oppHp?: number; bench?: boolean; refill?: boolean; before?: (e: any, t: number) => void; oppSkills?: any[]; oppPick?: (t: number) => number }) => {
    const opp = h.unit('E', o.oppHp ?? FULL, o.oppSkills ?? [h.wait()], { maxHp: o.oppHp ?? FULL, speed: 100, type: o.oppType, statStages: o.oppStages });
    const got = spy(opp);
    return h.play(side, { self: h.unit('S', FULL, [{ ...skill, power: 0 }, h.wait()], { maxHp: FULL, speed: 200, type: o.selfType, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
      opp, selfBench: o.bench ? [h.unit('B', FULL, [h.wait(), h.wait()], { maxHp: FULL, speed: 150 })] : undefined,
      turns: (e: any, t: number) => { o.before?.(e, t); if (o.refill) e.dispatch({ type: 'UPDATE_ELF', side: side === 'p1' ? 'p2' : 'p1', elf: { currentHp: o.oppHp ?? FULL } }); return [o.use ? o.use(t) : (t === 1 ? 0 : 1), o.oppPick ? o.oppPick(t) : 0]; } } as any, o.n).then(hist => ({ hist, got, loss: hist.map((r: any) => (o.oppHp ?? FULL) - r.opp.currentHp) }));
  };
  const diffs = (loss: number[]) => loss.map((v, i) => v - (loss[i - 1] ?? 0));
  for (const id of ['300', '5000']) for (const side of ['p1', 'p2'] as const) {
    const xuan = h.find(id, '旋滅裂空陣'), luo = h.find(id, '落芳天華');
    await check(`${id} 旋滅裂空陣／落芳天華 原文保護與 Kit 對應`, async () => {
      assert.equal(xuan.description, '🎯 5回合每回合使用技能則附加30點固定傷害');
      assert.equal(xuan.kit.length, 1);
      const t = xuan.kit[0].params.clause.body[0].acts[0];
      assert.equal(xuan.kit[0].node, 'on_hit', '首次成功命中才啟動');
      assert.deepEqual([t.op, t.p.turns, t.p.from, t.p.trig], ['timed', 5, 'now', 'self_after_use']);
      assert.deepEqual(t.p.body[0].acts[0].p, { flat: 30, type: '固定', both: false });
      assert.equal(luo.description, '■ 先制+3\n🎯 吸取對手能力提升狀態\n🎯 附加對手100點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍');
      assert.deepEqual(luo.kit.map((e: any) => e.codeId + ':' + (e.params.property || e.params.clause.body[0].acts[0].op)), ['skill_property:base_priority', 'effect_sequence:stat_steal', 'effect_sequence:dmg']);
      assert.equal(luo.kit[0].params.value, 3);
      const d = luo.kit[2].params.clause.body[0].acts[0].p;
      assert.deepEqual([d.flat, d.type, d.rampInc, d.rampCap, d.rampStreak, d.x2If.c], [100, '固定', 100, 400, false, 'enemy']);
    });
    await check(`${id} ${side} 旋滅裂空陣：使用當回合算第1次，共5次固定30；之後不再附加；固定傷害類型`, async () => {
      const r = await run(side, xuan, { n: 8 });
      assert.deepEqual(diffs(r.loss), [30, 30, 30, 30, 30, 0, 0, 0], r.loss.join());
      assert.ok(r.got.length === 5 && r.got.every((x: any) => x.damageType === 'fixed' && x.requestedAmount === 30), JSON.stringify(r.got.map((x: any) => [x.damageType, x.requestedAmount])));
    });
    await check(`${id} ${side} 旋滅裂空陣：自身後手出招（對手高先制先動）仍只附加 5 次（後手不補償成 6 次）`, async () => {
      const r = await run(side, xuan, { n: 8, oppSkills: [{ ...h.wait(), priority: 6 }] });
      assert.deepEqual(diffs(r.loss), [30, 30, 30, 30, 30, 0, 0, 0], r.loss.join());
    });
    await check(`${id} ${side} 旋滅裂空陣：每回合使用任一技能都附加（含屬性技能）；回合中再次使用只刷新、不疊加`, async () => {
      const r = await run(side, xuan, { n: 8, use: t => (t === 1 || t === 3 ? 0 : 1) });
      // t1 使用(5回合: t1~t5)；t3 再用 → 刷新為 t3~t7；每回合只 30
      assert.deepEqual(diffs(r.loss), [30, 30, 30, 30, 30, 30, 30, 0], r.loss.join());
    });
    await check(`${id} ${side} 旋滅裂空陣：附加效果被封印 → 不附加；下場後效果消失（舊程式亦為回合類，下場即清）`, async () => {
      const sealed = await run(side, xuan, { n: 3, sealed: true });
      assert.deepEqual(sealed.loss, [0, 0, 0]);
      // t1 使用；t2 換下（備戰上場）；t3 換回；之後不再附加
      const sw = await run(side, xuan, { n: 6, bench: true, use: t => (t === 1 ? 0 : t === 2 ? { switch: 1 } : t === 3 ? { switch: 0 } : 1) });
      assert.deepEqual(diffs(sw.loss), [30, 0, 0, 0, 0, 0], sw.loss.join());
    });

    await check(`${id} ${side} 落芳天華：每次使用累計100→400封頂（不需連續），固定傷害；吸取對手能力提升`, async () => {
      const r = await run(side, luo, { n: 6, use: t => (t === 2 || t === 4 ? 1 : 0), oppStages: { atk: 2, spdef: 1 } });
      assert.deepEqual(diffs(r.loss).filter(v => v > 0), [100, 200, 300, 400], r.loss.join());
      assert.ok(r.got.every((x: any) => x.damageType === 'fixed'));
      const first = r.hist[0];
      assert.equal(first.self.statStages.atk, 2); assert.equal(first.self.statStages.spdef, 1);
      assert.equal(first.opp.statStages.atk || 0, 0); assert.equal(first.opp.statStages.spdef || 0, 0);
      // 專測第6次封頂；原技能只有5PP，不可把「PP耗盡」誤判為倍率失效。
      const cap = await run(side, { ...luo, pp: 6, currentPp: 6, maxPp: 6 }, { n: 6, use: () => 0 });
      assert.deepEqual(diffs(cap.loss), [100, 200, 300, 400, 400, 400]);
    });
    await check(`${id} ${side} 落芳天華：天敵＝能克制自身當前屬性（相剋表），翻倍；非天敵不翻倍；不再寫死混沌／神秘／邪靈`, async () => {
      const dmg = async (selfType: string, oppType: string) => diffs((await run(side, luo, { n: 2, use: () => 0, selfType, oppType })).loss);
      assert.deepEqual(await dmg('聖靈', '戰鬥'), [200, 400], '戰鬥克聖靈 → 翻倍');
      assert.deepEqual(await dmg('聖靈', '神秘'), [200, 400]);
      assert.deepEqual(await dmg('草', '火'), [200, 400], '火克草 → 翻倍（舊程式不認）');
      assert.deepEqual(await dmg('聖靈', '混沌'), [100, 200], '混沌不克聖靈 → 不翻倍（舊程式誤翻）');
      assert.deepEqual(await dmg('火', '神秘'), [100, 200], '神秘不克火 → 不翻倍（舊程式誤翻）');
      assert.deepEqual(await dmg('草', '邪靈'), [100, 200]);
      assert.deepEqual(await dmg('聖靈', '普通'), [100, 200]);
      assert.deepEqual(await dmg('聖靈', '聖靈'), [100, 200]);
    });
    await check(`${id} ${side} 落芳天華：自身屬性被改變時天敵判定跟著變（以當前屬性計算）`, async () => {
      // t1 聖靈 vs 戰鬥（第1次100，天敵×2=200）；t2 自身屬性改為戰鬥（戰鬥不克戰鬥，第2次200 不翻倍）；t3 改回聖靈（第3次300，天敵×2=600）
      const r = await run(side, luo, { n: 3, use: () => 0, selfType: '聖靈', oppType: '戰鬥', before: (e, t) => { if (t === 2) e.dispatch({ type: 'UPDATE_ELF', side, elf: { type: '戰鬥' } }); if (t === 3) e.dispatch({ type: 'UPDATE_ELF', side, elf: { type: '聖靈' } }); } });
      assert.deepEqual(diffs(r.loss), [200, 200, 600], r.loss.join());
    });
    await check(`${id} ${side} 落芳天華：附加被封印 → 不吸取／不附加／不計次；先制+3 固有仍在；解封後從100起算`, async () => {
      const r = await run(side, luo, { n: 3, use: () => 0, oppStages: { atk: 2 }, before: (e, t) => e.dispatch({ type: 'UPDATE_ELF', side, elf: { isAdditionalInvalid: t === 1 } }) });
      assert.deepEqual(diffs(r.loss), [0, 100, 200], r.loss.join());
      assert.equal(r.hist[0].self.statStages.atk || 0, 0); assert.equal(r.hist[0].opp.statStages.atk, 2, '封印時不吸取');
      assert.equal(r.hist[1].self.statStages.atk, 2);
      const fast = await h.play(side, { self: h.unit('S', FULL, [{ ...luo, power: 0 }, h.wait()], { maxHp: FULL, speed: 10, extra: { isAdditionalInvalid: true } }),
        opp: h.unit('E', FULL, [h.wait()], { maxHp: FULL, speed: 300 }), turns: () => [0, 0] } as any, 1);
      assert.ok(fast[0].logs.filter((l: string) => l.includes('使用了'))[0].includes('落芳天華'), '先制+3 先出手');
    });
  }
  // 5000 神靈之觸
  for (const side of ['p1', 'p2'] as const) {
    const touch = h.find('5000', '神靈之觸');
    await check(`5000 神靈之觸 原文保護與 Kit 對應`, async () => {
      assert.equal(touch.description, '■ 先制+3\n🎯 消除對手能力提升狀態，消除成功則對手下1次攻擊技能無效\n🎯 附加對手最大體力值15%的百分比傷害，每次使用增加10%，最高45%');
      assert.deepEqual(touch.kit.map((e: any) => e.codeId + ':' + (e.params.property || e.params.clause.body[0].acts[0].op)), ['skill_property:base_priority', 'effect_sequence:stat_clear', 'effect_sequence:dmg']);
      const d = touch.kit[2].params.clause.body[0].acts[0].p;
      assert.deepEqual([d.ratio, d.rampInc, d.rampCap, d.rampStreak, d.rampReset, d.type, d.base, d.of], [0.15, 10, 45, false, 'switch', '百分比', '最大體力', 'opp']);
    });
    await check(`5000 ${side} 神靈之觸：每次使用累計15%→45%封頂（不需連續使用），百分比傷害`, async () => {
      const HP = 1000000;
      const consecutive = await run(side, touch, { n: 6, use: () => 0, oppHp: HP, refill: true });
      assert.deepEqual(consecutive.loss, [150000, 250000, 350000, 450000, 450000, 450000]);
      assert.ok(consecutive.got.every((x: any) => x.damageType === 'percent'), JSON.stringify(consecutive.got.map((x: any) => x.damageType)));
      const gap = await run(side, touch, { n: 5, use: t => (t === 2 || t === 4 ? 1 : 0), oppHp: HP, refill: true });
      assert.deepEqual(gap.loss.filter(v => v > 0), [150000, 250000, 350000], '中間夾別招仍累計');
    });
    await check(`5000 ${side} 神靈之觸：下場後累計重置（回場從15%起算）`, async () => {
      const HP = 1000000;
      // t1、t2 使用(15%、25%)；t3 換下；t4 換回；t5 再使用 → 15%
      const r = await run(side, touch, { n: 5, bench: true, oppHp: HP, refill: true, use: t => (t <= 2 ? 0 : t === 3 ? { switch: 1 } : t === 4 ? { switch: 0 } : 0) });
      assert.deepEqual(r.loss, [150000, 250000, 0, 0, 150000], r.loss.join());
    });
    await check(`5000 ${side} 神靈之觸：消除成功 → 對手下1次攻擊技能無效（僅1次）；沒有可消除 → 不無效；附加被封印 → 全不生效`, async () => {
      const hit = { ...h.wait(), name: '反擊', category: '物理', power: 100, isSureHit: true };
      const go = (stages: any, sealed = false) => h.play(side, { self: h.unit('S', 1e6, [{ ...touch, power: 0 }, h.wait()], { maxHp: 1e6, speed: 200, extra: sealed ? { isAdditionalInvalid: true } : {} }),
        opp: h.unit('E', 1e6, [hit, h.wait()], { maxHp: 1e6, speed: 100, statStages: stages }), turns: (_e: any, t: number) => [t === 1 ? 0 : 1, 0] } as any, 3);
      const ok = await go({ atk: 2 });
      assert.equal(ok[0].self.currentHp, 1e6, '第1次攻擊被無效'); assert.equal(ok[0].opp.statStages.atk || 0, 0, '能力提升被消除');
      assert.ok(ok[1].self.currentHp < 1e6, '第2次攻擊正常'); assert.ok(ok[2].self.currentHp < ok[1].self.currentHp);
      const none = await go({});
      assert.ok(none[0].self.currentHp < 1e6, '沒有提升可消除 → 攻擊不無效');
      const sealed = await go({ atk: 2 }, true);
      assert.equal(sealed[0].opp.statStages.atk, 2); assert.ok(sealed[0].self.currentHp < 1e6);
      assert.equal(sealed[0].opp.currentHp, 1e6, '封印時沒有百分比傷害');
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
