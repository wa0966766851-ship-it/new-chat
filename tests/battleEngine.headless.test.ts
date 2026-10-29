// 戰鬥引擎 headless：不經 React／JSDOM／畫面，直接在 Node 跑整場戰鬥，並驗證官方節點順序（src/engine/nodes.ts）。
// 註冊表用 import.meta.glob 載入，所以透過 Vite SSR 模組載入器取得模組（仍然沒有任何 DOM 或 React）。
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import type { BattleEngine } from '../src/engine/battleEngine';
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
const { getBattleSkillRegistry, getSoulMarkRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const { EffectTiming } = await server.ssrLoadModule('/src/effects/types.ts');
assert.equal(typeof (globalThis as any).window, 'undefined', '沒有 DOM');

let count = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); count++; console.log(`✓ ${name}`); };
const R = getBattleSkillRegistry(), S = getSoulMarkRegistry();
const quiet = console.error; console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) quiet(...a); };

const skill = (name: string, power = 0) => ({ name, category: power ? '物理' : '屬性', type: '普通', power, pp: 99, maxPp: 99, isSureHit: true, description: '' });
const elf = (id: string, hp: number, skills: any[], speed = 100): any => ({ id, name: id, battleId: id, type: '普通', level: 100, currentHp: hp, maxHp: hp,
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed }, calculatedStats: { hp, atk: 300, def: 200, spatk: 300, spdef: 200, speed }, statStages: {}, skills });

function battle(p1: any[], p2: any[]) {
  const nodes: { id: string; d?: any }[] = [];
  const engine: BattleEngine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].id, p2StarterId: p2[0].id, battleMode: 'PVP', preparedTeams: true,
    isFast: () => true, onNode: (id, d) => nodes.push({ id, d }) });
  engine.mount(); engine.start();
  return { engine, nodes };
}
async function turn(engine: BattleEngine, a: (e: BattleEngine) => void, b: (e: BattleEngine) => void) {
  await engine.idle();
  a(engine); b(engine);
  await engine.idle();
}
const use = (side: 'p1' | 'p2', i: number) => (e: BattleEngine) => e.onSkillSelect(side, e.getState()[side].skills[i]);
const ids = (nodes: { id: string }[]) => nodes.map(n => n.id);
const sub = (seq: string[], want: string[]) => { let i = 0; for (const x of seq) if (x === want[i]) i++; return i === want.length; };

await check('1.1正式開局逐隻通知完整背包，先於雙方首發1.3；官方節點不增添偽節點',async()=>{
  const events:string[]=[];
  for(const name of ['A','B','X','Y'])S[name]=(_:any,e:any)=>{if(e===EffectTiming.BATTLE_START)events.push(`${name}:start`);if(e===EffectTiming.ON_ENTRANCE)events.push(`${name}:enter`);};
  try{const {engine,nodes}=battle([elf('A',5000,[skill('等')]),elf('B',5000,[skill('等')])],[elf('X',5000,[skill('等')]),elf('Y',5000,[skill('等')])]);await engine.idle();assert.deepEqual(events,['A:start','B:start','X:start','Y:start','A:enter','X:enter']);assert.deepEqual(ids(nodes),['1.1','1.3','1.3']);engine.unmount();}finally{for(const name of ['A','B','X','Y'])delete S[name];}
});

await check('不經 React 跑完一個回合；雙方出手流程與回合結束依官方順序', async () => {
  const { engine, nodes } = battle([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 5000, [skill('打', 60)], 100)]);
  await turn(engine, use('p1', 0), use('p2', 0));
  const st = engine.getState();
  assert.equal(st.turnNumber, 2); assert.equal(st.phase, 'p1_select');
  assert.ok(st.p1.currentHp < 5000 && st.p2.currentHp < 5000, '雙方都受到攻擊傷害');
  const seq = ids(nodes);
  assert.deepEqual(seq.slice(0, 3), ['1.1', '1.3', '1.3']);
  const order = ['2.1', '2.2', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.10', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.10', '4.10', '4.11', '5', '5.4'];
  assert.deepEqual(seq.slice(3).filter(x => !x.startsWith('6.')), order);
  assert.equal(nodes.find(n => n.id === '3.1')!.d.side, 'p1', '速度快的先出手');
  // 未擊敗：6.1 未被擊敗（目標）與 6.3 未擊敗對手（出手方）
  assert.ok(sub(seq, ['3.10', '6.1', '6.3']));
});

