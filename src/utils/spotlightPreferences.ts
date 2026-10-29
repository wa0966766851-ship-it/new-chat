/** 只保存閱讀偏好，不改動精靈資料。 */
export const SPOTLIGHT_TEXT_SIZE_KEY = 'seer_spotlight_text_size';
const clamp = (value: number) => Number.isFinite(value) ? Math.min(160, Math.max(80, Math.round(value / 10) * 10)) : 100;
export function readSpotlightTextSize(): number {
  try { const value = localStorage.getItem(SPOTLIGHT_TEXT_SIZE_KEY); return value === null ? 100 : clamp(Number(value)); } catch { return 100; }
}
export function saveSpotlightTextSize(value: number): number {
  const size = clamp(value);
  try { localStorage.setItem(SPOTLIGHT_TEXT_SIZE_KEY, String(size)); } catch { /* 私密瀏覽仍可調整本次字級 */ }
  return size;
}
