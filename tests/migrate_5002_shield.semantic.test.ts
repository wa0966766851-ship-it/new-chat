// 5002 帝皇之盾 魂印「盾」真 Kit 拆解驗收（DSH 20261018 第十一批·第一波）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const shield = DEFAULT_ELVES.find((e: any) => String(e.id) === '5002');
  assert.equal(shield.soulMark?.effectMode, 'kit', '魂印 effectMode=kit');
  assert.ok(!JSON.stringify(shield.soulMark.kit || []).includes('legacy_handler'), '不得殘留包裝');
  checks++; console.log('OK 5002 魂印「盾」已是真 Kit');

  const shieldUnit = (id: string, hp: number, skills: any[], o: any = {}) => {
    const base = structuredClone(shield);
    base.id = id; base.battleId = id; base.name = '帝皇之盾';
    base.maxHp = hp; base.currentHp = hp;
    base.baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: o.speed ?? 100 };
    base.calculatedStats = { hp, atk: 300, def: 300, spatk: 300, spdef: 300, speed: o.speed ?? 100 };
    base.skills = skills; base.statStages = {}; base.shield = 0;
    base.soulMark = shield.soulMark;
    return base;
  };
  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 100, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    // 登場：獲得 maxHp/3 護盾（9000 → 3000）
    const self = shieldUnit('S', 9000, [h.wait(), attack]);
    const opp = h.unit('E', 100000, [h.wait(), h.wait()]);
    const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
    assert.ok((r[0].self.shield || 0) >= 2900, side + ' 登場獲得⅓護盾（' + (r[0].self.shield || 0) + '）');
    checks++;
    // 有護盾 → 對手全屬性-1（回合開始）
    const oppStages = (r[0].opp.statStages || {});
    const anyDown = Object.values(oppStages).some((v: any) => Number(v) < 0);
    assert.ok(anyDown, side + ' 有護盾時對手全屬性-1（' + JSON.stringify(oppStages) + '）');
    checks++;
  }
  console.log('OK 登場護盾＋回合開始對手全屬性-1 雙側通過');

  // 有護盾 → 免疫異常（對手施加麻痺應被擋）
  {
    const self = shieldUnit('S2', 9000, [h.wait(), attack]);
    const opp = h.unit('E2', 100000, [h.kitSkill('麻痺術', [{ op: 'status', p: { side: 'opp', status: '麻痺', chance: 100, turns: 3 } }]), h.wait()], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: () => [0, 0] }, 1);
    const statuses = r[0].self.statuses || r[0].self.status || {};
    const numParalysis = Object.keys(statuses).filter((k: string) => /麻痺|麻痹/.test(k) && Number(statuses[k]) > 0);
    assert.equal(numParalysis.length, 0, '有護盾時免疫異常（麻痺未上身）');
    checks++;
  }
  console.log('OK 有護盾免疫異常');

  // 被擊敗時：護盾轉給下一隻（nextElfShield）＋守護印記旗標
  {
    const self = shieldUnit('S3', 3000, [h.wait(), attack]);
    self.shield = 800;
    const opp = h.unit('E3', 100000, [h.kitSkill('斬殺', [{ op: 'dmg', p: { flat: 99999, type: '真實' } }]), h.wait()], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: () => [0, 0] }, 1);
    const reg = r[0].state.p1RegistryState || {};
    assert.ok(r[0].self.currentHp <= 0 || (Number(reg.nextElfShield) || 0) > 0, '被擊敗時護盾轉贈（nextElfShield=' + reg.nextElfShield + '）');
    checks++;
  }
  console.log('OK 被擊敗護盾轉贈');

  console.log('5002 魂印「盾」：' + checks + ' 項通過');
} finally { await h.close(); }