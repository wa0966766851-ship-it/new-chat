// src/utils/rng.ts
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 第一類偽隨機 (PRNG / 袋鼠保底累積機率機制)
const prngFailCountMap: Record<string, number> = {};

export function checkPRNG(key: string, expectedRate: number, rngFunc: () => number = Math.random): boolean {
  if (expectedRate <= 0) return false;
  if (expectedRate >= 1) return true;
  // 第一類偽隨機基礎常數 C 估算
  let C = expectedRate * 0.45;
  if (expectedRate >= 0.5) C = expectedRate * 0.65;
  const failCount = prngFailCountMap[key] || 0;
  const actualRate = Math.min(1.0, (failCount + 1) * C);
  const success = rngFunc() < actualRate;
  if (success) {
    prngFailCountMap[key] = 0;
  } else {
    prngFailCountMap[key] = failCount + 1;
  }
  return success;
}

export function resetPRNG() {
  for (const k in prngFailCountMap) delete prngFailCountMap[k];
}

