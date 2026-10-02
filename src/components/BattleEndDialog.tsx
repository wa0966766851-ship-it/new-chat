import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function BattleEndDialog({ winner, onRestart, onHome }: {
  winner: "p1" | "p2" | "draw"; onRestart: () => void; onHome: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);
  return createPortal(
    <dialog ref={ref} aria-labelledby="battle-end-title" aria-describedby="battle-end-description"
      onCancel={event => event.preventDefault()}
      className="fixed inset-0 m-auto w-[min(92vw,420px)] rounded-3xl border border-cyan-400/30 bg-slate-950 p-8 text-center text-slate-100 shadow-2xl backdrop:bg-black/70">
      <p className="text-sm text-cyan-300">普通對戰已結束</p>
      <h2 id="battle-end-title" className="mt-3 text-3xl font-black">{winner === "draw" ? "雙方平手" : `${winner.toUpperCase()} 勝利！`}</h2>
      <p id="battle-end-description" className="mt-3 text-sm text-slate-400">重來將以原本的陣容與首發開始新的一局。</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button autoFocus onClick={onRestart} className="rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300">重來</button>
        <button onClick={onHome} className="rounded-xl border border-slate-600 px-4 py-3 font-bold hover:bg-slate-800">回到首頁</button>
      </div>
    </dialog>, document.body);
}
