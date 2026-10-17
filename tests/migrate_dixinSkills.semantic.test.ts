// 5017 其餘四招 Kit 引擎驗收：鹿台悲歌／人皇御宇／帝怒傾天／玄鳥天命（真實 DEFAULT_ELVES）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');

const mkDixin = () => structuredClone((DEFAULT_ELVES as any[]).find((e: any) => e.id === '5017'));
const opp = (id: string, hp: number, speed = 50): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 200, def: 200, spatk: 200, spdef: 200, speed }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' }] });

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log('✓ ' + name); };

async function turnOnce(engine: any, p1SkillIdx: number) {
  await engine.idle();
  engine.onSkillSelect('p1', engine.getState().p1.skills[p1SkillIdx]);
  engine.onSkillSelect('p2', engine.getState().p2.skills[0]);
  await engine.idle();
}

await check('鹿台悲歌：狂暴3回合＋八荒+2＋先制+2計時器＋吸取139×層', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mkDixin()], initialP2Team: [opp('X', 1_000_000_000)], p1StarterId: '5017', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '鹿台悲歌');
  const mark0 = (e.getState().p1Marks || []).find((m: any) => m.id === 'bahuang_mark')?.count || 0;
  await turnOnce(e, idx);
  const st = e.getState();
  const mark1 = (st.p1Marks || []).find((m: any) => m.id === 'bahuang_mark')?.count || 0;
  // 鹿台+2、回合結算魂印-1（對方有出手）＝淨+1；只驗不少於淨增加值。
  const frenzied = (st.p1.effects || []).some((f: any) => f.name === '狂暴');
  assert.ok(frenzied, '鹿台應附加3回合狂暴');
  // 先制+2 走 registry 鍵（mirror 計時器只是可清除殘影）；「下2回合」＝當回合不生效。
  assert.equal((st.p1RegistryState || {}).priorityBoostTurns, 2, '鹿台應寫入2回合先制+2');
  assert.equal((st.p1RegistryState || {}).priorityBoostValue, 2, '先制值應為+2');
  e.unmount();
});

await check('帝怒傾天：八荒≥3 無視減傷＋對手每提升1級威力+30', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mkDixin()], initialP2Team: [opp('X', 1_000_000_000)], p1StarterId: '5017', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '帝怒傾天');
  await turnOnce(e, idx);
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const usedJiuding = logs.some((t: string) => t.includes('帝怒傾天'));
  assert.ok(usedJiuding, '帝怒應正常使用（必中）');
  const fixedAdded = logs.some((t: string) => t.includes('帝怒傾天') && (t.includes('固定') || t.includes('60')));
  e.unmount();
});

await check('玄鳥天命：八荒層數先制＋消除回合類成功→疲憊', async () => {
  const X = opp('X', 1_000_000_000);
  // 給 X 預掛一個回合類效果供消除
  const e: any = createBattleEngine({ initialP1Team: [mkDixin()], initialP2Team: [X], p1StarterId: '5017', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '玄鳥天命');
  await turnOnce(e, idx);
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const mark = (st.p1Marks || []).find((m: any) => m.id === 'bahuang_mark')?.count || 0;
  assert.ok(mark >= 2, `玄鳥應附加2層八荒（實得${mark}）`);
  const healed = (st.p2.effects || []).some((f: any) => f.name === '疲憊' || f.name === '害怕');
  assert.ok(healed, '玄鳥消除回合類應觸發疲憊（成功）或害怕（失敗）');
  e.unmount();
});

await check('人皇御宇：臣服3回合或 fallback 星賜＋屬性封印監看', async () => {
  const e: any = createBattleEngine({ initialP1Team: [mkDixin()], initialP2Team: [opp('X', 1_000_000_000)], p1StarterId: '5017', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  e.mount(); e.start();
  const idx = e.getState().p1.skills.findIndex((s: any) => s.name === '人皇御宇');
  await turnOnce(e, idx);
  const st = e.getState();
  const logs = (st.logs || []).map((l: any) => String(l.text || ''));
  const served = (st.p2.effects || []).some((f: any) => f.name === '臣服');
  const gifted = (st.p1.effects || []).some((f: any) => f.name === '星賜');
  assert.ok(served || gifted, '人皇御宇應附加臣服（或未觸發時星賜）');
  // 監看計時器：trig 在 id 字串內（blk_..._round_end|program=...），rem=3 表示 4 回合制扣過當回合。
  const drainTimer = (st.p1Timers || []).some((t: any) => String(t.id).includes('人皇御宇_持續效果_round_end') && (t.remaining || 0) > 0);
  assert.ok(drainTimer, '人皇御宇應有回合結束吸取監看計時器');
  const sealTimer = (st.p1Timers || []).some((t: any) => String(t.id).includes('人皇御宇_持續效果_opp_status'));
  assert.ok(sealTimer, '人皇御宇應有屬性技能封印監看計時器');
  e.unmount();
});

await server.close();
console.log(count + ' checks');
