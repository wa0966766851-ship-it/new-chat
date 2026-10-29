// 5013 柯爾霍德：寒淵之殤 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 其餘四招（蒼白冥步、寒夜未央、王·夜予寒吟、王·凜冬葬歌）與魂印含 B 缺口，未轉，見交接單 §4。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const timersOf = (state: any, side: string) => h.timers(state, side);
const HP = 90000, OPP = 99999;
try {
  const abyss = h.find('5013', '寒淵之殤');
  h.assertKitOnly(abyss);
  await check('固有屬性、節點（命中後 → on_hit）與原文逐句對應', async () => {
    assert.deepEqual(abyss.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`), ['sure_hit=true']);
    assert.deepEqual(abyss.kit.map((e: any) => e.node), ['before_skill', 'on_skill_use', 'on_hit', 'on_skill_use']);
  });
  const paralyze = h.kitSkill('麻', [{ op: 'status', p: { chance: 100, side: 'opp', status: '麻痺' } }]);
  const guard = h.kitSkill('護', [{ op: 'immune_status_turns', p: { turns: 4, reflect: false, cls: '' } }]);
  const strike = { ...h.wait(), name: '重擊', category: '物理', power: 100, isSureHit: true };
  const duel = (side: 'p1' | 'p2', selfSkills: any[], o: { sealed?: boolean; oppSkills?: any[]; n: number; pick: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', HP, selfSkills, { maxHp: HP, speed: 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', OPP, o.oppSkills ?? [h.wait(), paralyze], { maxHp: OPP, speed: 100 }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n);
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 4回合免疫並反彈所有異常（對手的麻痺被反彈給對手；到期後不再免疫）`, async () => {
      const run = (at: number) => duel(side, [{ ...abyss }, h.wait()], { n: 6, oppSkills: [h.wait(), paralyze], pick: t => [t === 1 ? 0 : 1, t === at ? 1 : 0] });
      const inside = await run(4);
      assert.ok(timersOf(inside[0].state, side).some((t: string) => /免疫並反彈異常:3/.test(t)), timersOf(inside[0].state, side).join());
      assert.ok(!h.statuses(inside[3].self).includes('麻痺'), '第4回合（免疫期間；對手第1～3回合被害怕/行動受限）：自身不受麻痺');
      assert.ok(h.statuses(inside[3].opp).includes('麻痺'), '麻痺被反彈給對手');
      assert.ok(!timersOf(inside[3].state, side).some((t: string) => /免疫並反彈/.test(t)), '第4回合結束免疫到期');
      const after = await run(5);
      assert.ok(h.statuses(after[4].self).includes('麻痺'), '第5回合（免疫到期後）：自身被麻痺');
    });
    await check(`${side} 命中後100%令對手害怕；成功時不扣最大體力1/3`, async () => {
      const [r] = await duel(side, [{ ...abyss }, h.wait()], { n: 1, pick: () => [0, 0] });
      assert.ok(h.statuses(r.opp).includes('害怕'));
      assert.equal(r.opp.currentHp, OPP, '害怕成功 → 未觸發分支不執行');
    });
    await check(`${side} 害怕失敗（對手免疫異常）→ 減少對手最大體力1/3（百分比傷害）`, async () => {
      const hist = await duel(side, [{ ...abyss }, h.wait()], { n: 2, oppSkills: [guard, h.wait()], pick: t => t === 1 ? [1, 0] : [0, 1] });
      assert.ok(!h.statuses(hist[1].opp).includes('害怕'));
      assert.equal(hist[0].opp.currentHp, OPP);
      assert.equal(OPP - hist[1].opp.currentHp, Math.floor(OPP / 3), `扣 1/3：${hist[1].opp.currentHp}`);
    });
    await check(`${side} 附加效果失效：整份連鎖不生效`, async () => {
      const [r] = await duel(side, [{ ...abyss }, h.wait()], { n: 1, sealed: true, pick: () => [0, 0] });
      assert.ok(!h.statuses(r.opp).includes('害怕')); assert.equal(r.opp.currentHp, OPP);
      assert.deepEqual(timersOf(r.state, side), []); assert.deepEqual(timersOf(r.state, opp), []);
    });
    await check(`${side} 下2回合對手受到傷害提升100%（第2、3回合×2，第4回合起恢復；本回合不生效）`, async () => {
      const run = (first: any) => duel(side, [first, strike], { n: 5, oppSkills: [h.wait()], pick: t => [t === 1 ? 0 : 1, 0] });
      const a = await run({ ...abyss }), b = await run(h.wait());
      const d = (hist: any[]) => hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : OPP) - r.opp.currentHp);
      const da = d(a), db = d(b);
      for (const t of [1, 2]) assert.ok(db[t] > 0 && Math.abs(da[t] - db[t] * 2) <= 2, `第${t + 1}回合 ×2：${da[t]} vs ${db[t]}`);
      for (const t of [3, 4]) assert.equal(da[t], db[t], `第${t + 1}回合恢復：${da[t]} vs ${db[t]}`);
    });
    await check(`${side} 傷害提高只算攻擊傷害：真實／固定／百分比傷害不受影響（全域規則：描述只寫「傷害」＝攻擊傷害）`, async () => {
      for (const [name, act] of [['真實', { op: 'dmg', p: { flat: 1000, type: '真實' } }], ['固定', { op: 'dmg', p: { flat: 1000, type: '固定' } }], ['百分比', { op: 'dmg', p: { base: '最大體力', of: 'opp', ratio: 0.01, type: '百分比' } }]] as const) {
        const dealer = h.kitSkill(name, [act]);
        const run = (first: any) => duel(side, [first, dealer], { n: 4, oppSkills: [h.wait()], pick: t => [t === 1 ? 0 : 1, 0] });
        const a = await run({ ...abyss }), b = await run(h.wait());
        const d = (hist: any[]) => hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : OPP) - r.opp.currentHp);
        const da = d(a), db = d(b);
        for (const t of [1, 2, 3]) assert.ok(db[t] > 0 && da[t] === db[t], `${name} 第${t + 1}回合不應被提高：${da[t]} vs ${db[t]}`);
      }
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
