/**
 * 效能模式（2026-11-16）：低階電腦防卡頓。
 * 開啟時於 <html data-perf="lite">：移除背景模糊（backdrop-filter）、停用無限循環的裝飾動畫、
 * 並讓 motion 元件改用減少動態（只保留必要的淡入淡出）。不影響戰鬥結算與存檔。
 * 設定：自動（預設）／開／關。自動＝依硬體與實測幀時間判斷。
 */
export type PerfPreference = 'auto' | 'on' | 'off';
export const PERF_KEY = 'seer_perf_mode';
export const PERF_EVENT = 'seer-perf-mode-change';

let autoLite: boolean | null = null;

export function readPerfPreference(): PerfPreference {
  try { const v = localStorage.getItem(PERF_KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}

/** 硬體提示：核心數少或記憶體小時直接視為低階。 */
export function weakHardwareHint(nav: { hardwareConcurrency?: number; deviceMemory?: number } | undefined = typeof navigator === 'undefined' ? undefined : navigator as any): boolean {
  if (!nav) return false;
  return (Number(nav.hardwareConcurrency) > 0 && Number(nav.hardwareConcurrency) <= 4) || (Number(nav.deviceMemory) > 0 && Number(nav.deviceMemory) <= 4);
}

/** 幀時間判斷：平均超過 22ms（<45fps）或超過 1/5 的幀超過 50ms 視為吃力。 */
export function framesLookSlow(deltas: number[]): boolean {
  if (deltas.length < 30) return false;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return avg > 22 || deltas.filter(d => d > 50).length > deltas.length / 5;
}

export function perfLiteActive(pref: PerfPreference = readPerfPreference()): boolean {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return autoLite ?? weakHardwareHint();
}

export function applyPerfMode(pref: PerfPreference = readPerfPreference()): boolean {
  const lite = perfLiteActive(pref);
  if (typeof document !== 'undefined') {
    if (lite) document.documentElement.dataset.perf = 'lite'; else delete document.documentElement.dataset.perf;
  }
  return lite;
}

export function writePerfPreference(pref: PerfPreference): void {
  try { localStorage.setItem(PERF_KEY, pref); } catch { /* 無法保存時只套用本次 */ }
  applyPerfMode(pref);
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(PERF_EVENT));
}

/** 啟動時量 2 秒幀時間；自動模式下吃力就切到精簡。 */
export function startPerfAutoDetect(): void {
  applyPerfMode();
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  const deltas: number[] = []; let last: number | undefined; const begin = performance.now();
  const frame = (now: number) => {
    if (document.hidden) return; // 背景分頁的幀不具代表性
    if (last !== undefined) deltas.push(now - last);
    last = now;
    if (now - begin < 2500) { requestAnimationFrame(frame); return; }
    autoLite = weakHardwareHint() || framesLookSlow(deltas);
    if (readPerfPreference() === 'auto') { applyPerfMode('auto'); window.dispatchEvent(new window.Event(PERF_EVENT)); }
  };
  requestAnimationFrame(frame);
}
