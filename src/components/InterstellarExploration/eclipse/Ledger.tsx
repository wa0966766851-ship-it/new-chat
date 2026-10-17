import React from "react";
import { motion } from "motion/react";
import * as E from "../../../modes/interstellar/v2/engine";
import { RELIC_BY_ID, RARITY_LABEL, relicMulTotals, type RelicRarity } from "../../../modes/interstellar/v2/relics";
import { Ornament, RelicIcon } from "./parts";
import BagPage from "./Bag";
import RecruitPage from "./Recruit";
import type { Elf } from "../../../types";

export type LedgerTab = "team" | "recruit" | "relics" | "chronicle";
type Dispatch = (f: (r: E.RunV2) => E.RunV2) => void;

const RARITY_ORDER: RelicRarity[] = ["boss", "legendary", "rare", "common", "cursed"];

/** 隊伍／遺物／紀事：收在同一個帳冊頁面，以分頁切換，不佔地圖畫面。 */
export default function Ledger({ run, pool, tab, onTab, onClose, dispatch }: { run: E.RunV2; pool: Elf[]; tab: LedgerTab; onTab: (t: LedgerTab) => void; onClose: () => void; dispatch: Dispatch }) {
  const tabs: { key: LedgerTab; label: string; count: string }[] = [
    { key: "team", label: "隊伍", count: `${E.lineupOf(run).length + E.benchOf(run).length}/${E.lineupSlots(run) + E.benchSlots(run)}・倉 ${E.storageOf(run).length}` },
    { key: "recruit", label: "招募", count: String(run.shards) },
    { key: "relics", label: "遺物", count: String(run.relics.length) },
    { key: "chronicle", label: "紀事", count: String(run.chronicle.length) },
  ];
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[45] overflow-y-auto bg-[rgba(4,3,8,.9)] backdrop-blur-[3px] p-4 md:p-8" role="dialog" aria-label="帳冊">
      <div className="mx-auto max-w-6xl ecl-frame p-5 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="ecl-roman text-[10px] ecl-muted">Ledger</div>
            <h2 className="ecl-title text-3xl ecl-gilt">帳冊</h2>
          </div>
          <div className="flex items-center gap-1" role="tablist">
            {tabs.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)}
                className={`px-2.5 sm:px-4 py-2 border-b-2 whitespace-nowrap font-black tracking-widest transition-colors ${tab === t.key ? "border-[var(--ecl-gold)] ecl-gilt" : "border-transparent ecl-muted hover:text-[var(--ecl-bone)]"}`}>
                {t.label}<span className="ml-1.5 text-xs tabular-nums opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
          <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-2" onClick={onClose}>闔上</button>
        </div>
        <Ornament className="my-4" />
        {tab === "team" && <BagPage run={run} dispatch={dispatch} />}
        {tab === "recruit" && <RecruitPage run={run} pool={pool} dispatch={dispatch} />}
        {tab === "relics" && <RelicPage run={run} />}
        {tab === "chronicle" && (<>
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs ecl-muted">
            <span className="tabular-nums" title="種子加上 N 等級、裝束、契約與禁用名單，可在開局的種子欄貼上復刻">種子 {run.seed}・{`N${run.nLevel ?? 0}`}{(run.bans?.length ?? 0) > 0 && `・禁用 ${run.bans!.length}`}</span>
            <button className="px-3 py-1 border border-[rgba(217,180,90,.4)] hover:bg-[rgba(217,180,90,.1)]" onClick={() => { try { void navigator.clipboard.writeText(E.runCodeOf(run)); } catch { /* 無剪貼簿權限 */ } }}>複製局碼</button>
          </div>
          <ol className="space-y-2 text-sm leading-relaxed">
            {run.chronicle.map((c, i) => <li key={i} className="border-l border-[rgba(217,180,90,.25)] pl-3" style={{ opacity: Math.max(.35, 1 - i * .04) }}>{c}</li>)}
          </ol>
        </>)}
      </div>
    </motion.div>
  );
}

function RelicPage({ run }: { run: E.RunV2 }) {
  const m = E.mods(run);
  const counts = new Map<string, number>();
  for (const id of run.relics) counts.set(id, (counts.get(id) ?? 0) + 1);
  const tot = relicMulTotals(run.relics), STAT_NAME = { hp: "體力", atk: "攻擊", def: "防禦", spatk: "特攻", spdef: "特防", speed: "速度" } as const;
  const vals = Object.values(tot), allSame = vals.length === 6 && vals.every(v => v === vals[0]);
  const mulChips = allSame ? [`全能力 ×${vals[0].toFixed(2)}`] : Object.entries(tot).map(([k, v]) => `${STAT_NAME[k as keyof typeof STAT_NAME]} ×${v.toFixed(2)}`);
  const mods = [
    m.shopMult !== 1 && `商店價格 ×${m.shopMult.toFixed(2)}`,
    m.beansMult !== 1 && `戰鬥賽爾豆 ×${m.beansMult.toFixed(2)}`,
    m.eclipsePerMove !== 0 && `每步蝕度 ${m.eclipsePerMove > 0 ? "+" : ""}${m.eclipsePerMove}`,
    m.restHealMult !== 1 && `星爐修復 ×${m.restHealMult.toFixed(2)}`,
    m.revealMystery && "看穿「？」",
    m.lineupBonus > 0 && `出戰／待命上限各 +${m.lineupBonus}`,
    m.eliteRelicChoice > 0 && `夢魘遺物 +${m.eliteRelicChoice} 選項`,
    ...mulChips,
  ].filter(Boolean) as string[];
  if (!run.relics.length) return <p className="ecl-muted">尚無遺物。寶匣、夢魘、王座與異兆都可能給你一件。</p>;
  return (
    <div className="space-y-6">
      {mods.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="ecl-roman text-[10px] ecl-muted self-center mr-1">Effects</span>
          {mods.map(t => <span key={t} className="px-2 py-1 border border-[rgba(217,180,90,.3)]">{t}</span>)}
        </div>
      )}
      {RARITY_ORDER.map(rarity => {
        const ids = [...counts.keys()].filter(id => RELIC_BY_ID[id]?.rarity === rarity);
        if (!ids.length) return null;
        return (
          <section key={rarity}>
            <h3 className={`font-black tracking-widest mb-2 ${rarity === "cursed" ? "ecl-blood" : "ecl-gilt"}`}>{RARITY_LABEL[rarity]}<span className="ml-2 text-xs ecl-muted">{ids.length}</span></h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ids.map(id => { const r = RELIC_BY_ID[id]; const n = counts.get(id) ?? 1; return (
                <div key={id} className={`flex gap-3 p-3 border ${rarity === "cursed" ? "border-[rgba(224,71,95,.35)]" : "border-[rgba(217,180,90,.2)]"} bg-black/30`}>
                  <RelicIcon id={id} rarity={r.rarity} glyph={r.glyph} dim="3.2rem" fontSize="1.4rem" />
                  <div className="min-w-0">
                    <div className="font-black">{r.name}{n > 1 && <span className="ml-1 text-xs ecl-muted">×{n}</span>}</div>
                    <div className="text-xs leading-relaxed mt-0.5">{r.desc}</div>
                    {r.lore && <div className="text-[11px] italic ecl-muted mt-1">「{r.lore}」</div>}
                  </div>
                </div>
              ); })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
