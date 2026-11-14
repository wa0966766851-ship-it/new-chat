/**
 * 精靈實戰強度模型（2026-11-07）。
 *
 * 「隊伍勝率」會被隊友拖累或帶飛：強精靈跟弱隊友同隊時勝率被低估。
 * 這裡用「調整後貢獻」（類似籃球的 adjusted plus-minus）：
 *   P(A 隊勝) = σ( Σ_{i∈A} s_i − Σ_{j∈B} s_j + h·先手 )
 * 以 L2 正則化的邏輯迴歸估 s_i（λ 越大越保守、沒出場的精靈維持 0），
 * 再把 s_i 換算成「與平均隊友同隊、對上平均對手時的勝率」顯示。
 */
export interface GameRecord { a: string[]; b: string[]; winner: 'a' | 'b' }
export interface AdjustedRow { id: string; games: number; coef: number; rating: number }

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** 估計每隻精靈的貢獻係數。side＝先手（P1）優勢，一併估計以免混進精靈分數。 */
export function fitAdjusted(games: GameRecord[], opts: { lambda?: number; iters?: number; lr?: number } = {}): { rows: AdjustedRow[]; side: number } {
  const lambda = opts.lambda ?? 1.5, iters = opts.iters ?? 600, lr = opts.lr ?? 0.08;
  const ids = [...new Set(games.flatMap(g => [...g.a, ...g.b]))];
  const idx = new Map(ids.map((id, i) => [id, i]));
  const w = new Float64Array(ids.length), count = new Float64Array(ids.length);
  for (const g of games) for (const id of [...g.a, ...g.b]) count[idx.get(id)!]++;
  let side = 0;
  const n = Math.max(1, games.length);
  for (let t = 0; t < iters; t++) {
    const grad = new Float64Array(ids.length); let gSide = 0;
    for (const g of games) {
      let z = side;
      for (const id of g.a) z += w[idx.get(id)!];
      for (const id of g.b) z -= w[idx.get(id)!];
      const err = sigmoid(z) - (g.winner === 'a' ? 1 : 0);
      gSide += err;
      for (const id of g.a) grad[idx.get(id)!] += err;
      for (const id of g.b) grad[idx.get(id)!] -= err;
    }
    for (let i = 0; i < ids.length; i++) w[i] -= lr * (grad[i] / n + (lambda / n) * w[i]);
    side -= lr * gSide / n;
  }
  const rows = ids.map((id, i) => ({ id, games: count[i], coef: Number(w[i].toFixed(4)), rating: Number(sigmoid(w[i]).toFixed(4)) }))
    .sort((x, y) => y.coef - x.coef);
  return { rows, side: Number(side.toFixed(4)) };
}
