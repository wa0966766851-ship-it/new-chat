// 龍之治癒（arena_16）四龍本體免疫（2026-11-15 依作者規格補實作）：
// 金龍免疫異常（成功時消除對手回合類效果）、玄龍免疫固定與百分比傷害（成功時下 3 回合固傷／百分比 +50%）、
// 赤龍抵擋並累計攻擊傷害、蒼龍免疫能力下降。另驗證「免疫傷害成功」事件會送到可編輯條款（damage_immune）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { getStatuses } = await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { eventTriggers } = await h.server.ssrLoadModule('/src/blocks/runtime.ts');
  const { EffectTiming } = await h.server.ssrLoadModule('/src/effects/types.ts');
  assert.deepEqual(eventTriggers({} as any, EffectTiming.DAMAGE_IMMUNIZED, {}), ['damage_immune'], '免疫傷害成功事件接到條款');
  const elf = DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_16');
  assert.ok(elf, 'arena_16');
  for (const k of ['【金龍】', '【玄龍】', '【赤龍】', '【蒼龍】', '【真龍・治癒】', '龍系技能傷害']) assert.ok(elf.soulMark.description.includes(k), `魂印說明含 ${k}`);
  const mk = () => JSON.parse(JSON.stringify({ ...elf, battleId: 'D', id: 'D', currentHp: elf.maxHp }));
  const para = h.kitSkill('麻痺術', [{ op: 'status', p: { side: 'opp', status: '麻痺', turns: 2, chance: 100 } }]);
  const fixed = h.kitSkill('固傷', [{ op: 'dmg', p: { flat: 5000, type: '固定' } }]);
  const drop = h.kitSkill('降攻', [{ op: 'stat', p: { side: 'opp', stats: ['攻擊'], v: -1 } }]);
  const atk = { ...h.wait(), name: '打', category: '物理', power: 150, isSureHit: true };
  for (const side of ['p1', 'p2'] as const) {
    // 金龍：第 1 技能喚醒後免疫異常
    let r = await h.play(side, { self: mk(), opp: h.unit('E', 200000, [para, h.wait()], { speed: 50 }), turns: (_e: any, t: number) => [0, t === 1 ? 1 : 0] }, 2);
    assert.ok(!getStatuses(r[1].self)['麻痺'], `${side} 金龍：免疫麻痺`);
    assert.ok(r[1].logs.some((l: string) => l.includes('免疫了【麻痺】')) && r[1].logs.some((l: string) => l.includes('【金龍】：免疫成功')), `${side} 金龍：免疫並觸發追加\n${r[1].logs.slice(-8).join('\n')}`); checks++;
    // 玄龍：第 2 技能喚醒後免疫 5000 固定傷害（體力遠低於 5000）
    r = await h.play(side, { self: mk(), opp: h.unit('E', 200000, [fixed, h.wait()], { speed: 50 }), turns: (_e: any, t: number) => [t === 1 ? 1 : 4, t === 1 ? 1 : 0] }, 2);
    assert.ok(r[1].self.currentHp > 0 && r[1].self.currentHp === r[1].self.maxHp, `${side} 玄龍：免疫固定傷害`);
    assert.ok(r[1].logs.some((l: string) => l.includes('【玄龍】：免疫成功')), `${side} 玄龍：成功免疫後追加`);
    assert.ok((r[1].state[`${side}Timers`] || []).some((t: any) => /固定|百分比/.test(JSON.stringify(t))), `${side} 玄龍：下 3 回合增傷計時器`); checks++;
    // 赤龍：第 3 技能喚醒後抵擋攻擊並累計
    r = await h.play(side, { self: mk(), opp: h.unit('E', 200000, [atk, h.wait()], { speed: 50 }), turns: (_e: any, t: number) => [2, t === 1 ? 1 : 0] }, 2);
    assert.ok(Number(r[1].state[`${side}RegistryState`]?.['damageStore:arena.red']) > 0, `${side} 赤龍：累計抵擋量`); checks++;
    // 蒼龍：第 4 技能喚醒後免疫能力下降並吸取
    r = await h.play(side, { self: mk(), opp: h.unit('E', 200000, [drop, h.wait()], { speed: 50 }), turns: (_e: any, t: number) => [t === 1 ? 3 : 0, t === 1 ? 1 : 0] }, 2);
    assert.ok(!(r[1].self.statStages?.atk < 0) && r[1].logs.some((l: string) => l.includes('【蒼龍】')), `${side} 蒼龍：免疫能力下降並吸取`); checks++;
  }
  console.log(`龍之治癒四龍免疫：${checks} 項通過（P1／P2）`);
} finally { await h.close(); }
process.exit(0);
