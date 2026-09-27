/**
 * 偽隨機分布（PRD, Pseudo-Random Distribution）
 *
 * 每個「機率事件」各自保有失敗次數 N。第 N 次嘗試的實際觸發率為 min(1, C × N)，觸發後 N 歸零。
 * C 由名目機率 p 反推，使長期平均觸發率仍等於 p，但大幅降低「連續不觸發／連續觸發」的極端情況。
 *   例：p = 30% → C ≈ 11.9%，第 1 次 11.9%、第 2 次 23.8%…最多連續 8 次不觸發。
 * 事件鍵（key）建議包含：方位／精靈／來源，讓不同精靈、不同效果各自計數。
 */
let rngFn: () => number = Math.random;
const counters = new Map<string, number>();
const cCache = new Map<number, number>();

/** 每場戰鬥開始時呼叫：綁定戰鬥內的種子亂數並清空計數 */
export function resetPrd(rng: () => number) {
  rngFn = rng;
  counters.clear();
}

function pFromC(c: number): number {
  let procByN = 0, sumNP = 0;
  const maxN = Math.ceil(1 / c);
  for (let n = 1; n <= maxN; n++) {
    const procOnN = Math.min(1, n * c) * (1 - procByN);
    procByN += procOnN;
    sumNP += n * procOnN;
  }
  return 1 / sumNP;
}

export function prdConstant(p: number): number {
  const k = Math.round(p * 10000) / 10000;
  const hit = cCache.get(k);
  if (hit !== undefined) return hit;
  let lo = 0, hi = k, c = k;
  for (let i = 0; i < 40; i++) {
    c = (lo + hi) / 2;
    if (pFromC(c) > k) hi = c; else lo = c;
  }
  cCache.set(k, c);
  return c;
}

/** 以偽隨機判定機率 p（0~1）是否觸發 */
export function prdChance(key: string, p: number): boolean {
  if (!(p > 0)) return false;
  if (p >= 1) return true;
  const c = prdConstant(p);
  const n = (counters.get(key) || 0) + 1;
  if (rngFn() < Math.min(1, c * n)) {
    counters.set(key, 0);
    return true;
  }
  counters.set(key, n);
  return false;
}

/** 百分比版本（0~100） */
export const prdPercent = (key: string, percent: number) => prdChance(key, percent / 100);
