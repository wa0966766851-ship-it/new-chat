import React from "react";
import { Briefcase, Copy, FolderOpen, Save, Shuffle } from "lucide-react";

export function TeamSetupTools({ side, names, onRandomize, onCopy, onBackpack, onSave, onLoad, message }: {
  side: "p1" | "p2"; names: string[]; onRandomize: () => void; onCopy: () => void;
  onBackpack: () => void; onSave: () => void; onLoad: () => void; message?: string;
}) {
  const other = side === "p1" ? "P2" : "P1";
  const button = "flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-cyan-400 hover:bg-slate-800";
  return <section aria-label={`${side.toUpperCase()} 陣容工具`} className="mt-3 space-y-2">
    <div className="grid grid-cols-3 gap-2">
      <button id={side === "p1" ? "btn-p1-randomize" : "btn-ai-randomize"} onClick={onRandomize} className={button}><Shuffle size={14} />隨機部署 12 隻</button>
      <button id={`btn-${side}-copy`} onClick={onCopy} className={button}><Copy size={14} />複製 {other} 陣容</button>
      <button onClick={onBackpack} className={button}><Briefcase size={14} />配裝背包</button>
    </div>
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
      <p className="mb-2 text-slate-400">上次保存：<span className="text-slate-200">{names.length ? names.join("、") : "尚無紀錄"}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onLoad} disabled={!names.length} className={`${button} disabled:opacity-40 disabled:cursor-not-allowed`}><FolderOpen size={14} />載入紀錄</button>
        <button onClick={onSave} className={button}><Save size={14} />保存當前陣容</button>
      </div>
    </div>
    {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
  </section>;
}
