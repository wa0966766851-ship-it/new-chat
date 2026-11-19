// 5019 奧丁 PP：ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ（世界樹）＝0/0；ᚱᚨᚷᚾᚨᚱᛟᚲ＝1/1（一般 PP）。
// 2026-11-16 使用者規則：世界樹 0PP 本身不可選，須先選其他技能激活 ᚱᚷ（選擇技能時不受PP值限制）後才可選。
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

  await check('內建定義：skills 與 skillPool 的世界樹皆 0/0 且不帶天生PP豁免；ᚱᚨᚷᚾᚨᚱᛟᚲ 皆 1/1', async () => {
    for (const list of [odin.skills, odin.skillPool]) {
      const tree = list.find((s: any) => s.name === TREE), rag = list.find((s: any) => s.name === RAG);
      assert.equal(tree.pp, 0); assert.equal(tree.maxPp ?? tree.pp, 0); assert.ok(!tree.ppUnlimited, '世界樹不得天生不受PP限制');
      assert.equal(rag.pp, 1); assert.equal(rag.maxPp ?? rag.pp, 1); assert.ok(!rag.ppUnlimited);
    }
    assert.deepEqual(odin.skills.map((s: any) => s.pp), [20, 0, 5, 5, 1], '其餘技能 PP 不變');
  });

  await check('選招：世界樹 PP 0 未激活 ᚱᚷ 時不可選；ᚱᚷ 激活後可選；ᚱᚨᚷᚾᚨᚱᛟᚲ 用掉 1 點後（PP 0）不可選', async () => {
    const tree = { ...odin.skills.find((s: any) => s.name === TREE), pp: 0 };
    const rag1 = { ...odin.skills.find((s: any) => s.name === RAG), pp: 1 }, rag0 = { ...rag1, pp: 0 };
    const elf = { ...odin, name: '眾神之父·奧丁', skills: [tree, rag1] };
    assert.equal(isZeroPpExempt(elf, tree), false, '未激活 ᚱᚷ：世界樹 0PP 不可選');
    const rg = { ...rag1, portableSkillMark: { symbol: 'ᚱᚷ', description: 'x', capabilities: { ppUnrestricted: true }, rules: [] }, skillRune: 'ᚱᚷ' };
    assert.equal(isZeroPpExempt({ ...elf, skills: [tree, { ...rg, isRuneActive: false }] }, tree), false, 'ᚱᚷ 未激活仍不可選');
    assert.equal(isZeroPpExempt({ ...elf, skills: [tree, { ...rg, isRuneActive: true }] }, tree), true, 'ᚱᚷ 激活後世界樹可選');
    assert.equal(isZeroPpExempt(elf, rag0), false); assert.equal(isPpCostFree(elf, rag0), false);
    assert.equal(isPpCostFree(elf, rag1), false, '一般 PP：用掉 1 點');
    const st = (e: any) => ({ p1: e, p2: h.unit('E', 1000, [h.wait()]), p1Timers: [], p2Timers: [] }) as any;
    assert.equal(skillSelectable(st({ ...elf, skills: [tree, rag0] }), 'p1', { ...elf, skills: [tree, rag0] }, 0), false, 'AI 選招：世界樹 0PP 未激活不可選');
    assert.equal(skillSelectable(st({ ...elf, skills: [tree, rag0] }), 'p1', { ...elf, skills: [tree, rag0] }, 1), false, 'AI 選招：ᚱᚨᚷᚾᚨᚱᛟᚲ 0PP 不可選');
    assert.equal(skillSelectable(st({ ...elf, skills: [tree, rag1] }), 'p1', { ...elf, skills: [tree, rag1] }, 1), true, 'ᚱᚨᚷᚾᚨᚱᛟᚲ 1PP 可選');
  });

  for (const side of ['p1', 'p2'] as const) {
    await check(`${side} 正式戰鬥：第1回合世界樹不可選（選了也不成立）；選 ᚺᚢᚷᛁᚾ 激活 ᚱᚷ 後世界樹 0PP 可連用且 PP 恆 0`, async () => {
      const base = { ...odin, battleId: 'odin1', skills: odin.skills.map((s: any) => ({ ...s })) };
      const foe = h.unit('E', 900000, [h.wait(), h.wait()], { maxHp: 900000, speed: 10 });
      const bench = [h.unit('B', 5000, [h.wait()])];
      const hist = await h.play(side, { self: base, opp: foe, selfBench: bench, turns: (_e: any, t: number) => [t === 1 ? 1 : t === 2 ? 2 : t === 5 ? 4 : 1, 0] } as any, 5);
      assert.ok(!hist[0].logs.some((l: string) => l.includes('使用了【ᛉᛖᛚᛃᚨ')), '未激活 ᚱᚷ 時世界樹不能出招');
      assert.ok(hist[0].logs.some((l: string) => l.includes('PP 已耗盡，無法選擇此技能')), '選不了時寫出原因');
      assert.equal(hist[1].self.skills[2].isRuneActive, true, '選 ᚺᚢᚷᛁᚾ 激活 ᚱᚷ');
      for (const r of hist.slice(2, 4)) { assert.equal(r.self.skills[1].pp, 0, '世界樹使用後仍為 0'); assert.ok(!r.self.skills[1].ppUnlimited); }
      assert.equal(hist[3].logs.filter((l: string) => l.includes('使用了【ᛉᛖᛚᛃᚨ')).length, 2, 'ᚱᚷ 激活後世界樹連用兩次');
      assert.equal(hist[4].self.skills[4].pp, 0, 'ᚱᚨᚷᚾᚨᚱᛟᚲ 1→0');
    });
  }

  await check('存檔遷移：舊誤植值（世界樹 5/5、ᚱᚨᚷᚾᚨᚱᛟᚲ 0/0）修正；自訂過的 PP 不動；其他精靈不動', async () => {
    const old = (pp: number, name: string) => ({ ...odin.skills.find((s: any) => s.name === name), pp, maxPp: pp, ppUnlimited: undefined });
    const saved = { ...odin, skills: [odin.skills[0], old(5, TREE), odin.skills[2], odin.skills[3], old(0, RAG)], skillPool: [old(5, TREE), old(0, RAG)] };
    const fixed = applySavedSkillCorrections(saved, DEFAULT_ELVES);
    for (const list of [fixed.skills, fixed.skillPool]) {
      const tree = list.find((s: any) => s.name === TREE), rag = list.find((s: any) => s.name === RAG);
      assert.deepEqual([tree.pp, tree.maxPp, tree.ppUnlimited], [0, 0, undefined]); assert.deepEqual([rag.pp, rag.maxPp], [1, 1]);
    }
    const custom = { ...odin, skills: [odin.skills[0], old(3, TREE), odin.skills[2], odin.skills[3], old(2, RAG)], skillPool: [] };
    const kept = applySavedSkillCorrections(custom, DEFAULT_ELVES);
    assert.equal(kept.skills[1].pp, 3); assert.equal(kept.skills[4].pp, 2);
    const stale = { ...odin, skills: odin.skills.map((s: any) => s.name === TREE ? { ...s, ppUnlimited: true } : s), skillPool: [] };
    assert.ok(!applySavedSkillCorrections(stale, DEFAULT_ELVES).skills.find((s: any) => s.name === TREE).ppUnlimited, '舊存檔世界樹的天生PP豁免移除');
    const other = { ...odin, id: '5018' };
    assert.equal(applySavedSkillCorrections(other, DEFAULT_ELVES), other);
  });
  console.log(`${count} checks`);
} finally { await h.close(); }
