/**
 * 背景音樂「播完停幾秒再重播」（2026-11-08，使用者：像遊戲一樣自動重播，中間等幾秒）。
 * 預設開、間隔 5 秒（0～60）。YouTube 以播放結束事件觸發；B站沒有結束事件，以影片長度計時。
 */
const ON = 'seer_music_replay', GAP = 'seer_music_replay_gap';
export const DEFAULT_REPLAY_GAP = 5;
export function readMusicReplay(): { enabled: boolean; gap: number } {
  try {
    const g = Number(localStorage.getItem(GAP));
    return { enabled: localStorage.getItem(ON) !== '0', gap: Number.isFinite(g) && localStorage.getItem(GAP) !== null ? Math.max(0, Math.min(60, Math.round(g))) : DEFAULT_REPLAY_GAP };
  } catch { return { enabled: true, gap: DEFAULT_REPLAY_GAP }; }
}
export function writeMusicReplay(v: { enabled: boolean; gap: number }) {
  try { localStorage.setItem(ON, v.enabled ? '1' : '0'); localStorage.setItem(GAP, String(Math.max(0, Math.min(60, Math.round(v.gap))))); } catch { /* 只影響本次 */ }
}
/** B站：從開始播放到下一次重播的毫秒數（長度＋間隔）；長度未知時不排程。 */
export function bilibiliReplayDelayMs(durationSec: number | null | undefined, gapSec: number): number | null {
  return durationSec && durationSec > 0 ? Math.round((durationSec + Math.max(0, gapSec)) * 1000) : null;
}
