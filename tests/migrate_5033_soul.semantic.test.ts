// 5033 魂印「格」Kit 引擎驗收：思維固化（paired_initial 幻化+10臨時PP）、三條件解除查詢。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const mod: any = await server.ssrLoadModule('/src/data/migratedAstralAesfigSoulKit.ts');

const mk = (partner: any) => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5033'));
  self.soulMark.effectMode = 'kit';
  self.soulMark.kit = structuredClone(mod.MIGRATED_ASTRAL_AESFIG_SOUL_KIT.kit);
  // paired_initial 語意＝初始背包對應位數（initialCounterpart 由隊伍建構帶入，引擎不自動推導）。
  self.initialCounterpart = structuredClone({ ...partner, initialCounterpart: undefined, illusion: undefined });
  return [self, partner];
};
const guard = (id: string, hp: number, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (nm: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };

await check('思維固化：幻化為初始背包對應位數精靈＋10臨時PP上限', async () => {
  const partner = guard('P1', 1_000_000_000);  // 己方第2位
  const foe = guard('X', 1_000_000_000, 40);
  const e: any = createBattleEngine({ initialP1Team: mk(partner), initialP2Team: [foe], p1StarterId: '5033', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const st = e.getState();
  console.log('  illusion:', st.p1.illusion?.target?.name ?? '無', '| src:', st.p1.illusion?.source ?? '-');
  console.log('  globalPpMaxOffset:', st.p1.globalPpMaxOffset, '| PP上限(maxPp+10):', st.p1.skills.map((s: any) => s.maxPp).join(','));
  assert.ok(st.p1.illusion, '應幻化');
  assert.equal(st.p1.illusion?.target?.name, 'P1', '幻化目標=初始背包對應位數');
  assert.equal(st.p1.globalPpMaxOffset, 10, '應有10點臨時PP上限');
  e.unmount();
});

await check('三條件解除查詢：未滿足時幻化保持', async () => {
  const partner = guard('P2', 1_000_000_000);
  const foe = guard('Y', 1_000_000_000, 40);
  const e: any = createBattleEngine({ initialP1Team: mk(partner), initialP2Team: [foe], p1StarterId: '5033', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  // 兩回合（無五類傷害各5/無5異常/登場1）→ 幻化應保持
  for (let i = 0; i < 2; i++) {
    const s = e.getState();
    e.onSkillSelect('p1', s.p1.skills[1]);
    e.onSkillSelect('p2', s.p2.skills[1]);
    await e.idle();
  }
  const st = e.getState();
  console.log('  2回合後 illusion:', st.p1.illusion?.target?.name ?? '無');
  assert.ok(st.p1.illusion, '三條件未滿足幻化應保持');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
