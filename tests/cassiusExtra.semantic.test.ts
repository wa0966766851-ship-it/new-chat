// 額外精靈通用事件入口＋炫彩山神（B 組，DSH 2026-10-31）。真實引擎 P1/P2，不弱化斷言。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const KIND = 'x_shancaishen';
try {
  const { createBattleEngine } = await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { createExtraElf, EXTRA_ELF_KINDS, EXTRA_ELF_ID_PATTERN, extraKindOf } = await h.server.ssrLoadModule('/src/utils/extraElf.ts');
  const { getBattleSkillRegistry } = await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { sequenceIssue } = await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  const { SHANCAISHEN_SELF_KIT } = await h.server.ssrLoadModule('/src/data/migratedShancaishenKit.ts');
  const R = getBattleSkillRegistry();
  const cas = DEFAULT_ELVES.find((e: any) => String(e.id) === '5041');

  type Opt = { stats?: Partial<Record<'atk' | 'def' | 'spatk' | 'spdef' | 'speed', number>>; noSummon?: boolean; noInvalid?: boolean; summon?: any; phaseEnd?: any };
  /** 真實 5041；o.phaseEnd 取代「護盾消失」子句（A 組合約版），o.summon 改寫召喚參數。 */
  const mkCas = (id: string, hp: number, o: Opt = {}) => {
    const b = structuredClone(cas); b.id = id; b.battleId = id; b.maxHp = hp; b.currentHp = hp;
    b.calculatedStats = { hp, atk: 400, def: 300, spatk: 200, spdef: 300, speed: 300, ...o.stats };
    b.statStages = {}; b.shield = 0; b.barrier = 0;
    b.skills.forEach((s: any) => { s.pp = s.maxPp = 99; }); b.skills.push(h.wait());
    // 屬性技能的「使用後無效對手下次攻擊技能」會在對手身上留下計時；需要乾淨的對手計時時移除（只在隔離死亡效果的測試使用）。
    if (o.noInvalid) b.soulMark.kit = b.soulMark.kit.filter((e: any) => !/使用技能後無效對手下次攻擊技能/.test(e.customText));
    if (o.noSummon) b.soulMark.kit = b.soulMark.kit.filter((e: any) => !/召喚額外精靈/.test(e.customText));
    for (const entry of b.soulMark.kit) {
      if (o.summon && /召喚額外精靈/.test(entry.customText)) for (const act of entry.params.clause.body[0].acts) if (act.op === 'summon_extra_elf') Object.assign(act.p, o.summon);
      if (o.phaseEnd !== undefined && /護盾每次消失/.test(entry.customText)) entry.params.clause.body = o.phaseEnd;
    }
    return b;
  };
  const WAIT = 5; // mkCas 的最後一個技能槽
  // 「護盾每次消失」子句的主體（A 組 shield_lost_watch 包 B 組 kill_owned_extra）；reset=false 為對照版（不清回合數）。
  const killClause = (reset: boolean) => [{ acts: [{ op: 'shield_lost_watch', label: 'shield_lost_watch', p: { scope: 'self', once: false, body: [
    { acts: [{ op: 'kill_owned_extra', p: { id: KIND, ownerShield: 'gone', ...(reset ? { resetOwnerRounds: true } : {}) }, label: 'kill_owned_extra' }] }] } }] }];

  async function run(p1: any[], p2: any[], turns: ((engine: any, t: number) => [any, any])[], seed = 11) {
    (globalThis as any).__BATTLE_SEED__ = seed;
    const engine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].id, p2StarterId: p2[0].id, battleMode: 'PVP', preparedTeams: true, isFast: () => true });
    engine.mount(); engine.start();
    const out: any[] = []; let seen = 0;
    for (let t = 0; t < turns.length; t++) {
      await engine.idle();
      const st = engine.getState();
      const pick = turns[t](engine, t + 1);
      for (const [side, a] of [['p1', pick[0]], ['p2', pick[1]]] as const) {
        if (a == null) continue;
        if (a === 'wait') engine.onSkillSelect(side, h.wait()); // 全部技能PP為0時的合法行動
        else if (typeof a === 'object') engine.onSwitchElf(side, a.switch); else engine.onSkillSelect(side, st[side].skills[a]);
      }
      await engine.idle();
      const s = engine.getState();
      const logs = s.logs.map((l: any) => String(l.text ?? l.message ?? ''));
      out.push({ t: t + 1, state: s, p1: s.p1, p2: s.p2, team1: s.p1Team, team2: s.p2Team, logs: logs.slice(seen) }); seen = logs.length;
    }
    engine.unmount();
    return out;
  }
  const extrasOf = (team: any[]) => team.filter((e: any) => e.isExtra);
  const shan = (team: any[]) => team.find((e: any) => e.isExtra && e.id === KIND);
  const casOf = (team: any[]) => team.find((e: any) => !e.isExtra && e.name === '岳峙淵渟.卡修斯');
  const waits = (n: number, enemy: any = 0): ((e: any, t: number) => [any, any])[] => Array.from({ length: n }, () => () => [WAIT, enemy] as [any, any]);

  await check('id 標準：字母開頭、不佔數字序號；登錄表全部合規；createExtraElf 尊重明確 id 並寫入 extraKind', async () => {
    for (const [name, kind] of Object.entries(EXTRA_ELF_KINDS)) { assert.match(kind as string, EXTRA_ELF_ID_PATTERN, name); assert.match(kind as string, /^x_/, name); }
    assert.equal(EXTRA_ELF_KINDS['炫彩山神'], KIND);
    const base = h.unit('B', 1000, [h.wait()]);
    const fixed = createExtraElf(base, { name: '炫彩山神', id: KIND, type: '普通' });
    assert.equal(fixed.id, KIND); assert.equal(fixed.battleId, KIND); assert.equal(fixed.extraKind, KIND); assert.equal(fixed.isExtra, true);
    const legacy = createExtraElf(base, { name: '克塔亞特', type: '水' });
    assert.match(legacy.id, EXTRA_ELF_ID_PATTERN, '既有額外精靈的實例 id 純字母開頭'); assert.ok(legacy.id.startsWith('x_cthyaat_')); assert.notEqual(legacy.id, 'x_cthyaat');
    assert.equal(legacy.extraKind, 'x_cthyaat'); assert.equal(extraKindOf(legacy), 'x_cthyaat');
    const numeric = createExtraElf(base, { name: '測試', id: '5041', type: '普通' });
    assert.notEqual(numeric.id, '5041', '數字 id 不被採用');
  });

  await check('合約：山神 Kit 與新 op／條件通過 sequenceIssue；entered_not_owner 只能用在 ally_entered；kill_owned_extra 要字母 id', async () => {
    for (const entry of SHANCAISHEN_SELF_KIT) assert.equal(sequenceIssue(entry.params.clause, entry.node), null, entry.customText);
    const wrap = (trig: string, node: string, body: any[]) => sequenceIssue({ raw: 'x', trig, parsed: true, body }, node);
    assert.equal(wrap('fatal', 'self_fatal', [{ acts: [{ op: 'kill_owned_extra', p: { id: KIND, ownerShield: 'gone', resetOwnerRounds: true } }] }]), null);
    assert.ok(wrap('fatal', 'self_fatal', [{ acts: [{ op: 'kill_owned_extra', p: { id: '5041' } }] }]));
    assert.ok(wrap('fatal', 'self_fatal', [{ cond: [{ c: 'entered_not_owner', p: {} }], acts: [{ op: 'extra_die', p: {} }] }]), '條件只限隊友登場事件');
    assert.ok(wrap('ally_entered', 'ally_entered', [{ acts: [{ op: 'extra_die', p: { x: 1 } }] }]), '多餘參數被擋');
  });

  await check('召喚時機：回合開始在場回合數≤1 才召喚，一次；實例 id 為字母、isExtra、summonerId 指向卡修斯；真實 Kit 不在護盾仍在時誤殺', async () => {
    const out = await run([mkCas('5041', 4000)], [h.unit('敵', 90000, [h.wait()], { speed: 10 })], waits(4));
    for (const r of out) {
      const ex = extrasOf(r.team1);
      assert.equal(ex.length, 1, `T${r.t} 只有一隻額外精靈`);
      assert.equal(ex[0].id, KIND); assert.equal(ex[0].extraKind, KIND); assert.equal(ex[0].name, '炫彩山神'); assert.equal(ex[0].type, '普通');
      assert.equal(ex[0].summonerId, '5041');
      assert.equal(ex[0].isVanished ?? false, false, `T${r.t} 護盾仍在，山神不得被誤殺`);
      assert.ok(ex[0].currentHp > 0);
      assert.ok(casOf(r.team1).shield > 0, `T${r.t} 卡修斯仍有護盾`);
    }
    assert.equal(out.flatMap(r => r.logs).filter(l => l.includes('召喚額外精靈：炫彩山神')).length, 1, '整場只召喚一次');
    assert.equal(extrasOf(out[0].team2).length, 0, '對手方沒有額外精靈');
  });

  await check('能力值＝敵我雙方卡修斯逐項取最高（each；不是整隊加總、不含非卡修斯友軍；背包也計入）', async () => {
    // 我方 {hp4000 atk400 def300 spatk200 spdef300 speed300}；對手 {hp6000 atk900 def300 spatk200 spdef300 speed100}。
    const mine = mkCas('5041', 4000, { stats: { atk: 400, speed: 300 } });
    const ally = h.unit('友', 9000, [h.wait()]); ally.calculatedStats = { hp: 9000, atk: 9999, def: 9999, spatk: 9999, spdef: 9999, speed: 9999 };
    const enemy = mkCas('敵卡', 6000, { stats: { atk: 900, def: 300, spatk: 200, spdef: 300, speed: 100 }, noSummon: true });
    const out = await run([mine, ally], [enemy], waits(1, WAIT));
    const sh = shan(out[0].team1);
    assert.deepEqual({ ...sh.calculatedStats }, { hp: 6000, atk: 900, def: 300, spatk: 200, spdef: 300, speed: 300 }, 'hp/atk 取對手、speed 取我方，其餘同值');
    assert.equal(sh.maxHp, 6000); assert.equal(sh.currentHp, 6000);
    // 兩隻卡修斯各有不同項目最高（總和相同也不影響）：逐項合成，結果不等於任何一隻。
    const a = mkCas('5041', 5000, { stats: { atk: 800, def: 200, spatk: 900, spdef: 100, speed: 700 } });
    const b = mkCas('後備卡', 9000, { stats: { atk: 300, def: 600, spatk: 400, spdef: 1000, speed: 500 }, noSummon: true });
    const c = mkCas('敵卡', 7000, { stats: { atk: 100, def: 100, spatk: 100, spdef: 100, speed: 1200 }, noSummon: true });
    const out2 = await run([a, b], [c], waits(1, WAIT));
    const got = { ...shan(out2[0].team1).calculatedStats };
    assert.deepEqual(got, { hp: 9000, atk: 800, def: 600, spatk: 900, spdef: 1000, speed: 1200 }, '六項各取三隻卡修斯的最高值');
    assert.equal(shan(out2[0].team1).maxHp, 9000);
    // P2 側：對稱（山神加入己方 P2）。
    const out3 = await run([mkCas('敵卡', 7000, { stats: { atk: 100, def: 100, spatk: 100, spdef: 100, speed: 1200 }, noSummon: true })], [a], waits(1, WAIT));
    assert.equal(shan(out3[0].team1), undefined, '只有召喚者那一方得到山神');
  });

  await check('statMode:total 對照解讀：整隻照抄總和最高者', async () => {
    const mine = mkCas('5041', 4000, { stats: { atk: 400, speed: 300 }, summon: { statMode: 'total' } });
    const enemy = mkCas('敵卡', 6000, { stats: { atk: 900, def: 300, spatk: 200, spdef: 300, speed: 100 }, noSummon: true });
    const out = await run([mine], [enemy], waits(1, WAIT));
    assert.deepEqual({ ...shan(out[0].team1).calculatedStats }, { hp: 6000, atk: 900, def: 300, spatk: 200, spdef: 300, speed: 100 });
  });

  await check('卡修斯召喚子句真實使用 statMode:each', async () => {
    const clause = cas.soulMark.kit.find((e: any) => /召喚額外精靈/.test(e.customText)).params.clause.body[0].acts.find((x: any) => x.op === 'summon_extra_elf');
    assert.equal(clause.p.statMode, 'each');
  });

  await check('被加入時三效果：解除自身異常、為卡修斯附加最大體力½護盾、3回合山神守護；只執行一次（隊友出戰不重複）', async () => {
    const out = await run([mkCas('5041', 4000), h.unit('友', 3000, [h.wait()])], [h.unit('敵', 90000, [h.wait()], { speed: 10 })], waits(1));
    const c = casOf(out[0].team1);
    assert.equal(c.shield, 2000, '最大體力4000的½');
    assert.ok(h.statuses(c).includes('山神守護'));
    assert.equal(Object.keys(shan(out[0].team1).battleStatuses || {}).length, 0);
    assert.equal(out[0].logs.filter(l => l.includes('陷入了【山神守護】')).length, 1, '山神守護只附加一次（不再有卡修斯內聯重複）');
    // 山神守護 3 回合：T1 加入，T3 內到期（時間由狀態機決定，這裡只鎖「不是永久、不是1回合」）
    const out3 = await run([mkCas('5041', 4000)], [h.unit('敵', 90000, [h.wait()], { speed: 10 })], waits(4));
    const has = out3.map(r => h.statuses(casOf(r.team1)).includes('山神守護'));
    assert.deepEqual(has.slice(0, 2), [true, true]); assert.equal(has[3], false);
  });

  await check('通用入口：任意額外精靈的 on_entered 於加入時執行一次、extra_cure_self 解除自身異常、ally_entered 不重複觸發 on_entered、self_fatal 只觸發一次', async () => {
    const { createExtraElf: mkExtra } = { createExtraElf };
    const clause = (trig: string, node: string, raw: string, acts: any[], cond?: any[], order = 0) => ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
      params: { clause: { raw, trig, parsed: true, body: [{ ...(cond ? { cond } : {}), acts: acts.map(a => ({ label: a.op, ...a })) }] } } });
    const kit = [
      clause('entrance', 'on_entered', '測試額外被加入', [{ op: 'extra_cure_self', p: {} }, { op: 'extra_owner_shield', p: { ratio: 0.25 } }], undefined, 0),
      clause('ally_entered', 'ally_entered', '測試額外隊友登場', [{ op: 'extra_die', p: {} }], [{ c: 'entered_not_owner', p: {} }], 1),
      clause('fatal', 'self_fatal', '測試額外死亡', [{ op: 'pp_zero', p: {} }], undefined, 2),
    ];
    R['召喚測試額外'] = (c: any) => c.addExtraElf(c.actor, mkExtra(c.self, { name: '測試額外', id: 'x_test_dummy', type: '普通', battleStatuses: { 麻痺: 2 }, kit } as any));
    const owner = h.unit('主', 5000, [{ ...h.wait(), name: '召喚測試額外' }, h.wait()], { speed: 200 });
    const ally = h.unit('友', 3000, [h.wait()]);
    const enemy = h.unit('敵', 90000, [h.wait()], { speed: 10 });
    const out = await run([owner, ally], [enemy], [() => [0, 0], () => [1, 0], () => [{ switch: 1 }, 0], () => [0, 0]]);
    const dummy = (r: any) => r.team1.find((e: any) => e.id === 'x_test_dummy');
    assert.ok(dummy(out[0]), '加入'); assert.equal(Object.keys(dummy(out[0]).battleStatuses || {}).length, 0, 'on_entered 解除自身麻痺');
    assert.equal(out[0].team1.find((e: any) => e.id === '主').shield, 1250, 'extra_owner_shield：召喚者最大體力5000的25%');
    assert.equal(dummy(out[1]).isVanished ?? false, false, '主動作與回合開始不會誤觸 on_entered 之外的節點，未登場前存活');
    assert.equal(out[2].p1.name, '友');
    assert.equal(dummy(out[2]).isVanished, true, '友登場→ally_entered 條件成立→自身死亡');
    assert.ok(out[2].p2.skills.every((s: any) => s.pp === 0), 'self_fatal：對手所有技能PP歸0');
    assert.equal(out[2].logs.filter(l => l.includes('測試額外') && l.includes('消逝')).length, 1, '死亡只結算一次');
  });

  await check('己方其他精靈登場→山神死亡；死亡時消除對手回合類效果與能力提升、令其所有技能PP歸0', async () => {
    const turnFx = h.turnEffectSkill();
    const boost = h.kitSkill('強化', [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 2, chance: 100 } }]);
    const idle = h.wait();
    const enemy = h.unit('敵', 900000, [turnFx, boost, idle], { speed: 10 });
    const p1 = [mkCas('5041', 4000, { noInvalid: true }), h.unit('友', 3000, [h.wait()])];
    const out = await run(p1, [enemy], [() => [WAIT, 0], () => [WAIT, 1], () => [{ switch: 1 }, 2]]);
    assert.ok(h.timers(out[1].state, 'p2').length > 0, '前置：對手有回合類效果');
    assert.equal(out[1].p2.statStages.atk, 2, '前置：對手有能力提升');
    assert.equal(shan(out[1].team1).isVanished ?? false, false);
    const r = out[2];
    assert.equal(r.p1.name, '友');
    assert.equal(shan(r.team1).isVanished, true, '友登場後山神死亡');
    assert.equal(shan(r.team1).currentHp, 0);
    assert.deepEqual(h.timers(r.state, 'p2'), [], '消除對手回合類效果');
    assert.equal(r.p2.statStages.atk, 0, '消除對手能力提升');
    assert.ok(r.p2.skills.every((s: any) => s.pp === 0), '令對手所有技能PP歸0：' + r.p2.skills.map((s: any) => s.pp));
  });

  await check('「岳峙淵渟.卡修斯以外」：同隊另一隻卡修斯登場不會令山神死亡；其他精靈登場才會', async () => {
    // 「護盾消失」子句換成空（A 組負責）：二號卡沒有護盾，舊子句會在階段結束殺山神，與本測試要鎖的登場條件無關。
    const p1 = [mkCas('5041', 4000, { noInvalid: true, phaseEnd: [] }), mkCas('二號卡', 4000, { noSummon: true, phaseEnd: [] }), h.unit('友', 3000, [h.wait()])];
    const out = await run(p1, [h.unit('敵', 90000, [h.wait()], { speed: 10 })], [() => [WAIT, 0], () => [{ switch: 1 }, 0], () => [WAIT, 0], () => [{ switch: 2 }, 0]]);
    assert.equal(out[1].p1.name, '岳峙淵渟.卡修斯'); assert.equal(out[1].p1.id, '二號卡');
    assert.equal(shan(out[1].team1).isVanished ?? false, false, '另一隻卡修斯登場：山神存活');
    assert.equal(shan(out[2].team1).isVanished ?? false, false);
    assert.equal(out[3].p1.name, '友');
    assert.equal(shan(out[3].team1).isVanished, true, '非卡修斯的精靈登場：山神死亡');
  });

  await check('卡修斯護盾消失→山神死亡（觸發死亡效果）＋清除在場累計回合數→下一回合開始可再次召喚；護盾仍在不動作', async () => {
    const clearShield = h.kitSkill('清盾', [{ op: 'clear_shield', p: { side: 'opp', kind: 'both' } }]);
    const mk = (reset: boolean) => [mkCas('5041', 4000, reset ? {} : { phaseEnd: killClause(false) })]; // reset=true 用真實 Kit 子句
    const enemyOf = () => h.unit('敵', 900000, [{ ...h.wait(), name: '閒置' }, clearShield, h.kitSkill('強化', [{ op: 'stat', p: { side: 'self', stats: ['攻擊'], v: 2, chance: 100 } }])], { speed: 10 });
    // T2 清盾→山神死亡→對手PP歸0；之後對手沒有可選技能（交給引擎自動處理），對手換上後備（全技能PP為0時不能再出招）。
    const picks: ((e: any, t: number) => [any, any])[] = [() => [WAIT, 2], () => [WAIT, 1], () => [WAIT, { switch: 1 }], () => [WAIT, 0]];
    const out = await run(mk(true), [enemyOf(), h.unit('敵後備', 900000, [h.wait()], { speed: 10 })], picks);
    const first = shan(out[0].team1);
    assert.ok(first && !first.isVanished && casOf(out[0].team1).shield === 2000, 'T1 護盾仍在，山神存活（守衛不誤殺）');
    assert.equal(out[0].p2.statStages.atk, 2, '前置：對手有能力提升');
    assert.equal(casOf(out[1].team1).shield ?? 0, 0, 'T2 對手清掉護盾');
    // T2：護盾消失 → 山神死亡並觸發死亡效果；同回合開始已不會再被重召（回合數尚大）
    assert.equal(out[1].logs.some(l => l.includes('炫彩山神') && l.includes('死亡')), true, '日誌：死亡並清除回合數');
    assert.equal(out[1].p2.statStages.atk, 0, '死亡效果：消除對手能力提升');
    assert.ok(out[1].p2.skills.every((s: any) => s.pp === 0), '死亡效果：對手PP歸0');
    // 清除在場累計回合數 → T3 回合開始（回合數歸1）再次召喚，新實例存活且再給 ½ 護盾
    const again = shan(out[2].team1);
    assert.ok(again && !again.isVanished && again.currentHp > 0, 'T3 重新召喚');
    assert.equal(casOf(out[2].team1).shield, 2000);
    assert.equal(extrasOf(out[2].team1).length, 1, '舊屍體被原位取代，不累積');
    // 對照：不清除回合數 → 不會在下一回合重召
    const noReset = await run(mk(false), [enemyOf(), h.unit('敵後備', 900000, [h.wait()], { speed: 10 })], picks);
    assert.equal(shan(noReset[1].team1).isVanished, true);
    assert.equal(shan(noReset[2].team1).isVanished, true, '未清回合數就不重召（證明重召來自回合數清除）');
  });

  await check('既有額外精靈補上字母 id／kind（克塔亞特／珀妮／賽博怨靈／旭／清）；實例 id 仍每次唯一', async () => {
    for (const name of ['克塔亞特', '珀妮', '賽博怨靈', '旭', '清']) {
      const e = createExtraElf(h.unit('B', 1000, [h.wait()]), { name, type: '普通' });
      assert.match(e.id, EXTRA_ELF_ID_PATTERN); assert.ok(e.id.startsWith(`${EXTRA_ELF_KINDS[name]}_`), `${name} 實例 id 帶種類前綴`); assert.equal(e.extraKind, EXTRA_ELF_KINDS[name]);
    }
  });
  await check('炫彩山神描述：卡修斯魂印含原文整段（緊接召喚句之後），Kit description 與精靈魂印逐字相同', async () => {
    const BLOCK = ['額外精靈炫彩山神：', '>能力值等同於任一方岳峙淵渟.卡修斯中能力最高者', '>己方岳峙淵渟.卡修斯以外的其他精靈登場後死亡', '',
      '炫彩山神被加入時：', '>解除自身異常狀態', '>為岳峙淵渟.卡修斯附加最大體力½的護盾值', '>為岳峙淵渟.卡修斯附加3回合山神守護',
      '炫彩山神進入死亡時：', '>消除對手在場精靈回合類效果', '>消除對手在場精靈能力提升狀態', '>令對手在場精靈所有技能PP值歸0'];
    const lines = cas.soulMark.description.split('\n');
    const at = lines.indexOf('>>召喚額外精靈炫彩山神加入己方');
    assert.ok(at >= 0, '召喚句仍在');
    assert.equal(lines[at + 1], '', '區塊前空一行');
    assert.deepEqual(lines.slice(at + 2, at + 2 + BLOCK.length), BLOCK, '原文整段逐行相同');
    assert.equal(lines[at + 2 + BLOCK.length], '', '區塊後空一行'); assert.equal(lines[at + 3 + BLOCK.length], '自身處於山神守護狀態時：', '後續結構不變');
    const { CASSIUS_SHAN_SOUL_KIT } = await h.server.ssrLoadModule('/src/data/migratedCassiusShanKits.ts');
    assert.equal(CASSIUS_SHAN_SOUL_KIT.description, cas.soulMark.description, 'Kit description 與精靈魂印逐字相同（套用 Kit 以原文比對）');
    assert.ok(cas.soulMark.kit?.length, '魂印 Kit 仍被套用（原文比對成功）');
  });

  await check('炫彩山神（額外精靈）自帶可見描述：魂印顯示該段原文，Kit description 與其逐字相同，條款句與各行對齊', async () => {
    const { SHANCAISHEN_DESCRIPTION, SHANCAISHEN_KIT_DEF } = await h.server.ssrLoadModule('/src/data/migratedShancaishenKit.ts');
    const { default: texts } = await h.server.ssrLoadModule('/src/data/cassiusShanText.json');
    assert.ok(texts.soul.includes(SHANCAISHEN_DESCRIPTION), '額外精靈的描述是卡修斯魂印中該段的逐字摘錄');
    const def = SHANCAISHEN_KIT_DEF();
    assert.equal(def.description, SHANCAISHEN_DESCRIPTION);
    for (const side of ['p1', 'p2'] as const) {
      const mine = [mkCas('5041', 4000)], foe = [h.unit('敵', 90000, [h.wait()], { speed: 10 })];
      const out = await run(side === 'p1' ? mine : foe, side === 'p1' ? foe : mine, Array.from({ length: 2 }, () => () => (side === 'p1' ? [WAIT, 0] : [0, WAIT]) as [any, any]));
      const ex = shan(out[1][side === 'p1' ? 'team1' : 'team2']);
      assert.ok(ex, `${side} 山神已召喚`);
      const desc = ex.soulMark?.description || '';
      assert.ok(desc.length > 0 && desc === SHANCAISHEN_DESCRIPTION, `${side} 額外精靈魂印描述非空且同原文：` + desc);
      for (const line of ['額外精靈炫彩山神：', '炫彩山神被加入時：', '炫彩山神進入死亡時：', '>解除自身異常狀態', '>令對手在場精靈所有技能PP值歸0']) assert.ok(desc.split('\n').includes(line), `${side} 描述含「${line}」`);
      assert.ok(ex.soulMark.name && ex.soulMark.name !== '額外精靈', '不是預設的「由…召喚」空殼描述');
    }
    // 條款句與描述各行對齊：「被加入時」「進入死亡時」每個 > 行都在某條款的原文中；「額外精靈」群的行對應登場後死亡條款與召喚參數
    const raws = def.kit.map((k: any) => k.params.clause.raw as string);
    const lines = SHANCAISHEN_DESCRIPTION.split('\n');
    const group = (head: string) => { const i = lines.indexOf(head); const out: string[] = []; for (let j = i + 1; j < lines.length && lines[j].startsWith('>'); j++) out.push(lines[j].slice(1)); return out; };
    for (const head of ['炫彩山神被加入時：', '炫彩山神進入死亡時：']) {
      const sentences = group(head); assert.ok(sentences.length >= 3, head);
      const owner = raws.find((r: string) => r.startsWith(head)); assert.ok(owner, `${head} 有對應條款`);
      for (const sentence of sentences) assert.ok(owner.includes(sentence), `「${sentence}」出現在條款「${owner}」`);
    }
    assert.ok(raws.includes(group('額外精靈炫彩山神：')[1]), '「己方…登場後死亡」逐字等於條款原文');
    const summon = cas.soulMark.kit.flatMap((e: any) => e.params.clause.body.flatMap((b: any) => b.acts)).find((a: any) => a.op === 'summon_extra_elf');
    assert.equal(summon.p.statSource, 'highest_of_name'); assert.equal(summon.p.statName, '岳峙淵渟.卡修斯', '「能力值等同於任一方卡修斯中能力最高者」由召喚參數承擔');
  });

  console.log(`cassius-extra: ${count} passed`);
} finally { await h.close(); }
