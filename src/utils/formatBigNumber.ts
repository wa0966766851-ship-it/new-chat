/**
 * 通用大數字格式化（結算畫面、戰鬥 HUD 共用）。
 * |n| < 100,000 千分位完整顯示；以上用中文萬進位單位（萬…極），整數部分 1~4 位；
 * |n| ≥ 1e52 改科學記號。完整精確值請用 formatFullNumber 放 title。
 */
export const BIG_UNITS: ReadonlyArray<readonly [string, number]> = [
  ['萬', 1e4], ['億', 1e8], ['兆', 1e12], ['京', 1e16], ['垓', 1e20], ['秭', 1e24],
  ['穰', 1e28], ['溝', 1e32], ['澗', 1e36], ['正', 1e40], ['載', 1e44], ['極', 1e48],
];
export const BIG_SCI_THRESHOLD = 1e52;
export const BIG_PLAIN_LIMIT = 1e5;

const group = (n: number, maxFrac = 0) => n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });

/** 取 sig 位有效數字（至少保留整數），去尾零。回傳數值字串（含千分位）。 */
function mantissa(m: number, sig: number): { text: string; value: number } {
  const intDigits = Math.floor(Math.log10(m)) + 1;
  const frac = Math.max(0, sig - intDigits);
  const v = Number(m.toFixed(frac));
  return { text: group(v, frac), value: v };
}

export interface FormatBigOptions { sig?: number }

export function formatBigNumber(n: number, opts: FormatBigOptions = {}): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (n === Infinity) return '∞';
  if (n === -Infinity) return '-∞';
  const sig = Math.max(2, Math.min(6, opts.sig ?? 4));
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs < BIG_PLAIN_LIMIT) return (Object.is(Math.round(n), -0) ? '0' : group(Math.round(n)));
  const sci = () => {
    const [m, e] = abs.toExponential(Math.max(1, sig - 2)).split('e');
    return `${sign}${m}e${Number(e)}`;
  };
  if (abs >= BIG_SCI_THRESHOLD) return sci();
  let i = 0;
  for (let k = 0; k < BIG_UNITS.length; k++) if (abs >= BIG_UNITS[k][1]) i = k;
  let r = mantissa(abs / BIG_UNITS[i][1], sig);
  // 四捨五入後達 10000 → 進位到下一個單位（9.9995e7 → 1億）
  if (r.value >= 1e4) {
    if (i + 1 >= BIG_UNITS.length) return sci();
    i += 1; r = mantissa(abs / BIG_UNITS[i][1], sig);
  }
  return `${sign}${r.text}${BIG_UNITS[i][0]}`;
}

/** 精確完整值（千分位），給 title tooltip。 */
export function formatFullNumber(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
  const r = Math.round(n);
  return Object.is(r, -0) ? '0' : r.toLocaleString('en-US', { maximumFractionDigits: 0, useGrouping: true });
}

/** 戰鬥 HUD 用：< 1e5 維持原樣字串，以上才縮寫（不改變既有小數字顯示）。 */
export function formatCompactHud(n: number): string {
  return Math.abs(n) < BIG_PLAIN_LIMIT ? String(n) : formatBigNumber(n);
}

/** 比例（0~100）：分母為 0／非有限時回 0，不產生 NaN。 */
export function safePct(part: number, total: number): number {
  const r = part / total * 100;
  return Number.isFinite(r) ? r : 0;
}
