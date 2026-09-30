import React, { useEffect, useState } from "react";
import type { Elf } from "../types";
import { ElfAvatar, TypeIcon } from "./SeerImages";

export const EDITOR_SECTIONS = [
  ["basic", "基本資料"], ["traits", "特性與特質"], ["skills", "技能"],
  ["training", "訓練與刻印"], ["resistance", "抗性"],
] as const;
export type EditorSection = typeof EDITOR_SECTIONS[number][0];

export function ElfEditorSectionNav({ active, onChange }: {
  active: EditorSection; onChange: (section: EditorSection) => void;
}) {
  return <nav aria-label="手動編輯分類" className="editor-section-nav ios-segment">
    {EDITOR_SECTIONS.map(([key, label]) => <button key={key} type="button"
      aria-current={active === key ? "page" : undefined} data-active={active === key}
      aria-controls="manual-section-content" onClick={() => onChange(key)}>{label}</button>)}
  </nav>;
}

/** 僅顯示草稿數值與名稱，不解析魂印／技能，不代表效果已實裝。 */
export function ElfEditorDraftSummary({ elf }: { elf: Elf }) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const update = () => setSummaryOpen(desktop.matches);
    update(); desktop.addEventListener('change', update);
    return () => desktop.removeEventListener('change', update);
  }, []);
  return <aside className="editor-draft-summary ios-panel ios-dialog p-4" aria-label="精靈草稿摘要">
    <header className="flex gap-3 items-center">
      <div className="w-14 h-14 rounded-full overflow-hidden ring-1 ring-white/15 shrink-0">
        <ElfAvatar elf={elf} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0"><p className="text-xs text-slate-400">尚未儲存的草稿</p>
        <h2 className="text-base font-semibold text-slate-100 break-words mt-1">{elf.name || "自訂精靈"}</h2>
        <p className="flex items-center gap-1.5 text-xs text-slate-300 mt-1"><TypeIcon type={elf.type} size={16} />{elf.type}</p>
      </div>
    </header>
    <details className="mt-4" open={summaryOpen} onToggle={e => setSummaryOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-xs text-slate-400">面板與配置摘要</summary>
      <dl className="grid grid-cols-3 gap-2 mt-3">
        {([['hp','體力'],['atk','攻擊'],['spatk','特攻'],['def','防禦'],['spdef','特防'],['speed','速度']] as const).map(([key,label]) =>
          <div key={key} className="ios-card px-2 py-3 text-center"><dt className="text-xs text-slate-400">{label}</dt>
            <dd className="text-sm tabular-nums text-slate-100 mt-1">{Number.isFinite(elf.calculatedStats?.[key]) ? elf.calculatedStats[key] : "—"}</dd></div>)}
      </dl>
      <p className="text-xs text-slate-300 mt-3 break-words">魂印：{elf.soulMark?.name || "無"}</p>
      <p className="text-xs text-slate-300 mt-2">攜帶 {elf.skills.length} 招 · 預備 {elf.skillPool?.length || 0} 招</p>
      <p className="text-xs text-slate-500 leading-5 mt-3">分頁切換不會清除輸入。此摘要僅呈現配置，效果需另行語意驗證。</p>
    </details>
  </aside>;
}
