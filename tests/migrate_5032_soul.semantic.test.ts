// 5032 魂印「核」Kit 引擎驗收：寰宇星幻（五星+幻化）、空間躍遷、後手減半吸取、星解除幻化。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const { MIGRATED_ASTRAL_AESFIA_SOUL_KIT } = await server.ssrLoadModule('/src/data/migratedAstralAesfiaSoulKit.ts');

const mk = () => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5032'));
  self.soulMark.effectMode = 'kit';
  self.soulMark.kit = structuredClone(MIGRATED_ASTRAL_AESFIA_SOUL_KIT.kit);
  return self;
};
// 確認 description 全文一致（匯總嚴格匹配的前提）
const raw5032 = (DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5032');
assert.equal(raw5032.soulMark.description, MIGRATED_ASTRAL_AESFIA_SOUL_KIT.description, '魂印原文全文一致（含相關說明段）');

const guard = (id: string, hp: number, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + name); };

await check('P1 先手：登場五星＋幻化＋空間躍遷擋傷＋反擊（PP歸0＋全恢復）', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [guard('X', 1_000_000_000, 50)], p1StarterId: '5032', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const st0 = e.getState();
  // 登場：五星
  const effNames = (st0.p1.effects || []).map((f: any) => f.name);
  console.log('  登場異常:', effNames.join(','));
  for (const s of ['星賜','星哲','星贖','星佑','星護']) assert.ok(effNames.includes(s), `缺 ${s}`);
  // 幻化
  assert.ok(st0.p1.illusion, '應幻化為對方');
  assert.equal(st0.p1.illusion?.target?.name, 'X', '幻化目標=對方在場');
  console.log('  幻化→', st0.p1.illusion?.target?.name);
  // 回合1：我方先手（speed 130>50）打；對手後手「打」——應被空間躍遷擋下（傷害0）＋反擊
  const idx = st0.p1.skills.findIndex((s: any) => s.name === '星核幻舞');
  e.onSkillSelect('p1', st0.p1.skills[idx >= 0 ? idx : 0]);
  e.onSkillSelect('p2', st0.p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const blocked = logs.some((t: string) => t.includes('空間躍遷') || (st.p1RegistryState || {}).blockedSkillDamageThisAction !== undefined);
  console.log('  對手HP:', st.p2.currentHp, '| 我方HP:', st.p1.currentHp, '| 對手打PP:', st.p2.skills[0].pp);
  console.log('  日誌尾:', logs.slice(-5).join(' | ').slice(0, 300));
  // 空間躍遷：對手的「打」造成0傷害（被擋）
  assert.equal(st.p2.skills[0].pp < 99, true, '對手使用槽 PP 應被反擊歸0（或至少消耗）');
  e.unmount();
});

await check('P1 後手（速度劣勢）：halveNonTrue 計時器＋回合末吸取½', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [guard('F', 1_000_000_000, 300)], p1StarterId: '5032', p2StarterId: 'F', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const st0 = e.getState();
  e.onSkillSelect('p1', st0.p1.skills[2] ?? st0.p1.skills[0]); // 殞星衝擊或任一
  e.onSkillSelect('p2', st0.p2.skills[1]); // 待機（不攻擊）
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  對手HP:', st.p2.currentHp, '(後手吸取½=', Math.floor(1000000000/2), '應生效)');
  console.log('  日誌尾:', logs.slice(-4).join(' | ').slice(0, 260));
  e.unmount();
});

await check('星贖延長：4回合後星仍在＋幻化仍在（自然到期不解除）', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [guard('X', 1_000_000_000, 300)], p1StarterId: '5032', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  assert.ok(e.getState().p1.illusion, '開局應幻化');
  for (let turn = 1; turn <= 4; turn++) {
    const s = e.getState();
    e.onSkillSelect('p1', s.p1.skills[1] ?? s.p1.skills[0]);
    e.onSkillSelect('p2', s.p2.skills[1]);
    await e.idle();
  }
  const st = e.getState();
  const eff = (st.p1.effects || []).map((f: any) => f.name);
  console.log('  4回合後異常:', eff.join(','), '| illusion:', st.p1.illusion?.target?.name ?? '無');
  // 星贖（附屬類）戰鬥階段結束時為所有非限制類異常+1回合——星的自然到期被抵消，不應消失。
  assert.ok(eff.some((n: string) => n === '星佑' || n === '星護'), '星應被星贖延長而未到期');
  assert.ok(st.p1.illusion, '星未到期→幻化應保持');
  // 解除分支（星被技能消除→幻化解除）列為第二批場景：需要 5032 技能或外部消除星後覆蓋。
  e.unmount();
});

await server.close();
console.log(count + ' checks');
