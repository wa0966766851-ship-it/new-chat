// arena_13 艷羅劍典／萬蒼書帝錄 真 Kit 拆解驗收（DSH 20261017 第十批；arenaShared 通用件）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const tf = DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_13');
  const yan = tf.skills.find((s: any) => s.name === '艷羅劍典');
  const wan = tf.skills.find((s: any) => s.name === '萬蒼書帝錄');
  assert.equal(yan.effectMode, 'kit', '艷羅劍典 effectMode=kit');
  assert.equal(wan.effectMode, 'kit', '萬蒼書帝錄 effectMode=kit');
  assert.ok(!JSON.stringify(yan.kit).includes('legacy_handler') && !JSON.stringify(wan.kit).includes('legacy_handler'), '不得殘留包裝');
  checks++; console.log('OK 艷羅／萬蒼已是真 Kit');

  const tfUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(tf);
    base.id = id; base.battleId = id; base.name = '龍錄天鋒';
    base.maxHp = hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = {};
    base.soulMark = tf.soulMark;
    return base;
  };
  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    // 艷羅：第五技能PP差——自帶第五技能（PP 10）對手無第五技能→diff=10→先制+10；隨機附加10種池中6種上限
    const self = tfUnit('S', 20000, [structuredClone(yan), structuredClone(wan), attack]); // 萬蒼為第五技能——PP差基準
    const opp = h.unit('E', 100000, [attack, h.wait()], { speed: 300 });
    const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
    const oppStatuses = Object.keys(r[0].state[(side === 'p1' ? 'p2' : 'p1') + 'RegistryState'] || {}).length;
    const oppMarkList = (r[0].logs.join('\n').match(/陷入了/g) || []).length;
    assert.ok(oppMarkList >= 1, side + ' 艷羅隨機附加已觸發（' + oppMarkList + ' 種）');
    checks++;
  }
  console.log('OK 艷羅隨機附加 雙側通過');

  // 萬蒼：自身能力下降時吸取（每級60；對手提升時×2）＋反轉對手提升＋解除自身下降
  {
    const self = tfUnit('S2', 20000, [structuredClone(wan), attack]);
    self.statStages = { atk: -2, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    const opp = h.unit('E2', 100000, [h.wait(), h.wait()]);
    opp.statStages = { atk: 1, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
    const r = await h.play('p1', { self, opp, turns: () => [0, 0] }, 1);
    const oppLoss = 100000 - r[0].opp.currentHp;
    assert.ok(oppLoss >= 120, '萬蒼每級下降吸取60（實損 ' + oppLoss + ' ≥120）');
    checks++;
    // 解除自身能力下降成功（atk -2 → 0）＋反轉/失敗消除對手提升（atk 1 → ≤0）
    const selfAtk = (r[0].self.statStages || {}).atk ?? 0;
    const oppAtk = (r[0].opp.statStages || {}).atk ?? 0;
    assert.ok(selfAtk >= -1, '解除自身下降（self atk=' + selfAtk + '）');
    checks++;
    assert.ok(oppAtk <= 0, '對手提升已反轉或消除（opp atk=' + oppAtk + '）');
    checks++;
  }
  console.log('OK 萬蒼吸取＋反轉');

  console.log('arena_13 三技：' + checks + ' 項通過');
} finally { await h.close(); }