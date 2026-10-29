// 發布前複核：只驗明確的PP分流與絕對HP門檻，不授予arena_12整份遷移完成。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';
const h = await createHarness();
let checks = 0;
try {
  const { MIGRATED_ARENA12_WUWEI_SOUL_KIT: soul, MIGRATED_ARENA12_SKILL_KITS: skills } =
    await h.server.ssrLoadModule('/src/data/migratedArena12SkillKits.ts');
  const nonzero = soul.kit.find((e: any) => e.customText.startsWith('以非 0 PP'));
  const free = soul.kit.find((e: any) => e.customText === '使用技能不受 PP 限制');
  const finish = skills.find((s: any) => s.name === '無相諦').kit.find((e: any) => e.customText.includes('不足 300'));
  const { kitEntryIssue } = await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
  for (const e of [free, nonzero, finish]) assert.equal(kitEntryIssue(e), null, e.customText);
  // 同時核對正式載入的封裝；來源檔測試通過不能代表產品已套用。
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const loaded = DEFAULT_ELVES.find((e: any) => String(e.id) === 'arena_12');
  assert.ok(loaded, '正式資料有arena_12');
  const loadedSoul = loaded.soulMark.kit ?? loaded.kit;
  assert.deepEqual(loadedSoul.find((e: any) => e.customText === nonzero.customText), nonzero);
  assert.deepEqual(h.find('arena_12', '無相諦').kit.find((e: any) => e.customText === finish.customText), finish);
  for (const side of ['p1', 'p2'] as const) {
    for (const pp of [9, 4, 0]) {
      const s = { ...h.wait(), pp, maxPp: 9 };
      const actor = h.unit('S', 10000, [s], { extra: { effects: [{ id: '中毒', name: '中毒', duration: 4 }], battleStatuses: { 中毒: 4 },
        soulMark: { name: soul.name, description: soul.description, effectMode: 'kit', kit: structuredClone([free, nonzero]) } } });
      const [r] = await h.play(side, { self: actor, opp: h.unit('E', 10000, [h.wait()]) });
      assert.equal(h.statuses(r.self).includes('中毒'), pp === 0, `${side} 施放前PP=${pp}：非0才解除異常`);
      const state = r.state[side + 'RegistryState'] || {};
      const immune = Object.entries(state).some(([key, value]) => /immun/i.test(key) && Number(value) > 0) ||
        (r.state[side + 'Timers'] || []).some((t: any) => /免疫/.test(t.name));
      assert.equal(immune, pp > 0, `${side} 施放前PP=${pp}：非0才取得下次免疫`);
      checks++;
    }
    for (const hp of [299, 300, 500]) {
      const sk = { ...h.wait(), name: '絕對門檻測試', effectMode: 'kit', kit: [structuredClone(finish)] };
      const [r] = await h.play(side, { self: h.unit('S', 10000, [sk]), opp: h.unit('E', hp, [h.wait()], { maxHp: 10000 }) });
      assert.equal(r.opp.currentHp, hp < 300 ? 0 : hp, `${side} HP=${hp}：門檻300點不能以30%替代`);
      checks++;
    }
  }
  console.log(`arena_12明確門檻 ${checks}項通過；其他條款仍須獨立驗收`);
} finally { await h.close(); }
