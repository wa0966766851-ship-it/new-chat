import assert from 'node:assert/strict';
import { fitAdjusted, type GameRecord } from '../src/utils/strengthModel';
import { makeRng } from '../src/utils/rng';

// 調整後貢獻：強精靈帶飛的隊友不該被高估；先手優勢單獨估計。
const rng = makeRng(3);
const ids = Array.from({ length: 12 }, (_, i) => `e${i}`);
const truth: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
truth.e0 = 1.6; truth.e11 = -1.2; // e0 很強、e11 很弱，其他平均
const games: GameRecord[] = [];
const teamWins: Record<string, [number, number]> = Object.fromEntries(ids.map(id => [id, [0, 0]]));
for (let g = 0; g < 1500; g++) {
  const s = [...ids].sort(() => rng() - 0.5);
  // e1 刻意常和 e0 同隊（被帶飛）
  if (rng() < 0.7) { const i0 = s.indexOf('e0'), i1 = s.indexOf('e1'); const team0 = i0 < 3 ? 0 : 1; const want = team0 === 0 ? [0, 1, 2] : [3, 4, 5];
    if (!want.includes(i1)) { const j = want.find(k => s[k] !== 'e0')!; [s[i1], s[j]] = [s[j], s[i1]]; } }
  const a = s.slice(0, 3), b = s.slice(3, 6);
  const z = 0.2 + a.reduce((t, id) => t + truth[id], 0) - b.reduce((t, id) => t + truth[id], 0);
  const winner = rng() < 1 / (1 + Math.exp(-z)) ? 'a' : 'b';
  games.push({ a, b, winner });
  for (const id of a) { teamWins[id][1]++; if (winner === 'a') teamWins[id][0]++; }
  for (const id of b) { teamWins[id][1]++; if (winner === 'b') teamWins[id][0]++; }
}
const { rows, side } = fitAdjusted(games);
const by = Object.fromEntries(rows.map(r => [r.id, r]));
assert.equal(rows[0].id, 'e0', '最強者排第一'); assert.equal(rows.at(-1)!.id, 'e11', '最弱者排最後');
const rawE1 = teamWins.e1[0] / teamWins.e1[1];
assert.ok(rawE1 > 0.56, `前提：e1 的隊伍勝率被 e0 帶高（${rawE1.toFixed(3)}）`);
assert.ok(Math.abs(by.e1.coef) < 0.25, `調整後 e1 接近平均（${by.e1.coef}）`);
assert.ok(side > 0.05 && side < 0.4, `先手優勢單獨估出（${side}）`);
assert.ok(by.e0.rating > 0.7 && by.e11.rating < 0.35);
console.log(`調整後貢獻模型：強弱排序正確、被帶飛的隊友不被高估（隊伍勝率 ${(rawE1 * 100).toFixed(0)}% → 係數 ${by.e1.coef}）、先手 ${side}`);
