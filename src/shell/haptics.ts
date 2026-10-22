/**
 * 觸覺回饋 — 手遊的基本手感
 *
 * 為什麼需要它：
 *   手機上「按下去有沒有反應」很大一部分靠震動。
 *   目前 Aegis 完全沒有（全專案 0 處 navigator.vibrate）。
 *
 * 設計原則：
 *   1. **預設開啟但可關**（存 localStorage）—— 有人不喜歡手機震動。
 *   2. **一律優雅降級**：不支援的瀏覽器（iOS Safari 沒有 vibrate）直接跳過，不報錯。
 *   3. **尊重 reduced-motion**：使用者已表示不想被動態干擾時，不要額外震動。
 *   4. **強度分級**：輕（按鍵）、中（確認）、重（錯誤／命中）——不要每件事都用力震。
 *
 * 對應 cues.ts 的拍點，但震動時長是獨立的（震動太長會煩）。
 */

export type HapticStrength = "light" | "medium" | "heavy";

/** 震動時長（毫秒）。比視覺動效短很多，避免煩躁。 */
const DURATION: Record<HapticStrength, number> = {
  light: 8,
  medium: 16,
  heavy: [12, 40, 18] as unknown as number, // 三段式，用於錯誤／擊中
};

const STORAGE_KEY = "seer_haptics_enabled";

/** 使用者是否開啟觸覺（預設開） */
export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* 無痕模式：靜默失敗 */
  }
}

/** 是否該震動（三個條件都要成立） */
function canVibrate(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  if (!isHapticsEnabled()) return false;
  // 尊重 reduced-motion：不要額外干擾
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* 沒有 matchMedia 就當作可以 */
  }
  return true;
}

/**
 * 觸發觸覺回饋
 *
 * @returns 是否真的震了（給測試用；實際裝置上多數瀏覽器回傳 true/false 不可靠）
 */
export function haptic(strength: HapticStrength = "light"): boolean {
  if (!canVibrate()) return false;
  try {
    const pattern = strength === "heavy" ? [12, 40, 18] : DURATION[strength];
    return navigator.vibrate(pattern as number | number[]);
  } catch {
    return false;
  }
}

/** 給 UI 用：切換開關 */
export function toggleHaptics(): boolean {
  const next = !isHapticsEnabled();
  setHapticsEnabled(next);
  return next;
}