import React from "react";

export interface DragScrollOptions {
  /** 放開後吸附到最近的子項中心（CSS 選擇器）；省略則停在慣性結束處 */
  snapSelector?: string;
  /** 超過這個距離（px）才算拖曳，未超過視為一般點擊 */
  threshold?: number;
  /** 垂直滾輪轉成水平捲動（捲到盡頭時放行，頁面照常捲動） */
  wheel?: boolean;
}
/** 慣性每影格速度衰減；低於 MIN_V（px/ms）停止 */
const FRICTION = 0.94, MIN_V = 0.02;

/**
 * 水平卡片列的拖曳捲動：滑鼠／手寫筆按住左右拖，放開有慣性並吸附到最近的卡片；
 * 拖曳後的那一下 click 會被吞掉，不會誤選卡片。觸控裝置維持原生捲動（含 scroll-snap），
 * 鍵盤與滾輪不受影響。所有水平卡片列共用這一份。
 */
export function useDragScroll<T extends HTMLElement>(opts: DragScrollOptions = {}) {
  const ref = React.useRef<T>(null);
  const st = React.useRef({ down: false, drag: false, id: -1, x0: 0, left0: 0, lastX: 0, lastT: 0, v: 0, raf: 0, swallow: false });
  const [dragging, setDragging] = React.useState(false);
  const optRef = React.useRef(opts); optRef.current = opts;

  const stopInertia = () => { cancelAnimationFrame(st.current.raf); st.current.raf = 0; };
  const snap = (el: T) => {
    const sel = optRef.current.snapSelector; if (!sel) return;
    const box = el.getBoundingClientRect(), mid = box.left + box.width / 2;
    let best: Element | null = null, bestD = Infinity;
    el.querySelectorAll(sel).forEach(c => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bestD) { bestD = d; best = c; } });
    if (best) { const r = (best as Element).getBoundingClientRect(); el.scrollTo({ left: el.scrollLeft + (r.left + r.width / 2 - mid), behavior: "smooth" }); }
  };
  const glide = (el: T) => {
    let last = performance.now();
    const step = (now: number) => {
      const s = st.current, dt = Math.min(48, now - last); last = now;
      const before = el.scrollLeft;
      el.scrollLeft = before - s.v * dt;
      s.v *= Math.pow(FRICTION, dt / 16);
      if (Math.abs(s.v) < MIN_V || el.scrollLeft === before) { s.raf = 0; el.style.scrollSnapType = ""; snap(el); return; }
      s.raf = requestAnimationFrame(step);
    };
    st.current.raf = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent<T>) => {
    if (e.pointerType === "touch" || e.button !== 0) return; // 觸控用原生捲動
    const el = ref.current; if (!el) return;
    stopInertia();
    Object.assign(st.current, { swallow: false, down: true, drag: false, id: e.pointerId, x0: e.clientX, left0: el.scrollLeft, lastX: e.clientX, lastT: e.timeStamp, v: 0 });
  };
  const onPointerMove = (e: React.PointerEvent<T>) => {
    const s = st.current, el = ref.current;
    if (!s.down || !el || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0;
    if (!s.drag) {
      if (Math.abs(dx) < (optRef.current.threshold ?? 6)) return;
      s.drag = true; setDragging(true);
      el.style.scrollSnapType = "none"; // 拖曳中關掉吸附，放開後再吸
      try { el.setPointerCapture(e.pointerId); } catch { /* 某些環境不支援 */ }
    }
    el.scrollLeft = s.left0 - dx;
    const dt = e.timeStamp - s.lastT;
    if (dt > 0) s.v = .8 * s.v + .2 * ((e.clientX - s.lastX) / dt);
    s.lastX = e.clientX; s.lastT = e.timeStamp;
    e.preventDefault();
  };
  const end = (e: React.PointerEvent<T>) => {
    const s = st.current, el = ref.current;
    if (!s.down || e.pointerId !== s.id) return;
    s.down = false;
    if (!s.drag || !el) return;
    if (e.timeStamp - s.lastT > 80) s.v = 0; // 停住再放開：沒有慣性
    s.drag = false; setDragging(false);
    s.swallow = true; setTimeout(() => { st.current.swallow = false; }, 300); // 吞掉緊接著的 click（下一次按下也會解除）
    try { el.releasePointerCapture(e.pointerId); } catch { /* 已釋放 */ }
    if (Math.abs(s.v) > MIN_V * 4) glide(el); else { el.style.scrollSnapType = ""; snap(el); }
  };
  const onClickCapture = (e: React.MouseEvent<T>) => { if (st.current.swallow) { e.preventDefault(); e.stopPropagation(); st.current.swallow = false; } };

  // 滾輪：瀏覽器的 wheel 監聽預設 passive，要 preventDefault 必須自己掛
  React.useEffect(() => {
    const el = ref.current; if (!el || !opts.wheel) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault(); el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [opts.wheel]);
  React.useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  return {
    ref, dragging,
    /** 展開到列容器上 */
    bind: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture, "data-dragging": dragging ? "1" : undefined },
  };
}
