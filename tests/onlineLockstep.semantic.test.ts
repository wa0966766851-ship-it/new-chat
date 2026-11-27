/**
 * 雙人連線（同步回合制）：兩份引擎各自只替自己那一側選擇，彼此只交換選擇，
 * 整場每回合的戰況摘要必須完全相同（2026-11-27）。
 * 不凍結 Math.random／Date.now：兩份引擎共用同一個環境亂數，正好模擬雙方電腦的環境亂數不同。
 * 兩份引擎各自從獨立的模組實例載入（PRD 計數等模組層級狀態不共用），等同雙方各自一台電腦。
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { SEEDED_SCENARIOS } from './helpers/seededBattle';

const mkServer = () => createServer({ optimizeDeps: { noDiscovery: true, include: [] }, resolve: { preserveSymlinks: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const server = await mkServer(), server2 = await mkServer();
const quiet = console.error; console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) quiet(...a); };
let checks = 0;
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const createEngine2 = (await server2.ssrLoadModule('/src/engine/battleEngine.ts')).createBattleEngine;
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { legalActions } = await server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const { makeRng } = await server.ssrLoadModule('/src/utils/rng.ts');
  const { battleChecksum, createRemoteQueue, validSelection, encodeLoadout, decodeLoadout } = await server.ssrLoadModule('/src/online/lockstep.ts');
  const byId = (id: string) => DEFAULT_ELVES.find((e: any) => String(e.id) === id);
  const team = (ids: string[], tag: string) => ids.map((id, i) => { const e = structuredClone(byId(id)); e.battleId = `${tag}${i}_${id}`; return e; });

  // 一、隊伍交換：編碼→解碼後與原隊伍摘要一致；被竄改時拒絕
  {
    const catalog = DEFAULT_ELVES.filter((e: any) => !e.isExtra && !e.isCustom);
    const mine = ['5000', '5029', '5041'].map(id => structuredClone(catalog.find((e: any) => String(e.id) === id)));
    mine[1].ev = { ...(mine[1].ev || {}), atk: 252 };
    const loadout = encodeLoadout(mine, '5029', { suit: '', eyewear: '', title: '', flame: '' }, catalog);
    const back = decodeLoadout(JSON.parse(JSON.stringify(loadout)), catalog, 3);
    assert.deepEqual(back.team.map((e: any) => e.id), mine.map(e => e.id));
    assert.equal(back.team[1].ev.atk, 252, '培養差異保留');
    const tampered = JSON.parse(JSON.stringify(loadout)); tampered.team[0].level = 999;
    assert.throws(() => decodeLoadout(tampered, catalog, 3), /資料不同/);
    assert.throws(() => decodeLoadout(JSON.parse(JSON.stringify(loadout)), catalog, 6), /數量不同/);
    checks++;
  }

  for (const sc of SEEDED_SCENARIOS) {
    const p1 = team(sc.p1, 'a'), p2 = team(sc.p2, 'b');
    const engines: Record<'p1' | 'p2', any> = {} as any;
    const queues: Record<'p1' | 'p2', any> = {} as any;
    let rejected = 0;
    for (const local of ['p1', 'p2'] as const) {
      const remote = local === 'p1' ? 'p2' : 'p1';
      engines[local] = (local === 'p1' ? createBattleEngine : createEngine2)({
        initialP1Team: structuredClone(p1), initialP2Team: structuredClone(p2), p1StarterId: p1[0].battleId, p2StarterId: p2[0].battleId,
        battleMode: 'PVP', randomSeed: sc.seed, isFast: () => true, preparedTeams: true,
        lockstep: { localSide: local, onLocalSelection: (sel: any) => {
          const wire = JSON.parse(JSON.stringify(sel));
          assert.ok(validSelection(wire, local), '送出的選擇通過格式檢查');
          queues[remote].push(wire);
        } },
      });
    }
    for (const local of ['p1', 'p2'] as const) {
      const e = engines[local];
      queues[local] = createRemoteQueue((sel: any) => e.applyRemoteSelection(sel));
      e.mount(); e.start();
    }
    const rng = { p1: makeRng(sc.seed + 1), p2: makeRng(sc.seed + 2) };
    const pick = (st: any, side: 'p1' | 'p2', forced: boolean) => {
      const l = legalActions(st, side, forced).filter((a: any) => a.kind === 'skill' || a.kind === 'switch');
      const skills = l.filter((a: any) => a.kind === 'skill'), pool = forced ? l : (skills.length ? skills : l);
      return pool.length ? pool[Math.floor(rng[side]() * pool.length)] : null;
    };
    const idle = async () => { for (let i = 0; i < 4; i++) { await engines.p1.idle(); await engines.p2.idle(); queues.p1.flush(); queues.p2.flush(); } };
    // 本機側在輪到自己時才選；遠端側一律不可由本機直接操作
    const step = (side: 'p1' | 'p2') => {
      const e = engines[side], st = e.getState();
      if (st.winner) return false;
      const forced = st.phase === 'forced_switch_both' ? side === 'p1' : st.phase === `forced_switch_${side}`;
      if (!(st.phase === `${side}_select` || forced)) return false;
      const a = pick(st, side, forced);
      if (a?.kind === 'skill') e.onSkillSelect(side, st[side].skills[a.slot]);
      else if (a?.kind === 'switch') e.onSwitchElf(side, a.index);
      else e.onPass(side);
      return true;
    };
    // 遠端側被本機直接呼叫時不生效
    {
      const st = engines.p1.getState();
      engines.p1.onSkillSelect('p2', st.p2.skills[0]);
      assert.equal(engines.p1.getState().p2SelectedSkill ?? null, st.p2SelectedSkill ?? null, `${sc.name} 本機不能替對手選招`);
    }
    let turns = 0;
    for (let guard = 0; guard < 400 && turns < sc.turns; guard++) {
      await idle();
      const a = engines.p1.getState(), b = engines.p2.getState();
      if (a.winner || b.winner) break;
      if (a.phase === 'p1_select' && b.phase === 'p1_select' && a.turnNumber === b.turnNumber) {
        assert.equal(battleChecksum(a), battleChecksum(b), `${sc.name} 第 ${a.turnNumber} 回合開始時戰況一致`);
        turns++;
      }
      const moved = step('p1') || step('p2');
      if (!moved && !queues.p1.pending && !queues.p2.pending) { await idle(); if (!step('p1') && !step('p2')) rejected++; }
      if (rejected > 20) break;
    }
    await idle();
    const fa = engines.p1.getState(), fb = engines.p2.getState();
    assert.ok(turns >= 5, `${sc.name} 至少打 5 回合（實際 ${turns}）`);
    assert.equal(battleChecksum(fa), battleChecksum(fb), `${sc.name} 最終戰況一致`);
    assert.equal(fa.winner ?? null, fb.winner ?? null, `${sc.name} 勝負一致`);
    for (const e of Object.values(engines)) e.unmount();
    console.log(`  ✓ ${sc.name}：${turns} 回合雙方戰況一致${fa.winner ? '，勝方 ' + fa.winner : ''}`);
    checks++;
  }
  console.log(`onlineLockstep: ${checks} checks passed`);
} finally { console.error = quiet; await server.close(); await server2.close(); }
