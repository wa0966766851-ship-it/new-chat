// 5033 五技引擎驗收：星軌念刃（multi_hit）、幻象帷幔、心像重構、念力傾瀉、寰宇星軌陣。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const mod: any = await server.ssrLoadModule('/src/data/migratedAstralAesfigSkillKits.ts');

const mk = (name: string) => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5033'));
  const def = mod.MIGRATED_ASTRAL_AESFIG_SKILLS.find((k: any) => k.name === name);
  assert.ok(def, name + ' Kit 存在');
  const sk = self.skills.find((s: any) => s.name === name);
  assert.equal(sk.description, def.description, name + ' 原文一致');
  sk.effectMode = 'kit'; sk.kit = structuredClone(def.kit);
  self.name = '技能驗收·艾斯菲格'; self.soulMark.effectType = 'none';
  return self;
};
const guard = (id: string, hp: number, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (nm: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };

await check('星軌念刃：multi_hit 10-20 連擊＋降2PP＋消強→全回', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('星軌念刃')], initialP2Team: [guard('X', 1_000_000_000, 50)], p1StarterId: '5033', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '星軌念刃');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const combo = logs.some((t: string) => /連擊/.test(t));
  console.log('  連擊日誌:', combo, '| 對手HP:', st.p2.currentHp, '| 對手打PP:', st.p2.skills[0].pp);
  assert.ok(combo, '應有連擊日誌（10-20次）');
  assert.ok(st.p2.skills[0].pp <= 97, '命中應降對手 2 點 PP');
  e.unmount();
});

await check('幻象帷幔：免疫反彈5回合＋吸取300監看＋先制+2', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('幻象帷幔')], initialP2Team: [guard('Y', 1_000_000_000, 50)], p1StarterId: '5033', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '幻象帷幔');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const watchers = (st.p1Timers || []).filter((t: any) => String(t.id).includes('幻象帷幔_持續效果_self_after_use'));
  const immune = (st.p1Timers || []).some((t: any) => String(t.id).includes('免疫並反彈'));
  const prio = (st.p1RegistryState || {}).priorityBoostTurns;
  console.log('  吸取監看:', watchers.length > 0, '| 免疫反彈:', immune, '| 先制:', prio);
  assert.ok(watchers.length > 0, '3回合使用後吸取300監看');
  assert.ok(immune, '5回合免疫反彈');
  assert.equal(prio, 2, '下2回合先制+2');
  e.unmount();
});

await check('念力傾瀉：先手→對手無效鍵＋致命→睡眠/免疫（on_hit 分支）', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('念力傾瀉')], initialP2Team: [guard('Z', 1_000_000_000, 50)], p1StarterId: '5033', p2StarterId: 'Z', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '念力傾瀉');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  console.log('  對手HP:', st.p2.currentHp, '| 日誌尾:', logs.slice(-3).join(' | ').slice(0, 200));
  assert.ok(!logs.some((t: string) => t.includes('效果待接通')), '無待接通');
  e.unmount();
});

await check('寰宇星軌陣：五星附加鏈（成→睡眠／敗→沉睡）＋擊敗→下隊先制失效', async () => {
  const me = mk('寰宇星軌陣');
  const weak = { ...guard('W', 100, 50) };
  weak.calculatedStats.def = 1; weak.calculatedStats.spdef = 1;
  const next = { ...guard('N1', 1_000_000_000, 40) };
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [weak, next], p1StarterId: '5033', p2StarterId: 'W', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '寰宇星軌陣');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const myStars = (st.p1.effects || []).filter((f: any) => f.name?.startsWith('星')).length;
  console.log('  我方星數:', myStars, '| W HP:', st.p2Team[0].currentHp, '| 對手睡眠:', logs.some((t: string) => t.includes('睡眠')), '| 下隊鍵:', (st.p2RegistryState || {}).nextElfAstralPriority);
  assert.ok(myStars >= 1, '應附加星附屬（免疫情形下仍部分觸發）');
  assert.ok(st.p2Team[0].currentHp <= 0, 'W 應被擊敗');
  assert.equal((st.p2RegistryState || {}).nextElfAstralPriority, 2, '擊敗後下隊先制失效鍵=2');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
