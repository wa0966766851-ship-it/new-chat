// 5019 奧丁 PP 修正：ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ（世界樹）＝0/0（不受PP限制、不消耗PP）；ᚱᚨᚷᚾᚨᚱᛟᚲ＝1/1（一般 PP）。
import assert from 'node:assert/strict';
import { createHarness } from './helpers/migrationHarness';

const TREE = 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ', RAG = 'ᚱᚨᚷᚾᚨᚱᛟᚲ';
const h = await createHarness();
let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
try {
  const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { isZeroPpExempt, isPpCostFree } = await h.server.ssrLoadModule('/src/battle/ppExemptions.ts');
  const { applySavedSkillCorrections } = await h.server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
  const { skillSelectable } = await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const odin = DEFAULT_ELVES.find((e: any) => String(e.id) === '5019');

  await check('內建定義：skills 與 skillPool 的世界樹皆 0/0 且 ppUnlimited；ᚱᚨᚷᚾᚨᚱᛟᚲ 皆 1/1', async () => {
    for (const list of [odin.skills, odin.skillPool]) {
      const tree = list.find((s: any) => s.name === TREE), rag = list.find((s: any) => s.name === RAG);
      assert.equal(tree.pp, 0); assert.equal(tree.maxPp ?? tree.pp, 0); assert.equal(tree.ppUnlimited, true);
      assert.equal(rag.pp, 1); assert.equal(rag.maxPp ?? rag.pp, 1); assert.ok(!rag.ppUnlimited);
    }
    assert.deepEqual(odin.skills.map((s: any) => s.pp), [20, 0, 5, 5, 1], '其餘技能 PP 不變');
  });

  await check('選招／扣PP：世界樹 PP 0 仍可選且不消耗；ᚱᚨᚷᚾᚨᚱᛟᚲ 用掉 1 點後（PP 0）不可選', async () => {
    const tree = { ...odin.skills.find((s: any) => s.name === TREE), pp: 0 };
    const rag1 = { ...odin.skills.find((s: any) => s.name === RAG), pp: 1 }, rag0 = { ...rag1, pp: 0 };
    const elf = { ...odin, name: '眾神之父·奧丁', skills: [tree, rag1] };
    assert.equal(isZeroPpExempt(elf, tree), true); assert.equal(isPpCostFree(elf, tree), true);
    assert.equal(isZeroPpExempt(elf, rag0), false); assert.equal(isPpCostFree(elf, rag0), false);
    assert.equal(isPpCostFree(elf, rag1), false, '一般 PP：用掉 1 點');
    const st = (e: any) => ({ p1: e, p2: h.unit('E', 1000, [h.wait()]), p1Timers: [], p2Timers: [] }) as any;
    assert.equal(skillSelectable(st({ ...elf, skills: [tree, rag0] }), 'p1', { ...elf, skills: [tree, rag0] }, 0), true, 'AI 選招：世界樹 0PP 可選');
    assert.equal(skillSelectable(st({ ...elf, skills: [tree, rag0] }), 'p1', { ...elf, skills: [tree, rag0] }, 1), false, 'AI 選招：ᚱᚨᚷᚾᚨᚱᛟᚲ 0PP 不可選');
    assert.equal(skillSelectable(st({ ...elf, skills: [tree, rag1] }), 'p1', { ...elf, skills: [tree, rag1] }, 1), true, 'ᚱᚨᚷᚾᚨᚱᛟᚲ 1PP 可選');
  });

  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 正式戰鬥：世界樹連用兩回合 PP 恆 0/0 且每次生效；ᚱᚨᚷᚾᚨᚱᛟᚲ 用一次後 PP 1→0`, async () => {
      const base = { ...odin, battleId: 'odin1', skills: odin.skills.map((s: any) => ({ ...s })) };
      const foe = h.unit('E', 900000, [h.wait(), h.wait()], { maxHp: 900000, speed: 10 });
      const hist = await h.play(side, { self: base, opp: foe, turns: (_e: any, t: number) => [t === 3 ? 4 : 1, 0] } as any, 3);
      for (const r of hist.slice(0, 2)) {
        const tree = r.self.skills[1];
        assert.equal(tree.pp, 0, '世界樹使用後仍為 0'); assert.equal(tree.ppUnlimited, true);
      }
      assert.ok((hist[1].self.statStages.atk || 0) >= 2, '連用兩次都生效（全屬性 +1 疊加）');
      assert.equal(hist[2].self.skills[4].pp, 0, 'ᚱᚨᚷᚾᚨᚱᛟᚲ 1→0');
    });
  }

  await check('存檔遷移：舊誤植值（世界樹 5/5、ᚱᚨᚷᚾᚨᚱᛟᚲ 0/0）修正；自訂過的 PP 不動；其他精靈不動', async () => {
    const old = (pp: number, name: string) => ({ ...odin.skills.find((s: any) => s.name === name), pp, maxPp: pp, ppUnlimited: undefined });
    const saved = { ...odin, skills: [odin.skills[0], old(5, TREE), odin.skills[2], odin.skills[3], old(0, RAG)], skillPool: [old(5, TREE), old(0, RAG)] };
    const fixed = applySavedSkillCorrections(saved, DEFAULT_ELVES);
    for (const list of [fixed.skills, fixed.skillPool]) {
      const tree = list.find((s: any) => s.name === TREE), rag = list.find((s: any) => s.name === RAG);
      assert.deepEqual([tree.pp, tree.maxPp, tree.ppUnlimited], [0, 0, true]); assert.deepEqual([rag.pp, rag.maxPp], [1, 1]);
    }
    const custom = { ...odin, skills: [odin.skills[0], old(3, TREE), odin.skills[2], odin.skills[3], old(2, RAG)], skillPool: [] };
    const kept = applySavedSkillCorrections(custom, DEFAULT_ELVES);
    assert.equal(kept.skills[1].pp, 3); assert.equal(kept.skills[4].pp, 2);
    const other = { ...odin, id: '5018' };
    assert.equal(applySavedSkillCorrections(other, DEFAULT_ELVES), other);
  });
  console.log(`${count} checks`);
} finally { await h.close(); }
