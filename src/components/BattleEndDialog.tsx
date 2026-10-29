import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/** 特殊模式（命運之輪、星際探索）結束：只提供返回模式，不提供重來。 */
export function SpecialBattleEndDialog({ winner, mode, onBack }: { winner: "p1" | "p2" | "draw"; mode: "destiny" | "interstellar"; onBack: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal?.(); return () => d?.close?.(); }, []);
  const win = winner === "p1";
  return createPortal(
    <dialog ref={ref} aria-labelledby="special-end-title" onCancel={e => e.preventDefault()}
      className="fixed inset-0 m-auto w-[min(92vw,400px)] rounded-2xl border border-amber-400/40 bg-[#0b0810] p-8 text-center text-slate-100 shadow-2xl backdrop:bg-black/70">
      <p className="text-xs tracking-[.3em] text-amber-300/80">{mode === "interstellar" ? "星蝕回廊" : "命運之輪"}</p>
      <h2 id="special-end-title" className={`mt-3 text-3xl font-black ${win ? "text-amber-200" : winner === "draw" ? "text-slate-200" : "text-rose-300"}`}>{win ? "勝利" : winner === "draw" ? "平手" : "敗北"}</h2>
      <button autoFocus onClick={onBack} className="mt-6 w-full rounded-xl border border-amber-400/60 px-4 py-3 font-bold text-amber-100 hover:bg-amber-400/10">{mode === "interstellar" ? "返回回廊" : "返回命運之輪"}</button>
    </dialog>, document.body);
}
