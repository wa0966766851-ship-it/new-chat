import React from "react";
import { motion } from "motion/react";
import type { Elf } from "../../../types";
import * as E from "../../../modes/interstellar/v2/engine";
import { RELIC_BY_ID, RARITY_LABEL, type RelicRarity } from "../../../modes/interstellar/v2/relics";
import { ElfAvatar, TypeIcon } from "../../SeerImages";
import { Ornament, RelicIcon, alive, hpRatio } from "./parts";

export type LedgerTab = "team" | "relics" | "chronicle";
type Dispatch = (f: (r: E.RunV2) => E.RunV2) => void;

const STAT_LABEL: [keyof Elf["calculatedStats"], string][] = [["hp", "體力"], ["atk", "攻擊"], ["def", "防禦"], ["spatk", "特攻"], ["spdef", "特防"], ["speed", "速度"]];
const RARITY_ORDER: RelicRarity[] = ["boss", "legendary", "rare", "common", "cursed"];

/** 隊伍／遺物／紀事：收在同一個帳冊頁面，以分頁切換，不佔地圖畫面。 */
export default function Ledger({ run, tab, onTab, onClose, dispatch }: { run: E.RunV2; tab: LedgerTab; onTab: (t: LedgerTab) => void; onClose: () => void; dispatch: Dispatch }) {
  const tabs: { key: LedgerTab; label: string; count: string }[] = [
    { key: "team", label: "隊伍", count: `${E.lineupOf(run).length + E.benchOf(run).length}/${E.lineupSlots(run) + E.benchSlots(run)}・倉 ${E.storageOf(run).length}` },
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
                className={`px-4 py-2 border-b-2 font-black tracking-widest transition-colors ${tab === t.key ? "border-[var(--ecl-gold)] ecl-gilt" : "border-transparent ecl-muted hover:text-[var(--ecl-bone)]"}`}>
                {t.label}<span className="ml-1.5 text-xs tabular-nums opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
          <button className="ecl-btn ecl-btn-ghost text-xs px-4 py-2" onClick={onClose}>闔上</button>
        </div>
        <Ornament className="my-4" />
        {tab === "team" && <TeamPage run={run} dispatch={dispatch} />}
        {tab === "relics" && <RelicPage run={run} />}
        {tab === "chronicle" && (
          <ol className="space-y-2 text-sm leading-relaxed">
            {run.chronicle.map((c, i) => <li key={i} className="border-l border-[rgba(217,180,90,.25)] pl-3" style={{ opacity: Math.max(.35, 1 - i * .04) }}>{c}</li>)}
          </ol>
        )}
      </div>
    </motion.div>
  );
}

