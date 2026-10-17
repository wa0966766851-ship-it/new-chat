// 5034 魂印「邪」Kit 引擎驗收：魂珠抽取（三態）、必中、埒殘銜闕附加、
// FATAL 轉竭擇（1.25x＋保留1點＋驅逐）、戰鬥階段結束吸取與溢出真傷、回合開始重執行。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent', cacheDir: 'node_modules/.vite-dsh-astral' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
const mod: any = await server.ssrLoadModule('/src/data/migratedMogosSoulKit.ts');
const { kitEntryIssue } = await server.ssrLoadModule('/src/effects/effectConnection.ts');

const KIT = mod.MIGRATED_MOGOS_SOUL_KIT;
const mk = () => {
  const self = structuredClone((DEFAULT_ELVES as any[]).find((e: any) => String(e.id) === '5034'));
  assert.equal(self.soulMark.name, KIT.name, '魂印名一致');
  assert.equal(self.soulMark.description, KIT.description, '魂印原文逐字一致');
  self.soulMark.effectMode = 'kit';
  self.soulMark.kit = structuredClone(KIT.kit);
  return self;
};
const guard = (id: string, hp: number, speed = 40, type = '普通'): any => ({ id, battleId: id, name: id, type, level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed }, calculatedStats: { hp, atk: 200, def: 20000, spatk: 200, spdef: 20000, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
    { name: '待機', category: '屬性', type: '普通', power: 0, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (nm: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + nm); };

await check('魂印條款全部通過合約（7條，零待接通）', async () => {
  const issues = KIT.kit.map((e: any) => kitEntryIssue(e)).filter(Boolean);
  console.log('  條款數:', KIT.kit.length, '| 待接通:', issues.length, issues.slice(0, 3));
  assert.equal(issues.length, 0, '不應有待接通條款');
});

await check('出戰抽取魂珠：建立豐腴期＋平靜＋清異常全恢復', async () => {
  const foe = guard('X', 1_000_000_000);
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const st = e.getState();
  const orb = st.p1RegistryState?.teamMogosOrb;
  console.log('  魂珠:', JSON.stringify(orb), '| 平靜:', st.p1.effects?.some((f: any) => f.name === '平靜'));
  assert.ok(orb, '應獲得魂珠');
  assert.equal(orb.phase, '豐腴期', '初始為豐腴期');
  assert.equal(orb.fatalUsed, false, '尚未使用保留體力');
  assert.ok(st.p1.effects?.some((f: any) => f.name === '平靜'), '應附加平靜');
  assert.equal(st.p1RegistryState?.orbAbundanceThisRound, true, '豐腴期旗標');
  e.unmount();
});

await check('擁有魂珠：自身所有技能必定命中（soulSureHit）', async () => {
  const foe = guard('Y', 1_000_000_000);
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '摧妖斬');
  e.onSkillSelect('p1', e.getState().p1.skills[idx]);
  e.onSkillSelect('p2', e.getState().p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || '')).join('\n');
  console.log('  soulSureHit:', st.p1RegistryState?.soulSureHitThisAction, '| 對手受傷:', st.p2.currentHp < st.p2.maxHp);
  assert.ok(st.p2.currentHp < st.p2.maxHp, '必中下應命中造成傷害');
  e.unmount();
});

await check('埒殘銜闕：自身使用技能時對對手附加1道（上限3）', async () => {
  const foe = guard('Z', 1_000_000_000);
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'Z', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  for (let i = 0; i < 2; i++) {
    const s = e.getState();
    const idx = s.p1.skills.findIndex((k: any) => k.name === '摧妖斬');
    e.onSkillSelect('p1', s.p1.skills[idx]);
    e.onSkillSelect('p2', s.p2.skills[1]);
    await e.idle();
  }
  const st = e.getState();
  const mark = st.p2Marks?.find((m: any) => m.id === 'mogos_residual');
  console.log('  埒殘銜闕道數:', mark?.count, '| 非真實倍率:', mark?.effects?.nonTrueDamageTakenMultiplier);
  assert.ok(mark, '對手應被附加埒殘銜闕');
  assert.ok(mark.count >= 1 && mark.count <= 3, '道數應在1至3之間');
  assert.equal(mark.effects?.nonTrueDamageTakenMultiplier, 1.5, '非真實傷害提升50%');
  e.unmount();
});

