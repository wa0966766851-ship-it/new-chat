import React, { useMemo, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";
import { SUIT_CATALOG } from "../../data/suitsAndEyewears";
import { EYEWEAR_CATALOG } from "../../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../../data/titles";
import { ChainImage } from "../../components/SeerImages";
import { haptic } from "../haptics";
import { useDragScroll } from "../../components/shared/useDragScroll";

/**
 * SuitRail — 套裝選擇（參考星蝕迴廊 SuitSelect 的做法）
 *
 * 借用的是「做法」，不是外觀：
 *   ✓ 大型直立卡片，一螢幕看得到 1.5–2 張
 *   ✓ 水平捲動 + snap 對齊
 *   ✓ 卡片上半是立繪（有素材用素材，沒有用徽記）
 *   ✓ 卡片下半是名稱 + 描述 + 數值摘要
 *   ✓ 選中與未選中外框尺寸相同，只換顏色（避免選中卡片跳動）
 *
 * 刻意不同的地方：
 *   ✗ 不用金色宮廷風（那是星蝕迴廊的皮），改用 Aegis 的青藍色票
 *   ✗ 加上搜尋（使用者要求保留）
 *   ✗ 點卡片直接裝備（星蝕是「選好再下一步」，背包要即時）
 */

export type RailKind = "suit" | "eyewear" | "title";

export interface RailItem {
  id: string;
  name: string;
  badge?: string;
  description: string;
  /** 數值摘要，例如「HP+60 速+60」 */
  stats?: string;
}

/** 立繪路徑：先找 elf-art，再找 seer/suit；都沒有就退回徽記 */
export function suitPortraitUrls(id: string): string[] {
  return [`/elf-art/suit_${id}.png`, `/seer/suit/${id}.png`];
}

export function SuitRail({
  kind, equippedId, onEquip,
}: {
  kind: RailKind;
  equippedId: string;
  onEquip: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  
  // 滑鼠拖曳 + 滾輪 + 觸控原生捲動（含 scroll-snap）
  const drag = useDragScroll<HTMLDivElement>({ snapSelector: "[data-suit-card]", wheel: true });

  const all: RailItem[] = useMemo(() => {
    if (kind === "suit") {
      return (Object.values(SUIT_CATALOG) as any[]).map(s => ({
        id: s.id,
        name: s.name,
        badge: s.badge,
        description: s.description ?? "",
        stats: summarizeStats(s),
      }));
    }
    if (kind === "eyewear") {
      return (Object.values(EYEWEAR_CATALOG) as any[]).map(e => ({
        id: e.id,
        name: e.name,
        badge: e.badge,
        description: e.description ?? "",
        stats: summarizeStats(e),
      }));
    }
    return (Object.values(TITLE_CATALOG) as any[]).map(t => ({
      id: t.id,
      name: t.name,
      badge: t.category?.slice(0, 2),
      description: t.description ?? "",
      stats: summarizeStats(t),
    }));
  }, [kind]);

  const list = useMemo(() => {
    const s = q.trim();
    if (!s) return all;
    return all.filter(it => it.name.includes(s) || it.description.includes(s));
  }, [all, q]);

  const tone = kind === "suit" ? "#38BDF8" : kind === "eyewear" ? "#A78BFA" : "#FBBF24";

  return (
    <div className="flex flex-col gap-1.5 min-h-0 flex-1">
      {/* 搜尋（使用者要求保留） */}
      <div className="relative shrink-0">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "rgba(148,163,184,0.7)" }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`搜尋${kind === "suit" ? "套裝" : kind === "eyewear" ? "護目鏡" : "稱號"}名稱或說明`}
          className="w-full pl-7 pr-7 py-1.5 text-[10.5px] outline-none"
          style={{ borderRadius: 8, background: "rgba(6,16,26,0.82)", border: "1px solid rgba(148,163,184,0.22)", color: "#F1F5F9" }}
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="w-3 h-3" style={{ color: "rgba(148,163,184,0.7)" }} />
          </button>
        )}
      </div>

      {/* 水平卡片列 */}
      <div
        ref={drag.ref}
        {...drag.bind}
        onDragStart={e => e.preventDefault()}
        tabIndex={0}
        aria-label="左右拖動選擇裝備"
        onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); drag.ref.current?.scrollBy({ left: e.key === "ArrowRight" ? 230 : -230, behavior: "smooth" }); } }}
        data-suit-rail
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory flex-1 min-h-0 pb-1"
        style={{ scrollbarWidth: "none", scrollBehavior: "smooth" }}
      >
        {list.map(it => {
          const selected = equippedId === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => { haptic("light"); onEquip(it.id); }}
              data-suit-card
              className="shrink-0 snap-center flex flex-col text-left active:scale-[0.98] transition-transform touch-pan-x"
              style={{
                width: "min(54vw, 210px)",
                borderRadius: 12,
                background: selected
                  ? `linear-gradient(170deg, color-mix(in srgb, ${tone} 26%, #071019), #060D14)`
                  : "linear-gradient(170deg, rgba(16,24,36,0.9), rgba(6,13,20,0.95))",
                border: `2px solid ${selected ? tone : "rgba(148,163,184,0.18)"}`
                ,
                boxShadow: selected ? `0 0 22px -6px ${tone}` : "none",
                transitionDuration: "160ms",
              }}
            >
              {/* 上半：立繪 */}
              <div
                className="relative shrink-0 overflow-hidden"
                style={{
                  height: "52%",
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  background: `radial-gradient(90% 70% at 50% 35%, color-mix(in srgb, ${tone} 32%, transparent), transparent 75%), linear-gradient(180deg, rgba(10,18,28,0.9), #050B12)`,
                }}
              >
                <ChainImage
                  urls={suitPortraitUrls(it.id)}
                  className="absolute inset-0 m-auto max-w-[92%] max-h-[92%] w-auto h-auto object-contain"
                  alt={it.name}
                  fallback={
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="text-4xl font-black opacity-80" style={{ color: tone }}>
                        {it.badge ?? it.name.slice(0, 2)}
                      </span>
                    </div>
                  }
                />
                {selected && (
                  <span
                    className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-black leading-none"
                    style={{ borderRadius: 3, background: tone, color: "#04121B" }}
                  >
                    <Check className="w-2 h-2" />已裝備
                  </span>
                )}
              </div>

              {/* 下半：資訊 */}
              <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1 flex-1 min-h-0">
                <span className="text-[12.5px] font-black leading-tight truncate" style={{ color: "#F1F5F9" }}>
                  {it.name}
                </span>
                {it.stats && (
                  <span className="text-[8.5px] font-mono leading-none" style={{ color: tone }}>
                    {it.stats}
                  </span>
                )}
                <span
                  className="text-[8.5px] leading-[1.35] mt-0.5"
                  style={{
                    color: "rgba(148,163,184,0.82)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {it.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!list.length && (
        <p className="text-center text-[10px] py-6" style={{ color: "rgba(148,163,184,0.6)" }}>沒有符合條件的項目</p>
      )}
    </div>
  );
}

/** 把 statBonus / percentBonus 轉成一行摘要 */
function summarizeStats(def: any): string | undefined {
  const parts: string[] = [];
  const label: Record<string, string> = { hp: "HP", atk: "攻", def: "防", spatk: "特攻", spdef: "特防", speed: "速" };
  const push = (obj: any, suffix: string) => {
    if (!obj) return;
    for (const k of Object.keys(label)) {
      const v = obj[k];
      if (typeof v === "number" && v !== 0) parts.push(`${label[k]}${v > 0 ? "+" : ""}${v}${suffix}`);
    }
  };
  push(def?.statBonus, "");
  push(def?.percentBonus, "%");
  return parts.length ? parts.slice(0, 4).join(" ") : undefined;
}
