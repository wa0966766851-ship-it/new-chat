// 5003 天蓬元帥八戒：天河衝擊、萬鈞鎮魂、混元護體、淨·天河倒懸 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 殘軀鎖命（使用者決定 2026-10-12：恢復量的50%轉化為戰鬥系「技能傷害」）已轉為 Kit；魂印（per_statdown_bonus、PP 上限）未轉，見交接單 §4。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
const stagesAll = (e: any, v: number, label: string) => { for (const k of STAGES) assert.equal(e.statStages[k] || 0, v, `${label}:${k}`); };
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const hasTimer = (state: any, side: string, prefix: string) => h.timers(state, side).some((t: string) => t.startsWith(prefix));
try {
  const river = h.find('5003', '天河衝擊'), soul = h.find('5003', '萬鈞鎮魂'), shield = h.find('5003', '混元護體'), flip = h.find('5003', '淨·天河倒懸');
  for (const s of [river, soul, shield, flip]) h.assertKitOnly(s);
  const prop = (s: any) => s.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`);
  await check('固有屬性與原文逐句對應', async () => {
    assert.deepEqual(prop(river), ['base_priority=3', 'sure_hit=true']);
    assert.deepEqual(prop(soul), ['sure_hit=true']);
    assert.deepEqual(prop(shield), ['sure_hit=true']);
    assert.deepEqual(prop(flip), ['sure_hit=true', 'base_priority=1']);
    assert.deepEqual(shield.kit.map((e: any) => e.node), ['before_skill', 'on_skill_use', 'on_hit', 'on_skill_use', 'on_skill_use'], '命中後100%害怕 → 命中後節點');
  });
  // 第1回合：self 等待、opp 立盾（取得回合類效果）或補血；第2回合起 self 出招 (turns[1])
  const duel = (side: 'p1' | 'p2', skill: any, o: { boosts?: boolean; turnEffect?: boolean; sealed?: boolean; selfHp?: number; oppHp?: number; n?: number; oppSkills?: any[]; pick?: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? 20000, [{ ...skill }, h.wait()], { maxHp: 20000, speed: 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', o.oppHp ?? 20000, o.oppSkills ?? [h.turnEffectSkill(), h.healSkill(), h.wait()], { maxHp: 20000, speed: 100, statStages: o.boosts ? { atk: 2 } : {} }),
    turns: (_e: any, t: number) => o.pick ? o.pick(t) : t === 1 ? [1, o.turnEffect ? 0 : 2] : t === 2 ? [0, 2] : [1, 2],
  } as any, o.n ?? 2);
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 天河衝擊：消除提升→全屬性-1；消除回合類→對手2回合內無法恢復體力（到期後可恢復）`, async () => {
      const hist = await duel(side, river, { boosts: true, turnEffect: true, oppHp: 10000, n: 5, pick: t => t === 1 ? [1, 0] : t === 2 ? [0, 1] : [1, 1] });
      stagesAll(hist[1].opp, -1, '全屬性-1');
      assert.ok(!hasTimer(hist[1].state, opp, '免疫'), '回合類效果已清除');
      const hp = hist.map((r: any) => r.opp.currentHp);
      assert.ok(hp[1] < hp[0], '第2回合受傷（技能傷害）');
      assert.equal(hp[2], hp[1], '第3回合（2回合內）無法恢復：' + hp.join());
      assert.equal(hp[3], hp[2] + 1000, '到期後第4回合可恢復：' + hp.join());
    });
    await check(`${side} 天河衝擊：兩句各自失敗／附加被封印`, async () => {
      const none = (await duel(side, river, {}))[1];
      stagesAll(none.opp, 0, '無提升'); assert.ok(!hasTimer(none.state, opp, '禁療'), JSON.stringify(h.timers(none.state, opp)));
      const onlyBoost = (await duel(side, river, { boosts: true }))[1];
      stagesAll(onlyBoost.opp, -1, '只有提升');
      const sealed = (await duel(side, river, { boosts: true, turnEffect: true, sealed: true }))[1];
      assert.equal(sealed.opp.statStages.atk, 2); assert.ok(hasTimer(sealed.state, opp, '免疫'));
      assert.ok(sealed.opp.currentHp < 20000);
    });
    await check(`${side} 萬鈞鎮魂：吸血只算技能傷害的40%；對手體力高於自身才附加最大體力1/4固定傷害；未擊敗全屬性-1`, async () => {
      const mk = (selfHp: number, oppHp: number, sealed = false) => duel(side, soul, { selfHp, oppHp, sealed, pick: t => [0, 2], n: 1 });
      const ctl = (await mk(8000, 8000))[0], hi = (await mk(8000, 20000))[0], sealed = (await mk(8000, 20000, true))[0];
      const d = 8000 - ctl.opp.currentHp;
      assert.ok(d > 0 && d < 8000, '技能傷害 ' + d);
      assert.equal(ctl.self.currentHp - 8000, Math.floor(d * 0.4), '等體力：不附加固定傷害；吸血40%');
      stagesAll(ctl.opp, -1, '未擊敗 → 全屬性-1');
      assert.equal(20000 - hi.opp.currentHp, d + 5000, '對手較高 → 追加最大體力1/4=5000固定傷害');
      assert.equal(hi.self.currentHp - 8000, Math.floor(d * 0.4), '吸血不含固定傷害');
      const low = (await mk(8000, 5000))[0];
      assert.equal(5000 - low.opp.currentHp >= 0 && 5000 - low.opp.currentHp <= d, true, '對手較低 → 無固定傷害');
      assert.equal(sealed.opp.currentHp, 20000 - d, '封印附加：只有技能傷害'); assert.equal(sealed.self.currentHp, 8000); stagesAll(sealed.opp, 0, '封印');
    });
    await check(`${side} 萬鈞鎮魂：擊敗對手時不降屬性（未擊敗才降）`, async () => {
      const [r] = await h.play(side, { self: h.unit('S', 20000, [{ ...soul }, h.wait()], { maxHp: 20000, speed: 200 }),
        opp: h.unit('E', 1, [h.wait()], { maxHp: 20000, speed: 100 }), turns: () => [0, 0] } as any, 1);
      const team = r.state[`${opp}Team`];
      assert.equal(team[0].currentHp, 0); stagesAll(team[0], 0, '已擊敗：未套用未擊敗效果');
    });
    const guardRun = (speed: number, oppSpeed: number, n: number) => {
      const attack = { ...h.wait(), name: '重擊', category: '物理', power: 300 };
      const selfAtk = { ...h.wait(), name: '還擊', category: '物理', power: 40 };
      // 第1回合 opp 立盾（免疫害怕以便觀察其餘效果）；第2回合 self 混元護體；之後 self 還擊、opp 重擊
      return h.play(side, { self: h.unit('S', 20000, [{ ...shield }, selfAtk, h.wait()], { maxHp: 20000, speed }),
        opp: h.unit('E', 20000, [h.turnEffectSkill(), attack, h.wait()], { maxHp: 20000, speed: oppSpeed }),
        turns: (_e: any, t: number) => t === 1 ? [2, 0] : t === 2 ? [0, 2] : [1, 1] } as any, n);
    };
    await check(`${side} 混元護體（先手）：4回合免疫反彈非附屬類異常、3回合受傷上限280，各自到期`, async () => {
      const hist = await guardRun(200, 100, 6);
      const use = hist[1];
      assert.ok(hasTimer(use.state, side, '免疫並反彈非附屬類異常:3'), h.timers(use.state, side).join());
      assert.ok(hasTimer(use.state, side, '受傷上限280:2'), h.timers(use.state, side).join());
      assert.ok(!hasTimer(hist[4].state, side, '免疫並反彈'), '4回合後免疫到期（第5回合結束）');
      assert.ok(hasTimer(hist[3].state, side, '免疫並反彈非附屬類異常:1'));
      const dmg = hist.map((r: any, i: number) => (i ? hist[i - 1].self.currentHp : 20000) - r.self.currentHp);
      assert.ok(dmg[2] > 0 && dmg[2] <= 280 && dmg[3] > 0 && dmg[3] <= 280, '上限期間（第3、4回合）：' + dmg.join());
      assert.ok(dmg[4] > 280, '3回合後不再受限：' + dmg.join());
    });
    await check(`${side} 混元護體（後手）：下2回合攻擊技能先制+2（第3、4回合先出手，第5回合起恢復）`, async () => {
      const hist = await guardRun(50, 300, 6);
      const order = hist.map((r: any, i: number) => r.logs.slice(i ? hist[i - 1].logs.length : 0).filter((l: string) => /使用了【(還擊|重擊)】/.test(l)).map((l: string) => l.includes('還擊') ? 'S' : 'E').join(''));
      assert.deepEqual([order[2], order[3], order[4], order[5]], ['SE', 'SE', 'ES', 'ES'], order.join());
    });
    await check(`${side} 混元護體：命中後令對手害怕（100%）；附加被封印時全部不生效`, async () => {
      const [r] = await h.play(side, { self: h.unit('S', 20000, [{ ...shield }, h.wait()], { maxHp: 20000, speed: 200 }), opp: h.unit('E', 20000, [h.wait()], { maxHp: 20000, speed: 100 }), turns: () => [0, 0] } as any, 1);
      assert.ok(h.statuses(r.opp).includes('害怕')); assert.ok(hasTimer(r.state, side, '免疫並反彈'));
      const [q] = await h.play(side, { self: h.unit('S', 20000, [{ ...shield }, h.wait()], { maxHp: 20000, speed: 200, extra: { isAdditionalInvalid: true } }), opp: h.unit('E', 20000, [h.wait()], { maxHp: 20000, speed: 100 }), turns: () => [0, 0] } as any, 1);
      assert.ok(!h.statuses(q.opp).includes('害怕')); assert.deepEqual(h.timers(q.state, side), []);
    });
    await check(`${side} 淨·天河倒懸：清除成功→3回合禁療＋屬性技能無效（到期）；自身體力低於對手→傷害×2並恢復等量體力`, async () => {
      const hist = await duel(side, flip, { turnEffect: true, n: 5, selfHp: 8000, oppHp: 10000, pick: t => t === 1 ? [1, 0] : t === 2 ? [0, 1] : [1, 1] });
      assert.ok(hasTimer(hist[1].state, opp, '禁療') || hasTimer(hist[1].state, opp, '屬性技能無效'), JSON.stringify(h.timers(hist[1].state, opp)));
      assert.ok(hasTimer(hist[1].state, opp, '屬性技能無效:2'), '屬性技能無效 3回合');
      assert.ok(!hasTimer(hist[3].state, opp, '屬性技能無效'), '3回合後屬性技能無效到期');
      const hp = hist.map((r: any) => r.opp.currentHp);
      assert.equal(hp[2], hp[1], '3回合內無法恢復：' + hp.join()); assert.equal(hp[3], hp[2], hp.join());
      assert.equal(hp[4], hp[3] + 1000, '第5回合可恢復：' + hp.join());
    });
    await check(`${side} 淨·天河倒懸：低於對手才增傷＋吸等量；體力相等／較高不觸發；封印附加時無效果`, async () => {
      const lo = (await duel(side, flip, { selfHp: 8000, pick: () => [0, 2], n: 1 }))[0];
      const eq = (await duel(side, flip, { selfHp: 20000, pick: () => [0, 2], n: 1 }))[0];
      const dLo = 20000 - lo.opp.currentHp, dEq = 20000 - eq.opp.currentHp;
      assert.ok(dEq > 0 && dLo / dEq > 1.8 && dLo / dEq < 2.2, `傷害約2倍 ${dEq} → ${dLo}`);
      assert.equal(lo.self.currentHp - 8000, dLo, '恢復等量體力（等於實際傷害）');
      assert.equal(eq.self.currentHp, 20000, '相等 → 不增傷、不吸血');
      const sealed = (await duel(side, flip, { selfHp: 8000, sealed: true, pick: () => [0, 2], n: 1 }))[0];
      assert.equal(sealed.self.currentHp, 8000); assert.ok(Math.abs((20000 - sealed.opp.currentHp) - dEq) / dEq < 0.1);
    });
  }

  // ───────── 殘軀鎖命 ─────────
  const lock = h.find('5003', '殘軀鎖命');
  h.assertKitOnly(lock);
  const HP = 90000, OPP = 100000;
  const lockRun = (side: 'p1' | 'p2', o: { selfHp?: number; sealed?: boolean; oppType?: string; oppSkills?: any[]; selfSkills?: any[]; stages?: any; n: number; pick: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? 3000, o.selfSkills ?? [{ ...lock }, h.wait()], { maxHp: HP, speed: 200, statStages: o.stages || {}, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', OPP, o.oppSkills ?? [h.wait(), h.wait()], { maxHp: OPP, speed: 100, type: o.oppType }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n);
  await check('殘軀鎖命：固有屬性與六句連鎖逐句對應（Kit 單一路徑）', async () => {
    assert.deepEqual(prop(lock), ['sure_hit=true', 'base_priority=2']);
    const seqs = lock.kit.filter((e: any) => e.codeId === 'effect_sequence').map((e: any) => e.params.clause.body[0].acts.map((a: any) => a.op).join('+'));
    assert.deepEqual(seqs, ['stat', 'dmg_cap_turns', 'timed', 'dmg_mod_turns']);
    const timed = lock.kit[4].params.clause.body[0].acts[0].p;
    assert.deepEqual(timed.body[0].acts.map((a: any) => `${a.op}:${a.p.type ?? a.p.side}`), ['heal:self', 'dmg_from_last:技能']);
    assert.equal(timed.body[0].acts[1].p.elem, '戰鬥'); assert.equal(timed.body[0].acts[1].p.ratio, 0.5);
  });
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 殘軀鎖命：4回合每回合恢復最大體力1/3，恢復量50%＝戰鬥系技能傷害；第5回合到期不再恢復也無傷害`, async () => {
      const hist = await lockRun(side, { n: 5, pick: t => [t === 1 ? 0 : 1, 0] });
      assert.deepEqual(hist.map((r: any) => r.self.currentHp), [33000, 63000, 90000, 90000, 90000], '第3回合只實際恢復27000（體力上限）');
      assert.deepEqual(hist.map((r: any) => r.opp.currentHp), [85000, 70000, 56500, 56500, 56500], '傷害＝實際恢復量×50%：15000、15000、13500、0、0');
      const timedRecovery = (state: any) => state[`${side}Timers`].find((t: any) => t.id.startsWith(`blk_${side}_殘軀鎖命_持續效果_self_skill|program=`)&&t.payload.block.body[0].acts[0].op==='heal');
      assert.equal(timedRecovery(hist[2].state)?.remaining, 1, h.timers(hist[2].state, side).join());
      assert.equal(timedRecovery(hist[3].state), undefined, '第4回合結束後到期；驗證穩定ID而非舊佔位名稱');
      assert.ok(hasTimer(hist[1].state, side, '受傷上限200:2'));
    });
    await check(`${side} 殘軀鎖命：傷害為戰鬥系技能傷害（吃屬性相剋，對超能系減半）`, async () => {
      const norm = (await lockRun(side, { n: 1, pick: () => [0, 0] }))[0], psy = (await lockRun(side, { n: 1, oppType: '超能', pick: () => [0, 0] }))[0];
      assert.equal(OPP - norm.opp.currentHp, 15000); assert.equal(OPP - psy.opp.currentHp, 7500);
    });
    await check(`${side} 殘軀鎖命：體力已滿時恢復量為0 → 沒有轉化傷害（其餘效果照常）`, async () => {
      const hist = await lockRun(side, { selfHp: HP, n: 3, pick: t => [t === 1 ? 0 : 1, 0] });
      assert.deepEqual(hist.map((r: any) => r.opp.currentHp), [OPP, OPP, OPP]);
      assert.deepEqual(hist.map((r: any) => r.self.currentHp), [HP, HP, HP]);
      stagesAll(hist[0].self, 1, '全屬性+1');
    });
    await check(`${side} 殘軀鎖命：無法恢復體力期間恢復量為0 → 傷害跟著為0；禁療結束後恢復並轉化`, async () => {
      const nh = h.kitSkill('封', [{ op: 'no_heal', p: { turns: 3 } }]);
      // 第1回合對手令自身3回合無法恢復；第2回合起自身使用殘軀鎖命
      const hist = await lockRun(side, { n: 6, oppSkills: [h.wait(), nh], pick: t => [t === 2 ? 0 : 1, t === 1 ? 1 : 0] });
      assert.deepEqual(hist.map((r: any) => r.self.currentHp), [3000, 3000, 3000, 33000, 63000, 63000]);
      assert.deepEqual(hist.map((r: any) => r.opp.currentHp), [OPP, OPP, OPP, 85000, 70000, 70000], '禁療的回合不轉化；之後的回合各 15000；第6回合已到期');
    });
    await check(`${side} 殘軀鎖命：附加被封印 → 全屬性、傷害上限、每回合恢復＋轉化傷害、對手易傷全部不生效`, async () => {
      const hist = await lockRun(side, { n: 3, sealed: true, pick: t => [t === 1 ? 0 : 1, 0] });
      assert.deepEqual(hist.map((r: any) => r.self.currentHp), [3000, 3000, 3000]);
      assert.deepEqual(hist.map((r: any) => r.opp.currentHp), [OPP, OPP, OPP]);
      stagesAll(hist[0].self, 0, '封印');
      assert.deepEqual(h.timers(hist[0].state, side), []); assert.deepEqual(h.timers(hist[0].state, opp), []);
    });
    await check(`${side} 殘軀鎖命：全屬性+1，自身處於能力提升狀態時強化效果翻倍（+2）`, async () => {
      const plain = (await lockRun(side, { selfHp: HP, n: 1, pick: () => [0, 0] }))[0], boosted = (await lockRun(side, { selfHp: HP, n: 1, stages: { atk: 1 }, pick: () => [0, 0] }))[0];
      stagesAll(plain.self, 1, '無提升 +1');
      assert.equal(boosted.self.statStages.atk, 3); for (const k of STAGES.filter(k => k !== 'atk')) assert.equal(boosted.self.statStages[k], 2, k);
    });
    await check(`${side} 殘軀鎖命：4回合內受到單次攻擊傷害不超過200點，第5回合起不再受限`, async () => {
      const big = { ...h.wait(), name: '重擊', category: '物理', power: 300 };
      const hist = await lockRun(side, { selfHp: HP, n: 6, oppSkills: [h.wait(), big], pick: t => [t === 1 ? 0 : 1, 1] });
      // 回合結束的恢復會把體力補回，故讀取引擎記錄的「本回合受到的傷害」
      const dmg = hist.map((r: any) => r.state[`${side}LastDamage`]);
      assert.deepEqual(dmg.slice(0, 4), [200, 200, 200, 200], dmg.join());
      assert.ok(dmg[4] > 200 && dmg[5] > 200, dmg.join());
    });
    await check(`${side} 殘軀鎖命：下2回合（不含本回合）對手受到攻擊傷害提升100%，第4回合起恢復`, async () => {
      const strike = { ...h.wait(), name: '還擊', category: '物理', power: 100 };
      const ctl = h.kitSkill('強化', [{ op: 'stat', p: { chance: 100, side: 'self', stats: ['全屬性'], v: 1 } }]);
      const run = (first: any) => lockRun(side, { selfHp: HP, n: 5, selfSkills: [first, strike], pick: t => [t === 1 ? 0 : 1, 0] });
      const a = await run({ ...lock }), b = await run(ctl);
      const d = (hist: any[]) => hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : OPP) - r.opp.currentHp);
      const da = d(a), db = d(b);
      assert.equal(da[0], 0); assert.equal(db[0], 0);
      for (const t of [1, 2]) assert.ok(Math.abs(da[t] - db[t] * 2) <= 2, `第${t + 1}回合 ×2：${da[t]} vs ${db[t]}`);
      for (const t of [3, 4]) assert.equal(da[t], db[t], `第${t + 1}回合不再提升`);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
