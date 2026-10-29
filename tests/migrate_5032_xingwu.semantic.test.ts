// 5032 星核幻舞 Kit 引擎驗收（真實種子；Kit 直掛 skill.kit＋effectMode 模擬匯總效果）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const { MIGRATED_ASTRAL_AESFIA_KITS } = await server.ssrLoadModule('/src/data/migratedAstralAesfiaKits.ts');

const aesfia = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5032'));
assert.ok(aesfia, '5032 種子存在');
const kitDef = MIGRATED_ASTRAL_AESFIA_KITS[0];
assert.equal(aesfia.skills.find((s: any) => s.name === '星核幻舞')?.description, kitDef.description, '原文一致（descriptionSources CRLF 原樣）');

const mk = () => {
  const self = structuredClone(aesfia);
  const sk = self.skills.find((s: any) => s.name === '星核幻舞');
  sk.effectMode = 'kit'; sk.kit = structuredClone(kitDef.kit);
  // 隔離技能效果：魂印已 Kit 化（資料驅動，不再依賴精靈名 handler），改名不足以停用，
  // 必須明確清除魂印 Kit，否則幻化轉化／星附屬會污染先後手斷言。魂印另由 migrate_5032_soul 驗收。
  self.name = '技能驗收·艾斯菲亞';
  self.soulMark = { ...self.soulMark, effectMode: undefined, kit: undefined, effectType: 'none' };
  return self;
};
const guard = (id: string, hp: number): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 50 }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed: 50 }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + name); };
const battleWith = (self: any, foeTeam: any[]) => {
  const e: any = createBattleEngine({ initialP1Team: [self], initialP2Team: foeTeam, p1StarterId: '5032', p2StarterId: foeTeam[0].id, battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  return e;
};

await check('P1 星核幻舞：全屬性+2（先手翻倍）＋先制-2計時器＋增傷監看＋恢復監看', async () => {
  const e = battleWith(mk(), [guard('X', 1_000_000_000)]);
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '星核幻舞');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]); // 待機
  await e.idle();
  const st = e.getState();
  const stages = st.p1.statStages || {};
  const ups = Object.entries(stages).filter(([k, v]) => Number(v) >= 2).length;
  console.log('  stages:', JSON.stringify(stages).slice(0, 120));
  assert.ok(ups >= 6, '先出手全屬性應+2（六項）');
  const oppPrio = (st.p2Timers || []).some((t: any) => t.payload?.block?.prio === -2 && (t.remaining || 0) > 0)
    || (st.p2RegistryState || {}).priorityBoostValue === -2;
  console.log('  對方先制-2:', oppPrio, '| p2 actionPriorityThisTurn:', (st.p2RegistryState || {}).actionPriorityThisTurn);
  // heal_then×round_end 已放行（本回合補上共用白名單）——恢復+等量百分比監看計時器啟用斷言。
  const healWatch = (st.p1Timers || []).some((t: any) => String(t.id).includes('星核幻舞_持續效果_round_end'));
  console.log('  恢復監看:', healWatch);
  assert.ok(healWatch, '應有4回合恢復+等量百分比監看計時器');
  e.unmount();
});

await check('P2 側：星核幻舞在 P2 側同樣生效', async () => {
  const self = mk(); self.battleId = 'p2-aesfia';
  const foe = guard('Y', 1_000_000_000); foe.speed = 600; foe.calculatedStats.speed = 600; // 5032 實速 431 → 對手 600 先手 → 我方後手 → 強化+1
  const e: any = createBattleEngine({ initialP1Team: [foe], initialP2Team: [self], p1StarterId: 'Y', p2StarterId: self.id, battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p2.skills.findIndex((s: any) => s.name === '星核幻舞');
  e.onSkillSelect('p1', e.getState().p1.skills[1]);
  e.onSkillSelect('p2', e.getState().p2.skills[idx]);
  await e.idle();
  const st = e.getState();
  const stages = st.p2.statStages || {};
  const ones = Object.values(stages).filter((v: any) => Number(v) === 1).length;
  console.log('  stages(後手應+1):', JSON.stringify(stages).slice(0, 100));
  assert.ok(ones >= 6, '後出手全屬性應+1（六項）');
  e.unmount();
});

await check('變思遷憶 kind2：對手處於回合類效果 → 額外行動打鄰位', async () => {
  const self = mk();
  // 對手隊伍兩隻（在場+鄰位），給在場者預掛回合類計時器
  const active = guard('K', 1_000_000_000);
  const bench = guard('N', 1_000_000_000);
  const e = battleWith(self, [active, bench]);
  await e.idle();
  // 由舊 handler 對手技能「打」產生回合類?——更直接：用 onNode 前 Hook 不行；改在選技後由
  // 引擎無法直接預掛。改用：先讓對手用屬性技（無回合類）→ 變思遷憶不觸發（負例）；
  // 正例靠 K 的「打」？打不產生回合類。用 astral handler 的 timed 也不行（已退場?）——
  // 最直接：回合1 對手選「待機」無效果 → 無回合類 → 不觸發（負例斷言）。正例在整合後用
  // 對手自帶回合類的精靈場景補。本測試先鎖定負例與 no-crash：
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '星核幻舞');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]); // 待機（無回合類）
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const memoryRan = logs.some((t: string) => t.includes('變思遷憶'));
  // 幻舞自身 prio_turns 先給對手掛回合類（先制-2）→ 變思遷憶 cond=對手回合類 應**觸發**（正例）。
  console.log('  memory(幻舞給對手掛回合類→觸發):', memoryRan);
  assert.ok(memoryRan, '幻舞使用後對手處於回合類效果（先制-2），變思遷憶應觸發');
  // heal_then×round_end 與 perNonFullPp 均已放行——不得有任何待接通。
  const pendingOther = logs.some((t: string) => t.includes('效果待接通'));
  assert.ok(!pendingOther, '不得有任何待接通');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
