// 5031 六界神王 魂印「界」真 Kit 驗收（組1收尾；讀法B）。P1/P2 雙側正式 headless 引擎。
// 六秘法以「只留單一分支的 random_branch」逐一驗證（隨機本身交給 random_branch 通用件）；
// 下場還原、被擊敗反饋（含致死來源）、回合開始／階段結束、疊加並存各自獨立斷言。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
const ok = (m: string) => { checks++; console.log('OK ' + m); };
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const lj = DEFAULT_ELVES.find((e: any) => String(e.id) === '5031');
  const { MIGRATED_LIUJIE_SOUL_KIT } = await h.server.ssrLoadModule('/src/data/migratedLiujieSoulKit.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const { LIUJIE_SOUL_DESCRIPTION } = await h.server.ssrLoadModule('/src/data/liujie.ts');
  assert.equal(lj.soulMark.name, '界');
  assert.equal(lj.soulMark.effectMode, 'kit');
  assert.ok(!JSON.stringify(lj.soulMark.kit).includes('legacy_handler'), '不得殘留包裝');
  assert.equal(lj.soulMark.description, MIGRATED_LIUJIE_SOUL_KIT.description, 'Kit 描述與實際載入原文逐字相同');
  assert.equal(lj.soulMark.description, LIUJIE_SOUL_DESCRIPTION);
  assert.deepEqual(lj.soulMark.kit, structuredClone(MIGRATED_LIUJIE_SOUL_KIT.kit));
  for (const e of MIGRATED_LIUJIE_SOUL_KIT.kit) assert.equal(kitEntryIssue(e), null, 'kitEntryIssue: ' + e.customText);
  for (const k of ['5031', '六界神王']) assert.ok(!(k in h.S), '舊映射不得殘留：' + k);
  ok('魂印「界」是真 Kit（無包裝、無舊映射、10 條款合約全過）');

  const strike = (power = 200) => ({ ...h.wait(), name: '重擊', category: '物理', type: '普通', power, isSureHit: true });
  /** 真 5031；branch 指定時 round_end 的 random_branch 只留該分支（0..5＝地葬..時空）。 */
  const jie = (id: string, o: { hp?: number; speed?: number; skills?: any[]; branch?: number; stages?: any; maxHp?: number } = {}) => {
    const u = structuredClone(lj);
    u.id = id; u.battleId = id; u.maxHp = o.maxHp ?? 50000; u.currentHp = o.hp ?? u.maxHp;
    u.calculatedStats = { hp: u.maxHp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    u.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    u.statStages = o.stages || {}; u.shield = 0; u.barrier = 0;
    u.skills = o.skills || [h.wait(), h.wait()];
    if (o.branch !== undefined) {
      for (const en of u.soulMark.kit) for (const g of en.params?.clause?.body || []) for (const act of g.acts || [])
        if (act.op === 'random_branch') act.p.branches = [act.p.branches[o.branch], act.p.branches[o.branch]]; // random_branch 需 2 至 10 支，兩支相同＝固定該秘法
    }
    return u;
  };
  const marks = (r: any, side: string) => (r.state[side + 'Marks'] || []).map((m: any) => m.id).sort();
  const SECRETS = ['地葬', '瀚海', '混沌', '幻境', '天玄', '時空'];

  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // ① 回合開始：處於能力提升→當回合免疫異常（對手麻痺失敗）＋攻擊傷害+50%；未提升則無
    {
      const para = h.kitSkill('麻痺', [{ op: 'status', p: { side: 'opp', status: '麻痺', chance: 100, turns: 3 } }], { isSureHit: true });
      const mk = (stages: any) => ({ self: jie('S', { stages, skills: [strike(100), h.wait()] }), opp: h.unit('E', 90000, [para, h.wait()], { speed: 300 }) });
      const up = await h.play(side, { ...mk({ def: 1 }), turns: () => [0, 0] }, 1);
      const none = await h.play(side, { ...mk({}), turns: () => [0, 0] }, 1);
      assert.ok(!h.statuses(up[0].self).includes('麻痺'), side + ' 能力提升→當回合免疫異常');
      assert.ok(h.statuses(none[0].self).includes('麻痺'), side + ' 對照：未提升則吃到麻痺');
      const plain = (stages: any) => ({ self: jie('S', { stages, skills: [strike(100), h.wait()] }), opp: h.unit('E', 90000, [h.wait()], { speed: 300 }) });
      const upD = await h.play(side, { ...plain({ def: 1 }), turns: () => [0, 0] }, 1);
      const noneD = await h.play(side, { ...plain({}), turns: () => [0, 0] }, 1);
      const dmgUp = 90000 - upD[0].opp.currentHp, dmgNone = 90000 - noneD[0].opp.currentHp;
      assert.ok(dmgUp > 0 && dmgNone > 0);
      assert.ok(Math.abs(dmgUp / dmgNone - 1.5) < 0.02, `${side} 攻擊傷害 +50%（${dmgUp}/${dmgNone}）`);
      ok(side + ' 回合開始：提升→免疫異常＋傷害+50%；未提升無');
    }
    // ② 戰鬥階段結束：不處於全屬性提升→全屬性+1；已全屬性提升則不再疊
    {
      const [r1, r2] = await h.play(side, { self: jie('S'), opp: h.unit('E', 90000, [h.wait()]), turns: () => [0, 0] }, 2);
      for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy']) assert.equal(r1.self.statStages[k], 1, `${side} 階段結束全屬性+1 ${k}`);
      for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy']) assert.equal(r2.self.statStages[k], 1, `${side} 已全屬性提升不再疊 ${k}`);
      ok(side + ' 階段結束：全屬性+1；全提升時不重複');
    }
    // ③ 階段結束後下回合所有技能先制+2：第 1 回合慢速界後手，第 2 回合先於快速對手
    {
      const opp = h.unit('E', 90000, [strike(100), h.wait()], { speed: 300 });
      const hist = await h.play(side, { self: jie('S', { speed: 50, skills: [strike(100), h.wait()] }), opp, turns: () => [0, 0] }, 2);
      const first = (r: any, from = 0) => { const l = r.logs.slice(from).filter((x: string) => x.includes('使用了【重擊】')); return l.length ? (l[0].includes('六界神王') ? 'jie' : 'opp') : 'none'; };
      assert.equal(first(hist[0]), 'opp', side + ' 第1回合對手速度快先動');
      assert.equal(first(hist[1], hist[0].logs.length), 'jie', side + ' 第2回合先制+2 使界先動');
      ok(side + ' 階段結束後下回合先制+2（實際出手順序）');
    }
  }
  // ---- 以下為逐側獨立斷言 ----
  const dummyOpp = (o: any = {}) => h.unit('E', o.hp ?? 90000, o.skills || [h.wait(), h.wait(), h.wait()], { speed: o.speed ?? 100, maxHp: o.maxHp ?? 90000 });
  const hpLoss = (r: any, before: number, who: 'self' | 'opp') => before - r[who].currentHp;
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // ④ 地葬：每回合結束 +200 盾 +200 罩；可重複領悟→再次觸發疊加
    {
      const hist = await h.play(side, { self: jie('S', { branch: 0 }), opp: dummyOpp(), turns: () => [0, 0] }, 2);
      assert.equal(hist[0].self.shield, 200, side + ' 地葬：盾 200'); assert.equal(hist[0].self.barrier, 200, side + ' 地葬：罩 200');
      assert.equal(hist[1].self.shield, 400, side + ' 重複領悟再觸發：盾 400'); assert.equal(hist[1].self.barrier, 400, side + ' 罩 400');
      assert.deepEqual(marks(hist[1], side), ['地葬'], side + ' 地葬印記 maxCount 1');
      ok(side + ' 地葬秘法');
    }
    // ⑤ 瀚海：對手 -200 固傷，自身恢復等量
    {
      const [r] = await h.play(side, { self: jie('S', { branch: 1, hp: 30000 }), opp: dummyOpp(), turns: () => [0, 0] }, 1);
      assert.equal(r.opp.currentHp, 89800, side + ' 瀚海：對手固傷 200');
      assert.equal(r.self.currentHp, 30200, side + ' 瀚海：自身恢復等量 200');
      ok(side + ' 瀚海秘法');
    }
    // ⑥ 混沌：對手恰有 2 個技能 PP 歸零
    {
      const opp = dummyOpp({ skills: [1, 2, 3, 4].map(i => ({ ...h.wait(), name: '技' + i, pp: 10, maxPp: 10 })) });
      const [r] = await h.play(side, { self: jie('S', { branch: 2 }), opp, turns: () => [0, 0] }, 1);
      assert.equal(r.opp.skills.filter((x: any) => x.pp === 0).length, 2, side + ' 混沌：恰 2 技能 PP 歸零：' + JSON.stringify(r.opp.skills.map((x: any) => x.pp)));
      ok(side + ' 混沌秘法');
    }
    // ⑦ 幻境：領悟後攻擊必定致命（第2回合傷害為對照 ×2，引擎致命倍率）
    {
      const run = async (branch: number) => {
        const hist = await h.play(side, { self: jie('S', { branch, skills: [strike(100), h.wait()] }), opp: dummyOpp({ speed: 10 }), turns: () => [0, 0] }, 2);
        return { hist, dmg: hist[0].opp.currentHp - hist[1].opp.currentHp, logs: hist[1].logs };
      };
      const a = await run(3), c = await run(0);
      assert.deepEqual(marks(a.hist[1], side), ['幻境']);
      assert.ok(c.dmg > 0 && Math.abs(a.dmg / c.dmg - 2) < 0.03, `${side} 幻境：第2回合致命一擊 ×2（${a.dmg}/${c.dmg}）`);
      ok(side + ' 幻境秘法（持續生效）');
    }
    // ⑧ 天玄：領悟後免疫大於400的攻擊傷害（整筆免疫）；不大於400的照常
    {
      const big = (atk: number) => { const o = dummyOpp({ speed: 300, skills: [strike(120), h.wait()] }); o.calculatedStats.atk = atk; return o; };
      const run = async (branch: number, atk: number) => {
        const hist = await h.play(side, { self: jie('S', { branch }), opp: big(atk), turns: () => [0, 0] }, 2);
        return hist[0].self.currentHp - hist[1].self.currentHp; // 第2回合受到的攻擊傷害
      };
      const ctrlBig = await run(5, 30000), tianBig = await run(4, 30000);
      assert.ok(ctrlBig > 400, side + ' 對照確有大於400的傷害：' + ctrlBig);
      assert.equal(tianBig, 0, side + ' 天玄：大於400的攻擊傷害整筆免疫');
      const ctrlSmall = await run(5, 300), tianSmall = await run(4, 300);
      assert.ok(ctrlSmall > 0 && ctrlSmall <= 400, side + ' 對照小傷害 ' + ctrlSmall);
      assert.equal(tianSmall, ctrlSmall, side + ' 天玄：不大於400的傷害照常');
      ok(side + ' 天玄秘法（使用者已裁定：整筆免疫大於400）');
    }
    // ⑨ 時空：領悟後攻擊技能先制+1（與對手先制+3 同級時以速度決勝）
    {
      const run = async (branch: number) => {
        const opp = dummyOpp({ speed: 300, skills: [{ ...strike(100), priority: 3 }, h.wait()] });
        const hist = await h.play(side, { self: jie('S', { branch, speed: 400, skills: [strike(100), h.wait()] }), opp, turns: () => [0, 0] }, 2);
        const seg = hist[1].logs.slice(hist[0].logs.length).filter((x: string) => x.includes('使用了【重擊】'));
        return seg[0].includes('六界神王') ? 'jie' : 'opp';
      };
      assert.equal(await run(0), 'opp', side + ' 對照：先制+2 輸給對手先制+3');
      assert.equal(await run(5), 'jie', side + ' 時空：先制+1 追平，速度較快者先動');
      ok(side + ' 時空秘法（持續生效）');
    }
    // ⑩ 疊加並存＋印記不減：多回合真實隨機（固定種子），已領悟印記只增不減，且在場期間持續
    {
      const hist = await h.play(side, { self: jie('S'), opp: dummyOpp(), turns: () => [0, 0] }, 10);
      let prev: string[] = [];
      for (const r of hist) {
        const cur = marks(r, side);
        for (const m of prev) assert.ok(cur.includes(m), side + ' 已領悟的秘法保留（疊加並存）：' + m);
        for (const m of cur) assert.ok(SECRETS.includes(m));
        prev = cur;
      }
      assert.ok(prev.length >= 3, side + ' 10 回合後至少 3 種並存：' + prev.join(','));
      ok(side + ' 讀法B：秘法疊加並存（' + prev.join('、') + '）');
    }
    // ⑪ 使用攻擊技能時：把當回合受到的傷害 100% 以真實傷害反饋（對照組＝同局拿掉該條款，亂數序列相同）
    {
      const mk = (dropReflect: boolean) => {
        const self = jie('S', { speed: 50, skills: [strike(100), h.wait()] });
        if (dropReflect) self.soulMark.kit = self.soulMark.kit.filter((en: any) => !JSON.stringify(en).includes('reflect_received_damage'));
        return { self, opp: dummyOpp({ speed: 300, skills: [strike(100), h.wait()] }) };
      };
      const withR = await h.play(side, { ...mk(false), turns: () => [0, 0] }, 1);
      const noR = await h.play(side, { ...mk(true), turns: () => [0, 0] }, 1);
      const received = 50000 - withR[0].self.currentHp;
      assert.ok(received > 0);
      assert.equal(noR[0].self.currentHp, withR[0].self.currentHp, side + ' 對照局受傷相同');
      assert.equal(noR[0].opp.currentHp - withR[0].opp.currentHp, received, side + ' 真實反饋=受到的傷害');
      ok(side + ' 自身攻擊時反饋受到的傷害（真實）');
    }
    // ⑫ 下場：六印記清除＋對方使用技能紀錄清除＋體力與PP重置為登場時狀態
    {
      const bench = h.unit('B', 50000, [h.wait()]);
      const self = jie('S', { branch: 3, skills: [{ ...strike(100), pp: 20, maxPp: 20 }, h.wait()] });
      const opp = dummyOpp({ speed: 300, skills: [strike(100), h.wait()] });
      const hist = await h.play(side, { self, opp, selfBench: [bench], turns: (_e, t) => [t === 2 ? { switch: 1 } : 0, t === 2 ? 1 : 0] }, 2); // 第2回合對手改出等待，避免下場後立刻重建紀錄
      const key = side === 'p1' ? 'p1RegistryState' : 'p2RegistryState', oppKey = other + 'RegistryState';
      const mid = hist[0];
      assert.ok(mid.self.currentHp < 50000 && mid.self.skills[0].pp < 20, side + ' 第1回合後體力／PP 已變：' + mid.self.currentHp + '/' + mid.self.skills[0].pp);
      assert.ok(marks(mid, side).includes('幻境'));
      assert.ok(mid.state[oppKey]['blkUses:重擊'] > 0, side + ' 對方有使用技能紀錄');
      const post = hist[1].state;
      const leaver = (post[side + 'Team'] || []).find((e: any) => (e.battleId || e.id) === 'S');
      assert.ok(leaver, side + ' 找得到下場的界');
      assert.equal(leaver.currentHp, 50000, side + ' 下場：體力重置為登場時');
      assert.equal(leaver.skills[0].pp, 20, side + ' 下場：PP 重置為登場時');
      assert.ok(!marks(hist[1], side).includes('幻境'), side + ' 下場：秘法印記清除（現場：' + marks(hist[1], side).join(',') + '）');
      assert.ok(!post[oppKey]['blkUses:重擊'] && !post[oppKey]['blkStreak:重擊'] && post[oppKey]['blkLastSkill'] !== '重擊', side + ' 下場：對方使用技能紀錄清除（累計／連續／最後使用）');
      ok(side + ' 下場：還原體力／PP、清印記與對方使用技能紀錄');
    }
    // ⑬ 被擊敗：消除對手回合類效果＋對手能力提升反轉＋致死來源受等量（本回合所受技能傷害）真實傷害
    {
      const killer = dummyOpp({ speed: 300, hp: 90000, skills: [strike(120), h.wait()] });
      killer.calculatedStats.atk = 3000; killer.statStages = { atk: 2 };
      const self = jie('S', { hp: 600, skills: [h.turnEffectSkill(), h.wait()] });
      const bench = h.unit('B', 50000, [h.wait()]);
      const hist = await h.play(side, { self, opp: killer, selfBench: [bench], turns: () => [0, 0] }, 1);
      const r = hist[0];
      const rec = r.state[side + 'RegistryState'].receivedSkillDamageThisRound;
      assert.ok(rec && rec.amount > 0, side + ' 有技能受傷記錄');
      assert.equal(90000 - r.opp.currentHp, rec.amount, side + ` 致死來源受到等量真實傷害（${90000 - r.opp.currentHp}/${rec.amount}）`);
      assert.equal(r.opp.statStages.atk, -2, side + ' 對手能力提升反轉為等量下降：' + JSON.stringify(r.opp.statStages));
      ok(side + ' 被擊敗：反轉能力＋致死來源受等量真傷');
    }
  }

  // ⑭ 位於場下的致死來源也可命中（以 killerId 指名個體）：直接餵 op 的最小 ctx
  {
    const { OPS } = await h.server.ssrLoadModule('/src/blocks/runtime.ts');
    const calls: any[] = [];
    const self = { battleId: 'S', name: '界', currentHp: 0 };
    const benchKiller = { battleId: 'K', name: '場下來源', currentHp: 500 };
    const ctx: any = { actor: 'p1', targetSide: 'p2', roundNumber: 3, self, target: { battleId: 'A', name: '在場', currentHp: 900 },
      getPlayerState: (k: string) => k === 'receivedSkillDamageThisRound' ? { round: 3, ownerBattleId: 'S', amount: 321 } : null,
      getFullTeam: () => [{ battleId: 'A', name: '在場', currentHp: 900 }, benchKiller],
      applyDamageToElf: (side: string, id: string, amt: number, type: string) => { calls.push({ side, id, amt, type }); return amt; }, addLog: () => {} };
    const st: any = { last: null, lastAmount: 0, event: { trig: 'defeated', data: { killerSide: 'p2', killerId: 'K', node: 1 } } };
    assert.equal(OPS.reflect_defeat_true(ctx, { ratio: 1 }, st), true);
    assert.deepEqual(calls, [{ side: 'p2', id: 'K', amt: 321, type: 'true' }], '來源在場下：指名個體命中');
    calls.length = 0;
    ctx.getPlayerState = (k: string) => k === 'receivedSkillDamageThisRound' ? { round: 2, ownerBattleId: 'S', amount: 321 } : null;
    assert.equal(OPS.reflect_defeat_true(ctx, { ratio: 1 }, st), false, '非本回合記錄不反饋');
    assert.equal(calls.length, 0);
    ok('場下致死來源可被指名命中；過期記錄不反饋');
  }
  console.log(`5031 jie: ${checks} checks passed`);
} finally { await h.close(); }
