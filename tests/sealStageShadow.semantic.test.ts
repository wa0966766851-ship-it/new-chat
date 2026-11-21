/**
 * 2026-11-21 第三輪驗收（P1/P2）：
 * 一、致死保留封印涵蓋所有同類效果：魂印致死存活、免死回合（含 BOSS 類由 FATAL_RESIST 入口觸發者）；觸發當回合仍保留，回合結束定案後不再成立（0體力存活者於定案時陣亡）。
 * 二、雙重暗影：對手的次數類異常免疫逐次消耗到不存在為止，之後照序附加詛咒、害怕（不設次數上限）。
 * 三、未暝之夜（柯爾霍德）：對手強化視為0、達條件時至少-n；傷害雙向與出手順序皆適用。
 * 五、受傷反應互打（納多雷受傷反應 × 對手「受到傷害時造成傷害」）：反應傷害不再引發下一層反應，回合正常結束不卡死。
 * 六、純粹暗影（激活）對混沌·布萊克同樣生效：狂暴主權只擋免疫，不擋道具把進入的狂暴改為平靜。
 * 七、柯爾霍德未暝之夜：造成攻擊傷害+150%實際生效；王·凜冬葬歌複製成功後對手3回合攻擊傷害為0。
 * 八、能力視圖規則（趙雲）：自身某項提升 n 級，對手同一項額外視為 -n（造成傷害、受到傷害、出手順序）。
 * 四、真實傷害／致死真實傷害後，靠後的固定或攻擊致死是否擊倒：依 5012 / 5013 原文（「致死真實傷害」與「真實傷害」兩條件）。
 */
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
import { checkElfDead } from '../src/battle/elfAlive';

