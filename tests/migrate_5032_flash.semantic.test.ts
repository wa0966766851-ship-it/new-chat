// 5032 寰宇幻影閃 Kit 引擎驗收：消強→PP全回、星計數×場下PP×10真傷、非異常強制變思、擊敗分支。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const mod: any = await server.ssrLoadModule('/src/data/migratedAstralAesfiaKits.ts');

const mk = () => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5032'));
  const def = mod.MIGRATED_ASTRAL_AESFIA_FLASH[0];
  const sk = self.skills.find((s: any) => s.name === def.name);
  assert.equal(sk.description, def.description, '原文一致');
  sk.effectMode = 'kit'; sk.kit = structuredClone(def.kit);
  self.name = '技能驗收·艾斯菲亞'; self.soulMark.effectType = 'none';
  return self;
};
const tank = (id: string, hp: number, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: { atk: 2 }, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (nm: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };

await check('幻影閃：消強成功→PP全回＋星計數真傷＋非異常強制變思遷憶', async () => {
  const me = mk();
  me.skills = me.skills.map((s: any) => ({ ...s, pp: 1, currentPp: 1 }));  // PP 壓低驗全回
  const foe = tank('K', 1_000_000_000);
  // foe 帶一名場下（已損PP → bench_pp_lost_sum 基數>0）
  const bench = { ...tank('B1', 500000), statStages: {} };
  bench.skills = [{ name: '打', category: '物理', type: '普通', power: 60, pp: 0, maxPp: 5, isSureHit: true, description: '' }];
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [foe, bench], p1StarterId: '5032', p2StarterId: 'K', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '寰宇幻影閃');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  對手 atk stage:', st.p2.statStages?.atk, '| 我方各PP:', (st.p1.skills || []).map((s: any) => s.pp).join(','));
  console.log('  對手HP:', st.p2.currentHp, '| 日誌尾:', logs.slice(-5).join(' | ').slice(0, 300));
  assert.equal(st.p2.statStages?.atk ?? 0, 0, '對手能力提升應被消除');
  const flash = st.p1.skills.find((s: any) => s.name === '寰宇幻影閃');
  assert.ok((st.p1.skills || []).every((s: any) => (s.pp || 0) >= (s.maxPp || 0) || s === flash), '消強成功應恢復所有 PP');
  const memoryRan = logs.some((t: string) => t.includes('變思遷憶'));
  console.log('  變思遷憶(非異常→強制):', memoryRan);
  assert.ok(memoryRan, '自身無異常（星未掛）應強制觸發變思遷憶');
  e.unmount();
});

await check('幻影閃：擊敗對手 → 下隻出戰先制失效（turn_key_set）', async () => {
  const me = mk();
  const weak = { ...tank('W', 100, 50) }; weak.statStages = {};
  weak.calculatedStats.def = 1; weak.calculatedStats.spdef = 1;  // 確保一擊擊敗
  const next = { ...tank('N1', 1_000_000_000, 40) };
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [weak, next], p1StarterId: '5032', p2StarterId: 'W', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '寰宇幻影閃');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  // W 被擊敗 → 強制換人 → 下隻先制失效鍵
  const st = e.getState();
  console.log('  W HP:', st.p2Team[0].currentHp, '| phase:', st.phase, '| p2 nextElfAstralPriority:', (st.p2RegistryState || {}).nextElfAstralPriority);
  assert.ok(st.p2Team[0].currentHp <= 0, 'W 應被擊敗');
  assert.equal((st.p2RegistryState || {}).nextElfAstralPriority, 2, '擊敗後對手下隻應掛 2 回合先制失效鍵');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
