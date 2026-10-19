// 5022 無序.六刃 技能「終焉·六花斬」真 Kit 拆解驗收（組 3；blocks/ops/extraElf.ts）。
// 雙側（P1/P2）正式 headless 引擎：必中／先制條件／依PP狀態獨立吸取／6次額外行動延後總和／場下消逝與能力轉化。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
const ok = (m: string) => { checks++; console.log('OK ' + m); };
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { getTypeMatchup } = await h.server.ssrLoadModule('/src/utils/statCalculator.ts');
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  const { MIGRATED_EXTRA_ELF_SKILL_KITS } = await h.server.ssrLoadModule('/src/data/migratedExtraElfKits.ts');
  const real = h.find('5022', '終焉·六花斬');
  h.assertKitOnly(real);
  assert.ok(!JSON.stringify(real.kit).includes('legacy_handler'), '不得殘留包裝');
  const def = MIGRATED_EXTRA_ELF_SKILL_KITS.find((k: any) => k.name === '終焉·六花斬');
  assert.equal(real.description, def.description);
  for (const e of real.kit) assert.equal(kitEntryIssue(e), null, kitEntryIssue(e) ?? '');
  ok('終焉·六花斬已是真 Kit（逐條 kitEntryIssue 通過，無包裝、無 handler）');

  // 戰鬥用複本：取真 Kit，改為威力 0 的屬性技（排除主招傷害干擾，Kit 條目原樣保留）。
  const petal = (o: any = {}) => ({ ...structuredClone(real), category: '屬性', power: 0, pp: o.pp ?? 5, maxPp: o.maxPp ?? 5, priority: 0 });
  const seq = ['邪靈', '戰鬥', '邪靈.戰鬥', '邪靈', '戰鬥', '邪靈.戰鬥'];
  const sumFor = (type: string) => seq.reduce((a, t) => a + Math.floor(66 * getTypeMatchup(t, type)), 0);
  const filler = (pp: number, maxPp: number) => ({ ...h.wait(), pp, maxPp });
  const bench = (id: string, hp: number, o: any = {}) => ({ ...h.unit(id, hp, [h.wait()], { type: o.type || '普通', maxHp: o.maxHp ?? 5000 }), isConcealed: !!o.concealed,
    calculatedStats: { hp: 5000, atk: 200, def: 100, spatk: 100, spdef: 100, speed: 100 } });

  for (const side of ['p1', 'p2'] as const) {
    // ① 依PP狀態獨立吸取：雙方技能 自身[六花斬 5/5 滿, A 3/5 不滿] 對手[B 5/5 滿, C 0/5 不滿, D 5/5 滿]
    //    notFull=2（A、C）、full=（六花斬、B、D）=3；每次 66 固定傷害；總吸取 5×66=330，自身等量回復。
    {
      const self = h.unit('S', 4000, [petal(), filler(3, 5)], { maxHp: 9000 });
      self.type = '普通'; self.calculatedStats.speed = 500;
      const opp = h.unit('E', 100000, [filler(5, 5), filler(0, 5), filler(5, 5)], { type: '普通' });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const afterDrainOnly = 100000 - r[0].opp.currentHp;
      const active = sumFor('普通');
      assert.equal(afterDrainOnly, 5 * 66 + active, side + ' 對手體力損失＝5次×66固定＋六花總和（' + afterDrainOnly + '）');
      assert.ok(r[0].self.currentHp >= 4000 + 5 * 66 - 1, side + ' 自身恢復吸取量');
      ok(side + ' 依PP狀態逐個獨立吸取 5×66，額外行動總和一次結算 ' + active);
    }
    // ② 護盾吸收：吸取後對手體力未減少 → 該次改汲取（真實傷害，穿盾）
    {
      const self = h.unit('S', 4000, [petal()], { maxHp: 9000 });
      self.type = '普通'; self.calculatedStats.speed = 500;
      const opp = h.unit('E', 100000, [filler(5, 5)], { type: '普通' });
      opp.shield = 100000;
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      // 技能：自身1個（六花斬滿）＋對手1個（滿）＝full 2；盾承受固定吸取 → 各改汲取66真傷。
      assert.ok(100000 - r[0].opp.currentHp >= 2 * 66, side + ' 護盾吸收吸取後改汲取真實傷害（' + (100000 - r[0].opp.currentHp) + '）');
      ok(side + ' 吸取被護盾吸收時改為汲取（真實傷害）');
    }
    // ③ 6次額外行動：場下被擊殺者消逝並轉化其能力值20%給自身；隱匿場下不被波及；場下存活者扣除總和
    {
      const self = h.unit('S', 8000, [petal()], { maxHp: 9000 });
      self.type = '普通'; self.calculatedStats.speed = 500;
      const opp = h.unit('E', 100000, [filler(5, 5)], { type: '普通' });
      const weak = bench('W', 10), tough = bench('T', 5000), hidden = bench('H', 5000, { concealed: true });
      const r = await h.play(side, { self, opp, oppBench: [weak, tough, hidden], turns: () => [0, 0] }, 1);
      const s = r[0].state;
      const team: any[] = s[(side === 'p1' ? 'p2' : 'p1') + 'Team'] || [];
      const get = (id: string) => team.find((e: any) => e.id === id);
      assert.ok(get('W')?.isVanished || get('W')?.currentHp === 0, side + ' 場下低血精靈被擊殺');
      assert.equal(get('T')?.currentHp, 5000 - sumFor('普通'), side + ' 場下存活者扣總和 ' + sumFor('普通'));
      assert.equal(get('H')?.currentHp, 5000, side + ' 隱匿場下精靈不被波及');
      assert.equal(r[0].self.calculatedStats.atk, 300 + Math.floor(200 * 0.2), side + ' 轉化被殺者攻擊20%');
      ok(side + ' 場下結算：擊殺消逝＋能力值20%轉化、存活者扣總和、隱匿者不受波及');
    }
  }
  // ③' 非中立屬性對手：總和 = 各次按屬性克制取整後相加（克制只算一次，不被重複乘）
  for (const side of ['p1', 'p2'] as const) {
    let typed = '';
    for (const t of ['火', '水', '草', '電', '光', '暗', '機械', '龍']) if (sumFor(t) !== 396) { typed = t; break; }
    assert.ok(typed, '需有克制不為 1 的屬性');
    const self = h.unit('S', 8000, [petal()], { maxHp: 9000 }); self.type = '普通'; self.calculatedStats.speed = 500;
    const opp = h.unit('E', 1000000, [filler(5, 5)], { type: typed });
    const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
    assert.equal(1000000 - r[0].opp.currentHp, 2 * 66 + sumFor(typed), side + ' 屬性 ' + typed + ' 總和 ' + sumFor(typed));
    ok(side + ' 克制總和（' + typed + ' → ' + sumFor(typed) + '）只結算一次');
  }
  // ④ 先制條件：自身處於異常時先制+3（速度慢仍先出手）；無異常時不加成。
  //    回合1對手以高速先上毒（或只等待），回合2比較出手順序。
  for (const side of ['p1', 'p2'] as const) {
    const mk = async (poisoned: boolean, oppPrio = 0) => {
      const self = h.unit('S', 90000, [h.wait(), petal()], { maxHp: 90000, speed: 10 });
      self.type = '普通';
      const poison = h.kitSkill('上毒', [{ op: 'status', p: { side: 'opp', status: '中毒', turns: 5, chance: 100 } }]);
      const atk = { ...h.wait(), name: '敵方普攻', category: '物理', power: 1, pp: 99, maxPp: 99, isSureHit: true, priority: oppPrio };
      const opp = h.unit('E', 100000, [poison, atk], { type: '普通', speed: 300 });
      const r = await h.play(side, { self, opp, turns: (_e, t) => [t === 1 ? 0 : 1, poisoned && t === 1 ? 0 : 1] }, 2);
      const logs: string[] = r[1].logs.slice(r[0].logs.length);
      const i1 = logs.findIndex(l => l.includes('【S】使用了')), i2 = logs.findIndex(l => l.includes('【E】使用了'));
      assert.ok(i1 >= 0 && i2 >= 0, side + ' 回合2雙方皆出手：' + logs.join('|'));
      if (poisoned) assert.ok(r[0].self.battleStatuses?.中毒 > 0 || r[0].logs.some((l: string) => l.includes('中毒')), side + ' 回合1已中毒');
      return i1 < i2;
    };
    assert.equal(await mk(true), true, side + ' 自身異常時先制+3，慢速者先出手');
    assert.equal(await mk(false), false, side + ' 無異常不加先制');
    ok(side + ' 條件先制（異常時 +3）');
    // 無視對手正先制：對手 +5 先制本應壓過我方 +3；自身異常時其正先制被無視（視為 0），我方先出手。
    assert.equal(await mk(true, 5), true, side + ' 自身異常時無視對手正先制+5');
    assert.equal(await mk(false, 5), false, side + ' 無異常時對手 +5 先制照常生效');
    ok(side + ' 異常時無視對手正先制效果');
  }
  console.log('終焉·六花斬：' + checks + ' 項通過');
} finally { await h.close(); }
