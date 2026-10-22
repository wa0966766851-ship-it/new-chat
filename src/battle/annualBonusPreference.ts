export type AnnualSide = 'p1' | 'p2';
const key = (side: AnnualSide) => `seer_${side}_annual_bonus`;

/** 兩個開戰入口共用偏好；未設定時維持預設開啟。實際加成由能力公式加固定10點。 */
export function readAnnualBonus(side: AnnualSide): boolean {
  try {
    const value = window.localStorage.getItem(key(side));
    return value === null ? true : value !== '0' && value !== 'false';
  } catch { return true; }
}

export function writeAnnualBonus(side: AnnualSide, enabled: boolean): void {
  try { window.localStorage.setItem(key(side), enabled ? '1' : '0'); }
  catch { /* 無儲存空間時仍保留本次選擇。 */ }
}