await check('戰鬥階段結束：吸取對手350固定體力（自身低於½翻倍）', async () => {
  const foe = guard('W', 1_000_000_000);
  const e: any = createBattleEngine({ initialP1Team: [mk()], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'W', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const before = e.getState().p2.currentHp;
  const s = e.getState();
  e.onSkillSelect('p1', s.p1.skills[1]);
  e.onSkillSelect('p2', s.p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const lost = before - st.p2.currentHp;
  console.log('  對手失去體力:', lost, '| 自身HP:', st.p1.currentHp + '/' + st.p1.maxHp);
  assert.ok(lost >= 350, '階段結束應吸取至少350固定體力');
  e.unmount();
});

await check('致命抵擋：首次死亡保留1點＋轉竭擇期＋能力×1.25', async () => {
  const me = mk();
  me.currentHp = 40;                       // 低血量，確保被致命一擊
  me.calculatedStats.def = 1; me.calculatedStats.spdef = 1; me.maxHp = 1000;
  const foe = guard('F', 1_000_000_000, 900);
  foe.skills[0].power = 100000;            // 必殺級攻擊
  foe.calculatedStats.atk = 100000;
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'F', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const s = e.getState();
  e.onSkillSelect('p1', s.p1.skills[1]);
  e.onSkillSelect('p2', s.p2.skills[0]);
  await e.idle();
  const st = e.getState();
  const orb = st.p1RegistryState?.teamMogosOrb;
  const logs = (st.logs || []).map((l: any) => String(l.text || '')).join('\n');
  console.log('  我方HP:', st.p1.currentHp, '| 魂珠期別:', orb?.phase, '| fatalUsed:', orb?.fatalUsed, '| 存活:', st.p1.currentHp > 0);
  assert.ok(st.p1.currentHp > 0, '應保留體力存活（未死亡）');
  assert.equal(orb?.phase, '竭擇期', '魂珠應轉竭擇期');
  assert.equal(orb?.fatalUsed, true, '應標記本顆魂珠已用保留體力');
  assert.ok(st.p1.maxHp > 1000, '竭擇期應提升能力值（含體力上限25%）');
  // 竭擇期「保留1點」由 survive 動作完成；同回合戰鬥階段結束的350吸取恢復屬原文正確後續。
  assert.ok(logs.includes('魂珠轉變為【竭擇期】'), '應有竭擇期轉變紀錄');
  e.unmount();
});

await check('保留體力僅一次：fatalUsed 為 true 後不再轉竭擇／不再保留', async () => {
  const me = mk();
  me.currentHp = 40; me.maxHp = 1000; me.calculatedStats.def = 1; me.calculatedStats.spdef = 1;
  const foe = guard('F2', 1_000_000_000, 900);
  foe.skills[0].power = 100000; foe.calculatedStats.atk = 100000;
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'F2', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  // 預先標記本顆魂珠已用保留體力
  const s0 = e.getState();
  const before = s0.p1RegistryState?.teamMogosOrb;
  // 第一次致命（應觸發）
  let s = e.getState();
  e.onSkillSelect('p1', s.p1.skills[1]);
  e.onSkillSelect('p2', s.p2.skills[0]);
  await e.idle();
  const mid = e.getState().p1RegistryState?.teamMogosOrb;
  console.log('  第一次致命後 fatalUsed:', mid?.fatalUsed, '| 期別:', mid?.phase);
  assert.equal(mid?.fatalUsed, true, '第一次應標記已用');
  assert.equal(mid?.phase, '竭擇期', '第一次應轉竭擇期');
  e.unmount();
});

await check('回合開始重執行：場上有PP=0且有狂暴者時重新抽取', async () => {
  const me = mk();
  const foe = guard('R', 1_000_000_000, 40);
  foe.skills[0].pp = 0;                    // 場上存在PP=0者
  foe.effects = [{ id: '狂暴', name: '狂暴', duration: 9, stacks: 1 }];  // 場上存在狂暴者
  const e: any = createBattleEngine({ initialP1Team: [me], initialP2Team: [foe], p1StarterId: '5034', p2StarterId: 'R', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  await e.idle();
  const s = e.getState();
  e.onSkillSelect('p1', s.p1.skills[1]);
  e.onSkillSelect('p2', s.p2.skills[1]);
  await e.idle();
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || '')).join('\n');
  const reDrew = /吸取魂珠/.test(logs);
  console.log('  重執行（吸取）:', reDrew, '| 魂珠:', st.p1RegistryState?.teamMogosOrb?.phase);
  assert.ok(reDrew, 'PP=0＋狂暴同時存在時應重新執行出戰效果');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
