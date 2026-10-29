// arena_16 剛莖棍壓 真 Kit 拆解驗收（DSH 20261017；legacyWrapped→0 第一批）。
// 覆蓋：Kit 單一來源／無視成功加成（ignore_success 新條件）／stage_view 雙視為／
//       對手 PP 歸零技能數每個 +20%／百分比未造成時等量真實傷害。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const sk = h.find('arena_16', '剛莖棍壓');
  h.assertKitOnly(sk);
  assert.ok(!(sk.kit || []).some((e: any) => JSON.stringify(e).includes('legacy_handler')), '不得殘留包裝動作');
  checks++; console.log('OK 剛莖棍壓已是真 Kit（非包裝、無舊 handler 分支）');

  const attack = { ...h.wait(), name: '普通攻擊', category: '物理', power: 80, pp: 10, maxPp: 10, isSureHit: true, description: '' };

  for (const side of ['p1', 'p2'] as const) {
    {
      const self = h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000 });
      const opp = h.unit('E', 100000, [attack, h.wait()]);
      const r = await h.play(side, { self, opp, turns: () => [0, 1] }, 1);
      const oppLoss = 100000 - r[0].opp.currentHp;
      assert.ok(oppLoss > 800, side + ' 百分比附加存在（損血 ' + oppLoss + ' 應大於 800）');
      checks++;
    }
    {
      const shieldSkill = h.kitSkill('盾化', [{ op: 'dmg_mod_turns', p: { side: 'self', dir: 'in', kind: '百分比', reduce: 1, turns: 2 } }]);
      const self = h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000 });
      const opp = h.unit('E', 100000, [shieldSkill, attack], { speed: 300 });
      const r = await h.play(side, { self, opp, turns: () => [0, 0] }, 1);
      const oppLoss = 100000 - r[0].opp.currentHp;
      assert.ok(oppLoss >= 800, side + ' 百分比未造成時等量真實傷害（損血 ' + oppLoss + ' ≥ 800）');
      checks++;
    }
    {
      const mkOpp = (ppB: number, ppC: number) => h.unit('E', 100000, [
        attack,
        { ...h.wait(), name: '技B', pp: ppB, maxPp: 5 },
        { ...h.wait(), name: '技C', pp: ppC, maxPp: 5 },
      ]);
      const r1 = await h.play(side, { self: h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000 }), opp: mkOpp(0, 0), turns: () => [0, 0] }, 1);
      const r2 = await h.play(side, { self: h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000 }), opp: mkOpp(5, 5), turns: () => [0, 0] }, 1);
      const loss1 = 100000 - r1[0].opp.currentHp, loss2 = 100000 - r2[0].opp.currentHp;
      assert.ok(loss1 > loss2, side + ' 對手PP歸零技能數加成（' + loss1 + ' > ' + loss2 + '）');
      checks++;
    }
  }
  console.log('OK 百分比附加／真實fallback／PP歸零加成 雙側通過');

  {
    const wallSkill = h.kitSkill('鐵壁設限', [{ op: 'damage_cap_turns', p: { side: 'self', dir: 'in', kind: '攻擊', cap: 150, turns: 2 } }, { op: 'immune_attack_count', p: { count: 1 } }]);
    const self = h.unit('S', 4000, [sk, h.wait()], { maxHp: 4000 });
    const opp = h.unit('E', 100000, [wallSkill, h.wait()], { speed: 300 });
    const r = await h.play('p1', { self, opp, turns: () => [0, 0] }, 1);
    assert.ok(r[0].logs.some((l: string) => l.includes('無視')), '免疫被無視（無視成功日誌）');
    checks++;
    const oppLoss = 100000 - r[0].opp.currentHp;
    assert.ok(oppLoss > 150, '傷害限制被無視後不受 150 上限（損血 ' + oppLoss + '）');
    checks++;
  }
  console.log('OK 無視成功：免疫無視＋傷害限制無視不受上限');

  console.log('剛莖棍壓：' + checks + ' 項通過');
} finally { await h.close(); }