// 詩章機制：真實引擎驗證（不經 React／DOM）。
//
// 2026-10-30：這裡用「實際跑戰鬥」取代「只讀程式碼」。
// 之前三輪都只讀原始碼就宣稱修好，結果：
//   - 第一次：手寫疊加 → 層數永遠 1、上限暴漲
//   - 第二次：改走 kit → 但 5021 的 handler 對應還在，effectRoute 回傳 registry，
//              kit 永遠不執行，詩章直接消失
// 現在用真實 5021 + 真實 kit 目錄跑引擎，直接驗證行為。
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const cat = await server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');
const { getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const quiet = console.error;
console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) return; quiet(...a); };

const build = (battleId: string, hp = 8000) => {
  const base = (DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5021');
  const withKit = cat.applyReviewedSkillKits ? cat.applyReviewedSkillKits(structuredClone(base)) : structuredClone(base);
  return { ...withKit, battleId, currentHp: hp, maxHp: hp,
    calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed: 100 },
    statStages: { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 } };
};
const plain = (id: string, name: string, hp = 5000) => ({
  id, name, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed: 100 },
  statStages: { atk: 0, spatk: 0, def: 0, spdef: 0, speed: 0, accuracy: 0 },
  skills: [{ name: '等', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }],
  skillPool: [], soulMark: { name: '無', description: '' },
});
const battle = (p1: any[], p2: any[]) => createBattleEngine({
  initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].battleId, p2StarterId: p2[0].battleId,
  battleMode: 'PVE', isFast: () => true, onNode: () => {},
});
const poem = (st: any, side: 'p1' | 'p2', id: string) => {
  const all = [...(st[`${side}Marks`] || []), ...((st[side]?.marks) || [])];
  return all.find((m: any) => m.id === 'poem_chapter' && (!m.ownerBattleId || m.ownerBattleId === id));
};
const cnt = (m: any) => (m?.effects?.poemHpSnapshots || []).length;
const step = async (e: any) => {
  const st = e.getState();
  if (st.phase === 'p1_select' || st.phase === 'p2_select') {
    e.onSkillSelect('p1', st.p1.skills[0]); e.onSkillSelect('p2', st.p2.skills[0]);
    await e.idle();
  }
};

await check('5021 不再有手寫魂印 handler（否則 effectRoute 會回傳 registry，kit 永不執行）', async () => {
  const S = getSoulMarkRegistry();
  assert.equal(S['5021'], undefined, '5021 不可有 handler 對應');
  assert.equal(S['治癒.龍魂再臨 次元龍'], undefined, '名稱對應也不可有');
});

await check('真實 5021 的 soulMark 帶 17 條 kit 且 effectMode=kit', async () => {
  const d = (DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5021');
  assert.equal(d.soulMark.effectMode, 'kit');
  assert.equal(d.soulMark.kit.length, 17);
});

await check('戰鬥開始後詩章就存在（不是 0）', async () => {
  const e = battle([build('D1')], [plain('X', '對手')]);
  e.mount(); e.start(); await e.idle();
  const c = cnt(poem(e.getState(), 'p1', 'D1'));
  assert.ok(c >= 1, `開局至少 1 篇，實際 ${c}`);
});

await check('詩章逐回合疊加（不是停在 1）', async () => {
  const e = battle([build('D1')], [plain('X', '對手')]);
  e.mount(); e.start(); await e.idle();
  const lens: number[] = [cnt(poem(e.getState(), 'p1', 'D1'))];
  for (let i = 0; i < 4; i++) { await step(e); lens.push(cnt(poem(e.getState(), 'p1', 'D1'))); }
  console.log(`   各回合篇數: ${lens.join(' → ')}`);
  assert.ok(lens[lens.length - 1] > lens[0], `必須疊加，實際 ${lens.join(',')}`);
});

await check('體力上限不暴漲（增量不超過 起始 × 篇數）', async () => {
  const e = battle([build('D2')], [plain('X', '對手')]);
  e.mount(); e.start(); await e.idle();
  const hp0 = e.getState().p1.maxHp;
  for (let i = 0; i < 4; i++) await step(e);
  const st = e.getState(); const c = cnt(poem(st, 'p1', 'D2')); const hp1 = st.p1.maxHp;
  console.log(`   上限 ${hp0} → ${hp1}（${c} 篇，上限容許 ${hp0 * (c + 1)}）`);
  assert.ok(hp1 <= hp0 * (c + 1), `上限 ${hp1} 相對 ${hp0} 與 ${c} 篇不合理（暴漲）`);
});

await check('雙方次元龍都累積詩章（不分敵我）', async () => {
  const e = battle([build('D3')], [build('D4')]);
  e.mount(); e.start(); await e.idle();
  const st = e.getState();
  const a = cnt(poem(st, 'p1', 'D3')), b = cnt(poem(st, 'p2', 'D4'));
  console.log(`   我方 ${a} / 對方 ${b}`);
  assert.ok(a >= 1, '我方要有詩章');
  assert.ok(b >= 1, '對方也要有詩章');
});

await server.close();
console.log(`\n詩章真實引擎驗證：${count} 項通過`);
