export type DestinyView = "A" | "B";
export const DESTINY_VIEW_KEY = "destinyWheelView";

/** 讀取介面偏好（A 經典版／B 拾光行記版，2026-11-07 起預設 B）；localStorage 不可用時用 B。 */
export function readDestinyView(): DestinyView {
  try { return localStorage.getItem(DESTINY_VIEW_KEY) === "A" ? "A" : "B"; } catch { return "B"; }
}
export function writeDestinyView(v: DestinyView) {
  try { localStorage.setItem(DESTINY_VIEW_KEY, v); } catch { /* 隱私模式等：只是不記住 */ }
}

/** jsdom 沒有 Canvas／scrollTo 實作且會在主控台報 Not implemented；這類裝飾性呼叫在 jsdom 直接略過。 */
export const isJsdom = () => typeof window !== "undefined" && /jsdom/i.test(window.navigator?.userAgent ?? "");
