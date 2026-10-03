/** 星蝕回廊：整局使用種子亂數（存檔記錄 nonce），重新載入不會重擲，避免 S/L。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 從 seed + nonce 建立擲骰器；用完把 nonce 寫回存檔。 */
export class Dice {
  private rng: () => number;
  constructor(public seed: number, public nonce: number) {
    this.rng = mulberry32((seed ^ Math.imul(nonce + 1, 0x9E3779B1)) >>> 0);
  }
  next(): number { this.nonce++; return this.rng(); }
  chance(p: number): boolean { return this.next() < p; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  pick<T>(items: readonly T[]): T { return items[Math.floor(this.next() * items.length)]; }
  weighted<T>(items: readonly { item: T; w: number }[]): T {
    const total = items.reduce((s, x) => s + Math.max(0, x.w), 0);
    let r = this.next() * total;
    for (const x of items) { r -= Math.max(0, x.w); if (r < 0) return x.item; }
    return items[items.length - 1].item;
  }
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  sample<T>(items: readonly T[], n: number): T[] { return this.shuffle(items).slice(0, n); }
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);
