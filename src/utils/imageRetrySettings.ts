export type ImageRetryMode = 'auto' | 'manual' | 'off';
export const IMAGE_RETRY_EVENT = 'seer-image-retry';
export const IMAGE_RETRY_SETTINGS_EVENT = 'seer-image-retry-settings';
const KEY = 'seerImageRetryMode';
export function readImageRetryMode(): ImageRetryMode {
  try { const value = localStorage.getItem(KEY); return value === 'manual' || value === 'off' ? value : 'auto'; } catch { return 'auto'; }
}
export function writeImageRetryMode(mode: ImageRetryMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* 儲存空間不可用時仍可操作。 */ }
  window.dispatchEvent(new Event(IMAGE_RETRY_SETTINGS_EVENT));
}
