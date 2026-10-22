import React, { useEffect, useMemo, useState } from "react";
import { Search, Check, Package, Shirt, Glasses, Award, Gem, X, Users, Layers } from "lucide-react";
import type { ShellBridge } from "../bridge";
import type { Elf } from "../../types";
import { ElfAvatar, TypeIcon, SkillTypeIcon } from "../../components/SeerImages";
import { SUIT_CATALOG } from "../../data/suitsAndEyewears";
import { EYEWEAR_CATALOG } from "../../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../../data/titles";
import { cueCss } from "../../design/cues";
import { AegisBackdrop } from "../art/backdrop";
import { typeColor } from "../art/figure";
import { readEquipment, writeEquipment, clearEquipment, type EquipmentSlot } from "../equipment";
import { readLastUsedRecord, summarizeTeam } from "../lastTeam";
import { TeamBoard } from "../art/TeamPanel";
import { SuitRail } from "../art/SuitRail";
import { ElfCardSheet } from "../art/ElfCardSheet";
import { haptic } from "../haptics";

/**
 * BagScene — 原生背包（Phase 3）
 *
 * 手遊背包的標準結構（方舟的「幹員 → 裝備」、原神的「角色 → 武器」都一樣）：
 *   左：角色選擇（誰要裝備）
 *   中：目前裝備摘要
 *   右／下：可換的裝備清單（分類分頁 + 搜尋）
 *
 * 這裡的分類對應本專案真實存在的資料：
 *   套裝 SUIT_CATALOG、護目鏡 EYEWEAR_CATALOG、稱號 TITLE_CATALOG。
 *   技能石只在精靈的換技能介面處理。
 *
 * 唯讀優先：先能「看」，裝備寫入走 Legacy 編輯器（避免兩套裝備邏輯分岔）。
 * 每個項目都附「到 Legacy 裝備」的出口，所以功能不缺席。
 */

type BagTab = "team" | "suit" | "eyewear" | "title" | "elf";

const TABS: { id: BagTab; label: string; icon: React.ReactNode; tone: string }[] = [
  { id: "team", label: "隊伍", icon: <Users className="w-3.5 h-3.5" />, tone: "#22D3EE" },
  { id: "suit", label: "套裝", icon: <Shirt className="w-3.5 h-3.5" />, tone: "#38BDF8" },
  { id: "eyewear", label: "護目鏡", icon: <Glasses className="w-3.5 h-3.5" />, tone: "#A78BFA" },
  { id: "title", label: "稱號", icon: <Award className="w-3.5 h-3.5" />, tone: "#FBBF24" },
  { id: "elf", label: "精靈", icon: <Users className="w-3.5 h-3.5" />, tone: "#F472B6" },
];

