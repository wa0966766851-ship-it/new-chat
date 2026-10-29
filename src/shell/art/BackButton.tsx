import React from "react";
import { ArrowLeft } from "lucide-react";
import { haptic } from "../haptics";

/**
 * AegisBackButton — iOS 風格的返回按鈕 + 邊緣滑動返回
 *
 * 使用者要求（2026-10-22）：
 *   「加上返回按鈕以適應 iOS 的系統（左上角）並加上相應手勢」
 *
 * iOS 的習慣：
 *   ✓ 返回永遠在左上角，箭頭朝左
 *   ✓ 從螢幕左邊緣往右滑 = 返回
 *   ✓ 返回不會關掉整個 App，只退一層
 *
 * 為什麼手勢只在左邊緣 24px：
 *   整個畫面都能滑的話，會跟「橫向滑動切換分頁」打架。
 *   iOS 自己也是這樣做的。
 */

/** 邊緣滑動返回的 hook */
export function useEdgeSwipeBack(onBack: () => void, enabled = true) {
  React.useEffect(() => {
    if (!enabled) return;
    let startX = 0, startY = 0, tracking = false;
    const EDGE = 24;      // 左邊緣感應寬度
    const THRESHOLD = 60; // 要滑多遠才算返回

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      tracking = t.clientX <= EDGE;
      startX = t.clientX;
      startY = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // 往右滑超過門檻，且不是垂直滑動
      if (dx > THRESHOLD && dy < 80) {
        tracking = false;
        haptic("light");
        onBack();
      }
    };
    const onEnd = () => { tracking = false; };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [onBack, enabled]);
}

export function AegisBackButton({
  onBack, label = "返回", className, style,
}: {
  onBack: () => void;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() => { haptic("light"); onBack(); }}
      className={className ?? "flex items-center gap-1 active:scale-95 transition-transform"}
      style={{
        color: "var(--p-accent-hot)",
        /* 觸控目標至少 44px（iOS HIG） */
        minHeight: 44,
        paddingLeft: 4,
        paddingRight: 8,
        ...style,
      }}
      aria-label={label}
    >
      <ArrowLeft className="w-5 h-5" />
      <span className="text-[12px] font-bold">{label}</span>
    </button>
  );
}
