// 次元龍完整實跑驗證（2026-10-30）
// 1. 印記能不能被 UI 渲染成「詩 N篇」
// 2. 逐回合疊加
// 3. 龍魂再臨免死（致死傷害保留 1 體力）
// 4. 體力上限不暴漲
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const cat = await server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');
const { buildEffectViewModels } = await server.ssrLoadModule('/src/battle/effectViewModel.ts');

await DEFAULT_ELVES && (await server.ssrLoadModule('/src/data/defaultElves.ts')).loadImportedElves();

let pass = 0;
const ok = (n: string, f: () => void) => { f(); pass++; console.log('✓ ' + n); };
const quiet = console.error; console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) return; quiet(...a); };

const dragon = (bid: string, hp = 3000) => {
  const base = (DEFAULT_ELVES as any[]).find(e => String(e.id) === '5021');
  const k = cat.applyReviewedSkillKits ? cat.applyReviewedSkillKits(structuredClone(base)) : structuredClone(base);
  return { ...k, battleId: bid, currentHp: hp, maxHp: hp,
    calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed: 100 },
    statStages: { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 } };
};
const foe = (id: string, hp = 12000) => ({
  id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  calculatedStats: { hp, atk: 900, def: 100, spatk: 900, spdef: 100, speed: 200 },
  statStages: { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 },
  skills: [{ name: '重擊', category: '物理', type: '普通', power: 400, pp: 99, maxPp: 99, isSureHit: true, description: '' }],
  skillPool: [], soulMark: { name: '無', description: '' },
});
const start = (p1: any[], p2: any[]) => {
  const e = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].battleId, p2StarterId: p2[0].battleId, battleMode: 'PVE', isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  return e;
};
const marksOf = (st: any, side: 'p1' | 'p2', bid: string) => {
  const all = [...(st[`${side}Marks`] || []), ...((st[side]?.marks) || [])];
  return all.filter((m: any) => m.id === 'poem_chapter' && (!m.ownerBattleId || m.ownerBattleId === bid));
};
const poemCount = (st: any, side: 'p1' | 'p2', bid: string) => {
  const m = marksOf(st, side, bid)[0];
  return (m?.effects?.poemHpSnapshots || []).length;
};

// 1. 印記能渲染
await (async () => {
  const e = start([dragon('D1')], [foe('X')]);
  await e.idle();
  const st = e.getState();
  const m = marksOf(st, 'p1', 'D1')[0];
  ok('戰鬥開始就有詩章印記', () => assert.ok(m, '必須存在 poem_chapter'));
  const views = buildEffectViewModels([m], [], 'D1');
  ok('詩章能被渲染成「詩 N篇」', () => {
    assert.equal(views.length, 1, '必須產生 view');
    assert.equal(views[0].label, '詩章');
    assert.equal(views[0].shortLabel, '詩');
    assert.equal(views[0].unit, '篇');
    assert.ok(Number(views[0].value) >= 1, '層數至少 1，實際 ' + views[0].value);
  });
})();

// 2. 逐回合疊加 + 4. 上限不暴漲
await (async () => {
  const e = start([dragon('D2')], [foe('Y')]);
  await e.idle();
  const hp0 = e.getState().p1.maxHp;
  const seq: number[] = [poemCount(e.getState(), 'p1', 'D2')];
  for (let i = 0; i < 6; i++) {
    const st = e.getState();
    if (st.phase === 'p1_select' || st.phase === 'p2_select') {
      e.onSkillSelect('p1', st.p1.skills[0]);
      e.onSkillSelect('p2', st.p2.skills[0]);
      await e.idle();
    }
    seq.push(poemCount(e.getState(), 'p1', 'D2'));
  }
  console.log('   詩章篇數序列: ' + seq.join(' → '));
  ok('詩章逐回合疊加', () => assert.ok(seq[seq.length - 1] > seq[0], '必須增加，實際 ' + seq.join(',')));
  const hp1 = e.getState().p1.maxHp;
  const n = poemCount(e.getState(), 'p1', 'D2');
  console.log(`   體力上限: ${hp0} → ${hp1}（${n} 篇）`);
  ok('體力上限不暴漲', () => assert.ok(hp1 <= hp0 * (n + 1), `上限 ${hp1} 相對 ${hp0} 與 ${n} 篇不合理`));
})();

// 3. 龍魂再臨免死
await (async () => {
  const e = start([dragon('D3', 1200)], [foe('Z')]);
  await e.idle();
  let survived = false;
  let log = '';
  for (let round = 0; round < 12; round++) {
    const st: any = e.getState();
    if (st.phase !== 'p1_select' && st.phase !== 'p2_select') break;
    e.onSkillSelect('p1', st.p1.skills[0]);
    e.onSkillSelect('p2', st.p2.skills[0]);
    await e.idle();
    const after: any = e.getState();
    const hp = after.p1.currentHp;
    // 免死：受過致死傷害但仍活著（或觸發旗標）
    const used = !!(after.p1 as any).playerState?.dimensionalFatalResistUsed;
    if (hp > 0 && hp <= 5) { survived = true; log = `第 ${round + 1} 回合保留 ${hp} 體力`; }
    if (hp > 0 && hp < 1200 && (after.p1 as any).battleStatus === 'normal' && used) { survived = true; }
    if (hp <= 0) break;
  }
  console.log('   免死結果: ' + (survived ? log || '觸發' : '未觀察到（可能未受到致死傷害）'));
  ok('龍魂再臨免死可觸發（保留 1 點體力）', () => assert.ok(survived, '12 回合內應觀察到免死保留 1 體力'));
})();

await server.close();
console.log(`\n次元龍實跑驗證：${pass} 項通過`);
