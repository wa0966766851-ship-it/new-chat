import React from "react";
import { Search, Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import type { Elf } from "../../types";
import { SEER_TYPES } from "../../utils/statCalculator";
import { applyElfFilter, DEFAULT_ELF_FILTER, ELF_FLAG_HINT, ELF_FLAG_LABEL, ELF_RANKS, ELF_SORT_LABEL, elfFilterActiveCount, type ElfFilterContext, type ElfFlag, type ElfSortKey, type ElfTypeKind, type ElfTypeMode } from "../../utils/elfFilter";
import type { ElfDisplayRank } from "../../utils/elfDisplayRank";
import { TypeIcon } from "../SeerImages";

/** 首頁背包與星蝕回廊共用的搜尋＋屬性篩選（名稱、ID、屬性、魂印；空白為 AND）。 */
export type PickerVariant = "slate" | "eclipse" | "shell";
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
  // 新版 UI（src/shell）：深色小字，與 HeroPicker／TeamScene 一致
  shell: {
    input: "w-full pl-7 pr-2 py-1.5 text-[11px] outline-none rounded-lg bg-[rgba(6,16,26,0.82)] border border-[rgba(148,163,184,0.22)] text-slate-100",
    toggle: (on: boolean) => `flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${on ? "border-[var(--p-accent)] text-[var(--p-accent-hot)] bg-[rgba(6,16,26,0.9)]" : "border-[rgba(148,163,184,0.22)] text-slate-300 bg-[rgba(6,16,26,0.82)]"}`,
    clear: "p-1.5 rounded-lg border border-[rgba(148,163,184,0.22)] text-rose-300 bg-[rgba(6,16,26,0.82)] cursor-pointer",
    panel: "p-2 rounded-lg border border-[rgba(148,163,184,0.18)] bg-[rgba(4,10,18,0.7)] max-h-[26dvh] overflow-y-auto",
    chip: (on: boolean) => `px-1.5 py-1 rounded-md text-[9px] font-bold border cursor-pointer inline-flex items-center gap-1 ${on ? "border-[var(--p-accent)] text-[var(--p-accent-hot)] bg-[color-mix(in_srgb,var(--p-accent)_22%,transparent)]" : "border-[rgba(148,163,184,0.18)] text-slate-400 bg-[rgba(6,16,26,0.7)]"}`,
    icon: "text-slate-400",
  },
} as const;

const SEL = "bg-transparent border rounded-md text-[10px] py-1 px-1 cursor-pointer";

export function useElfFilter(initial: Partial<typeof DEFAULT_ELF_FILTER> = {}) {
  const [spec, setSpec] = React.useState({ ...DEFAULT_ELF_FILTER, ...initial });
  const patch = React.useCallback((p: Partial<typeof DEFAULT_ELF_FILTER>) => setSpec(v => ({ ...v, ...p })), []);
  const toggleIn = <K extends "types" | "ranks" | "flags">(k: K) => (x: typeof spec[K][number]) =>
    setSpec(v => ({ ...v, [k]: (v[k] as any[]).includes(x) ? (v[k] as any[]).filter(y => y !== x) : [...(v[k] as any[]), x] }));
  const toggleType = React.useCallback(toggleIn("types") as (t: string) => void, []);
  const toggleRank = React.useCallback(toggleIn("ranks") as (r: ElfDisplayRank) => void, []);
  const toggleFlag = React.useCallback(toggleIn("flags") as (f: ElfFlag) => void, []);
  /** 清除所有篩選條件（保留搜尋字與排序） */
  const clear = React.useCallback(() => setSpec(v => ({ ...v, types: [], typeMode: "all", kind: "any", ranks: [], flags: [] })), []);
  const setQuery = React.useCallback((query: string) => patch({ query }), [patch]);
  const setTypeMode = React.useCallback((typeMode: ElfTypeMode) => patch({ typeMode }), [patch]);
  const setKind = React.useCallback((kind: ElfTypeKind) => patch({ kind }), [patch]);
  const setSort = React.useCallback((sort: ElfSortKey) => patch({ sort, desc: sort === "total" }), [patch]);
  const setDesc = React.useCallback((desc: boolean) => patch({ desc }), [patch]);
  const filter = React.useCallback(<E extends Elf>(list: readonly E[], ctx?: ElfFilterContext) => applyElfFilter(list, spec, ctx), [spec]);
  return { spec, query: spec.query, setQuery, types: spec.types, toggleType, typeMode: spec.typeMode, setTypeMode, kind: spec.kind, setKind,
    ranks: spec.ranks, toggleRank, flags: spec.flags, toggleFlag, sort: spec.sort, setSort, desc: spec.desc, setDesc,
    activeCount: elfFilterActiveCount(spec), clear, filter };
}
export type ElfFilterState = ReturnType<typeof useElfFilter>;

