/**
 * AI 自我對戰（2026-11-07）：讓 AI 實際組陣容對打，統計精靈與陣容的實戰勝率，並比較 AI 設定強弱。
 *
 * 用法（專案根目錄）：
 *   npx tsx scripts/selfplay.ts --games 60 --format peak_6v6 --size 6 --seed 1 --out src/data/elfStrength.json
 *   npx tsx scripts/selfplay.ts --games 40 --ab hard:control,balanced:balanced   （A/B：兩種 AI 設定互打，左右交換以抵消先後手）
 *
 * 做法：
 * - 陣容：每局從精靈池隨機抽兩隊（不重複），雙方都由 AI 操作（P1 托管＋P2 電腦），使用正式引擎與正式規則。
 * - 統計：每隻精靈「出場隊伍的勝率」＋貝氏平滑（先驗 50%、權重 k），另記 1 對 1 的對位勝負。
 * - 輸出：elfStrength.json（勝率、場數、平滑分數），供命運之輪 AI 選角／禁用參考；並印出 A/B 結果。
 * - 回合上限：巔峰 6V6 依正式規則 50 回合判定；其他格式以 --maxTurns 截斷（截斷算平手，不計勝率）。
 */
import { createServer } from 'vite';
import fs from 'node:fs';
import { fitAdjusted, type GameRecord } from '../src/utils/strengthModel';

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const GAMES = Number(arg('games', '20')), SIZE = Number(arg('size', '6')), FORMAT = arg('format', 'peak_6v6')!;
const SEED = Number(arg('seed', '1')), MAX_TURNS = Number(arg('maxTurns', '60')), OUT = arg('out');
const AB = arg('ab'); // 例：hard:control,balanced:balanced（難度:風格）
const PRIOR_K = 6;

