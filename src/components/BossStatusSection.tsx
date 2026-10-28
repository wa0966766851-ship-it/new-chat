import React from "react";
import { statusVisual } from "../battle/effectIcons";
import { BOSS_TRAIT_BY_STATUS, bossTraitText, type BossTraitDef } from "../data/bossTraits";
import { BOSS_STATUS_GROUPS, bossGroupOf } from "../data/bossStatusGroups";

const TIER_LABEL: Record<number, string> = { 1: "溫和", 2: "中等", 3: "強", 4: "極端" };
const TIER_TONE: Record<number, string> = { 1: "text-emerald-300", 2: "text-sky-300", 3: "text-amber-300", 4: "text-rose-300" };

export interface BossStatusEntry { name: string; description: string }

/** 參數列：名稱＝預設值（x／y／s）。 */
function paramRows(def?: BossTraitDef): { label: string; value: string }[] {
  if (!def) return [];
  return (["x", "y", "s"] as const).filter(k => def.lab[k]).map(k => ({ label: def.lab[k]!, value: String(def.def[k] ?? "") }));
}
function searchText(e: BossStatusEntry): string {
  const def = BOSS_TRAIT_BY_STATUS[e.name];
  return [e.name, e.description, def ? bossTraitText(def) : "", def?.cat ?? "", ...paramRows(def).map(r => r.label)].join("\n").toLowerCase();
}

/** 戰鬥百科「BOSS 類」異常：依性質細分子分類，可搜尋、可篩選；每條顯示圖示、名稱、威脅層次、說明與參數。 */
export function BossStatusSection({ entries, query = "" }: { entries: readonly BossStatusEntry[]; query?: string }) {
  const [group, setGroup] = React.useState<string>("");
  const q = query.trim().toLowerCase();
  const matched = React.useMemo(() => entries.filter(e => !q || searchText(e).includes(q)), [entries, q]);
  const counts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of matched) { const g = bossGroupOf(e.name) ?? "other"; m[g] = (m[g] || 0) + 1; }
    return m;
  }, [matched]);
  const groups = [...BOSS_STATUS_GROUPS, ...(counts.other ? [{ id: "other", label: "其他", hint: "尚未歸類", members: [] as string[] }] : [])];
  const chip = (on: boolean) => `px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${on ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-slate-950 text-slate-500 hover:text-slate-300 border-slate-900"}`;
  return (
    <div className="space-y-5" data-testid="boss-status-section">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="BOSS 子分類">
        <button type="button" aria-pressed={!group} data-boss-group="" onClick={() => setGroup("")} className={chip(!group)}>全部 {matched.length}</button>
        {groups.map(g => (
          <button type="button" key={g.id} aria-pressed={group === g.id} data-boss-group={g.id} title={g.hint} onClick={() => setGroup(group === g.id ? "" : g.id)} className={chip(group === g.id)}>
            {g.label} {counts[g.id] || 0}
          </button>
        ))}
      </div>
      {groups.filter(g => (!group || group === g.id) && counts[g.id]).map(g => (
        <div key={g.id} className="space-y-3" data-boss-section={g.id}>
          <h4 className="text-sm font-bold text-rose-300/90" title={g.hint}>{g.label}（{counts[g.id]}）</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matched.filter(e => (bossGroupOf(e.name) ?? "other") === g.id).map(e => {
              const def = BOSS_TRAIT_BY_STATUS[e.name];
              const icon = statusVisual(e.name)?.icon;
              const rows = paramRows(def);
              return (
                <div key={e.name} data-boss-status={e.name} className="ios-card p-4 flex gap-3">
                  <img src={icon} alt="" data-boss-icon className="w-9 h-9 rounded shrink-0 object-contain" onError={ev => ((ev.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-slate-100 text-sm">{e.name}</h4>
                      {def && <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] ${TIER_TONE[def.tier]}`} title="威脅層次（星蝕回廊依難度解鎖）">{TIER_LABEL[def.tier]}</span>}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{def ? bossTraitText(def) : e.description}</p>
                    {(rows.length > 0 || def?.lv) && (
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                        {rows.map(r => <span key={r.label} className="px-1.5 py-0.5 rounded bg-white/[0.05]" title="參數預設值">{r.label} {r.value}</span>)}
                        {def?.lv && <span className="px-1.5 py-0.5 rounded bg-white/[0.05]" title={`星蝕回廊難度 0–3 的${def.lab.x ?? "參數"}`}>難度 {def.lv.join("／")}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {matched.length === 0 && <p className="text-xs text-slate-500">沒有符合的 BOSS 異常</p>}
    </div>
  );
}
