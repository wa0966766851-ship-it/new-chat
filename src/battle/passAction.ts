// 2026-11-14 空過：不出招、不換人、不用藥，直接結束本回合的行動選擇。
// 用途：所有操作都被封鎖時避免戰鬥卡死；也可手動放棄本回合行動。空過不算「使用技能」。
import type { Skill } from '../types';

export const PASS_SKILL_NAME = '空過';
export const passSkill = (): Skill => ({ name: PASS_SKILL_NAME, type: '無', category: '屬性', power: 0, pp: 0, priority: 0,
  description: '放棄本回合行動。', effectType: 'none', effectDetail: '', isPass: true } as unknown as Skill);
export const isPassSkill = (skill: unknown): boolean => !!(skill as any)?.isPass;

export type PassMode = 'manual' | 'auto';
const KEY = 'seer_battle_pass_mode';
/** manual：只顯示空過鈕；auto：無任何可用行動時自動空過（預設）。 */
export function readPassMode(): PassMode {
  try { return window.localStorage.getItem(KEY) === 'manual' ? 'manual' : 'auto'; } catch { return 'auto'; }
}
export function writePassMode(mode: PassMode): void {
  try { window.localStorage.setItem(KEY, mode); } catch { /* 無儲存空間時本次仍生效 */ }
  try { window.dispatchEvent(new CustomEvent('seer-pass-mode', { detail: mode })); } catch { /* 非瀏覽器 */ }
}