export function ElfFilterBar({ state, variant = "slate", placeholder = "名稱、ID、屬性（可用空白組合）", count, showInTeam = false }: { state: ElfFilterState; variant?: PickerVariant; placeholder?: string; count?: React.ReactNode; showInTeam?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const t = T[variant];
  const shell = variant === "shell";
  const flags: ElfFlag[] = showInTeam ? ["new", "fifth", "custom", "inTeam"] : ["new", "fifth", "custom"];
  const group = (label: string, hint: string | undefined, body: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-1.5" title={hint}>
      <span className={`text-[10px] font-bold shrink-0 ${t.icon}`}>{label}</span>{body}
    </div>
  );
  const seg = <V extends string>(value: V, options: [V, string, string?][], set: (v: V) => void) => options.map(([v, label, hint]) => (
    <button type="button" key={v} aria-pressed={value === v} title={hint} onClick={() => set(v)} className={t.chip(value === v)}>{label}</button>
  ));
  return (
    <div className={shell ? "space-y-1.5" : "space-y-3"}>
      <div className={shell ? "flex items-center gap-1" : "flex flex-col md:flex-row gap-3 md:items-center"}>
        <div className={`relative ${shell ? "flex-1 min-w-0" : "flex-1 w-full"}`}>
          <Search className={`${shell ? "w-3 h-3 left-2" : "w-4 h-4 left-3"} absolute top-1/2 -translate-y-1/2 ${t.icon}`} />
          <input type="text" aria-label="搜尋精靈" placeholder={placeholder} value={state.query} onChange={e => state.setQuery(e.target.value)} className={t.input} />
        </div>
        <div className={`flex items-center gap-1.5 ${shell ? "shrink-0" : "w-full md:w-auto"}`}>
          <select aria-label="排序" title="排序" value={state.sort} onChange={e => state.setSort(e.target.value as ElfSortKey)} className={`${SEL} ${t.icon} ${shell ? "border-[rgba(148,163,184,0.22)] bg-[rgba(6,16,26,0.82)]" : "border-slate-700"}`}>
            {(Object.keys(ELF_SORT_LABEL) as ElfSortKey[]).map(k => <option key={k} value={k} className="text-black">{ELF_SORT_LABEL[k]}</option>)}
          </select>
          {state.sort !== "default" && (
            <button type="button" aria-label="反向排序" title={state.desc ? "目前由大到小（點擊反向）" : "目前由小到大（點擊反向）"} aria-pressed={state.desc} onClick={() => state.setDesc(!state.desc)} className={t.chip(state.desc)}>{state.desc ? "↓" : "↑"}</button>
          )}
          <button type="button" aria-expanded={open} title="屬性（單／雙／複合）、分級、特徵" onClick={() => setOpen(v => !v)} className={`${t.toggle(open || state.activeCount > 0)} ${shell ? "" : "flex-1 md:flex-none"}`}>
            <Filter className="w-3.5 h-3.5" />{shell ? "篩選" : "屬性篩選"} {state.activeCount > 0 && `(${state.activeCount})`}
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {state.activeCount > 0 && <button type="button" onClick={state.clear} className={t.clear} title="清除所有篩選" aria-label="清除所有篩選"><X className="w-4 h-4" /></button>}
          {count !== undefined && <span className={`text-xs tabular-nums ml-auto ${t.icon}`}>{count}</span>}
        </div>
      </div>
      {open && (
        <div className={`${t.panel} space-y-2`} data-testid="elf-filter-panel">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => state.types.forEach(state.toggleType)} className={t.chip(state.types.length === 0)}>全部</button>
            {SEER_TYPES.map(type => (
              <button type="button" key={type} aria-pressed={state.types.includes(type)} onClick={() => state.toggleType(type)} className={t.chip(state.types.includes(type))}>
                <TypeIcon type={type} size={shell ? 14 : 18} showLabelWhenMissing={false} /> {type}
              </button>
            ))}
          </div>
          {group("符合", "全部＝需同時具備所有已選屬性（複合）；任一＝具備其中一種即可", seg<ElfTypeMode>(state.typeMode, [["all", "全部"], ["any", "任一"]], state.setTypeMode))}
          {group("型態", "單屬性＝只有一種屬性；雙屬性＝含兩種以上屬性", seg<ElfTypeKind>(state.kind, [["any", "不限"], ["single", "單屬性"], ["dual", "雙屬性"]], state.setKind))}
          {group("分級", "命運之輪／圖鑑參考評級", ELF_RANKS.map(r => (
            <button type="button" key={r} aria-pressed={state.ranks.includes(r)} onClick={() => state.toggleRank(r)} className={t.chip(state.ranks.includes(r))}>{r}</button>
          )))}
          {group("特徵", undefined, flags.map(f => (
            <button type="button" key={f} aria-pressed={state.flags.includes(f)} title={ELF_FLAG_HINT[f]} onClick={() => state.toggleFlag(f)} className={t.chip(state.flags.includes(f))}>{ELF_FLAG_LABEL[f]}</button>
          )))}
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
