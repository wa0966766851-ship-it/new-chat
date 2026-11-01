/**
 * 戰鬥 HUD 的立繪保留高度。
 * 立繪舞台高度只取決於頭像卡片底緣：狀態晶片區是疊在場地上方的浮層（可蓋住場地頂端、區內遮罩並捲動），
 * 不佔舞台高度。晶片數量、晶片區最大高度都不是 stageHeight 的輸入。
 * （2026-11-01 前一版另外固定預留 48–104px 給晶片區，立繪因此整體縮小；已撤除。）
 */
export const HUD_TRAY_MIN_PX = 96;
export const HUD_TRAY_MAX_PX = 248;
export const HUD_RESERVE_GAP_PX = 8;

/** 晶片區浮層的最大高度（桌面約 4 列後捲動；手機場地矮則收斂到下限）。與立繪舞台高度無關。 */
export function hudTrayMaxHeight(fieldHeight: number): number {
  const h = Number.isFinite(fieldHeight) ? fieldHeight : 0;
  return Math.min(HUD_TRAY_MAX_PX, Math.max(HUD_TRAY_MIN_PX, Math.round(h * 0.34)));
}

/** 場地頂端到卡片底緣的距離（已量測）→ 立繪需讓出的高度。 */
export function hudFieldReserve(cardBottomFromFieldTop: number): number {
  return Math.max(0, Math.ceil(cardBottomFromFieldTop + HUD_RESERVE_GAP_PX));
}

/** 立繪舞台高度（與 BattleScreen 的 fh 同式）。 */
export function stageHeight(fieldHeight: number, reserve: number): number {
  return Math.max(120, fieldHeight - reserve);
}
