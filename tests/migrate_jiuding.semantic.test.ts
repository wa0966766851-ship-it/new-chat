// 九鼎震八荒 Kit 引擎驗收（真實 5017 資料）：一次效果、9層八荒＋9回合鎖、無效補償。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
// 引擎驗收：真實 5017 種子跑九鼎全場景（once/九層鎖/degrade/無效補償/kill 關天陣）。

const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');

const dixin = (DEFAULT_ELVES as any[]).find((e: any) => e.id === '5017');
assert.ok(dixin, '5017 帝辛種子存在');
const jiuding = dixin.skills.find((s: any) => s.name === '九鼎震八荒');
assert.ok(jiuding, '九鼎震八荒存在');
console.log('九鼎 effectMode:', (jiuding as any).effectMode, '| kit entries:', (jiuding as any).kit?.length);

// 對手：普通高血量假精靈
const opp = (id: string, hp: number): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 50 }, calculatedStats: { hp, atk: 200, def: 200, spatk: 200, spdef: 200, speed: 50 }, statStages: {}, skills: [
    { name: '打', category: '物理', type: '普通', power: 60, pp: 99, maxPp: 99, isSureHit: true, description: '' },
  ] });

const logs: string[] = [];
const engine: any = createBattleEngine({ initialP1Team: [dixin], initialP2Team: [opp('X', 1_000_000_000)], p1StarterId: '5017', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {},
  onLog: (l: any) => { if (l?.text) logs.push(l.text); } });
engine.mount(); engine.start();
await engine.idle();
const st = () => engine.getState();
const idx = st().p1.skills.findIndex((s: any) => s.name === '九鼎震八荒');
engine.onSkillSelect('p1', st().p1.skills[idx]);
engine.onSkillSelect('p2', st().p2.skills[0]);
await engine.idle();

// 1) 九層八荒
const bahuang = (st().p1Marks || []).find((m: any) => m.id === 'bahuang_mark' && (!m.ownerBattleId || m.ownerBattleId === (st().p1.battleId || st().p1.id)));
console.log('八荒層數:', bahuang?.count);
assert.equal(bahuang?.count, 9, '九鼎使用後八荒應達9層');
// 2) markLock 計時器存在
const lockTimer = (st().p1Timers || []).find((t: any) => t.payload?.block?.markLock?.id === 'bahuang_mark');
assert.ok(lockTimer, 'markLock 計時器應存在');
console.log('markLock remaining:', lockTimer?.remaining);
// 3) 每場一次旗標：日誌已證實 op 執行（📜 輝煌效果已用過）；掃 flat/scoped/native 找實際落點。
const flatOnce = st().p1RegistryState?.['blockOnce:dixin-jiuding-once'];
const ownerKey = st().p1.battleId || st().p1.id;
const elfBank = (st().p1ElfState || {})[ownerKey]?.registry || {};
const scopedOnce = elfBank['blockOnce:dixin-jiuding-once'];
const nativeOnce = (st().p1 as any).nativeRegistry?.['blockOnce:dixin-jiuding-once'];
const p1Keys = Object.keys(st().p1RegistryState || {}).filter(k => String(k).includes('blockOnce'));
const bankKeys = Object.keys(elfBank).filter(k => String(k).includes('blockOnce'));
console.log('once flat:', flatOnce, '| scoped:', scopedOnce, '| native:', nativeOnce);
console.log('p1RegistryState blockOnce keys:', p1Keys);
console.log('scoped bank blockOnce keys:', bankKeys);
assert.ok(flatOnce || scopedOnce || nativeOnce || p1Keys.length > 0 || bankKeys.length > 0, 'once 旗標已寫入（任一落點）');

// ── 第二回合：再用九鼎 → 命中率已歸0（技能必定 Miss）──
engine.onSkillSelect('p1', st().p1.skills[idx]);
engine.onSkillSelect('p2', st().p2.skills[0]);
await engine.idle();
const logs2 = (st().logs || []).map((l: any) => String(l.text || ''));
const missed = logs2.some((t: string) => /未命中|Miss|沒有命中/.test(t));
console.log('turn2 phase:', st().phase, '| turn:', st().turnNumber);
console.log('turn2 logs:', logs2.slice(-8).join(' / ').slice(0, 500));
console.log('九鼎 accuracy now:', st().p1.skills[idx]?.accuracy, '| pp:', st().p1.skills[idx]?.pp);
// degrade 之後九鼎必失（accuracy 0）；「選擇該技能時對方當回合先制-4」由 calcPriority 的 priorityComp 讀取端接線。
assert.ok(missed, '第二次使用九鼎應因命中率歸0而未命中');

