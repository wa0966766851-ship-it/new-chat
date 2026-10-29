import assert from 'node:assert/strict';
import test from 'node:test';
import { ring, rule, brush, blade, sparkle, rng, clamp, lerp, easeOut, easeInOut, dist, TAU, PAPER_PALETTE } from '../src/design/sketchStroke';

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

console.log('手繪筆法模組：決定性、格式、值域、色票 全部通過');
