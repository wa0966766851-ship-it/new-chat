/**
 * 戰鬥畫面預設布局：依戰鬥區域大小計算，三個面板不重疊、不超出畫面。
 *   最上方保留一條狀態列（回合／階段、右上角設定按鈕）
 *   上半：P1 面板（左）｜AI 面板（右），等寬
 *   下半：戰術指令面板（全寬）
 */
export const TOP_BAR = 76;
export interface PanelLayout { pos: { x: number; y: number }; size: { width: number; height: number }; opacity: number; scale: number }
export const LAYOUT_VERSION = "3";

export function computeDefaultLayout(W: number, H: number, opacity = 0.95): { p1: PanelLayout; p2: PanelLayout; tactical: PanelLayout } {
  const gap = 12;
  const w = Math.max(320, W), h = Math.max(480, H);
  const tacticalH = Math.max(260, Math.min(360, Math.round(h * 0.4)));
  const topH = h - TOP_BAR - tacticalH - gap * 2;
  const halfW = Math.floor((w - gap * 3) / 2);
  return {
    p1: { pos: { x: gap, y: TOP_BAR }, size: { width: halfW, height: topH }, opacity, scale: 1 },
    p2: { pos: { x: gap * 2 + halfW, y: TOP_BAR }, size: { width: halfW, height: topH }, opacity, scale: 1 },
    tactical: { pos: { x: gap, y: TOP_BAR + topH + gap }, size: { width: w - gap * 2, height: tacticalH }, opacity, scale: 1 },
  };
}

/** 面板是否完整位於戰鬥區域內 */
export function fitsArea(p: PanelLayout | undefined, W: number, H: number): boolean {
  if (!p || !p.pos || !p.size) return false;
  const s = p.scale || 1;
  const right = p.pos.x + p.size.width * s, bottom = p.pos.y + p.size.height * s;
  return p.pos.x >= -8 && p.pos.y >= -8 && right <= W + 8 && bottom <= H + 8 && p.size.width >= 150 && p.size.height >= 100;
}
