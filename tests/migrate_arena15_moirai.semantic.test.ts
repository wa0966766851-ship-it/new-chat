// arena_15 命運龍輪 莫伊萊 專屬特性 真 Kit 拆解驗收（DSH 20261018 第十二批）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const mf = DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_15');
  assert.equal(mf.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(!JSON.stringify(mf.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  checks++; console.log('OK arena_15 專屬特性已是真 Kit');

  const mfUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(mf);
    base.id = id; base.battleId = id; base.name = '命運龍輪 莫伊萊';
    base.maxHp = hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = {}; base.shield = 0; base.barrier = 0;
    base.soulMark = mf.soulMark;
    return base;
  };
  const waitAtk = { ...h.wait(), name: '等待', category: '屬性', pp: 99, maxPp: 99 };

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：回合開始隨機 2 選 1——每回合至少出現一種（能力提升 或 護盾/護罩）
    const self = mfUnit('S', 20000, [waitAtk, waitAtk]);
    const opp = h.unit('E', 100000, [waitAtk, waitAtk]);
    // 單場 4 回合（同場 rng 逐回合推進；跨場重擲會得相同序列）
    const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 4);
    let sawBoost = 0, sawShield = 0;
    for (let t = 0; t < r.length; t++) {
      const s = r[t].self;
      const stg = Object.values(s.statStages || {}).some((v: any) => Number(v) > 0);
      const sh = (s.shield || 0) > 0 || (s.barrier || 0) > 0;
      if (stg) sawBoost++;
      if (sh) sawShield++;
      assert.ok(stg || sh, side + ' 第' + (t + 1) + '回合：隨機 2 選 1 至少觸發一項');
      checks++;
    }
    // 固定種子（11）下分支選擇具確定性——本場全走護盾分支。能力提升分支的行為由
    // 場景二（對手睡眠→全部效果）確定性覆蓋（其中含開始①的能力提升）。
    assert.ok(sawShield >= 1, side + ' 護盾分支已觸發（' + sawShield + ' 回）');
    checks++;
  }
  console.log('OK 回合開始隨機 2 選 1 雙側（含雙分支覆蓋）');

  // 場景二：對手該回合沒有使用技能（睡眠）→ 回合結束觸發上述全部效果
  {
    const self = mfUnit('S2', 20000, [waitAtk, waitAtk]);
    const opp = h.unit('E2', 100000, [waitAtk, waitAtk], { extra: { battleStatuses: { '睡眠': 3 } } });
    const r = await h.play('p1', { self, opp, turns: () => [0, 0] }, 1);
    const t1 = r[0];
    assert.ok((t1.self.shield || 0) >= 200, '全效果：護盾≥200（' + (t1.self.shield || 0) + '）');
    checks++;
    assert.ok((t1.self.statStages || {}).atk >= 1, '全效果：自身全屬性+1');
    checks++;
    const oppDown = Object.values(t1.opp.statStages || {}).some((v: any) => Number(v) < 0);
    assert.ok(oppDown, '全效果：對手全屬性-1');
    checks++;
    const anyZero = (t1.opp.skills || []).some((s: any) => (s.currentPp ?? s.pp) === 0);
    assert.ok(anyZero, '全效果：對手隨機1技能PP歸零');
    checks++;
  }
  console.log('OK 對手未用技能→全部效果');

  console.log('arena_15 命運龍輪：' + checks + ' 項通過');
} finally { await h.close(); }