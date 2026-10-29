// 5001 黯魂印 Kit 引擎驗收：受擊害怕（未觸發PP吸取）、未受擊 scarBonus、擊敗附加黯痕。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');

const sobirat = () => structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5001'));
assert.equal(sobirat().soulMark?.effectMode, 'kit', '魂印已切 kit');
assert.ok((sobirat().soulMark?.kit || []).length >= 3, '魂印至少三條款');

const dummy = (id: string, hp: number, atk = 20000): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk, def: 100, spatk: 100, spdef: 100, speed: 50 }, calculatedStats: { hp, atk, def: 2000, spatk: 2000, spdef: 2000, speed: 50 }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + name); };

await check('未受技能傷害回合 → scarBonus+1（pending_counter）', async () => {
  const e: any = createBattleEngine({ initialP1Team: [sobirat()], initialP2Team: [dummy('X', 1_000_000_000)], p1StarterId: '5001', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  // 回合1：對手用屬性技（不造成技能傷害）→ sobirat 未受擊 → scarBonus+1
  const guard = { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' };
  const xs = e.getState().p2.skills; xs.push(guard);
  e.onSkillSelect('p1', e.getState().p1.skills[1] ?? e.getState().p1.skills[0]);
  e.onSkillSelect('p2', xs[xs.length - 1]);
  await e.idle();
  const st = e.getState();
  const bonus = (st.p1RegistryState || {}).sobiratScarBonus;
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  scarBonus:', bonus, '| pending log:', logs.some((t: string) => t.includes('待觸發層數')));
  assert.ok((bonus || 0) >= 1, '未受擊回合 scarBonus 應+1');
  assert.ok(!logs.some((t: string) => t.includes('靜謐之夜')), '舊 handler 應已退場');
  e.unmount();
});

await check('受技能傷害 → 對手害怕（on_damaged 鏈）', async () => {
  const e: any = createBattleEngine({ initialP1Team: [sobirat()], initialP2Team: [dummy('X', 1_000_000_000)], p1StarterId: '5001', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  e.onSkillSelect('p1', e.getState().p1.skills[0]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const feared = logs.some((t: string) => t.includes('害怕'));
  console.log('  feared:', feared);
  assert.ok(feared, '受擊應令對手害怕');
  e.unmount();
});

await check('被擊敗 → 消除對手效果＋附加黯痕（DarkScarTurns 鍵＋可見異常）', async () => {
  const e: any = createBattleEngine({ initialP1Team: [sobirat()], initialP2Team: [dummy('K', 1_000_000_000, 900000)], p1StarterId: '5001', p2StarterId: 'K', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  // 回合1：K 一擊打死 sobirat（atk 900000）
  e.onSkillSelect('p1', e.getState().p1.skills[0]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const darkTurns = (st.p1RegistryState || {}).DarkScarTurns;
  // 擊敗者視角：黯痕掛在擊敗者（p2）身上——從 p2 registry 讀
  const darkOnP2 = (st.p2RegistryState || {}).DarkScarTurns;
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  p1 DarkScarTurns:', darkTurns, '| p2 DarkScarTurns:', darkOnP2);
  console.log('  黯痕 log:', logs.filter((t: string) => t.includes('黯痕')).slice(-2).join(' / ').slice(0, 200));
  assert.ok((darkOnP2 || 0) >= 3, '擊敗者應被附加 3+ 回合黯痕鍵');
  assert.ok(logs.some((t: string) => t.includes('黯痕')), '黯痕日誌應存在');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
