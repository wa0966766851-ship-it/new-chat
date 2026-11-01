/**
 * 戰鬥 HUD 的立繪保留高度。
 * 狀態晶片再多也不得縮小立繪：保留高度只由「頭像卡片底緣＋固定的晶片區預留」決定，
 * 晶片區自身以同一個預留值為最大高度（超出者在區內捲動），因此舞台高度與晶片數量無關。
 */
export const HUD_TRAY_MIN_PX = 48;
export const HUD_TRAY_MAX_PX = 104;
export const HUD_RESERVE_GAP_PX = 8;

/** 晶片區預留（同時是晶片區的最大高度）：隨場地高度縮放，夾在上下限內。 */
export function hudTrayReserve(fieldHeight: number): number {
  const h = Number.isFinite(fieldHeight) ? fieldHeight : 0;
  return Math.min(HUD_TRAY_MAX_PX, Math.max(HUD_TRAY_MIN_PX, Math.round(h * 0.18)));
}

/** 場地頂端到卡片底緣的距離（已量測）→ 立繪需讓出的高度。chipCount 刻意不是參數。 */
export function hudFieldReserve(cardBottomFromFieldTop: number, fieldHeight: number): number {
  return Math.max(0, Math.ceil(cardBottomFromFieldTop + HUD_RESERVE_GAP_PX + hudTrayReserve(fieldHeight)));
}

/** 立繪舞台高度（與 BattleScreen 的 fh 同式）。 */
export function stageHeight(fieldHeight: number, reserve: number): number {
  return Math.max(120, fieldHeight - reserve);
}
