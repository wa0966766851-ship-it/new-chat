/**
 * 頁面進入自動播放音樂（2026-11-08）：星蝕回廊大廳與回廊戰鬥預設開啟，可在控制中心「音樂」關閉。
 * 只在「進入」該頁時要求播放一次；使用者在頁內手動暫停後不會被再次打開。
 */
export const AUTOPLAY_SCENES = ['interstellar_exploration', 'eclipse_battle'] as const;
const KEY = 'seer_music_autoplay_eclipse';
export function readMusicAutoplay(): boolean { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }
export function writeMusicAutoplay(on: boolean) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* 無法儲存時只影響本次 */ } }
/** 由 A 頁進入 B 頁時是否該自動播放（同一組自動播放頁之間切換不重複觸發）。 */
export function shouldAutoplayOnEnter(prev: string | null, next: string, enabled: boolean): boolean {
  if (!enabled) return false;
  const inSet = (s: string | null) => !!s && (AUTOPLAY_SCENES as readonly string[]).includes(s);
  return inSet(next) && !inSet(prev);
}
