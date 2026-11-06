// 效能重構用：以固定種子跑整場 headless 6v6，逐回合把完整狀態做 canonical 雜湊，供「重構前後結果完全一致」比對。
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

export type SeededScenario = { name: string; seed: number; p1: string[]; p2: string[]; turns: number };
/** 代表性重量級陣容：卡修斯5041、奧丁5019、無極聖武、布林克克5007、聖光斯嘉麗5014、聖靈譜尼5000、雷伊系列。 */
export const SEEDED_SCENARIOS: SeededScenario[] = [
  { name: 'heavy-A', seed: 101, p1: ['5041', '5019', 'arena_14', '5007', '5014', '5000'], p2: ['5029', '7070', '707070', '5041', '5019', '5000'], turns: 30 },
  { name: 'heavy-B', seed: 202, p1: ['5000', '5029', '5041', '707070', 'arena_14', '5019'], p2: ['5014', '5007', '7070', '5000', '5041', 'arena_14'], turns: 30 },
  { name: 'heavy-C', seed: 303, p1: ['5019', '5019', '5041', '5000', '5014', '5007'], p2: ['707070', '5029', '5029', 'arena_14', '5000', '5041'], turns: 30 },
];

/** 額外精靈 id 內含 Date.now() 與亂數（x_puni_1793939875816_vee81），每次執行不同，雜湊前抹平。 */
const VOLATILE_ID = /_\d{13}_[a-z0-9]{3,8}/g;
/** 鍵排序＋略過 undefined／函式的穩定序列化；循環參照以路徑標記。 */
export function canonical(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: any): string => {
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return 'null';
    if (typeof v === 'string') return JSON.stringify(v.replace(VOLATILE_ID, '_<ts>'));
    if (v === null || typeof v !== 'object') return typeof v === 'number' && !Number.isFinite(v) ? `"${v}"` : JSON.stringify(v);
    if (seen.has(v)) return '"[cycle]"';
    seen.add(v);
    try {
      if (Array.isArray(v)) return `[${v.map(walk).join(',')}]`;
      if (v instanceof Map) return `{"map":${walk([...v.entries()])}}`;
      if (v instanceof Set) return `{"set":${walk([...v])}}`;
      return `{${Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] !== 'function').map(k => `${JSON.stringify(k.replace(VOLATILE_ID, '_<ts>'))}:${walk(v[k])}`).join(',')}}`;
    } finally { seen.delete(v); }
  };
  return walk(value);
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export async function createSeededRunner() {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, resolve: { preserveSymlinks: true }, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { legalActions } = await server.ssrLoadModule('/src/battle/ai/legalActions.ts');
  const { makeRng } = await server.ssrLoadModule('/src/utils/rng.ts');
  const quiet = console.error; console.error = (...a: any[]) => { if (String(a[0]).includes('[onNode]')) quiet(...a); };
  const byId = (id: string) => DEFAULT_ELVES.find((e: any) => String(e.id) === id);
  const mk = (ids: string[], tag: string) => ids.map((id, i) => { const e = structuredClone(byId(id)); e.battleId = `${tag}${i}_${id}`; return e; });
  const pick = (st: any, side: string, rng: () => number, forced: boolean) => {
    const l = legalActions(st, side, forced).filter((a: any) => a.kind === 'skill' || a.kind === 'switch');
    const skills = l.filter((a: any) => a.kind === 'skill'), pool = forced ? l : (skills.length ? skills : l);
    return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  };
  /** 回傳每回合的狀態雜湊鏈；counters 供效能守門測試讀取。 */
  async function run(sc: SeededScenario) {
    (globalThis as any).__BATTLE_SEED__ = sc.seed;
    const p1 = mk(sc.p1, 'a'), p2 = mk(sc.p2, 'b');
    let commits = 0;
    const engine = createBattleEngine({ initialP1Team: p1, initialP2Team: p2, p1StarterId: p1[0].battleId, p2StarterId: p2[0].battleId, battleMode: 'PVP', isFast: () => true, onStateCommit: () => { commits++; } });
    engine.mount(); engine.start();
    const rng = makeRng(sc.seed + 800);
    const chain: string[] = []; const commitsPerTurn: number[] = []; let played = 0;
    for (let t = 1; t <= sc.turns; t++) {
      await engine.idle();
      let st = engine.getState(); if (st.winner) break;
      const c0 = commits;
      for (let g = 0; g < 4 && st.phase.startsWith('forced_switch') && !st.winner; g++) {
        for (const side of ['p1', 'p2'] as const) if (st.phase === 'forced_switch_both' || st.phase === `forced_switch_${side}`) {
          const a = pick(st, side, rng, true); if (a?.kind === 'switch') { engine.onSwitchElf(side, a.index); await engine.idle(); st = engine.getState(); break; }
        }
      }
      if (st.winner || st.phase !== 'p1_select') break;
      for (const side of ['p1', 'p2'] as const) {
        const a = pick(engine.getState(), side, rng, false);
        if (a?.kind === 'skill') engine.onSkillSelect(side, engine.getState()[side].skills[a.slot]); else if (a?.kind === 'switch') engine.onSwitchElf(side, a.index);
      }
      await engine.idle();
      commitsPerTurn.push(commits - c0); played++;
      chain.push(sha(canonical(engine.getState())));
    }
    const fin = engine.getState();
    const result = { name: sc.name, turnsPlayed: played, winner: fin.winner ?? null, turnNumber: fin.turnNumber, logCount: fin.logs.length, logsHash: sha(canonical(fin.logs)), finalHash: sha(canonical(fin)), chainHash: sha(chain.join('|')) };
    engine.unmount();
    return { result, chain, commitsPerTurn };
  }
  return { run, server, close: async () => { console.error = quiet; await server.close(); } };
}
