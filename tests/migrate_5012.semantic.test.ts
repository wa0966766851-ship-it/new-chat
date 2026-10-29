// 5012 冰魄·柯爾德：傲視千川 轉成連鎖 Kit 的語意驗收（P1／P2 正式戰鬥）。
// 其餘四招（凝寒止喧、冰天花葬、王·蒼銀之棺、王·霜祲霞罰）與魂印含 B 缺口，未轉，見交接單 §4。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const STAGES = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'];
const stagesAll = (e: any, v: number, label: string) => { for (const k of STAGES) assert.equal(e.statStages[k] || 0, v, `${label}:${k}=${e.statStages[k]}`); };
const otherOf = (s: string) => s === 'p1' ? 'p2' : 'p1';
const timersOf = (state: any, side: string) => h.timers(state, side);
try {
  const gaze = h.find('5012', '傲視千川');
  h.assertKitOnly(gaze);
  await check('固有屬性與連鎖節點與原文逐句對應', async () => {
    assert.deepEqual(gaze.kit.filter((e: any) => e.codeId === 'skill_property').map((e: any) => `${e.params.property}=${e.params.value}`), ['sure_hit=true']);
    assert.equal(gaze.kit.filter((e: any) => e.codeId === 'effect_sequence').length, 4);
    assert.equal(gaze.kit.length, 5);
  });
  const freeze = h.kitSkill('凍', [{ op: 'status', p: { chance: 100, side: 'opp', status: '冰封' } }]);
  const boost = h.kitSkill('強化', [{ op: 'stat', p: { chance: 100, side: 'self', stats: ['全屬性'], v: 1 } }]);
  const strike = { ...h.wait(), name: '重擊', category: '物理', power: 100, isSureHit: true };
  const counter = { ...h.wait(), name: '還擊', category: '物理', power: 100, isSureHit: true };
  const duel = (side: 'p1' | 'p2', selfSkills: any[], o: { sealed?: boolean; selfSpeed?: number; oppSpeed?: number; oppSkills?: any[]; n: number; pick: (t: number) => [number, number] }) => h.play(side, {
    self: h.unit('S', 90000, selfSkills, { maxHp: 90000, speed: o.selfSpeed ?? 200, extra: o.sealed ? { isAdditionalInvalid: true } : {} }),
    opp: h.unit('E', 100000, o.oppSkills ?? [h.wait(), strike], { maxHp: 100000, speed: o.oppSpeed ?? 100 }),
    turns: (_e: any, t: number) => o.pick(t),
  } as any, o.n);
  for (const side of ['p1', 'p2'] as const) {
    const opp = otherOf(side);
    await check(`${side} 全屬性+1（含命中）；對手冰封時翻倍為+2；對手未冰封不翻倍`, async () => {
      const plain = await duel(side, [{ ...gaze }, freeze, h.wait()], { n: 1, pick: () => [0, 0] });
      stagesAll(plain[0].self, 1, '未冰封');
      assert.equal(Object.values(plain[0].opp.statStages).filter(Boolean).length, 0, '對手能力不受影響');
      const icy = await duel(side, [{ ...gaze }, freeze, h.wait()], { n: 2, pick: t => t === 1 ? [1, 0] : [0, 0] });
      assert.ok(h.statuses(icy[0].opp).includes('冰封'), '第1回合對手被冰封');
      assert.ok(h.statuses(icy[1].opp).includes('冰封'), '第2回合使用時對手仍冰封');
      stagesAll(icy[1].self, 2, '冰封');
    });
    await check(`${side} 附加效果失效：整份連鎖不生效（無能力提升、無回合效果）`, async () => {
      const [r] = await duel(side, [{ ...gaze }, h.wait()], { n: 1, sealed: true, pick: () => [0, 0] });
      stagesAll(r.self, 0, '失效');
      assert.deepEqual(timersOf(r.state, side), []); assert.deepEqual(timersOf(r.state, opp), []);
    });
    await check(`${side} 下2回合對手受到的傷害提高100%（第2、3回合×2，第4回合起恢復；本回合不生效）`, async () => {
      const run = (first: any) => duel(side, [first, strike], { n: 5, pick: t => [t === 1 ? 0 : 1, 0] });
      const a = await run({ ...gaze }), b = await run(boost);
      const d = (hist: any[]) => hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : 100000) - r.opp.currentHp);
      const da = d(a), db = d(b);
      assert.equal(da[0], 0); assert.equal(db[0], 0);
      for (const t of [1, 2]) assert.ok(db[t] > 0 && Math.abs(da[t] - db[t] * 2) <= 2, `第${t + 1}回合 ×2：${da[t]} vs ${db[t]}`);
      for (const t of [3, 4]) assert.equal(da[t], db[t], `第${t + 1}回合恢復：${da[t]} vs ${db[t]}`);
    });
    await check(`${side} 傷害提高只算攻擊傷害：真實／固定／百分比傷害不受影響（全域規則：描述只寫「傷害」＝攻擊傷害）`, async () => {
      for (const [name, act] of [['真實', { op: 'dmg', p: { flat: 1000, type: '真實' } }], ['固定', { op: 'dmg', p: { flat: 1000, type: '固定' } }], ['百分比', { op: 'dmg', p: { base: '最大體力', of: 'opp', ratio: 0.01, type: '百分比' } }]] as const) {
        const dealer = h.kitSkill(name, [act]);
        const run = (first: any) => duel(side, [first, dealer], { n: 4, oppSkills: [h.wait()], pick: t => [t === 1 ? 0 : 1, 0] });
        const a = await run({ ...gaze }), b = await run(h.wait());
        const d = (hist: any[]) => hist.map((r: any, i: number) => (i ? hist[i - 1].opp.currentHp : 100000) - r.opp.currentHp);
        const da = d(a), db = d(b);
        for (const t of [1, 2, 3]) assert.ok(db[t] > 0 && da[t] === db[t], `${name} 第${t + 1}回合不應被提高：${da[t]} vs ${db[t]}`);
      }
    });
    await check(`${side} 下2回合自身所有技能先制+2（後手時第2、3回合先出手，第4回合起恢復）`, async () => {
      const hist = await duel(side, [{ ...gaze }, counter], { n: 5, selfSpeed: 50, oppSpeed: 100, oppSkills: [strike, h.wait()], pick: t => t === 1 ? [0, 1] : [1, 0] });
      const order = hist.map((r: any, i: number) => r.logs.slice(i ? hist[i - 1].logs.length : 0).filter((l: string) => /使用了【(還擊|重擊)】/.test(l)).map((l: string) => l.includes('還擊') ? 'S' : 'E').join(''));
      assert.deepEqual([order[1], order[2], order[3], order[4]], ['SE', 'SE', 'ES', 'ES'], order.join());
    });
    await check(`${side} 下2回合對手無法主動切換精靈：計時器 2→1→到期；失效時不施加`, async () => {
      const hist = await duel(side, [{ ...gaze }, h.wait()], { n: 4, pick: t => [t === 1 ? 0 : 1, 0] });
      const lock = (r: any) => (r.state[`${opp}Timers`] || []).filter((t: any) => /無法切換/.test(t.name));
      assert.equal(lock(hist[0]).length, 1, JSON.stringify(timersOf(hist[0].state, opp)));
      assert.equal(lock(hist[0])[0].remaining, 2); assert.equal(lock(hist[1])[0].remaining, 1);
      assert.equal(lock(hist[2]).length, 0, '2回合後到期');
      assert.equal(timersOf(hist[0].state, side).filter((t: string) => /無法切換/.test(t)).length, 0, '只作用在對手');
      // 引擎的切換判定吃這個狀態：對手（第2、3回合）不能主動切換，自身不受影響，到期後恢復
      const { isElfSwitchDisabled, getNoSwitchTurns } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
      const disabled = (r: any, who: string) => isElfSwitchDisabled(r.state[who], r.state[otherOf(who)], false, getNoSwitchTurns(r.state, who));
      assert.equal(disabled(hist[0], opp), true, '第2回合對手被鎖定切換'); assert.equal(disabled(hist[1], opp), true, '第3回合仍鎖定');
      assert.equal(disabled(hist[2], opp), false, '第4回合恢復'); assert.equal(disabled(hist[0], side), false, '自身可切換');
    });
  }
  console.log(`${count} checks`);
} finally { await h.close(); }
