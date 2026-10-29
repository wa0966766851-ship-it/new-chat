import { ElfSpotlight } from '../../components/ElfSpotlight';
import React, { useState } from "react";
import { X, ChevronRight, Sparkles } from "lucide-react";
import type { Elf } from "../../types";
import { RELEASE_NOTES } from "../../data/releaseNotes";
import { haptic } from "../haptics";

/** 航行日誌：公告與可替換的精靈介紹模板。 */
export function NoticeSheet({ onClose, elves = [] }: { onClose: () => void; elves?: Elf[] }) {
  const [tab, setTab] = useState<"news" | "elves">("news");
  const [openId, setOpenId] = useState<string | null>(RELEASE_NOTES[0]?.id ?? null);


  if(tab==='elves')return <ElfSpotlight elves={elves} onClose={onClose} onBack={()=>setTab('news')}/>;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" data-shell-drawer aria-label="航行日誌">
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
