import React, { useMemo, useState } from "react";
import { X, ChevronRight, Sparkles, ArrowLeft } from "lucide-react";
import type { Elf } from "../../types";
import { RELEASE_NOTES } from "../../data/releaseNotes";
import { ElfAvatar, TypeIcon } from "../../components/SeerImages";
import { typeColor } from "./figure";
import { haptic } from "../haptics";

/**
 * NoticeSheet — 航行日誌（公告 + 最新精靈）
 *
 * 2026-10-22 使用者要求：
 *   「航行日誌新增最新精靈介紹，點入後就是一整個頁面大小」
 *
 * 結構：
 *   分頁 1「更新公告」：現有的 RELEASE_NOTES 手風琴
 *   分頁 2「最新精靈」：從精靈池取最近加入的，卡片式瀏覽
 *   點精靈 → 整頁詳情（不是小彈窗）
 *
 * 為什麼分兩頁而不是混在一起：
 *   公告是「版本資訊」，精靈是「內容介紹」，
 *   兩者的閱讀目的不同，混在一起會讓清單變長。
 */
export function NoticeSheet({ onClose, elves = [] }: { onClose: () => void; elves?: Elf[] }) {
  const [tab, setTab] = useState<"news" | "elves">("news");
  const [openId, setOpenId] = useState<string | null>(RELEASE_NOTES[0]?.id ?? null);
  const [detailElf, setDetailElf] = useState<Elf | null>(null);

  /* 最新精靈：取精靈池最後 12 隻（資料順序即加入順序） */
  const newest = useMemo(() => elves.slice(-12).reverse(), [elves]);

  /* ── 整頁精靈詳情 ── */
  if (detailElf) {
    return <ElfFullPage elf={detailElf} onBack={() => setDetailElf(null)} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-label="航行日誌">
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        className="relative flex flex-col flex-1 min-h-0 mt-12"
        style={{
          background: "linear-gradient(180deg, #0B1620 0%, #060D14 100%)",
          borderTop: "2px solid var(--p-accent)",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        }}
      >
        {/* 標題列 */}
        <div className="shrink-0 flex items-center gap-2 px-4 pt-3 pb-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--p-accent)" }} />
          <div className="flex flex-col leading-none flex-1 min-w-0">
            <span className="text-[7.5px] font-mono tracking-[0.2em]" style={{ color: "rgba(148,163,184,0.6)" }}>
              CHANGELOG
            </span>
            <span className="text-[15px] font-black mt-0.5" style={{ color: "#F8FAFC" }}>航行日誌</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 active:scale-90 transition-transform"
            style={{ borderRadius: 999, background: "rgba(255,255,255,0.08)" }}
          >
            <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        {/* 分頁 */}
        <div className="shrink-0 flex gap-1 px-3 pb-2">
          {([["news", "更新公告"], ["elves", "最新精靈"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { haptic("light"); setTab(id); }}
              className="flex-1 py-1.5 text-[10.5px] font-bold active:scale-95 transition-transform"
              style={{
                borderRadius: 8,
                background: tab === id ? "color-mix(in srgb, var(--p-accent) 22%, transparent)" : "rgba(255,255,255,0.05)",
                color: tab === id ? "var(--p-accent-hot)" : "rgba(203,213,225,0.7)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 內容 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3">
          {tab === "news" ? (
            <div className="flex flex-col gap-1">
              {RELEASE_NOTES.map(note => {
                const open = openId === note.id;
                return (
                  <div key={note.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => { haptic("light"); setOpenId(open ? null : note.id); }}
                      className="flex items-center gap-2 py-2.5 text-left active:opacity-80 transition-opacity"
                      style={{ borderLeft: `2px solid ${open ? "var(--p-accent)" : "rgba(148,163,184,0.18)"}`, paddingLeft: 10 }}
                    >
                      <span className="flex flex-col leading-none min-w-0 flex-1">
                        <span className="text-[8px] font-mono" style={{ color: "rgba(148,163,184,0.6)" }}>{note.date}</span>
                        <span className="text-[12px] font-black mt-1 truncate" style={{ color: open ? "#FFFFFF" : "#CBD5E1" }}>{note.title}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform"
                        style={{ color: "rgba(148,163,184,0.55)", transform: open ? "rotate(90deg)" : "none" }} />
                    </button>
                    {open && (
                      <ul className="flex flex-col gap-1 pb-2.5" style={{ paddingLeft: 12 }}>
                        {note.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="shrink-0 mt-1.5" style={{ width: 3, height: 3, borderRadius: 999, background: "var(--p-accent)", opacity: 0.7 }} />
                            <span className="text-[10px] leading-relaxed" style={{ color: "rgba(203,213,225,0.85)" }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {newest.map(elf => {
                const tone = typeColor(elf.type);
                return (
                  <button
                    key={elf.id || elf.name}
                    type="button"
                    onClick={() => { haptic("light"); setDetailElf(elf); }}
                    className="relative overflow-hidden text-left active:scale-[0.97] transition-transform"
                    style={{ borderRadius: 10, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 34%, transparent)` }}
                  >
                    <span className="absolute inset-0" style={{
                      background: `radial-gradient(ellipse 80% 60% at 50% 30%, color-mix(in srgb, ${tone} 30%, transparent), transparent 72%), linear-gradient(180deg, #0E1A26 0%, #060D14 100%)`,
                    }} />
                    <span className="relative block" style={{ height: 84 }}>
                      <ElfAvatar elf={elf} kind="body" className="absolute inset-0 w-full h-full object-contain object-bottom" />
                    </span>
                    <span className="relative block px-2 pb-2 pt-1">
                      <span className="block text-[10.5px] font-black truncate" style={{ color: "#F1F5F9" }}>{elf.name}</span>
                      <span className="flex items-center gap-1 mt-0.5">
                        <TypeIcon type={elf.type} size={12} />
                        <span className="text-[7.5px] font-mono" style={{ color: "rgba(148,163,184,0.75)" }}>Lv.{elf.level}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
              {!newest.length && (
                <p className="col-span-2 text-center text-[10px] py-8" style={{ color: "rgba(148,163,184,0.6)" }}>尚未載入精靈資料</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 精靈整頁詳情（覆蓋整個畫面） */
function ElfFullPage({ elf, onBack, onClose }: { elf: Elf; onBack: () => void; onClose: () => void }) {
  const tone = typeColor(elf.type);
  const stats = elf.calculatedStats;
  const rows: [string, string | number][] = [
    ["HP", stats?.hp ?? "-"], ["攻擊", stats?.atk ?? "-"], ["防禦", stats?.def ?? "-"],
    ["特攻", stats?.spatk ?? "-"], ["特防", stats?.spdef ?? "-"], ["速度", stats?.speed ?? "-"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-label={`${elf.name} 詳情`}>
      <div className="flex-1 min-h-0 flex flex-col" style={{ background: "linear-gradient(180deg, #0B1620 0%, #060D14 100%)" }}>
        {/* 頂部：返回 + 關閉（iOS 習慣：返回在左） */}
        <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <button type="button" onClick={onBack} className="flex items-center gap-1 active:scale-95 transition-transform" style={{ color: "var(--p-accent-hot)" }}>
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[11px] font-bold">返回</span>
          </button>
          <button type="button" onClick={onClose} className="ml-auto p-1.5 active:scale-90 transition-transform" style={{ borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
            <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 立繪 */}
          <div className="relative" style={{ height: "38vh", minHeight: 200 }}>
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse 62% 70% at 50% 45%, color-mix(in srgb, ${tone} 34%, transparent), transparent 74%)`,
            }} />
            <ElfAvatar elf={elf} kind="body" className="absolute inset-0 w-full h-full object-contain object-center" />
          </div>

          {/* 名稱 */}
          <div className="px-4 flex flex-col gap-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[22px] font-black leading-none" style={{ color: "#F8FAFC" }}>{elf.name}</span>
              <TypeIcon type={elf.type} size={20} />
              <span className="text-[10px] font-mono" style={{ color: "rgba(148,163,184,0.8)" }}>Lv.{elf.level}</span>
            </div>
            {elf.soulMark?.name && (
              <span className="text-[10px] font-bold" style={{ color: "#C4B5FD" }}>魂印 · {elf.soulMark.name}</span>
            )}
          </div>

          {/* 數值 */}
          <div className="px-4 mt-3 grid grid-cols-3 gap-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-col items-center py-2" style={{ borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
                <span className="text-[8px] font-mono" style={{ color: "rgba(148,163,184,0.7)" }}>{k}</span>
                <span className="text-[14px] font-black font-mono mt-0.5" style={{ color: "#F1F5F9" }}>{String(v)}</span>
              </div>
            ))}
          </div>

          {/* 技能 */}
          {elf.skills?.length > 0 && (
            <div className="px-4 mt-4 flex flex-col gap-1 pb-8">
              <span className="text-[8px] font-mono tracking-[0.18em]" style={{ color: "rgba(148,163,184,0.65)" }}>技能</span>
              {elf.skills.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2" style={{ borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
                  <span className="text-[8px] font-mono shrink-0" style={{ color: "rgba(148,163,184,0.55)" }}>{i + 1}</span>
                  <span className="text-[11px] font-bold truncate flex-1" style={{ color: "#E2E8F0" }}>{s.name}</span>
                  <span className="text-[8.5px] font-mono shrink-0" style={{ color: s.category === "屬性" ? "#6EE7B7" : "rgba(203,213,225,0.7)" }}>
                    {s.category === "屬性" ? "屬性" : `威力 ${s.power || 0}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
