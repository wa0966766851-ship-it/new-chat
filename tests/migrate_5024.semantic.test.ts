// 5024 湮滅之主・咤克斯：無限・虛數湮滅 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 其餘技能（沉寂・永夜悼亡、崩解・萬念劫灰、劫數・限界歸無、絕滅・萬物哀鳴 ...）與魂印含 B 缺口，未轉，見交接單 §4。
// 「恢復自身最大體力1/1並附加對手等量百分比傷害」：等量＝本招實際恢復量（體力已滿則恢復 0、不附加）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const timersOf = (state: any, side: string) => h.timers(state, side);
const HP = 90000, OPP = 200000;
try {
  const void_ = h.find('5024', '無限・虛數湮滅');
  h.assertKitOnly(void_);
  const noAtk = { ...void_, power: 0, category: '屬性' };
  await check('固有屬性與連鎖節點與原文逐句對應', async () => {
    assert.deepEqual(void_.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`), ['base_priority=3', 'sure_hit=true']);
    assert.equal(void_.priority,3);assert.ok(void_.description.startsWith('■ 先制+3'));
    assert.equal(void_.kit.length, 6);
  });
  const strike = { ...h.wait(), name: '重擊', category: '物理', power: 100, isSureHit: true };
  const duel = (side: 'p1' | 'p2', selfSkills: any[], o: { selfHp?: number; oppStages?: any; sealed?: boolean; selfSpeed?: number; oppSkills?: any[]; n: number; pick: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', o.selfHp ?? HP, selfSkills, { maxHp: HP, speed: o.selfSpeed ?? 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', OPP, o.oppSkills ?? [h.wait(), strike], { maxHp: OPP, speed: 100, statStages: o.oppStages || {} }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n);
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 回合類效果與能力提升都消除成功→疲憊＋害怕；兩者都失敗→各100%詛咒（同一異常只有一個）`, async () => {
      const both = await duel(side, [noAtk, h.wait()], { oppSkills: [h.turnEffectSkill(), h.wait()], oppStages: { atk: 2 }, n: 2, pick: t => t === 1 ? [1, 0] : [0, 1] });
      const st = h.statuses(both[1].opp);
      assert.ok(st.includes('疲憊') && st.includes('害怕'), st.join());
      assert.ok(!st.includes('詛咒'), '兩句都成功 → 不詛咒');
      assert.equal(both[1].opp.statStages.atk || 0, 0, '能力提升已消除');
      assert.ok(!timersOf(both[1].state, opp).some((t: string) => /免疫/.test(t)), '回合類效果已消除');
      const none = await duel(side, [noAtk, h.wait()], { n: 1, pick: () => [0, 0] });
      const s2 = h.statuses(none[0].opp);
      assert.ok(s2.includes('詛咒') && !s2.includes('疲憊') && !s2.includes('害怕'), s2.join());
    });
    await check(`${side} 兩句各自獨立：只消除回合類效果→疲憊＋詛咒；只消除能力提升→害怕＋詛咒`, async () => {
      const onlyTurn = await duel(side, [noAtk, h.wait()], { oppSkills: [h.turnEffectSkill(), h.wait()], n: 2, pick: t => t === 1 ? [1, 0] : [0, 1] });
      const a = h.statuses(onlyTurn[1].opp);
      assert.ok(a.includes('疲憊') && a.includes('詛咒') && !a.includes('害怕'), a.join());
      const onlyBuff = await duel(side, [noAtk, h.wait()], { oppStages: { speed: 1 }, n: 1, pick: () => [0, 0] });
      const b = h.statuses(onlyBuff[0].opp);
      assert.ok(b.includes('害怕') && b.includes('詛咒') && !b.includes('疲憊'), b.join());
    });
    await check(`${side} 疲憊／害怕／詛咒「預設3回合」（使用者 2026-10-12 確認）：施加當回合算第1回合，回合結束剩 2→1→到期`, async () => {
      const { getStatuses } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
      const left = (r: any, k: string) => (getStatuses(r.opp) || {})[k] ?? 0;
      // 疲憊＋害怕（兩句都成功）
      const both = await duel(side, [noAtk, h.wait()], { oppSkills: [h.turnEffectSkill(), h.wait()], oppStages: { atk: 2 }, n: 4, pick: t => t === 1 ? [1, 0] : t === 2 ? [0, 1] : [1, 0] });
      // 第1回合對手立盾、第2回合我方使用 → 第2回合結束：剩 2；第3回合剩 1；第4回合到期
      assert.deepEqual([1, 2, 3].map(t => left(both[t], '疲憊')), [2, 1, 0], '疲憊');
      assert.deepEqual([1, 2, 3].map(t => left(both[t], '害怕')), [2, 1, 0], '害怕');
      // 詛咒（兩句都失敗）
      const curse = await duel(side, [noAtk, h.wait()], { n: 3, pick: t => [t === 1 ? 0 : 1, 0] });
      assert.deepEqual([0, 1].map(t => left(curse[t], '詛咒')), [2, 1], '詛咒：第1回合結束剩2、第2回合剩1');
      assert.equal(left(curse[2], '詛咒'), 0, '3回合後詛咒到期（轉為既有的虛弱詛咒）');
      assert.equal(Object.values(getStatuses(curse[0].opp)).length, 1, '第1回合只有詛咒一個異常');
    });
    await check(`${side} 2回合內對手屬性技能無效（含本回合，到期）`, async () => {
      const hist = await duel(side, [noAtk, h.wait()], { n: 4, pick: t => [t === 1 ? 0 : 1, 0] });
      assert.ok(timersOf(hist[0].state, opp).some((t: string) => /屬性技能無效:1/.test(t)), '使用當回合已算第1回合，剩1回合：' + timersOf(hist[0].state, opp).join());
      assert.ok(!timersOf(hist[1].state, opp).some((t: string) => /屬性技能無效/.test(t)), '第2回合結束到期');
    });
    await check(`${side} 恢復最大體力1/1並附加對手等量百分比傷害（等量＝實際恢復量）；體力全滿則不附加`, async () => {
      const [r] = await duel(side, [noAtk, h.wait()], { selfHp: 40000, n: 1, pick: () => [0, 0] });
      assert.equal(r.self.currentHp, HP, '回滿');
      assert.equal(OPP - r.opp.currentHp, HP - 40000, '附加對手等量（實際恢復 50000）的百分比傷害');
      const [f] = await duel(side, [noAtk, h.wait()], { selfHp: HP, n: 1, pick: () => [0, 0] });
      assert.equal(f.opp.currentHp, OPP, '實際恢復量 0 → 不造成傷害');
    });
    await check(`${side} 使用者回調先制+3，速度較慢仍先於對手+2出手；附加效果失效不封固有先制`, async () => {
      const priority2={...strike,effectMode:'kit',kit:[{...void_.kit[0],params:{property:'base_priority',value:2,conditions:[]}}]};
      const hist = await duel(side, [void_, h.wait()], { selfSpeed: 50, oppSkills: [priority2, h.wait()], n: 1, pick: () => [0, 0] });
      const l = hist[0].logs.filter((x: string) => /使用了【/.test(x));
      assert.ok(l[0].includes('虛數湮滅'), '自身先出手：' + l.join(' / '));
      const [s] = await duel(side, [noAtk, h.wait()], { selfHp: 40000, oppStages: { atk: 2 }, sealed: true, n: 1, pick: () => [0, 0] });
      assert.equal(s.self.currentHp, 40000); assert.equal(s.opp.statStages.atk, 2);
      assert.deepEqual(h.statuses(s.opp), []); assert.deepEqual(timersOf(s.state, opp), []);
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
