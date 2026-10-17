import React from "react";
import { SUIT_CATALOG } from "../../../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../../../data/titles";
import { SUIT_PERKS, PERK_BUDGET, perkItems } from "../../../modes/interstellar/v2/suitPerks";
import { hashSeed } from "../../../modes/interstellar/v2/seed";
import { ChainImage } from "../../SeerImages";
import { Ornament } from "./parts";
import { useDragScroll } from "../../shared/useDragScroll";

export type EquipType = "suit" | "title";
const TIER_LABEL = { strong: "強襲", mid: "均衡", support: "輔助" } as const;

/** 套裝立繪：有素材就用（public/seer/suit/<id>.png 或 public/elf-art/suit_<id>.png），沒有就退回徽記。 */
export const suitPortraitUrls = (id: string) => [`/elf-art/suit_${id}.png`, `/seer/suit/${id}.png`];

const SuitCard: React.FC<{ id: string; selected: boolean; onSelect: () => void }> = ({ id, selected, onSelect }) => {
  const s = SUIT_CATALOG[id], sp = SUIT_PERKS[id];
  const hue = hashSeed(id) % 360;
  const perks = sp ? perkItems(sp.perk) : [];
  // 選中與否外框尺寸、位置完全相同（一律 2px 框），只換顏色與光暈，避免選中卡跳高或變大。
  return (
    <button type="button" role="option" aria-selected={selected} data-suit={id} onClick={onSelect}
      className={`group relative shrink-0 snap-center w-[15.5rem] sm:w-[17rem] lg:w-[18rem] h-[clamp(26rem,calc(100dvh-29rem),42rem)] flex flex-col text-left border-2 transition-colors duration-200 bg-[rgba(10,8,18,.88)] ${selected ? "border-[var(--ecl-gold-hi)] shadow-[0_0_28px_rgba(246,226,160,.28)]" : "border-[rgba(217,180,90,.22)] hover:border-[rgba(217,180,90,.6)]"}`}>
      <div className="relative h-[44%] shrink-0 overflow-hidden" style={{ background: `radial-gradient(90% 70% at 50% 35%, hsl(${hue} 55% 28% / .85), transparent 75%), linear-gradient(180deg, hsl(${hue} 40% 12%), #07060c)` }}>
        {/* 立繪是 200–320px 的小圖：以原尺寸置中（只縮不放），避免拉伸模糊 */}
        <ChainImage urls={suitPortraitUrls(id)} className="absolute inset-0 m-auto max-w-[94%] max-h-[94%] w-auto h-auto object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,.65)]" alt={s.name} sourceStyle={() => ({ imageRendering: "auto" })}
          fallback={<div className="absolute inset-0 grid place-items-center"><span className="ecl-title text-6xl ecl-gilt opacity-90 drop-shadow-[0_4px_12px_rgba(0,0,0,.8)]">{s.badge ?? s.name.slice(0, 2)}</span></div>} />
        {sp && <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 border border-[rgba(217,180,90,.5)] bg-black/60 ecl-gilt" title={`特權預算 ${PERK_BUDGET[sp.tier]} 點`}>{TIER_LABEL[sp.tier]}</span>}
        {selected && <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 bg-[var(--ecl-gold)] text-black font-black">已選</span>}
      </div>
      <div className="px-4 pt-3 pb-4 flex-1 flex flex-col min-h-0">
        <div className={`ecl-title text-xl leading-tight ${selected ? "ecl-gilt" : ""}`}>{s.name}</div>
        <p className="text-[11.5px] ecl-muted leading-relaxed mt-1.5 line-clamp-4 lg:line-clamp-[9]" title={s.description}>{s.description}</p>
        <div className="mt-auto pt-3 border-t border-[rgba(217,180,90,.2)]">
          <div className="ecl-roman text-[10px] ecl-muted mb-1" title="只作用於回廊跑圖，不改變套裝本身的戰鬥效果">Corridor Perk</div>
          {perks.length ? perks.map(p => <div key={p.text} title={p.tip} className="text-[13px] font-black ecl-gilt leading-6">✦ {p.text}</div>) : <div className="text-xs ecl-muted">—</div>}
        </div>
      </div>
    </button>
  );
};

/** 獨立的套裝選擇頁：由左至右的直立卡片，可水平捲動、鍵盤左右切換。 */
export default function SuitSelect({ equipType, equipId, onChange, perksOff, onNext }: { equipType: EquipType; equipId: string; onChange: (t: EquipType, id: string) => void; perksOff?: boolean; onNext?: () => void }) {
  const ids = Object.keys(SUIT_CATALOG);
  const drag = useDragScroll<HTMLDivElement>({ snapSelector: "[data-suit]", wheel: true });
  const rail = drag.ref;
  const move = (dir: 1 | -1) => {
    const i = Math.max(0, ids.indexOf(equipId)), next = ids[Math.max(0, Math.min(ids.length - 1, i + dir))];
    onChange("suit", next);
    requestAnimationFrame(() => rail.current?.querySelector(`[data-suit="${next}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }));
  };
  React.useEffect(() => { if (equipType === "suit") rail.current?.querySelector(`[data-suit="${equipId}"]`)?.scrollIntoView({ inline: "center", block: "nearest" }); }, []); // 只在開頁時置中
  const titles = Object.values(TITLE_CATALOG);
  const selectedTitle = equipType === "title" ? TITLE_CATALOG[equipId] : null;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="ecl-roman text-[10px] ecl-muted">Attire</div>
          <h2 className="ecl-title text-3xl md:text-4xl ecl-gilt">選擇套裝</h2>
        </div>
        <div className="flex gap-1 text-sm" role="tablist">
          {(["suit", "title"] as const).map(t => (
            <button key={t} role="tab" aria-selected={equipType === t} onClick={() => onChange(t, t === "suit" ? ids[0] : Object.keys(TITLE_CATALOG)[0])}
              className={`px-4 py-1.5 border-b-2 font-black tracking-widest ${equipType === t ? "border-[var(--ecl-gold)] ecl-gilt" : "border-transparent ecl-muted"}`}>{t === "suit" ? "套裝" : "稱號"}</button>
          ))}
        </div>
      </div>
      <Ornament className="my-3" />
      {equipType === "suit" ? (
        <div className="relative -mx-4 md:-mx-6">
          <button type="button" aria-label="上一個套裝" onClick={() => move(-1)} className="hidden md:grid absolute left-1 top-1/2 -translate-y-1/2 z-10 w-10 h-14 place-items-center border border-[rgba(217,180,90,.4)] bg-black/70 ecl-gilt hover:bg-[rgba(217,180,90,.15)]">‹</button>
          <button type="button" aria-label="下一個套裝" onClick={() => move(1)} className="hidden md:grid absolute right-1 top-1/2 -translate-y-1/2 z-10 w-10 h-14 place-items-center border border-[rgba(217,180,90,.4)] bg-black/70 ecl-gilt hover:bg-[rgba(217,180,90,.15)]">›</button>
          <div ref={rail} {...drag.bind} role="listbox" aria-label="套裝" tabIndex={0} data-testid="suit-rail"
            onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); move(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); } }}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory cursor-grab data-[dragging]:cursor-grabbing select-none px-4 md:px-14 pt-4 pb-6 outline-none focus-visible:ring-1 focus-visible:ring-[var(--ecl-gold)] [scrollbar-width:thin]">
            {ids.map(id => <SuitCard key={id} id={id} selected={equipId === id} onSelect={() => onChange("suit", id)} />)}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[34rem] overflow-y-auto pr-1">
          {titles.map(t => (
            <button key={t.id} type="button" onClick={() => onChange("title", t.id)} title={t.description}
              className={`text-left px-3 py-2 border ${equipId === t.id ? "border-[var(--ecl-gold)] bg-[rgba(217,180,90,.08)]" : "border-[rgba(217,180,90,.15)] hover:border-[rgba(217,180,90,.4)]"}`}>
              <div className={`font-black text-sm ${equipId === t.id ? "ecl-gilt" : ""}`}>{t.name}</div>
              <div className="text-[11px] ecl-muted line-clamp-2">{t.description}</div>
            </button>
          ))}
        </div>
      )}
      {/* 詳情面板：目前選擇的完整說明與特權；下一步在右側 */}
      <div className="mt-2 ecl-frame p-4 md:p-5 flex flex-wrap items-center gap-x-8 gap-y-3" aria-live="polite" data-testid="suit-detail">
        {equipType === "suit" ? (() => { const s = SUIT_CATALOG[equipId], sp = SUIT_PERKS[equipId]; return (
          <div className="min-w-0 flex-1 basis-80">
            <div className="flex items-baseline gap-3 flex-wrap"><b className="ecl-title text-2xl ecl-gilt">{s?.name ?? "—"}</b>{sp && <span className="text-xs ecl-muted" title={`特權預算 ${PERK_BUDGET[sp.tier]} 點`}>{TIER_LABEL[sp.tier]}</span>}
              {perksOff && <span className="ecl-blood text-sm" title="N12 起套裝回廊特權失效，套裝本身的戰鬥效果仍然有效">特權已被 N 等級封印</span>}</div>
            <p className="hidden md:block text-[13px] ecl-muted leading-relaxed mt-1 max-w-3xl">{s?.description}</p>
            <div className={`flex flex-wrap gap-2 mt-2 ${perksOff ? "opacity-40 line-through" : ""}`}>{(sp ? perkItems(sp.perk) : []).map(p => <span key={p.text} title={p.tip} className="text-[13px] font-black ecl-gilt px-2 py-0.5 border border-[rgba(217,180,90,.35)]">✦ {p.text}</span>)}</div>
          </div>); })() : (
          <div className="min-w-0 flex-1 basis-80"><b className="ecl-title text-2xl ecl-gilt">{selectedTitle?.name ?? "—"}</b><p className="hidden md:block text-[13px] ecl-muted leading-relaxed mt-1">{selectedTitle?.description}</p></div>
        )}
        {onNext && <button className="ecl-btn text-lg px-10 ml-auto" onClick={onNext}>下一步</button>}
      </div>
    </div>
  );
}
