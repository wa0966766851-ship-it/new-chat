// 5032 三技 Kit 引擎驗收（星核脈衝/星霧迷境/殞星衝擊）——獨立 cacheDir 避免共用競爭。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent',
  cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const mod: any = await server.ssrLoadModule('/src/data/migratedAstralAesfiaKits.ts');

const mk = (name: string) => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5032'));
  const def = [...mod.MIGRATED_ASTRAL_AESFIA_KITS, ...mod.MIGRATED_ASTRAL_AESFIA_SKILLS_2].find((k: any) => k.name === name);
  assert.ok(def, name + ' Kit 存在');
  const sk = self.skills.find((s: any) => s.name === name);
  assert.equal(sk.description, def.description, name + ' 原文一致');
  sk.effectMode = 'kit'; sk.kit = structuredClone(def.kit);
  // 技能驗收避開魂印（幻化轉化+星附屬污染斷言）：魂印已 Kit 化（資料驅動），
  // 改名不足以停用，必須明確清除魂印 Kit。魂印行為由 migrate_5032_soul 獨立驗收。
  self.name = '技能驗收·艾斯菲亞';
  self.soulMark = { ...self.soulMark, effectMode: undefined, kit: undefined, effectType: 'none' };
  return self;
};
const guard = (id: string, hp: number, speed = 50): any => ({ id, battleId: id, name: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (nm: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };

await check('星核脈衝：消除回合類→屬性PP歸零；命中降2PP stopIfEmpty', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('星核脈衝')], initialP2Team: [guard('X', 1_000_000_000, 50)], p1StarterId: '5032', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '星核脈衝');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  // 對手無回合類→吸取⅓ 分支
  console.log('  對手HP:', st.p2.currentHp, '| 對手打PP:', st.p2.skills[0].pp, '| 待機PP:', st.p2.skills[1].pp);
  // 命中降2PP：對手「打」99-2=97（若 stopIfEmpty 觸發歸零則對手本回合無法行動——本場對手後手已行動）
  assert.ok(st.p2.skills[0].pp <= 97, '命中應降低對手 2 點 PP');
  assert.ok(st.p2.currentHp < 1_000_000_000, '吸取⅓ 或傷害應落地');
  e.unmount();
});

await check('星霧迷境：免疫反彈5回合＋無弱化→疲憊＋3回合吸取300監看', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('星霧迷境')], initialP2Team: [guard('Y', 1_000_000_000, 50)], p1StarterId: '5032', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '星霧迷境');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const watchers = (st.p1Timers || []).filter((t: any) => String(t.id).includes('星霧迷境_持續效果_self_after_use'));
  console.log('  吸取監看:', watchers.length > 0, '| 疲憊:', (st.p2.effects || []).some((f: any) => f.name === '疲憊'));
  assert.ok(watchers.length > 0, '應有3回合使用後吸取300監看');
  assert.ok((st.p2.effects || []).some((f: any) => f.name === '疲憊'), '無弱化→100%疲憊');
  e.unmount();
});

await check('殞星衝擊：能力拉平（差值固定傷害）＋¼反彈計時器＋睡眠/沉睡分支', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mk('殞星衝擊')], initialP2Team: [guard('Z', 1_000_000_000, 50)], p1StarterId: '5032', p2StarterId: 'Z', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '殞星衝擊');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  // 能力拉平：我方六項能力應被拉至對方值（guard calculatedStats hp=1e9 atk=200...）
  const me = st.p1, foe = st.p2;
  // 拉平語意：僅「低於對方」的項被提升（種子 def=448 < guard def=20000 → 應拉至 20000）；
  // 高於對方的項保持不變（atk 383 > 200 不動）。
  console.log('  def:', me.calculatedStats?.def, '(對手', foe.calculatedStats?.def + ')', '| ¼反彈:', logs.some((t: string) => t.includes('¼反彈')));
  assert.equal(me.calculatedStats?.def, foe.calculatedStats?.def, '低於對方的 def 應拉平');
  assert.ok((st.p2Timers || []).some((t: any) => t.payload?.reflectSkillQuarter), '¼反彈計時器應掛對手');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
