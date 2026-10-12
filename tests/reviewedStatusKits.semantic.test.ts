import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
let checks = 0;
try {
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { REVIEWED_SKILL_KITS, applyReviewedSkillKits } = await server.ssrLoadModule('/src/data/reviewedSkillKits.ts');
  const { runSkillBlocks } = await server.ssrLoadModule('/src/blocks/registry.ts');
  const { resetPrd } = await server.ssrLoadModule('/src/utils/prd.ts');
  const rows = REVIEWED_SKILL_KITS.filter((r: any) => !r.elfIds.includes('300'));
  assert.equal(rows.length, 6);
  for (const row of rows) {
    const elf = DEFAULT_ELVES.find((e: any) => e.id === row.elfIds[0]);
    const skill = [...elf.skills, ...(elf.skillPool || [])].find((s: any) => s.name === row.name && s.description === row.description);
    assert.ok(skill, `${row.name} 保留現有技能庫原文`);
    assert.equal(skill.effectMode, 'kit');
    assert.deepEqual(skill.kit, row.kit);
    const changed = applyReviewedSkillKits({ ...elf, skills: [{ ...skill, kit: undefined, effectMode: undefined, description: '已修改原文' }] });
    assert.equal(changed.skills[0].kit, undefined);
    const status = row.name === '雙重暗影' ? '害怕' : row.name.includes('海嘯') ? '凍傷' : row.name.includes('攻碎') ? '中毒' : '燒傷';
    const chance = row.description.includes('100%') ? 100 : 10;
    for (const side of ['p1', 'p2']) for (const sealed of [false, true]) for (const proc of [false, true]) {
      const opp = side === 'p1' ? 'p2' : 'p1';
      const target: any = { id: 'target', statStages: { def: 2 } };
      const self: any = { id: 'self', skills: [skill], isAdditionalInvalid: sealed };
      const calls: any[] = [];
      const ctx: any = { actor: side, targetSide: opp, self, target, skill, activeP1: side === 'p1' ? self : target, activeP2: side === 'p2' ? self : target,
        getPlayerState: () => 0, addLog: () => {},
        applyStatChange: (s: string, changes: any) => { assert.equal(s, opp); for (const [key, value] of Object.entries(changes)) target.statStages[key] = (target.statStages[key] || 0) + Number(value); },
        applyStatusWithImmunityCheck: (s: string, name: string, turns: number) => calls.push([s, name, turns]),
        updateElf: (s: string, patch: any) => { assert.equal(s, opp); Object.assign(target, patch); } };
      resetPrd(() => proc ? 0 : 0.999999);
      runSkillBlocks(ctx, 'use', true);
      const useExpected = !sealed && row.name === '雙重暗影' ? [[opp, '害怕', 3]] : [];
      assert.deepEqual(calls, useExpected, '命中前不得執行命中後異常');
      assert.equal(target.statStages.def, !sealed && row.name === '雙重暗影' ? 1 : 2, '降防只處理指定對手一次');
      runSkillBlocks(ctx, 'on_invalid', true);
      assert.deepEqual(calls, useExpected, '技能無效不得補發命中異常');
      runSkillBlocks(ctx, 'after_hit', true);
      const expected = !sealed && (chance === 100 || proc) ? [[opp, status, 3]] : [];
      assert.deepEqual(calls, expected, '雙側／命中節點／機率成功失敗／附加失效精確請求一次');
      checks++;
    }
    // 模擬未命中流程：只使用與無效節點，不派發 after_hit。
    if (row.name !== '雙重暗影') assert.equal(skill.kit[0].node, 'on_hit');
    checks++;
  }
  console.log(`第二批六技能：正式技能庫及正式積木執行入口 ${checks} 情境通過；不冒充完整戰鬥／免疫／期限驗收。`);
} finally { await server.close(); }
