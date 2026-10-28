import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import type { Elf } from "../../types";
import { listBagElves, type BagEntry } from "../../battle/bagTargets";
import { ElfPicker } from "../shared/ElfPicker";
import { ElfAvatar, TypeIcon } from "../SeerImages";
import { getAttributeBadgeColor } from "../../utils/statCalculator";
import { hiddenFromViewer, maskElfIdentity, UNKNOWN_ELF } from "../../battle/viewerPerspective";
import { useBattleViewMode } from "../../battle/viewerMode";

const ZONE_LABEL: Record<BagEntry["zone"], string> = { active: "出戰", standby: "待命" };

/** 選擇雙方背包（出戰＋待命）內任一隻未消逝的精靈；幻化指令等「需選對象」的道具共用。 */
export default function BagElfPickerModal({ teams, viewerSide = "p1", title, onPick, onClose }: {
  teams: Record<"p1" | "p2", readonly Elf[]>; viewerSide?: "p1" | "p2"; title: string;
  onPick: (side: "p1" | "p2", battleId: string) => void; onClose: () => void;
}) {
  const mode = useBattleViewMode();
  const entries = useMemo(() => listBagElves(teams), [teams]);
  // 搜尋框會比對名稱／屬性：不可見的隱匿精靈先換成無識別替身，搜尋也洩漏不了。
  const shown = useMemo(() => entries.map(x => ({ x, elf: maskElfIdentity(x.elf, x.side, mode) })), [entries, mode]);
  const entryOf = useMemo(() => new Map(shown.map(y => [y.elf, y.x] as const)), [shown]);
  const elves = useMemo(() => shown.map(y => y.elf), [shown]);
  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title} data-bag-picker onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-950 border border-amber-500/40 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <h3 className="text-base font-black text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="關閉" className="text-slate-400 hover:text-white px-2">✕</button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">
          <ElfPicker
            elves={elves}
            getKey={(elf, i) => `${entryOf.get(elf)?.side}-${elf.battleId || elf.id}-${i}`}
            gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-2"
            itemClassName="group bg-[#050608] border border-slate-800 hover:border-amber-500/60 rounded-xl p-2.5 text-left transition-all flex items-center gap-3 cursor-pointer"
            onPick={elf => { const x = entryOf.get(elf); if (x) onPick(x.side, String(elf.battleId || elf.id)); }}
            renderItem={elf => {
              const x = entryOf.get(elf)!;
              const hidden = hiddenFromViewer(elf, x.side, mode);
              return (
                <>
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                    <ElfAvatar elf={elf} battleSide={x.side} kind="head" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-100 truncate">{hidden ? UNKNOWN_ELF : elf.name}</span>
                      {!hidden && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${getAttributeBadgeColor(elf.type)} inline-flex items-center gap-0.5`}>
                        <TypeIcon type={elf.type} size={12} showLabelWhenMissing={false} />{elf.type}
                      </span>}
                    </div>
                    <div className={`text-[10px] font-bold ${x.side === viewerSide ? "text-emerald-400" : "text-rose-400"}`}>
                      {x.side === viewerSide ? "我方" : "對手"}{ZONE_LABEL[x.zone]}
                    </div>
                  </div>
                </>
              );
            }}
          />
        </div>
      </div>
    </div>, document.body);
}
