import React, { useEffect, useRef, useState } from "react";
import { cueMs } from "../../design/cues";

/**
 * SceneTransition — 場景切換轉場
 *
 * 為什麼需要它：
 *   目前 Aegis 的場景之間是「硬切」——點下去畫面瞬間換掉，
 *   沒有過渡，看起來像網頁重新載入，不像遊戲。
 *   cues.ts 早就定義了 `sceneSwap: 320ms`，但從來沒被使用。
 *
 * 設計原則：
 *   1. **只用 CSS transform + opacity**（合成層，不掉幀）
 *   2. **尊重 reduced-motion**：直接切，不播動畫
 *   3. **不阻塞互動**：轉場期間新畫面已可點擊（pointer-events 保持 auto）
 *   4. **方向感**：前進（進子頁）從右滑入，後退（回首頁）從左滑入
 *
 * 實作方式：
 *   用 key 變化偵測 view 改變，觸發一次 CSS 動畫。
 *   不用 framer-motion，因為 shell 不該為了 320ms 轉場引入依賴。
 */

export type TransitionDirection = "forward" | "back" | "none";

/** 哪些 view 是「首頁層級」，從它們離開 = 前進 */
const ROOT_VIEWS = new Set(["start"]);

export function directionFor(from: string, to: string): TransitionDirection {
  if (from === to) return "none";
  if (ROOT_VIEWS.has(to)) return "back";
  if (ROOT_VIEWS.has(from)) return "forward";
  return "forward";
}

export function SceneTransition({
  viewKey, children, disabled,
}: {
  /** 場景識別（通常是 b.view）；變化時播轉場 */
  viewKey: string;
  children: React.ReactNode;
  /** 戰鬥中不需要轉場（避免動畫疊加） */
  disabled?: boolean;
}) {
  const prevRef = useRef(viewKey);
  const [direction, setDirection] = useState<TransitionDirection>("none");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (prevRef.current === viewKey) return;
    const dir = directionFor(prevRef.current, viewKey);
    prevRef.current = viewKey;
    setDirection(dir);
    setTick(t => t + 1);
  }, [viewKey]);

  const duration = cueMs("sceneSwap");
  const animName =
    direction === "forward" ? "aegisSceneInRight"
    : direction === "back" ? "aegisSceneInLeft"
    : "aegisSceneFade";

  // 戰鬥這類有內部計時器的畫面，絕不能因為轉場被重新掛載
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div
      data-transition={`${viewKey}-${tick}`}
      style={{
        display: "contents",
        // 用 CSS 變數把時長傳給 keyframes（讓 cues.ts 是唯一真相）
        ["--aegis-scene-duration" as any]: `${duration}ms`,
      }}
    >
      <style>{`
        @keyframes aegisSceneInRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes aegisSceneInLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes aegisSceneFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* 只有包住的那一層播動畫；reduced-motion 由 motion.css 統一關閉 */
        .aegis-scene-enter {
          animation: var(--aegis-scene-anim) var(--aegis-scene-duration) ease-out both;
          will-change: transform, opacity;
        }
      `}</style>
      <div
        className={disabled || direction === "none" ? undefined : "aegis-scene-enter"}
        style={{
          ["--aegis-scene-anim" as any]: animName,
          display: "contents",
        }}
      >
        {children}
      </div>
    </div>
  );
}
