import assert from 'node:assert/strict';
import test from 'node:test';
import { ring, rule, brush, blade, sparkle, rng, clamp, lerp, easeOut, easeInOut, dist, TAU, PAPER_PALETTE, DW, INK_OFFSET, inkLayers, stamp, hatch, cross } from '../src/design/sketchStroke';

// 2026-10-29：手繪筆法模組（移植自拾光行記模板）。
// 這些是純函式，必須：決定性、格式正確、值域合法。

test('rng 是決定性的（同 seed 同序列）', () => {
  const a = rng(123), b = rng(123);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('rng 值域落在 [0, 1)', () => {
  const R = rng(999);
  for (let i = 0; i < 200; i++) {
    const v = R();
    assert.ok(v >= 0 && v < 1, `值 ${v} 超出 [0,1)`);
  }
});

test('rng 不同 seed 產生不同序列', () => {
  const a = rng(1), b = rng(2);
  assert.notEqual(a(), b());
});

test('ring 回傳合法 SVG path 且同 seed 決定性', () => {
  const d1 = ring(100, 100, 50, 42);
  const d2 = ring(100, 100, 50, 42);
  assert.equal(d1, d2, '同 seed 必須完全相同');
  assert.match(d1, /^M[\d.-]+ [\d.-]+(L[\d.-]+ [\d.-]+)+$/, '必須是 M/L 序列');
  assert.notEqual(d1, ring(100, 100, 50, 43), '不同 seed 必須不同');
});

test('ring 半徑會起伏（不是完美圓）', () => {
  const d = ring(0, 0, 100, 7);
  const pts = [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(m => Math.hypot(+m[1], +m[2]));
  const min = Math.min(...pts), max = Math.max(...pts);
  assert.ok(max - min > 0.5, `半徑應有起伏，實際 ${min.toFixed(2)}~${max.toFixed(2)}`);
});

test('rule 使用二次貝茲（Q）', () => {
  assert.ok(rule(0, 0, 100, 0, 7).includes('Q'));
});

test('rule 兩端會衝出端點', () => {
  const d = rule(0, 0, 100, 0, 7);
  const m = d.match(/^M([\d.-]+)/);
  assert.ok(Number(m![1]) < 0, '起點應在 x=0 左側（衝出）');
});

test('brush 回傳閉合輪廓', () => {
  assert.ok(brush([[0, 0], [10, 5], [20, 0]], 6).endsWith('Z'));
});

test('brush 少於 2 點回傳空字串', () => {
  assert.equal(brush([[0, 0]], 6), '');
});

test('blade 回傳閉合柳葉形', () => {
  assert.ok(blade(50, 50, 30, 0, 8).endsWith('Z'));
});

test('sparkle 產生指定條數的線段', () => {
  const d = sparkle(50, 50, 20, 8, 3);
  assert.equal((d.match(/M/g) || []).length, 8);
});

test('數學輔助函式行為正確', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(dist(0, 0, 3, 4), 5);
  assert.ok(Math.abs(TAU - Math.PI * 2) < 1e-12);
});

test('色票是拾光行記原始五色', () => {
  assert.deepEqual(PAPER_PALETTE, {
    paper: '#F2EDE4', ink: '#16307A', cobalt: '#1F4FD8', pale: '#7C9BE8', warm: '#E8622B',
  });
});

// 2026-10-31：隨機源對齊拾光行記（mulberry32）。圖形因此與舊版（xorshift）不同，這是刻意的；
// 下面的參考實作逐字抄自 index.html 的 rng，不是被測碼的拷貝，逐值比對。
function referenceRng(seed: number) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
test('rng 與拾光行記 index.html 的 mulberry32 逐值相同', () => {
  for (const seed of [0, 1, 7, 123, 4242, 20240, 900, 0xFFFFFFFF, -5]) {
    const a = rng(seed), b = referenceRng(seed);
    for (let i = 0; i < 64; i++) assert.equal(a(), b(), `seed ${seed} 第 ${i} 個值`);
  }
});
test('rng 固定值（防止被無意改回其他演算法）', () => {
  const R = rng(1);
  assert.equal(R().toFixed(10), referenceRng(1)().toFixed(10));
  assert.notEqual(rng(1)().toFixed(6), '0.000000');
});
test('ring 圖形隨 rng 改變：同 seed 仍決定性，且與參考 rng 驅動的首點一致', () => {
  const R = referenceRng(42);
  const a1 = 0.012 + R() * 0.006, a2 = 0.004 + R() * 0.003, f1 = 2 + Math.floor(R() * 3), f2 = 5 + Math.floor(R() * 4);
  const p1 = R() * TAU, p2 = R() * TAU, st = R() * TAU;
  const rr = 50 * (1 + a1 * Math.sin(f1 * st + p1) + a2 * Math.sin(f2 * st + p2));
  const expect = `M${(100 + Math.cos(st) * rr).toFixed(2)} ${(100 + Math.sin(st) * rr).toFixed(2)}`;
  assert.ok(ring(100, 100, 50, 42).startsWith(expect), '起點必須由參考 rng 的前 7 個值決定');
});
test('DW 線寬依景深：0.6／0.85／1.15／1.55', () => {
  assert.equal(DW(0.2), 0.6); assert.equal(DW(0.3), 0.85); assert.equal(DW(0.5), 0.85); assert.equal(DW(0.6), 1.15); assert.equal(DW(0.99), 1.15); assert.equal(DW(1), 1.55); assert.equal(DW(1.4), 1.55);
});
test('inkLayers：套印錯位＝先描偏移 (1.15, 0.95)、透明度 ×0.4 的一遍，再描正本', () => {
  const [shadow, main] = inkLayers('M0 0L1 1', { color: '#123456', width: 2, alpha: 0.5 });
  assert.deepEqual([shadow.dx, shadow.dy, shadow.alpha], [INK_OFFSET.x, INK_OFFSET.y, 0.5 * 0.4]); assert.deepEqual([main.dx, main.dy, main.alpha], [0, 0, 0.5]);
  assert.equal(inkLayers('M0 0L1 1', { inked: false }).length, 1); assert.equal(INK_OFFSET.x, 1.15); assert.equal(INK_OFFSET.y, 0.95);
  assert.equal(inkLayers('M0 0', { dash: [3, 9] })[1].dash, '3 9');
});
test('stamp／hatch／cross 為決定性 path', () => {
  assert.equal(stamp(0, 0, 20, 10, 5), stamp(0, 0, 20, 10, 5)); assert.equal((stamp(0, 0, 20, 10, 5).match(/M/g) || []).length, 4);
  const h = hatch(0, 0, 40, 20, 8, 3); assert.equal(h, hatch(0, 0, 40, 20, 8, 3)); assert.ok((h.match(/M/g) || []).length >= 5);
  const c = cross(50, 50, 30, 9); assert.equal(c, cross(50, 50, 30, 9)); assert.equal((c.match(/Z/g) || []).length, 2); assert.notEqual(c, cross(50, 50, 30, 10));
});

console.log('手繪筆法模組：決定性、格式、值域、色票 全部通過');