function TeamPage({ run, dispatch }: { run: E.RunV2; dispatch: Dispatch }) {
  const slots = E.lineupSlots(run), bslots = E.benchSlots(run);
  const lineup = E.lineupOf(run), bench = E.benchOf(run), storage = E.storageOf(run);
  const onMap = run.scene.kind === "map";
  const starter = lineup.find(alive);
  const btn = "text-xs px-3 py-1 border hover:bg-[rgba(217,180,90,.1)] disabled:opacity-35 disabled:hover:bg-transparent";
  const gold = `${btn} border-[rgba(217,180,90,.5)]`, grey = `${btn} border-[rgba(169,159,139,.4)]`;
  const actions = (e: Elf, place: "lineup" | "bench" | "storage") => {
    const i = run.team.indexOf(e), dead = !alive(e);
    const lineFull = lineup.length >= slots, benchFull = bench.length >= bslots;
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {place === "lineup" && lineup.length > 1 && <button className={grey} onClick={() => dispatch(r => E.toggleLineup(r, i))} title={benchFull ? "待命已滿，將送入倉庫" : ""}>下場待命</button>}
        {place !== "lineup" && <button className={gold} disabled={dead || lineFull || (place === "storage" && !onMap)} title={dead ? "陣亡，需在星爐復甦" : lineFull ? "出戰已滿，先讓一隻下場" : place === "storage" && !onMap ? "倉庫只能在地圖上取用" : ""} onClick={() => dispatch(r => E.toggleLineup(r, i))}>上場</button>}
        {!dead && e !== starter && place !== "storage" && <button className={gold} onClick={() => dispatch(r => E.setStarter(r, i))}>設為首發</button>}
        {place === "bench" && <button className={grey} disabled={!onMap} title={onMap ? "" : "倉庫只能在地圖上取用"} onClick={() => dispatch(r => E.toggleStorage(r, i))}>存入倉庫</button>}
        {place === "storage" && <button className={grey} disabled={benchFull || !onMap} title={benchFull ? "待命已滿" : !onMap ? "倉庫只能在地圖上取用" : ""} onClick={() => dispatch(r => E.toggleStorage(r, i))}>放入背包</button>}
      </div>
    );
  };
  const badges = (e: Elf) => {
    const boost = Number((e as any).runBoost) || 0;
    return <>
      {e === starter && <span className="text-[10px] px-1.5 border border-[var(--ecl-gold)] ecl-gilt">首發</span>}
      {!alive(e) && <span className="text-[10px] px-1.5 border border-[rgba(224,71,95,.6)] ecl-blood">陣亡</span>}
      {boost > 0 && <span className="text-[10px] px-1.5 border border-[rgba(79,209,197,.5)]" style={{ color: "var(--ecl-teal)" }}>淬鍊 +{Math.round(boost * 100)}%</span>}
    </>;
  };
  const card = (e: Elf, place: "lineup" | "bench") => {
    const snap = E.snapshotElf(run, e), dead = !alive(e);
    return (
      <div key={e.battleId || run.team.indexOf(e)} className={`relative flex gap-4 p-4 border ${e === starter ? "border-[var(--ecl-gold)] bg-[rgba(217,180,90,.06)]" : "border-[rgba(217,180,90,.2)] bg-black/30"} ${dead ? "opacity-60" : ""}`}>
        <div className={`w-20 h-24 shrink-0 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.5)] bg-black/60 ${dead ? "grayscale" : ""}`}>
          <ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center text-2xl font-black ecl-gilt" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-black text-lg truncate">{e.name}</span>{badges(e)}</div>
          <div className="flex items-center gap-1 text-xs ecl-muted"><TypeIcon type={e.type} size={14} showLabelWhenMissing={false} />{e.type}</div>
          <div className="mt-2">
            <div className="flex justify-between text-[11px] tabular-nums"><span>體力</span><span>{Math.max(0, e.currentHp)} / {e.maxHp}</span></div>
            <div className="ecl-hp mt-0.5"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>
          </div>
          <div className="grid grid-cols-6 gap-1 mt-2 text-center">
            {STAT_LABEL.map(([k, label]) => (
              <div key={k} className="bg-black/40 py-1"><div className="text-[9px] ecl-muted">{label}</div><div className="text-xs font-black tabular-nums">{snap.calculatedStats?.[k] ?? "—"}</div></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {e.skills.map((sk, j) => (
              <span key={j} title={sk.name} className={`text-[10px] px-1.5 py-0.5 border ${(sk.pp ?? 0) <= 0 ? "border-[rgba(224,71,95,.4)] ecl-blood" : "border-[rgba(217,180,90,.2)] ecl-muted"}`}>
                {sk.name.length > 6 ? sk.name.slice(0, 6) + "…" : sk.name} {sk.pp ?? 0}/{sk.maxPp ?? sk.pp}
              </span>
            ))}
          </div>
          {actions(e, place)}
        </div>
      </div>
    );
  };
  const mini = (e: Elf) => (
    <div key={e.battleId || run.team.indexOf(e)} className={`flex gap-3 p-3 border border-[rgba(217,180,90,.15)] bg-black/25 ${alive(e) ? "" : "opacity-60"}`}>
      <div className={`w-12 h-14 shrink-0 rounded-[50%] overflow-hidden border border-[rgba(217,180,90,.35)] bg-black/60 ${alive(e) ? "" : "grayscale"}`}>
        <ElfAvatar elf={e} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full grid place-items-center font-black ecl-gilt" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap"><span className="font-black truncate">{e.name}</span>{badges(e)}</div>
        <div className="ecl-hp mt-1"><i style={{ width: `${hpRatio(e) * 100}%` }} /></div>
        {actions(e, "storage")}
      </div>
    </div>
  );
  const empty = (n: number, text: string) => Array.from({ length: Math.max(0, n) }).map((_, i) => (
    <div key={`empty-${text}-${i}`} className="p-4 border border-dashed border-[rgba(217,180,90,.25)] grid place-items-center text-sm ecl-muted min-h-24">{text}</div>
  ));
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-baseline justify-between mb-2 gap-4 flex-wrap">
          <h3 className="font-black tracking-widest ecl-gilt">背包・出戰<span className="ml-2 text-xs ecl-muted tabular-nums">{lineup.length} / {slots}</span></h3>
          <span className="text-xs ecl-muted" title="出戰與待命上限：第 1 章各 3，每章 +1，最多各 6（共 12）">背包 {lineup.length + bench.length} / {slots + bslots}・排最前的存活者首發</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">{lineup.map(e => card(e, "lineup"))}{empty(slots - lineup.length, "空位")}</div>
      </section>
      <section>
        <h3 className="font-black tracking-widest mb-2">背包・待命<span className="ml-2 text-xs ecl-muted tabular-nums">{bench.length} / {bslots}</span></h3>
        <div className="grid md:grid-cols-2 gap-4">{bench.map(e => card(e, "bench"))}{empty(bslots - bench.length, "空位")}</div>
      </section>
      <section>
        <div className="flex items-baseline justify-between mb-2 gap-4 flex-wrap">
          <h3 className="font-black tracking-widest ecl-muted">倉庫<span className="ml-2 text-xs tabular-nums">{storage.length}</span></h3>
          <span className="text-xs ecl-muted" title="倉庫只能在地圖上存取；星爐修復只恢復背包內的精靈">地圖上可存取・星爐不修復倉庫</span>
        </div>
        {storage.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{storage.map(mini)}</div> : <p className="text-sm ecl-muted">空。背包滿時，新夥伴會送進這裡。</p>}
      </section>
    </div>
  );
}

function RelicPage({ run }: { run: E.RunV2 }) {
  const m = E.mods(run);
  const counts = new Map<string, number>();
  for (const id of run.relics) counts.set(id, (counts.get(id) ?? 0) + 1);
  const mods = [
    m.shopMult !== 1 && `商店價格 ×${m.shopMult.toFixed(2)}`,
    m.beansMult !== 1 && `戰鬥賽爾豆 ×${m.beansMult.toFixed(2)}`,
    m.eclipsePerMove !== 0 && `每步蝕度 ${m.eclipsePerMove > 0 ? "+" : ""}${m.eclipsePerMove}`,
    m.restHealMult !== 1 && `星爐修復 ×${m.restHealMult.toFixed(2)}`,
    m.revealMystery && "看穿「？」",
    m.lineupBonus > 0 && `出戰／待命上限各 +${m.lineupBonus}`,
    m.eliteRelicChoice > 0 && `夢魘遺物 +${m.eliteRelicChoice} 選項`,
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
