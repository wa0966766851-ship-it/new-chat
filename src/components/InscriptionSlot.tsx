import React from "react";
import type { Inscription } from "../types";
import { getDefaultInscriptions } from "../data/inscriptionsCatalog";
import { Plus, Award } from "lucide-react";

interface InscriptionSlotProps {
  key?: React.Key | number | string;
  index: number;
  inscription?: Inscription;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}

export const HEXAGON_CLIP = "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)";

export function InscriptionSlot({ index, inscription, onClick, size = "md" }: InscriptionSlotProps) {
  const effectiveInsc = inscription || getDefaultInscriptions()[index || 0];
  const hasInsc = effectiveInsc && (effectiveInsc.name || Object.values(effectiveInsc.stats || {}).some(val => val !== 0));

  const sizeClasses = {
    sm: "w-16 h-18 sm:w-20 sm:h-22",
    md: "w-20 h-24 sm:w-24 sm:h-28",
    lg: "w-24 h-28 sm:w-28 sm:h-32",
  }[size];

  return (
    <button type="button" aria-label={`編輯第 ${index + 1} 刻印孔`}
      onClick={onClick}
      className={`${sizeClasses} p-[2px] transition-all duration-300 cursor-pointer flex items-center justify-center group relative drop-shadow-lg ${
        hasInsc
          ? "bg-gradient-to-b from-amber-400 via-amber-500 to-amber-800 shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-[1.02]"
          : "bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-amber-500 hover:to-amber-600 opacity-90 hover:opacity-100"
      }`}
      style={{ clipPath: HEXAGON_CLIP }}
    >
      <div
        className="w-full h-full bg-[#0A0D14] group-hover:bg-[#111622] flex flex-col items-center justify-center transition-colors p-1.5 text-center select-none"
        style={{ clipPath: HEXAGON_CLIP }}
      >
        {hasInsc ? (
          <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden">
            <span className="text-[10px] sm:text-xs font-bold text-amber-300 group-hover:text-amber-200 truncate max-w-full px-1 border-b border-amber-500/30 pb-0.5 mb-1 flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400 flex-shrink-0 inline" />
              <span className="truncate">{effectiveInsc.name || "自訂刻印"}</span>
            </span>
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[9px] sm:text-[10px] text-slate-300 font-mono">
              {effectiveInsc.stats?.hp ? <span className="text-emerald-400">體+{effectiveInsc.stats.hp}</span> : null}
              {effectiveInsc.stats?.atk ? <span className="text-rose-400">攻+{effectiveInsc.stats.atk}</span> : null}
              {effectiveInsc.stats?.spatk ? <span className="text-purple-400">特+{effectiveInsc.stats.spatk}</span> : null}
              {effectiveInsc.stats?.def ? <span className="text-blue-400">防+{effectiveInsc.stats.def}</span> : null}
              {effectiveInsc.stats?.spdef ? <span className="text-cyan-400">特防+{effectiveInsc.stats.spdef}</span> : null}
              {effectiveInsc.stats?.speed ? <span className="text-amber-400">速+{effectiveInsc.stats.speed}</span> : null}
            </div>
            <span className="text-[8px] text-slate-500 mt-1 uppercase tracking-wider">點擊修改</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-dashed border-slate-600 group-hover:border-amber-400 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition-all group-hover:scale-110">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 group-hover:text-amber-300 transition-colors">
              第 {index + 1} 刻印孔
            </span>
            <span className="text-[8px] text-slate-600 group-hover:text-slate-400">點擊嵌入</span>
          </div>
        )}
      </div>
    </button>
  );
}
