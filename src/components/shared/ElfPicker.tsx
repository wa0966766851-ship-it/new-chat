import React from "react";
import { Search, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import type { Elf } from "../../types";
import { SEER_TYPES } from "../../utils/statCalculator";
import { matchesElfQuery } from "../../utils/elfSearch";
import { TypeIcon } from "../SeerImages";

/** 首頁背包與星蝕回廊共用的搜尋＋屬性篩選（名稱、ID、屬性、魂印；空白為 AND）。 */
export type PickerVariant = "slate" | "eclipse";
const T = {
  slate: {
    input: "w-full bg-[#050608] border border-slate-800 focus:border-blue-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-all shadow-inner",
    toggle: (on: boolean) => `flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${on ? "bg-blue-600/10 border-blue-500/50 text-blue-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"}`,
    clear: "p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer",
    panel: "p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl",
    chip: (on: boolean) => `px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${on ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"}`,
    icon: "text-slate-500",
  },
  eclipse: {
    input: "w-full bg-black/50 border border-[rgba(217,180,90,.3)] focus:border-[var(--ecl-gold)] pl-9 pr-3 py-2 text-sm focus:outline-none",
    toggle: (on: boolean) => `flex items-center justify-center gap-2 px-3 py-2 border text-xs font-black tracking-widest cursor-pointer ${on ? "border-[var(--ecl-gold)] ecl-gilt" : "border-[rgba(217,180,90,.3)] ecl-muted hover:text-[var(--ecl-bone)]"}`,
    clear: "p-2 border border-[rgba(224,71,95,.45)] ecl-blood hover:bg-[rgba(155,28,49,.18)] cursor-pointer",
    panel: "p-3 border border-[rgba(217,180,90,.2)] bg-black/30",
    chip: (on: boolean) => `px-2.5 py-1 text-[11px] font-black border cursor-pointer ${on ? "border-[var(--ecl-gold)] bg-[rgba(217,180,90,.12)] ecl-gilt" : "border-[rgba(217,180,90,.2)] ecl-muted hover:text-[var(--ecl-bone)]"}`,
    icon: "ecl-muted",
  },
} as const;

export function useElfFilter() {
  const [query, setQuery] = React.useState("");
  const [types, setTypes] = React.useState<string[]>([]);
  const toggleType = React.useCallback((t: string) => setTypes(v => v.includes(t) ? v.filter(x => x !== t) : [...v, t]), []);
  const clear = React.useCallback(() => setTypes([]), []);
  const filter = React.useCallback(<E extends Partial<Elf>>(list: readonly E[]) => list.filter(e => matchesElfQuery(e, query, types)), [query, types]);
  return { query, setQuery, types, toggleType, clear, filter };
}
export type ElfFilterState = ReturnType<typeof useElfFilter>;

export function ElfFilterBar({ state, variant = "slate", placeholder = "名稱、ID、屬性（可用空白組合）", count }: { state: ElfFilterState; variant?: PickerVariant; placeholder?: string; count?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const t = T[variant];
  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 w-full">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${t.icon}`} />
          <input type="text" aria-label="搜尋精靈" placeholder={placeholder} value={state.query} onChange={e => state.setQuery(e.target.value)} className={t.input} />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className={t.toggle(open || state.types.length > 0)}>
            <Filter className="w-3.5 h-3.5" />屬性篩選 {state.types.length > 0 && `(${state.types.length})`}
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {state.types.length > 0 && <button type="button" onClick={state.clear} className={t.clear} title="清除所有篩選" aria-label="清除所有篩選"><X className="w-4 h-4" /></button>}
          {count !== undefined && <span className={`text-xs tabular-nums ml-auto ${t.icon}`}>{count}</span>}
        </div>
      </div>
      {open && (
        <div className={t.panel}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={state.clear} className={t.chip(state.types.length === 0)}>全部</button>
            {SEER_TYPES.map(type => (
              <button type="button" key={type} onClick={() => state.toggleType(type)} className={t.chip(state.types.includes(type))}>
                <TypeIcon type={type} size={18} showLabelWhenMissing={false} /> {type}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 搜尋＋篩選＋卡片格。卡片內容由呼叫端決定（renderItem），點擊交給 onPick。 */
export function ElfPicker<E extends Elf>({ elves, onPick, renderItem, variant = "slate", gridClassName, itemClassName, isDisabled, emptyText = "沒有符合的精靈", placeholder, getKey }: {
  elves: readonly E[]; onPick: (elf: E) => void; renderItem: (elf: E, index: number) => React.ReactNode; variant?: PickerVariant;
  gridClassName?: string; itemClassName?: string; isDisabled?: (elf: E) => string | false; emptyText?: string; placeholder?: string; getKey?: (elf: E, index: number) => string;
}) {
  const f = useElfFilter();
  const shown = f.filter(elves);
  return (
    <div className="space-y-4">
      <ElfFilterBar state={f} variant={variant} placeholder={placeholder} count={`${shown.length} / ${elves.length}`} />
      <div className={gridClassName ?? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {shown.map((elf, index) => {
          const reason = isDisabled?.(elf);
          return (
            <button type="button" key={getKey ? getKey(elf, index) : `${elf.id}-${index}`} disabled={!!reason} title={reason || undefined} onClick={() => onPick(elf)} className={itemClassName}>
              {renderItem(elf, index)}
            </button>
          );
        })}
        {!shown.length && <p className={`col-span-full text-sm ${T[variant].icon}`}>{emptyText}</p>}
      </div>
    </div>
  );
}