export function BagScene({ b, onSetup }: { b: ShellBridge; onSetup?: () => void }) {
  const [tab, setTab] = useState<BagTab>("team");
  // 精靈卡牌倉庫：選中的精靈（null = 關閉）
  const [cardElf, setCardElf] = React.useState<Elf | null>(null);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"p1" | "p2">("p1");
  const [equipError, setEquipError] = useState('');
  const [picked, setPicked] = useState<string | null>(b.allElvesCombined[0]?.id ?? null);
  const [detail, setDetail] = useState<{ name: string; badge?: string; desc: string; tone: string; elf?: Elf } | null>(null);

  /**
   * 裝備在 Legacy 是「隊伍層級」的 localStorage（seer_p1_suit / eyewear / title），
   * 不是掛在精靈身上。所以背包要判斷「已裝備」就得讀那三個 key。
   */
  // 裝備狀態放在 state，裝備／卸下後立即反映（不重新整理頁面）
  const [equipped, setEquipped] = useState(() => readEquipment("p1"));
  useEffect(() => { setEquipped(readEquipment(side)); }, [side]);

  /** 目前分頁對應的裝備欄位；精靈分頁不適用 */
  const slotForTab: EquipmentSlot | null =
    tab === "suit" ? "suit" : tab === "eyewear" ? "eyewear" : tab === "title" ? "title" : null;

  /** 點物品：已裝備 → 卸下；未裝備 → 裝備上 */
  const toggleEquip = (id: string) => {
    if (!slotForTab) return;
    haptic("light");
    const targetId = equipped[slotForTab] === id ? '' : id;
    const next = equipped[slotForTab] === id
      ? clearEquipment(side, slotForTab)
      : writeEquipment(side, slotForTab, id);
    setEquipped(next);
    setEquipError(next[slotForTab] === targetId ? '' : '裝備未能儲存，請檢查儲存空間；目前維持原配裝。');
  };

  // 隊伍資料（與大廳、編成共用同一份存檔）
  const team = useMemo(() => summarizeTeam(readLastUsedRecord(side)), [side]);
  const teamIsPreview = !team.hasTeam;

  const elf = useMemo(
    () => b.allElvesCombined.find(e => e.id === picked) ?? b.allElvesCombined[0] ?? null,
    [b.allElvesCombined, picked]
  );

  const items = useMemo<{
    key: string; name: string; badge?: string; desc: string; tone: string; elf?: Elf;
  }[]>(() => {
    const q = query.trim();
    const match = (name: string, desc?: string) =>
      !q || name.includes(q) || (desc ?? "").includes(q);

    if (tab === "suit") {
      return Object.values(SUIT_CATALOG)
        .filter(s => match(s.name, s.description))
        .map(s => ({ key: s.id, name: s.name, badge: s.badge, desc: s.description, tone: "#38BDF8" }));
    }
    if (tab === "eyewear") {
      return Object.values(EYEWEAR_CATALOG)
        .filter(e => match(e.name, e.description))
        .map(e => ({ key: e.id, name: e.name, badge: e.badge, desc: e.description, tone: "#A78BFA" }));
    }
    if (tab === "title") {
      return Object.values(TITLE_CATALOG)
        .filter(t => match(t.name, t.description))
        .map(t => ({ key: t.id, name: t.name, badge: t.category?.slice(0, 2), desc: t.description, tone: "#FBBF24" }));
    }
    if (tab === "elf") {
      // 精靈倉庫：全部精靈，顯示屬性與等級；點開看詳情
      return b.allElvesCombined
        .filter(e => match(e.name, e.type))
        .map(e => ({
          key: String(e.id ?? e.name),
          name: e.name,
          badge: e.type?.slice(0, 1),
          desc: `Lv.${e.level} · ${e.type} · HP ${e.calculatedStats?.hp ?? "-"} · 速 ${e.calculatedStats?.speed ?? "-"}`,
          tone: typeColor(e.type),
          elf: e,
        }));
    }
    return [];
  }, [tab, query, b.allElvesCombined]);

  return (
    <section data-scene="bag" className="relative w-full flex flex-col overflow-hidden" style={{ height: "100%", minHeight: 0 }}>
      <AegisBackdrop image={null} desaturate={0.5} sceneOpacity={0.28} />

      <div className="relative z-10 flex flex-col gap-1.5 px-2.5 pt-1.5 flex-1 min-h-0">

        {/* ── 標題 ── */}
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <div className="flex flex-col leading-none">
            <span className="text-[7.5px] font-mono tracking-[0.2em]" style={{ color: "rgba(203,213,225,0.6)" }}>INVENTORY</span>
            <span className="text-[13px] font-black mt-0.5" style={{ color: "#F8FAFC" }}>背包</span>
          </div>
          {tab !== 'team' && <div className="flex items-center ml-1" style={{ borderRadius: 8, background: "rgba(6,16,26,0.8)", border: "1px solid rgba(148,163,184,0.2)" }}>
            {(["p1", "p2"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className="px-2 py-0.5 text-[9.5px] font-bold transition-colors"
                style={{
                  borderRadius: 7,
                  background: side === s ? "color-mix(in srgb, var(--p-accent) 26%, transparent)" : "transparent",
                  color: side === s ? "var(--p-accent-hot)" : "rgba(203,213,225,0.6)",
                }}
              >
                {s === "p1" ? "我方" : "對手"}
              </button>
            ))}
          </div>}
          <span className="text-[9px] font-mono" style={{ color: "rgba(203,213,225,0.55)" }}>
            {tab === "team" ? "雙方陣容" : `${items.length} 件`}
          </span>
          <button
            type="button"
            onClick={() => b.setView("custom")}
            className="ml-auto px-2.5 py-1.5 text-[10px] font-bold active:scale-95 transition-transform flex items-center gap-1"
            style={{ borderRadius: 8, background: "color-mix(in srgb, var(--p-accent) 20%, transparent)", border: "1px solid color-mix(in srgb, var(--p-accent) 45%, transparent)", color: "var(--p-accent-hot)" }}
          >
            <Package className="w-3 h-3" />
            精靈編成
          </button>
          {onSetup && <button type="button" onClick={onSetup} className="rounded-lg bg-slate-800 px-2 py-2 text-xs">完整設定</button>}
        </div>

        {/* ── 分類分頁 ── */}
        <div className="shrink-0 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex items-center justify-center gap-1 py-1.5 px-2 shrink-0 active:scale-95 transition-transform"
              style={{
                borderRadius: 9,
                background: tab === t.id
                  ? `linear-gradient(135deg, color-mix(in srgb, ${t.tone} 34%, #06101A) 0%, color-mix(in srgb, ${t.tone} 12%, #06101A) 100%)`
                  : "rgba(6,16,26,0.72)",
                boxShadow: tab === t.id
                  ? `inset 0 0 0 1px ${t.tone}`
                  : "inset 0 0 0 1px rgba(148,163,184,0.18)",
                transitionDuration: cueCss("pressUp"),
              }}
            >
              <span style={{ color: tab === t.id ? t.tone : "rgba(148,163,184,0.7)" }}>{t.icon}</span>
              <span className="text-[9.5px] font-bold" style={{ color: tab === t.id ? "#F8FAFC" : "rgba(203,213,225,0.7)" }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {slotForTab && <p className="text-xs text-slate-300">裝備套用於{side === "p1" ? "我方" : "對手"}全隊，點選卡片即可裝備或卸下。</p>}

        {/* ── 搜尋（只有精靈分頁用；裝備分頁的搜尋在 SuitRail 內） ── */}
        {tab === "elf" && (
        <div className="shrink-0 relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "rgba(148,163,184,0.7)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜尋名稱或說明"
            className="w-full pl-7 pr-7 py-1.5 text-[10px] outline-none"
            style={{ borderRadius: 8, background: "rgba(6,16,26,0.82)", border: "1px solid rgba(148,163,184,0.22)", color: "#F1F5F9" }}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3" style={{ color: "rgba(148,163,184,0.7)" }} />
            </button>
          )}
        </div>

        )}
        {/* ── 隊伍分頁：雙方並排（手機上下、桌面左右） ── */}
        {tab === "team" && (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
            <TeamBoard b={b} />
            <div
              className="shrink-0 flex items-center gap-1.5 px-2 py-1.5"
              style={{ borderRadius: 8, background: "rgba(6,16,26,0.6)", border: "1px solid rgba(148,163,184,0.14)" }}
            >
              <span className="text-[8px] leading-tight flex-1" style={{ color: "rgba(148,163,184,0.85)" }}>
                點精靈查看資料或替換；前6隻出戰，後6隻待命。
              </span>

            </div>
          </div>
        )}

        {/* ── 套裝／護目鏡／稱號：改用星蝕式卡片列 ── */}
        {slotForTab && (
          <>
          {equipError && <p role="alert" className="text-amber-200 text-sm">{equipError}</p>}
          <SuitRail
            kind={slotForTab}
            equippedId={equipped[slotForTab]}
            onEquip={(id) => toggleEquip(id)}
          />
          </>
        )}

        {/* ── 精靈倉庫清單 ── */}
        {tab === "elf" && (
        <div
          className="flex-1 min-h-0 overflow-y-auto p-1"
          style={{ borderRadius: 12, background: "rgba(4,10,18,0.6)",  }}
        >
          <div className="flex flex-col gap-1">
            {items.map(it => {
              const isEquipped = slotForTab !== null && equipped[slotForTab] === it.key;
              const isElf = tab === "elf" && it.elf;
              return (
              <div key={it.key} className="relative">
              <button
                type="button"
                title={slotForTab ? (isEquipped ? "點擊卸下" : "點擊裝備") : "點擊查看詳情"}
                onClick={() => {
                  if (slotForTab) toggleEquip(it.key);
                  else setDetail({ name: it.name, badge: it.badge, desc: it.desc, tone: it.tone, elf: it.elf });
                }}
                className="w-full flex items-start gap-1.5 p-1.5 pr-9 text-left active:scale-[0.98] transition-transform"
                style={{
                  borderRadius: 9,
                  background: `linear-gradient(150deg, color-mix(in srgb, ${it.tone} 14%, #071019) 0%, rgba(6,16,26,0.9) 78%)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${it.tone} 26%, transparent)`,
                }}
              >
                <span
                  className="shrink-0 flex items-center justify-center text-[8px] font-black"
                  style={{
                    width: 48, height: 48, borderRadius: 6,
                    background: `color-mix(in srgb, ${it.tone} 30%, transparent)`,
                    color: it.tone,
                  }}
                >
                  {it.elf ? <ElfAvatar elf={it.elf} kind="head" className="w-12 h-12 object-contain" /> : it.badge ?? it.name.slice(0, 1)}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="text-[9.5px] font-bold truncate" style={{ color: "#F1F5F9" }}>{it.name}</span>{it.elf && <TypeIcon type={it.elf.type} size={16} />}
                    {isEquipped && (
                      <span className="shrink-0 text-[6.5px] font-black px-1 leading-[10px]"
                        style={{ borderRadius: 2, background: "#22C55E", color: "#04121C" }}>已裝備</span>
                    )}
                  </span>
                  <span
                    className="text-[8px] leading-[1.35]"
                    style={{
                      color: "rgba(148,163,184,0.82)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {it.desc}
                  </span>
                </div>
              </button>

              {/* 精靈專屬：查看卡牌倉庫（使用者要求 2026-10-22） */}
              {isElf && (
                <button
                  type="button"
                  title={`查看 ${it.name} 的卡牌倉庫`}
                  onClick={(ev) => { ev.stopPropagation(); haptic("light"); setCardElf(it.elf!); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center active:scale-90 transition-transform"
                  style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(6,16,26,0.9)", border: "1px solid rgba(148,163,184,0.3)" }}
                >
                  <Layers className="w-3 h-3" style={{ color: it.tone }} />
                </button>
              )}
              </div>
              );
            })}
          </div>
          {!items.length && (
            <p className="text-center text-[10px] py-6" style={{ color: "rgba(148,163,184,0.6)" }}>沒有符合條件的物品</p>
          )}
        </div>
        )}

        {/* ── 目前裝備摘要（精靈分頁時不需要） ── */}
        {slotForTab && (
        <div
          className="shrink-0 flex items-center gap-1.5 px-2 py-1"
          style={{ borderRadius: 8, background: "rgba(4,10,18,0.62)", border: "1px solid rgba(148,163,184,0.14)" }}
        >
          <span className="text-[7.5px] font-mono shrink-0" style={{ color: "rgba(148,163,184,0.7)" }}>
            {side === "p1" ? "P1" : "P2"} 裝備
          </span>
          {[
            ["套裝", equipped.suit, "#38BDF8"],
            ["眼鏡", equipped.eyewear, "#A78BFA"],
            ["稱號", equipped.title, "#FBBF24"],
          ].map(([label, id, tone]) => {
            const name =
              label === "套裝" ? (SUIT_CATALOG[id as string]?.name ?? "未裝備")
              : label === "眼鏡" ? (EYEWEAR_CATALOG[id as string]?.name ?? "未裝備")
              : (TITLE_CATALOG[id as string]?.name ?? "未裝備");
            const none = name === "未裝備";
            return (
              <span key={label as string} className="text-[7.5px] px-1 py-px truncate max-w-[80px]"
                style={{
                  borderRadius: 3,
                  color: none ? "rgba(148,163,184,0.5)" : (tone as string),
                  background: none ? "rgba(148,163,184,0.08)" : `color-mix(in srgb, ${tone} 16%, transparent)`,
                }}
                title={name}
              >
                {label}:{name}
              </span>
            );
          })}
        </div>

        )}

        {/* ── 詳情抽屜 ── */}
        {detail && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-label="物品詳情">
            <button type="button" aria-label="關閉" onClick={() => setDetail(null)} className="absolute inset-0 bg-black/70" />
            <div
              className="relative p-4 pb-8 flex flex-col gap-2.5"
              style={{
                background: "linear-gradient(180deg, #0B1620, #060D14)",
                borderTop: `1px solid ${detail.tone}`,
                borderRadius: "20px 20px 0 0",
                animation: `drawerUp ${cueCss("drawer")} ease-out`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${detail.tone} 30%, transparent)`, color: detail.tone }}
                >
                  {detail.badge ?? detail.name.slice(0, 1)}
                </span>
                <span className="text-[15px] font-black flex-1" style={{ color: "#F8FAFC" }}>{detail.name}</span>
                <button type="button" onClick={() => setDetail(null)} className="p-1.5" style={{ borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
                  <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
                </button>
              </div>
              <p className="text-[11.5px] leading-[1.65]" style={{ color: "rgba(203,213,225,0.88)" }}>
                {detail.desc}
              </p>
              {detail.elf && <>
                <ElfAvatar elf={detail.elf} kind="body" className="h-36 w-full object-contain" />
                <button type="button" className="rounded-lg bg-cyan-700 p-3 text-white" onClick={() => {
                  b.setEditingElf(detail.elf!); b.setEditorTab('manual'); b.setView('custom');
                }}>編輯精靈／技能／積木</button>
              </>}
              <button
                type="button"
                onClick={() => { setDetail(null); b.setView("custom"); }}
                className="py-2.5 text-[11.5px] font-bold active:scale-95 transition-transform"
                style={{ borderRadius: 10, background: "var(--p-accent)", color: "#03121B" }}
              >
                到編成裝備
              </button>
              <style>{`@keyframes drawerUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
            </div>
          </div>
        )}

        {/* ── 底部提示 ── */}
        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1"
          style={{ borderRadius: 8, background: "rgba(6,16,26,0.6)", border: "1px solid rgba(148,163,184,0.14)" }}>
          <Check className="w-2.5 h-2.5 shrink-0" style={{ color: "#22C55E" }} />
          <span className="text-[8px] leading-tight flex-1" style={{ color: "rgba(148,163,184,0.85)" }}>
            {tab === "elf"
              ? "點選精靈可查看或編輯；陣容配置請到「精靈編成」。"
              : tab === "team"
                ? "雙方同頁管理，點選精靈即可查看或替換。"
                : `點擊裝備／卸下（${side === "p1" ? "我方" : "對手"}）；新戰局會套用此配裝。`}
          </span>
        </div>
      </div>
      {cardElf && <ElfCardSheet elf={cardElf} onClose={() => setCardElf(null)} />}
    </section>
  );
}