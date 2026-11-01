import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useDestinyDraft, type DestinyScreenProps } from "./destiny/useDestinyDraft";
import DestinyWheelClassic from "./destiny/DestinyWheelClassic";
import { readDestinyView, writeDestinyView, isJsdom, type DestinyView } from "./destiny/destinyViewPref";

export type { DestinyScreenProps } from "./destiny/useDestinyDraft";

// B 頁（拾光行記風格）獨立 lazy chunk：不進首頁初始區塊。
const DestinyWheelB = lazy(() => import("./destiny/DestinyWheelB/DestinyWheelB"));

/**
 * 命運之輪入口：A＝既有頁（數理／標準／紙本），B＝以拾光行記為基礎的新介面。
 * 兩者共用同一份流程狀態（useDestinyDraft），切換時抽卡進度不會遺失；偏好記在 localStorage。
 */
export default function DestinyWheelScreen(props: DestinyScreenProps) {
  const draft = useDestinyDraft(props);
  const [view, setView] = useState<DestinyView>(() => readDestinyView());
  const switchTo = useCallback((v: DestinyView) => { writeDestinyView(v); setView(v); }, []);
  const first = useRef(true);
  useEffect(() => { // 切換介面後回到頂端（初次載入不動）
    if (first.current) { first.current = false; return; }
    if (isJsdom()) return;
    try { window.scrollTo?.(0, 0); } catch { /* 測試環境 */ }
  }, [view]);
  if (view === "B") {
    return (
      <Suspense fallback={<div className="min-h-screen" style={{ background: "#F2EDE4" }} aria-busy="true" />}>
        <DestinyWheelB draft={draft} onBack={props.onBack} onSwitchToA={() => switchTo("A")} />
      </Suspense>
    );
  }
  return <DestinyWheelClassic draft={draft} allElves={props.allElves} onBack={props.onBack} onSwitchToB={() => switchTo("B")} />;
}