await check('1.2 操作階段：切換精靈在回合開始前完成，新精靈吃到對手本回合攻擊、且不進入出手流程', async () => {
  const { engine, nodes } = battle([elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 5000, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 100)]);
  await engine.idle(); nodes.length = 0;
  await turn(engine, use('p1', 0), e => e.onSwitchElf('p2', 1));
  const seq = ids(nodes);
  assert.ok(sub(seq, ['1.2', '1.3', '2.1', '2.2', '3.1']), seq.join(','));
  assert.equal(nodes.filter(n => n.id === '3.1').length, 1, '只有 P1 出手');
  const st = engine.getState();
  assert.equal(st.p2.name, 'Y'); assert.ok(st.p2Team[1].currentHp < 5000, 'Y 吃到攻擊'); assert.equal(st.p2Team[0].currentHp, 5000, 'X 已換下');
});

await check('額外行動在死亡節點一之前執行，對手已倒下仍執行（鞭屍）', async () => {
  let extraRan = 0;
  R['斬殺附額外'] = (c: any) => {
    c.applyTrueDamage(c.targetSide, 999999, '斬殺');
    c.queueExtraAction(c.actor, { owner: c.actor, label: '追擊', run: (cc: any) => { extraRan++; return cc.applySkillTypeDamage(cc.targetSide, 100, '追擊', { category: 'skill_extra_action', node: 'extra_action' }); } });
  };
  const { engine, nodes } = battle([elf('A', 5000, [skill('斬殺附額外')], 200)], [elf('X', 5000, [skill('打', 60)], 100), elf('Y', 5000, [skill('打', 60)], 100)]);
  await engine.idle(); nodes.length = 0;
  await turn(engine, use('p1', 0), use('p2', 0));
  assert.equal(extraRan, 1, '對手倒下後額外行動仍執行');
  const seq = ids(nodes);
  assert.ok(sub(seq, ['3.7', '3.8', '3.9', '3.10', '6.2', '6.4', '6.5', '6.6', '4.10', '4.11', '5', '5.4']), seq.join(','));
  assert.equal(nodes.filter(n => n.id === '3.1').length, 1, '後手已倒下，不出手');
  assert.equal(engine.getState().phase, 'forced_switch_p2');
});

await check('死亡節點二：戰鬥階段結束效果造成的陣亡在回合結束前結算（被擊敗時 data.node＝2）', async () => {
  const seen: any[] = [];
  S['階段終結者'] = ((c: any, ev: any, data: any) => { if (ev === EffectTiming.BATTLE_PHASE_END) c.applyTrueDamage(c.targetSide, 999999, '階段終結'); }) as any;
  S['受害者'] = ((_c: any, ev: any, data: any) => { if (ev === EffectTiming.DEATH_NODE_1) seen.push(data); }) as any;
  const { engine, nodes } = battle([elf('階段終結者', 5000, [skill('等')], 200)], [elf('受害者', 5000, [skill('等')], 100), elf('Y', 5000, [skill('等')], 100)]);
  await engine.idle(); nodes.length = 0;
  await turn(engine, use('p1', 0), use('p2', 0));
  assert.equal(seen.length, 1); assert.equal(seen[0].node, 2);
  const seq = ids(nodes);
  assert.ok(sub(seq, ['4.10', '4.11', '6.2', '5', '5.4']), seq.join(','));
  delete S['階段終結者']; delete S['受害者'];
});

await check('回合結束：異常扣減與轉化排在回合結束效果之後', async () => {
  const order: string[] = [];
  R['上漸凍'] = (c: any) => { c.applyStatusWithImmunityCheck(c.targetSide, '漸凍', 1); };
  S['觀察者'] = ((c: any, ev: any) => { if (ev === EffectTiming.ROUND_END && c.actor === 'p2') order.push('ROUND_END:' + JSON.stringify((c.self.effects || []).map((e: any) => e.id + e.duration))); }) as any;
  const { engine } = battle([elf('A', 5000, [skill('上漸凍')], 200)], [elf('觀察者', 5000, [skill('等')], 100)]);
  await turn(engine, use('p1', 0), use('p2', 0));
  assert.deepEqual(order, ['ROUND_END:["漸凍1"]'], '回合結束效果看到的仍是漸凍');
  assert.deepEqual(engine.getState().p2.effects.map((e: any) => e.id + e.duration), ['冰封3'], '之後才轉化');
  delete S['觀察者'];
});