const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
const quiet = console.error, warn = console.warn; console.error = () => {}; console.warn = () => {};
try {
  const { createBattleEngine } = await server.ssrLoadModule('/src/engine/battleEngine.ts');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
  const { prepareSavedBattleRoster } = await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
  const { DEFAULT_AI_SETTINGS } = await server.ssrLoadModule('/src/battle/ai/settings.ts');
  const { makeRng } = await server.ssrLoadModule('/src/utils/rng.ts');
  const rng = makeRng(SEED);
  const pool: any[] = DEFAULT_ELVES.filter((e: any) => !e.isExtra && e.skills?.length);
  const pick = (n: number, avoid: Set<string>) => {
    const ids = pool.filter(e => !avoid.has(String(e.id)));
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids.slice(0, n);
  };
  const settingOf = (spec?: string) => {
    if (!spec) return { ...DEFAULT_AI_SETTINGS, mode: 'heuristic' };
    const [difficulty, style] = spec.split(':');
    return { ...DEFAULT_AI_SETTINGS, mode: 'heuristic', difficulty, style: style || DEFAULT_AI_SETTINGS.style };
  };
  const abSpecs = AB ? AB.split(',') : null;

  async function play(teamA: any[], teamB: any[], specA?: string, specB?: string) {
    const t1 = prepareSavedBattleRoster(teamA.map(e => structuredClone(e)), DEFAULT_ELVES, false, 'p1');
    const t2 = prepareSavedBattleRoster(teamB.map(e => structuredClone(e)), DEFAULT_ELVES, false, 'p2');
    const sA = settingOf(specA), sB = settingOf(specB);
    const engine = createBattleEngine({ initialP1Team: t1, initialP2Team: t2, p1StarterId: t1[0].battleId, p2StarterId: t2[0].battleId,
      battleMode: 'PVE', battleFormat: FORMAT, preparedTeams: true, isFast: () => true, randomSeed: Math.floor(rng() * 1e9),
      // 雙方各自的 AI 風格：style＝P2 電腦、ownStyle＝托管 P1（難度為雙方共用設定，A/B 請比較風格）
      aiSettings: () => ({ ...sB, ownStyle: sA.style }) });
    engine.mount(); engine.start(); await engine.idle();
    engine.dispatch({ type: 'SET_AUTO_BATTLE', isAuto: true });
    const begin = Date.now();
    for (let i = 0; i < 4000; i++) {
      const st = engine.getState();
      if (st.winner || st.turnNumber > MAX_TURNS || Date.now() - begin > 120000) break;
      await new Promise(r => setTimeout(r, 5));
      await engine.idle();
    }
    const st = engine.getState(); engine.unmount();
    return { winner: st.winner as ('p1' | 'p2' | 'draw' | null), turns: st.turnNumber, ms: Date.now() - begin };
  }

  const stats = new Map<string, { name: string; games: number; wins: number; draws: number }>();
  const pair = new Map<string, { a: number; b: number }>();
  const ab = abSpecs ? { [abSpecs[0]]: 0, [abSpecs[1]]: 0, draws: 0 } as Record<string, number> : null;
  let done = 0, totalMs = 0, timeouts = 0;
  const gameLog: GameRecord[] = [];
  const LOG = OUT ? OUT.replace(/\.json$/, '') + '.games.json' : null; // 每局陣容與勝負（供調整後貢獻模型）
  const prevLog: GameRecord[] = LOG && fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
  // 既有結果在開始時讀一次；每 10 局與結束時寫出（中斷也不會白跑）
  const prev = OUT && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const currentRows = () => [...stats.entries()].map(([id, s]) => ({ id, name: s.name, games: s.games, wins: s.wins, draws: s.draws,
    winRate: s.games ? s.wins / s.games : null, score: (s.wins + PRIOR_K * 0.5) / (s.games + PRIOR_K) }))
    .sort((a, b) => b.score - a.score);
  const writeOut = () => {
    if (!OUT) return;
    const merged = new Map<string, any>((prev?.elves || []).map((r: any) => [r.id, r]));
    for (const r of currentRows()) { const p = merged.get(r.id); merged.set(r.id, p ? { ...r, games: p.games + r.games, wins: p.wins + r.wins, draws: (p.draws || 0) + r.draws } : r); }
    const allGames = [...prevLog, ...gameLog];
    const fit = allGames.length ? fitAdjusted(allGames) : null;
    const adj = new Map(fit?.rows.map(r => [r.id, r]) ?? []);
    const elves = [...merged.values()].map(r => ({ id: r.id, name: r.name, games: r.games, wins: r.wins, draws: r.draws || 0,
      score: Number(((r.wins + PRIOR_K * 0.5) / (r.games + PRIOR_K)).toFixed(4)),
      ...(adj.has(r.id) ? { adjusted: adj.get(r.id)!.rating } : {}) })).sort((a, b) => b.score - a.score);
    if (LOG) fs.writeFileSync(LOG, JSON.stringify(allGames) + '\n');
    fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), format: FORMAT, teamSize: SIZE,
      totalGames: (prev?.totalGames || 0) + done, priorK: PRIOR_K, sideAdvantage: fit?.side ?? null, adjustedGames: allGames.length,
      note: 'score＝隊伍勝率＋貝氏平滑；adjusted＝扣除隊友與對手後的個體貢獻（L2 邏輯迴歸，換算為對上平均的勝率）；由 scripts/selfplay.ts 產生', elves }, null, 1) + '\n');
  };
  for (let g = 0; g < GAMES; g++) {
    const A = pick(SIZE, new Set()), B = pick(SIZE, new Set(A.map(e => String(e.id))));
    // A/B：偶數局 A 設定在 P1、奇數局交換，抵消先後手與陣容偏差
    const swap = !!abSpecs && g % 2 === 1;
    const r = await play(A, B, abSpecs ? abSpecs[swap ? 1 : 0] : undefined, abSpecs ? abSpecs[swap ? 0 : 1] : undefined);
    done++; totalMs += r.ms;
    const decided = r.winner === 'p1' || r.winner === 'p2';
    if (!decided) timeouts++;
    for (const [team, side] of [[A, 'p1'], [B, 'p2']] as const) for (const e of team) {
      const s = stats.get(String(e.id)) || { name: e.name, games: 0, wins: 0, draws: 0 };
      if (decided) { s.games++; if (r.winner === side) s.wins++; } else s.draws++;
      stats.set(String(e.id), s);
    }
    if (decided && SIZE === 1) { const k = [A[0].id, B[0].id].join('|'); const p = pair.get(k) || { a: 0, b: 0 }; r.winner === 'p1' ? p.a++ : p.b++; pair.set(k, p); }
    if (decided && !abSpecs) gameLog.push({ a: A.map(e => String(e.id)), b: B.map(e => String(e.id)), winner: r.winner === 'p1' ? 'a' : 'b' });
    if (ab) { if (!decided) ab.draws++; else ab[(r.winner === 'p1') !== swap ? abSpecs![0] : abSpecs![1]]++; }
    if (done % 10 === 0) writeOut();
    process.stdout.write(`\r${done}/${GAMES} 局（平均 ${(totalMs / done / 1000).toFixed(1)} 秒，未分勝負 ${timeouts}）`);
  }
  process.stdout.write('\n');
  const rows = currentRows();
  console.log('\n精靈實戰分數（隊伍勝率，貝氏平滑）前 15：');
  for (const r of rows.slice(0, 15)) console.log(`  ${r.name.padEnd(12)} ${r.wins}/${r.games}  平滑 ${(r.score * 100).toFixed(1)}%`);
  if (ab) console.log(`\nA/B：${abSpecs![0]} ${ab[abSpecs![0]]} 勝、${abSpecs![1]} ${ab[abSpecs![1]]} 勝、未分 ${ab.draws}`);
  if (OUT) { writeOut(); console.log(`已寫入 ${OUT}`); }
} finally { console.error = quiet; console.warn = warn; await server.close(); }
process.exit(0);
