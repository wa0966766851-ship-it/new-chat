// 大數字格式化：萬進位單位、邊界、進位跨單位、科學記號、非有限值、負數。
import assert from 'node:assert/strict';
import { formatBigNumber as f, formatFullNumber as full, formatCompactHud, safePct } from '../src/utils/formatBigNumber';

assert.equal(f(0), '0');
assert.equal(f(-0), '0');
assert.equal(f(99_999), '99,999', '< 100,000 千分位完整');
assert.equal(f(1_234), '1,234');
assert.equal(f(100_000), '10萬', '100,000 起用單位');
assert.equal(f(123_456), '12.35萬');
assert.equal(f(1e8), '1億');
assert.equal(f(1.5e8), '1.5億');
assert.equal(f(99_995_000), '1億', '9.9995e7 進位後跨單位（9999.5萬 → 1億）');
assert.equal(f(99_994_000), '9,999萬', '未進位時整數部分最多 4 位');
assert.equal(f(1e12), '1兆');
assert.equal(f(1e16), '1京');
assert.equal(f(1e42), '100正');
assert.equal(f(1.0306089843750003e42), '103.1正');
assert.match(f(2.4975e41), /^24\.9[78]正$/);
assert.equal(f(1e48), '1極');
assert.equal(f(9.9995e51), '1.00e52', '進位後超出極 → 科學記號');
assert.equal(f(1e52), '1.00e52');
assert.equal(f(1.234e60), '1.23e60');
assert.equal(f(-1.234e60), '-1.23e60');
assert.equal(f(Infinity), '∞');
assert.equal(f(-Infinity), '-∞');
assert.equal(f(NaN), '—');
assert.equal(f(-5), '-5');
assert.equal(f(-1_234_567), '-123.5萬');
assert.equal(f(-99_999), '-99,999');
for (const n of [3, 12345, 5e5, 7.7e9, 3e13, 1e19, 4e25, 8e30, 1e35, 6e39, 9e43, 2e47, 1.03e42, 2.4975e41]) {
  const s = f(n);
  assert.ok(!/NaN|undefined/.test(s), s);
  assert.ok(s.length <= 9, `${n} -> ${s} 長度`);
}
// 整數部分 1~4 位
for (let e = 5; e < 52; e++) {
  const m = /^-?([\d,]+)(?:\.\d+)?[^\d]/.exec(f(1.2345 * 10 ** e));
  assert.ok(m && m[1].replace(/,/g, '').length <= 4, `1.2345e${e} -> ${f(1.2345 * 10 ** e)}`);
}
// 完整值
assert.equal(full(99_999), '99,999');
assert.equal(full(1e8), '100,000,000');
assert.ok(full(1.0306089843750003e42).startsWith('1,030,608,984,375,000,300'));
assert.equal(full(Infinity), '∞');
assert.equal(full(NaN), '—');
// HUD：小數字原樣
assert.equal(formatCompactHud(1234), '1234');
assert.equal(formatCompactHud(1e42), '100正');
// 比例
assert.equal(safePct(1e42, 4e42), 25);
assert.equal(safePct(0, 0), 0);
assert.equal(safePct(Infinity, Infinity), 0);
assert.equal(safePct(1, 0), 0);
console.log('✓ formatBigNumber');