const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const seed = (id: string, bid: string, hp = 5000, speed = 300) => {
    const s = structuredClone(DEFAULT_ELVES.find((e: any) => String(e.id) === id));
    Object.assign(s, { battleId: bid, maxHp: hp, currentHp: hp, calculatedStats: { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed }, statStages: {} });
    return s;
  };
  const truth = (n: number, o: any = {}) => h.kitSkill('真傷', [{ op: 'dmg', p: { flat: n, type: '真實' } }], { priority: 5, pp: 99, maxPp: 99, currentPp: 99, ...o });
  for (const side of ['p1', 'p2'] as const) {
    // 一、免死回合同樣受封印：封印後第一次（免死回合救下）當回合仍成立，下一回合起不再成立
    {
      const run = async (sealed: boolean) => {
        const seal = sealed ? h.kitSkill('封', [{ op: 'seal_fatal_resist', p: { side: 'opp' } }], { priority: 6 }) : { ...h.wait(), priority: 6 };
        return h.play(side, { self: h.unit('封者' + side, 5000, [seal, truth(999999)]),
          opp: h.unit('免死' + side, 5000, [h.wait()], { extra: { deathImmunity: { deathImmuneTurns: 9, guardTurns: 0 } } }),
          turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 3);
      };
      const ctl = await run(false), sealed = await run(true);
      assert.ok(!checkElfDead(ctl[2].opp), `${side} 對照：免死回合期間不陣亡`);
      // 封印後第一次：真傷致死時免死仍成立（當回合仍能行動）；回合結束定案，0體力不再受免死保護而陣亡。
      const logs = sealed[1].logs, hit = logs.findIndex((l: string) => l.includes('使用了【真傷】'));
      assert.ok(hit >= 0 && logs.slice(hit).some((l: string) => l.includes(`【免死${side}】使用了`)), `${side} 封印後第一次免死仍成立：` + logs.slice(-6).join('｜'));
      assert.ok(checkElfDead(sealed[1].opp) && sealed[1].opp.fatalResistSeal === 'spent', `${side} 回合結束封印定案後陣亡`);
      checks++;
    }
    // 二、雙重暗影：次數免疫5次全部消耗後，詛咒、害怕依序附加
    {
      const blake = seed('5053', 'NB' + side); blake.skills = [h.wait()];
      const prep = h.kitSkill('免疫', [{ op: 'immune_status_count', p: { count: 5, reflect: false } }], { priority: 6 });
      const r = await h.play(side, { self: blake, opp: h.unit('次免' + side, 50000, [prep, truth(999999)]), turns: (_e, t) => [0, t === 1 ? 0 : 1] }, 2);
      const st = h.statuses(r[1].opp);
      assert.equal(r[1].self.currentHp, 1, `${side} 雙重暗影保留1點`);
      assert.ok(st.includes('詛咒') && st.includes('害怕'), `${side} 次數免疫耗盡後仍附加詛咒、害怕：` + JSON.stringify(st) + r[1].logs.slice(-14).join('｜'));
      checks++;
    }
  }
  // 三、未暝之夜：對手攻擊/防禦/速度+6
  {
    const night = (n: number) => ({ op: 'resource_mark_add', p: { id: 'dark_night', name: '未暝之夜', displayChar: '夜', unit: '道', side: 'opp', scope: 'elf', persistsOffField: true, maxCount: 6, amount: n, description: 'x' } });
    const result: Record<number, { taken: number; dealt: number; first: boolean }> = {};
    for (const n of [0, 1, 2]) {
      const kee = seed('5013', 'KH', 100000, 100);
      kee.skills = [{ ...h.kitSkill('打', [], { category: '物理', type: '普通', power: 100, isSureHit: true }), effectMode: undefined, kit: undefined }];
      const prep = h.kitSkill('夜', n ? [night(n)] : [{ op: 'heal_flat', p: { amount: 1 } }], { priority: 6 });
      const atk = { ...h.kitSkill('強打', [], { category: '物理', type: '普通', power: 100, isSureHit: true }), effectMode: undefined, kit: undefined };
      const opp = h.unit('強' + n, 1000000, [prep, atk], { statStages: { atk: 6, def: 6, spatk: 0, spdef: 0, speed: 6, accuracy: 0 } });
      const r = await h.play('p1', { self: kee, opp, turns: (_e, t) => [0, t === 1 ? 0 : 1] }, 2);
      // 造成傷害另以對手不出手的回合量測（避免對手攻擊引發的魂印反應混入）。
      const kee2 = structuredClone(kee); kee2.currentHp = 100000;
      const still = h.unit('靜' + n, 1000000, [prep, h.wait()], { statStages: { atk: 0, def: 6, spatk: 0, spdef: 0, speed: 0, accuracy: 0 } });
      const q = await h.play('p1', { self: kee2, opp: still, turns: (_e, t) => [0, t === 1 ? 0 : 1] }, 2);
      const idx = (nm: string) => r[1].logs.map((l: string, i: number) => l.includes(`【${nm}】使用了`) ? i : -1).reduce((a: number, b: number) => Math.max(a, b), -1);
      result[n] = { taken: r[0].self.currentHp - r[1].self.currentHp, dealt: q[0].opp.currentHp - q[1].opp.currentHp, first: idx(kee.name) < idx('強' + n) };
    }
    assert.ok(!result[0].first && result[1].first && result[2].first, '未暝之夜：對手速度強化視為0 → 柯爾霍德先手：' + JSON.stringify(result));
    assert.ok(result[1].taken < result[0].taken / 2 && result[2].taken < result[1].taken, '受到傷害：對手攻擊強化失效、達條件再視為下降：' + JSON.stringify(result));
    assert.ok(result[1].dealt > result[0].dealt * 2 && result[2].dealt > result[1].dealt, '造成傷害：對手防禦強化失效、達條件再視為下降：' + JSON.stringify(result));
    checks++;
  }
  // 四、真實傷害與靠後致死
  {
    const mk = (id: string) => { const s = seed(id, 'K' + id, 100000, 100); s.skills = [{ ...h.wait(), name: '等待' }]; return s; };
    const d = (flat: number, type: string) => ({ op: 'dmg', p: { flat, type } });
    const cases: [string, any, boolean, boolean][] = [
      ['真傷500→固定致死', h.kitSkill('A', [d(500, '真實'), d(999999, '固定')], { priority: 5 }), false, true],
      ['致死真傷→固定致死', h.kitSkill('B', [d(999999, '真實'), d(999999, '固定')], { priority: 5 }), true, true],
      ['只有固定致死', h.kitSkill('C', [d(999999, '固定')], { priority: 5 }), false, false],
      ['真傷500→攻擊致死', h.kitSkill('D', [d(500, '真實')], { priority: 5, category: '物理', power: 99999, type: '普通', isSureHit: true }), false, true],
      ['致死真傷→攻擊致死', h.kitSkill('E', [d(999999, '真實')], { priority: 5, category: '物理', power: 99999, type: '普通', isSureHit: true }), true, true],
    ];
    for (const [name, sk, keld, kee] of cases) for (const [id, expect] of [['5012', keld], ['5013', kee]] as const) {
      const r = await h.play('p1', { self: mk(id), opp: h.unit('打' + name, 50000000, [sk], { statStages: { atk: 6 } }) }, 1);
      assert.equal(!checkElfDead(r[0].self), expect, `${id} ${name}：預期${expect ? '存活' : '陣亡'}：` + r[0].logs.slice(-8).join('｜'));
    }
    checks++;
  }
  // 五、受傷反應互打不卡死
  {
    const retaliate = { name: '受傷反擊', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_damaged', source: 'soulmark', role: 'innate', order: 0, customText: '測試',
      params: { clause: { raw: '測試', trig: 'damaged_nontrue', parsed: true, body: [{ acts: [{ op: 'dmg', p: { flat: 50, type: '固定' }, label: 'dmg' }] }] } } }] };
    const nd = seed('5042', 'ND', 50000, 100);
    const hit = h.kitSkill('固打', [{ op: 'dmg', p: { flat: 100, type: '固定' } }], { priority: 5 });
    const t0 = Date.now();
    const r = await h.play('p1', { self: h.unit('反擊者', 50000, [hit], { extra: { soulMark: retaliate } }), opp: nd }, 2);
    assert.ok(Date.now() - t0 < 60000 && r[1].state.phase !== 'resolving', '回合正常結束：' + r[1].state.phase);
    assert.ok(r[0].self.currentHp > 0 && r[0].opp.currentHp > 40000 && r[0].logs.length < 80, `反應有限：反擊者 ${r[0].self.currentHp}、納多雷 ${r[0].opp.currentHp}、日誌 ${r[0].logs.length}`);
    checks++;
    // 柯爾霍德（受到小於當前體力⅓的非真實傷害→汲取）× 對手「每次受到非真實傷害時對對手造成3次固定傷害」：
    // 因果鏈讓同一隻精靈在同一條鏈裡只反應一次；結算次數不設上限，但不會指數爆炸或無限互打。
    const triple = { name: '三連反擊', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'on_damaged', source: 'soulmark', role: 'innate', order: 0, customText: '測試',
      params: { clause: { raw: '測試', trig: 'damaged_nontrue', parsed: true, body: [{ acts: [1, 2, 3].map(() => ({ op: 'dmg', p: { flat: 30, type: '固定' }, label: 'dmg' })) }] } } }] };
    const kee = seed('5013', 'KR', 100000, 100); kee.skills = [h.kitSkill('固打', [{ op: 'dmg', p: { flat: 100, type: '固定' } }], { priority: 5 })];
    const t1 = Date.now();
    const k = await h.play('p1', { self: kee, opp: h.unit('三連者', 100000, [h.wait()], { extra: { soulMark: triple } }) }, 2);
    assert.ok(Date.now() - t1 < 60000 && k[1].state.phase !== 'resolving', '柯爾霍德 × 三連反擊：回合正常結束');
    // 無因果鏈時雙方會互打到一方倒下（實測柯爾霍德 10 萬體力被打到 0）；有因果鏈時只多出有限幾筆。
    assert.ok(k[0].self.currentHp > 99000 && k[0].opp.currentHp > 99000 && k[0].logs.length < 60,
      `反應有限：柯爾霍德 ${k[0].self.currentHp}、對手 ${k[0].opp.currentHp}、日誌 ${k[0].logs.length}`);
    checks++;
  }
  // 六、純粹暗影對混沌·布萊克
  for (const side of ['p1', 'p2'] as const) {
    const cb = seed('5015', 'CB' + side, 50000);
    cb.skills = [h.kitSkill('激活', [{ op: 'grant_item', p: { side: 'self', itemId: 'pure_shadow_active', count: 1 } }], { priority: 6 }), h.wait()];
    const rage = h.kitSkill('狂', [{ op: 'status', p: { side: 'opp', status: '狂暴', turns: 3, chance: 100 } }]);
    const r = await h.play(side, { self: cb, opp: h.unit('狂者' + side, 50000, [rage]), turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 2);
    const st = h.statuses(r[1].self);
    assert.ok(st.includes('平靜') && !st.includes('狂暴'), `${side} 混沌·布萊克的狂暴轉為平靜：` + JSON.stringify(st) + r[1].logs.slice(-6).join('｜'));
    checks++;
  }
  // 七、柯爾霍德
  {
    const night = { op: 'resource_mark_add', p: { id: 'dark_night', name: '未暝之夜', displayChar: '夜', unit: '道', side: 'opp', scope: 'elf', persistsOffField: true, maxCount: 6, amount: 1, description: 'x' } };
    const dealt: number[] = [];
    for (const n of [0, 1]) {
      const kee = seed('5013', 'KF' + n, 100000, 100);
      kee.skills = [{ ...h.kitSkill('打', [], { category: '物理', type: '普通', power: 100, isSureHit: true }), effectMode: undefined, kit: undefined }];
      const prep = h.kitSkill('夜', n ? [night] : [{ op: 'heal_flat', p: { amount: 1 } }], { priority: 6 });
      const r = await h.play('p1', { self: kee, opp: h.unit('靶' + n, 1000000, [prep, h.wait()]), turns: (_e, t) => [0, t === 1 ? 0 : 1] }, 2);
      dealt.push(r[0].opp.currentHp - r[1].opp.currentHp);
    }
    // 未暝之夜還附帶吸血；只看對手失去的體力：+150% → 2.5 倍
    assert.ok(Math.abs(dealt[1] / dealt[0] - 2.5) < 0.1, '未暝之夜造成攻擊傷害+150%：' + JSON.stringify(dealt));
    const kee = seed('5013', 'KG', 100000, 100);
    kee.skills = [kee.skills.find((s: any) => s.name === '王·凜冬葬歌'), { ...h.wait(), name: '等待' }];
    const atk = { ...h.kitSkill('強打', [], { category: '物理', type: '普通', power: 100, isSureHit: true }), effectMode: undefined, kit: undefined };
    const r = await h.play('p1', { self: kee, opp: h.unit('升', 1000000, [atk], { statStages: { atk: 3, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 } }), turns: (_e, t) => [t === 1 ? 0 : 1, 0] }, 2);
    assert.equal(r[0].self.statStages.atk, 3, '複製對手能力提升');
    assert.equal(r[0].self.currentHp - r[1].self.currentHp <= 0, true, '複製成功：對手攻擊傷害為0：' + r[1].logs.slice(-6).join('｜'));
    checks++;
  }
  // 八、能力視圖規則
  {
    const viewSoul = { name: '視圖', effectMode: 'kit', kit: [{ codeId: 'effect_sequence', node: 'battle_start', source: 'soulmark', role: 'innate', order: 0, customText: '測試',
      params: { clause: { raw: '測試', trig: 'battle_start', parsed: true, body: [{ acts: [{ op: 'stage_view_rule', p: { selfUpAsOppDown: true }, label: 'x' }] }] } } }] };
    const hit = () => ({ ...h.kitSkill('打', [], { category: '物理', type: '普通', power: 100, isSureHit: true, priority: 0 }), effectMode: undefined, kit: undefined });
    const stages = (o: any) => ({ atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, ...o });
    const run = async (withRule: boolean, selfStages: any, oppStages: any, oppSpeed = 100) => {
      const me = h.unit('視' + withRule, 1000000, [hit()], { speed: 100, statStages: stages(selfStages), extra: withRule ? { soulMark: viewSoul } : {} });
      const foe = h.unit('對' + withRule, 1000000, [hit()], { speed: oppSpeed, statStages: stages(oppStages) });
      const r = await h.play('p1', { self: me, opp: foe }, 1);
      const order = r[0].logs.findIndex((l: string) => l.includes(`【${me.name}】使用了`)) < r[0].logs.findIndex((l: string) => l.includes(`【${foe.name}】使用了`));
      return { dealt: 1000000 - r[0].opp.currentHp, taken: 1000000 - r[0].self.currentHp, first: order };
    };
    // 造成傷害：自身防禦+2 → 對手防禦額外 -2
    const a1 = await run(true, { def: 2 }, {}), a0 = await run(false, { def: 2 }, { def: -2 });
    assert.equal(a1.dealt, a0.dealt, '造成傷害：自身防禦+2 視同對手防禦-2：' + JSON.stringify([a1, a0]));
    // 受到傷害：自身攻擊+2 → 對手攻擊額外 -2
    const b1 = await run(true, { atk: 2 }, {}), b0 = await run(false, { atk: 2 }, { atk: -2 });
    assert.equal(b1.taken, b0.taken, '受到傷害：自身攻擊+2 視同對手攻擊-2：' + JSON.stringify([b1, b0]));
    // 出手順序：對手速度 150（+0）快於自身 100；自身速度+1 → 對手視為 -1（150×2/3=100）… 用 +2：自身 200、對手 150×0.5=75
    const c1 = await run(true, { speed: 2 }, {}, 250), c0 = await run(false, { speed: 2 }, {}, 250);
    assert.ok(c1.first && !c0.first, '出手順序：自身速度提升等級視為對手速度下降：' + JSON.stringify([c1, c0]));
    checks++;
  }
  console.log(`封印／未暝之夜／雙重暗影／真傷致死：${checks} 項通過`);
} finally { await h.close(); }
