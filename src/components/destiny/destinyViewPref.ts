export type DestinyView = "A" | "B";
export const DESTINY_VIEW_KEY = "destinyWheelView";

/** 讀取介面偏好（A 舊頁／B 新頁）；localStorage 不可用時退回 A。 */
export function readDestinyView(): DestinyView {
  try { return localStorage.getItem(DESTINY_VIEW_KEY) === "B" ? "B" : "A"; } catch { return "A"; }
}
export function writeDestinyView(v: DestinyView) {
  try { localStorage.setItem(DESTINY_VIEW_KEY, v); } catch { /* 隱私模式等：只是不記住 */ }
}

/** jsdom 沒有 Canvas／scrollTo 實作且會在主控台報 Not implemented；這類裝飾性呼叫在 jsdom 直接略過。 */
export const isJsdom = () => typeof window !== "undefined" && /jsdom/i.test(window.navigator?.userAgent ?? "");
