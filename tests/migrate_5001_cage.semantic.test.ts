// 5001 影之牢籠 Kit 引擎驗收：體力降為1、待觸發黯痕+1、300固傷、同歸保留1。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');

const sobirat = () => structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5001'));
const dummy = (id: string, hp: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 50 }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed: 50 }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機觀察', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + name); };

await check('常規場景：體力降為1＋scarBonus+1＋300固傷落地', async () => {
  const e: any = createBattleEngine({ initialP1Team: [sobirat()], initialP2Team: [dummy('X', 1_000_000_000)], p1StarterId: '5001', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '影之牢籠');
  assert.ok(idx >= 0, '影之牢籠在技能欄');
  assert.equal(e.getState().p1.skills[idx].effectMode, 'kit', '已切 kit');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  // 對手用屬性技（第二槽），避免 1 血被攻擊反殺干擾斷言
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  assert.equal(st.p1.currentHp, 1, '自身體力應降為1（未受攻擊）');
  // 影之牢籠+1；對手用屬性技未對我方造成技能傷害 → 魂印「回合結束未受擊+1」再+1 = 2（皆正當）。
  const scar = (st.p1RegistryState || {}).sobiratScarBonus;
  assert.ok(scar >= 1, `待觸發黯痕應至少+1（實得 ${scar}；魂印未受擊+1 為正當疊加）`);
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  assert.ok(logs.some((t: string) => t.includes('黯痕') && t.includes('+1')), '黯痕+1 日誌應存在');
  const dealt = 1_000_000_000 - st.p2.currentHp;
  assert.ok(logs.some((t: string) => t.includes('影之牢籠')), '影之牢籠應正常使用');
  assert.ok(dealt >= 300, '300固傷應落地（總扣血至少300）');
  e.unmount();
});

await check('同歸場景：300固傷擊敗低血對手 → 自身保留1點體力', async () => {
  const e: any = createBattleEngine({ initialP1Team: [sobirat()], initialP2Team: [dummy('Y', 200)], p1StarterId: '5001', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '影之牢籠');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  assert.equal(st.p2.currentHp, 0, '低血對手應被300固傷擊敗');
  assert.equal(st.phase, 'game_over', '戰鬥應結束');
  assert.ok(st.p1.currentHp >= 1, '同歸時自身應保留至少1點體力（不會因消耗而低於1）');
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  hp:', st.p1.currentHp, '| logs:', logs.slice(-4).join(' / ').slice(0, 260));
  e.unmount();
});

await server.close();
console.log(count + ' checks');