await check('結算不等動畫：慢速播放下引擎仍立即算完整回合，結果與快速模式相同，畫面狀態依時間軸落後', async () => {
  const mk = () => [[elf('A', 5000, [skill('打', 60)], 200)], [elf('X', 5000, [skill('打', 60)], 100)]];
  const runWith = async (fast: boolean) => {
    const [a, b] = mk();
    const engine: BattleEngine = createBattleEngine({ initialP1Team: a, initialP2Team: b, p1StarterId: 'A', p2StarterId: 'X', battleMode: 'PVP', preparedTeams: true,
      isFast: () => fast, animationSettings: () => ({ skill: true, damage: true, extra: true, potion: true, roundEnd: true }) as any });
    engine.mount(); engine.start();
    const t0 = Date.now();
    await turn(engine, use('p1', 0), use('p2', 0));
    return { engine, ms: Date.now() - t0 };
  };
  (globalThis as any).__BATTLE_SEED__ = 7;
  const slow = await runWith(false);
  assert.equal(slow.engine.getState().turnNumber, 2);
  assert.ok(slow.ms < 1000, `結算耗時 ${slow.ms}ms，未等動畫`);
  assert.equal(slow.engine.presentation.busy, true, '動畫仍在播放');
  assert.notEqual(slow.engine.presentation.view?.turnNumber, 2, '畫面尚未跳到下一回合');
  (globalThis as any).__BATTLE_SEED__ = 7;
  const fast = await runWith(true);
  const pick = (e: BattleEngine) => { const st = e.getState(); return [st.p1.currentHp, st.p2.currentHp, st.logs.map((l: any) => l.text)]; };
  assert.deepEqual(pick(slow.engine), pick(fast.engine));
  slow.engine.unmount(); fast.engine.unmount();
  delete (globalThis as any).__BATTLE_SEED__;
});

await check('全局規則（搬出引擎）：次元龍詩章、下一隻上場的守護印記、通用忽略對手速度', async () => {
  // 次元龍在場：回合開始所有存活精靈各記一篇詩章
  {
    // 詩章由 Kit 的 snapshot_resource_rule 安裝（不再依精靈名稱自動生效）——
    // 合成精靈需帶該規則才能驗證引擎的「回合開始全體累積」行為。
    const poemRule = { id: 'poem_chapter', name: '詩章', displayChar: '詩', snapshotKey: 'poemHpSnapshots',
      perRound: 1, receiverKey: 'all', unit: '篇', persistsOffField: true };
    const owner = elf('測試次元龍', 5000, [skill('等')], 200);
    owner.snapshotResourceRules = { poem_chapter: poemRule };
    const { engine } = battle([owner], [elf('X', 5000, [skill('等')], 100)]);
    await turn(engine, use('p1', 0), use('p2', 0));
    const st = engine.getState();
    assert.equal(st.p1Marks.find((m: any) => m.id === 'poem_chapter')?.count, 1);
    assert.equal(st.p2Marks.find((m: any) => m.id === 'poem_chapter')?.count, 1);
  }
  // 守護印記：nextElfGuardianMark 在下一隻登場時生效，回合結束遞減
  {
    R['設守護'] = (c: any) => { c.setPlayerState('nextElfGuardianMark', true); };
    const { engine } = battle([elf('A', 5000, [skill('設守護')], 200), elf('B', 5000, [skill('等')], 200)], [elf('X', 5000, [skill('等')], 100)]);
    await turn(engine, use('p1', 0), use('p2', 0));
    await turn(engine, e => e.onSwitchElf('p1', 1), use('p2', 0));
    const st = engine.getState();
    assert.equal(st.p1.name, 'B');
    assert.equal(st.p1Marks.find((m: any) => m.id === 'guardian_shield_mark')?.count, 1);
    assert.equal(st.p1RegistryState.guardianMarkTurns, 3, '登場 4 回合，當回合結束遞減為 3');
  }
  // 通用 opponentSpeedPenalty：設定後下一回合對手速度被扣，自身改為先手
  {
    R['減速'] = (c: any) => { c.setPlayerState('opponentSpeedPenalty', 1000); };
    const { engine, nodes } = battle([elf('A', 5000, [skill('減速')], 100)], [elf('X', 5000, [skill('等')], 120)]);
    await turn(engine, use('p1', 0), use('p2', 0));
    assert.equal(nodes.find(n => n.id === '3.1')!.d.side, 'p2', '第 1 回合對手較快');
    nodes.length = 0;
    await turn(engine, use('p1', 0), use('p2', 0));
    assert.equal(nodes.find(n => n.id === '3.1')!.d.side, 'p1', '第 2 回合忽略對手速度後自身先手');
  }
});

console.error = quiet;
console.log(`${count} checks`);
await server.close();
process.exit(0);
