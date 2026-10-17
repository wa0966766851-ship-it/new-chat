// arena_13 龍錄天鋒 魂印（出戰次數序列）真 Kit 拆解驗收（DSH 20261017 第九批）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const tf = DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_13');
  assert.ok(tf, 'arena_13 精靈存在（deferred 載入）');
  assert.equal(tf.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(tf.soulMark?.kit?.length >= 7, '魂印 Kit 條目齊全（7 條款；六段內建於 entrance_effect_stage）');
  assert.ok(!JSON.stringify(tf.soulMark.kit).includes('legacy_handler'), '不得殘留包裝');
  checks++; console.log('OK arena_13 魂印已是真 Kit');

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
  const critSkill = h.kitSkill('必暴', [{ op: 'crit_uses', p: { uses: 1, scope: 'elf' } }]);

  for (const side of ['p1', 'p2'] as const) {
    // 場景一：首次登場→段①（受到技能傷害上限25% maxHp）——對手大攻不超過 ¼
    const self = tfUnit('S', 10000, [h.wait(), attack]);
    const opp = h.unit('E', 100000, [h.kitSkill('重砲', [{ op: 'dmg', p: { flat: 9000, type: '技能', elem: '普通' } }]), h.wait()], { speed: 300 });
    const r = await h.play(side, { self, opp, turns: (_e, t) => [t === 1 ? 1 : 0, 0] }, 1);
    const selfLoss = 10000 - r[0].self.currentHp;
    assert.ok(selfLoss <= 2500 + 60, side + ' 段①傷害上限25%（實損 ' + selfLoss + ' ≤ ~2500）');
    checks++;
    assert.equal(r[0].state[side + 'RegistryState'].activeEntranceStage, 1, side + ' 段數=1');
    checks++;
  }
  console.log('OK 段①傷害上限25% 雙側通過');

  // 場景二：血≤½ 回合開始重觸發（不增出戰次數）→出戰1次仍觸發段1~1（觸發計數獨立累加）
  {
    const self = tfUnit('S2', 10000, [h.wait(), attack]);
    self.currentHp = 4000; // ≤½ → 回合開始重觸發
    const opp = h.unit('E2', 200000, [h.wait(), h.wait()]);
    const r = await h.play('p1', { self, opp, turns: () => [1, 1] }, 1);
    assert.ok(r[0].state.p1RegistryState.entranceStageTriggered >= 2, '重觸發計數累加（' + r[0].state.p1RegistryState.entranceStageTriggered + '）');
    checks++;
    const hist = r[0].state.p1RegistryState.teamEntranceHistory || {};
    assert.ok(hist['S2'] === undefined || Number(hist['S2']) <= 2, '重觸發不虛增出戰次數');
    checks++;
  }
  console.log('OK 血≤½ 重觸發（段1~出戰次數，觸發計數獨立）');

  console.log('arena_13 魂印：' + checks + ' 項通過');
} finally { await h.close(); }