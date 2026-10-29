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

const FIELDS_KEY = 'seer_spotlight_field_sizes';
export function readSpotlightFieldSizes(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(FIELDS_KEY) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v==='number' && Number.isFinite(v)).map(([k,v])=>[k,clamp(v as number)]));
  } catch { return {}; }
}
export function saveSpotlightFieldSizes(sizes: Record<string, number>): void {
  try { localStorage.setItem(FIELDS_KEY, JSON.stringify(sizes)); } catch { /* 本次仍可閱讀 */ }
}