// ── Miss 回合的先制驗證：degrade「選擇該技能時令對方當回合先制-4」──
// 帝辛 speed 141 vs X speed 50：帝辛先手。degrade 後施術者選九鼎時對方（X）先制-4 → X 更慢，帝辛保持先手。
{
  const order: string[] = [];
  const engine2: any = createBattleEngine({ initialP1Team: [dixin], initialP2Team: [opp('X', 1_000_000_000)], p1StarterId: '5017', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true, isFast: () => true,
    onNode: (id: string, d: any) => { if (id === '3.1' && d?.side) order.push(d.side); } });
  engine2.mount(); engine2.start();
  await engine2.idle();
  const idx2 = engine2.getState().p1.skills.findIndex((s: any) => s.name === '九鼎震八荒');
  engine2.onSkillSelect('p1', engine2.getState().p1.skills[idx2]);
  engine2.onSkillSelect('p2', engine2.getState().p2.skills[0]);
  await engine2.idle();
  engine2.onSkillSelect('p1', engine2.getState().p1.skills[idx2]);
  engine2.onSkillSelect('p2', engine2.getState().p2.skills[0]);
  await engine2.idle();
  console.log('action order:', order.join(','));
  // X 在第二回合（degrade 選招回合）被神游沒出手，改驗證引擎記錄的實際先制值：
  const xPrioTurn2 = (engine2.getState() as any).p2RegistryState?.actionPriorityThisTurn;
  console.log('X actionPriorityThisTurn (turn2):', xPrioTurn2);
  assert.ok(typeof xPrioTurn2 === 'number' && xPrioTurn2 <= -4, `degrade 令對方當回合先制-4：X 實際先制 ${xPrioTurn2} 應 ≤ -4`);
  engine2.unmount();
}

// ── on_kill 關天陣驗收：開天陣（九鼎9層）→ 低血量對手 → 帝怒擊殺 → 天陣關閉＋懲罰 ──
{
  const victim = opp('Y', 400);  // 低血量：帝辛一擊擊殺
  const engine3: any = createBattleEngine({ initialP1Team: [dixin], initialP2Team: [victim], p1StarterId: '5017', p2StarterId: 'Y', battleMode: 'PVP', preparedTeams: true, isFast: () => true, onNode: () => {} });
  engine3.mount(); engine3.start();
  await engine3.idle();
  const s3 = () => engine3.getState();
  const jIdx = s3().p1.skills.findIndex((x: any) => x.name === '九鼎震八荒');
  const dinuIdx = s3().p1.skills.findIndex((x: any) => x.name === '帝怒傾天');
  // 回合1：九鼎開9層+天陣
  engine3.onSkillSelect('p1', s3().p1.skills[jIdx]);
  engine3.onSkillSelect('p2', s3().p2.skills[0]);
  await engine3.idle();
  const formTimer = (s3().p1Timers || []).find((t: any) => t.id === 'dixin_formation');
  const openedLog = (s3().logs || []).some((l: any) => /誅魔天陣.{0,2}開啟|開啟.{0,4}誅魔天陣/.test(String(l?.text || '')));
  console.log('天陣計時器 (after 九鼎):', formTimer ? `remaining=${formTimer.remaining}` : 'none', '| 開陣日誌:', openedLog);
  // 此場景九鼎一擊擊殺 Y：on_kill 立刻關閉天陣。驗證「曾開啟」＋「kill 後已關閉」。
  assert.ok(openedLog, '九鼎9層應開啟過誅魔天陣（日誌為證）');
  assert.ok(!formTimer, '擊殺後天陣應立刻關閉（不殘留計時器）');
  // 回合2：帝怒擊殺低血 Y → 觸發 on_kill close_formation
  engine3.onSkillSelect('p1', s3().p1.skills[dinuIdx >= 0 ? dinuIdx : 0]);
  if (s3().phase === 'p2_select') engine3.onSkillSelect('p2', s3().p2.skills[0]);
  await engine3.idle();
  if (s3().phase === 'p2_select') { engine3.onSkillSelect('p2', s3().p2.skills[0]); await engine3.idle(); }
  const logs3 = (s3().logs || []).map((l: any) => String(l.text || ''));
  console.log('engine3 all logs:', logs3.join(' | ').slice(0, 900));
  console.log('Y currentHp:', s3().p2.currentHp, '| phase:', s3().phase);
  const closed = logs3.some((x: string) => /陣形關閉懲罰|誅魔天陣正常關閉/.test(x));
  const formedClosed = !(s3().p1Timers || []).some((t: any) => t.id === 'dixin_formation' && t.remaining > 0);
  const finalTimers = (s3().p1Timers || []).map((t: any) => t.id + ':' + t.remaining).join(', ');
  console.log('final p1 timers:', finalTimers);
  console.log('FormationRounds state:', (s3().p1RegistryState || {})['dixinFormationRounds'], '| AtNine:', (s3().p1RegistryState || {})['dixinFormationAtNine']);
  console.log('close log:', closed, '| formation gone:', formedClosed, '| p1 hp:', s3().p1.currentHp, '| pp sum:', s3().p1.skills.reduce((n: number, k: any) => n + (k.pp || 0), 0));
  assert.ok(closed, '擊殺時應觸發關閉懲罰日誌');
  assert.ok(formedClosed, '天陣計時器應已消耗');
  assert.equal(s3().p1.currentHp, 1, '關閉懲罰：帝辛體力調整為1');
  assert.equal(s3().p1.skills.reduce((n: number, k: any) => n + (k.pp || 0), 0), 0, '關閉懲罰：所有技能PP歸0');
  engine3.unmount();
}

await server.close();
console.log('JIUDING KIT ACCEPTANCE PASSED');
