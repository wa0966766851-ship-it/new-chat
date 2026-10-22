import React, { useMemo, useState } from "react";
import { X, Search, Crown, ChevronRight } from "lucide-react";
import type { Elf } from "../../types";
import { ElfAvatar, TypeIcon } from "../../components/SeerImages";
import { typeColor } from "./figure";
import { haptic } from "../haptics";

/**
 * ElfCardSheet — 單一精靈的卡牌資訊彈窗
 *
 * 使用者要求（2026-10-22）：
 *   「精靈背包每隻精靈新增可以查看精靈卡牌倉庫的按鈕，並顯示相關頁面」
 *
 * 為什麼做成彈窗而不是跳頁：
 *   玩家在背包裡是「快速確認某隻精靈」，跳頁會失去位置感；
 *   彈窗關掉就回到原本的列表，符合手遊的操作習慣。
 *
 * 風格對齊：與 LobbyScene 的資訊層級一致（無大框、資訊貼齊、色票取自屬性）。
 */
export function ElfCardSheet({
  elf, onClose,
}: {
  elf: Elf;
  onClose: () => void;
}) {
  const tone = typeColor(elf.type);
  const stats = elf.calculatedStats;

  const rows: [string, string | number][] = [
    ["HP", stats?.hp ?? "-"],
    ["攻擊", stats?.atk ?? "-"],
    ["防禦", stats?.def ?? "-"],
    ["特攻", stats?.spatk ?? "-"],
    ["特防", stats?.spdef ?? "-"],
    ["速度", stats?.speed ?? "-"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label={`${elf.name} 的卡牌資訊`}>
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        className="relative flex flex-col max-h-[88dvh] overflow-y-auto"
        style={{
          background: "linear-gradient(180deg, #0B1620 0%, #060D14 100%)",
          borderTop: `2px solid ${tone}`,
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
        }}
      >
        {/* 頂部：立繪 + 名稱 */}
        <div className="relative shrink-0" style={{ height: 168 }}>
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse 60% 70% at 50% 40%, color-mix(in srgb, ${tone} 34%, transparent), transparent 72%)`,
          }} />
          <ElfAvatar
            elf={elf}
            kind="body"
            className="absolute inset-0 w-full h-full object-contain object-center"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 p-1.5 active:scale-90 transition-transform"
            style={{ borderRadius: 999, background: "rgba(6,16,26,0.8)" }}
          >
            <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        {/* 名稱與屬性 */}
        <div className="px-4 flex flex-col gap-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[20px] font-black leading-none" style={{ color: "#F8FAFC" }}>{elf.name}</span>
            <TypeIcon type={elf.type} size={20} />
            <span className="text-[10px] font-mono" style={{ color: "rgba(148,163,184,0.8)" }}>Lv.{elf.level}</span>
          </div>
          {elf.soulMark?.name && (
            <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "#C4B5FD" }}>
              <Crown className="w-3 h-3" />
              {elf.soulMark.name}
            </span>
          )}
        </div>

        {/* 數值 */}
        <div className="px-4 mt-3 grid grid-cols-3 gap-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col items-center py-1.5" style={{ borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
              <span className="text-[8px] font-mono" style={{ color: "rgba(148,163,184,0.7)" }}>{k}</span>
              <span className="text-[13px] font-black font-mono mt-0.5" style={{ color: "#F1F5F9" }}>{String(v)}</span>
            </div>
          ))}
        </div>

        {/* 技能 */}
        {elf.skills?.length > 0 && (
          <div className="px-4 mt-3 flex flex-col gap-1">
            <span className="text-[8px] font-mono tracking-[0.18em]" style={{ color: "rgba(148,163,184,0.65)" }}>技能</span>
            {elf.skills.slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5" style={{ borderRadius: 7, background: "rgba(255,255,255,0.04)" }}>
                <span className="text-[8px] font-mono shrink-0" style={{ color: "rgba(148,163,184,0.55)" }}>{i + 1}</span>
                <span className="text-[10.5px] font-bold truncate flex-1" style={{ color: "#E2E8F0" }}>{s.name}</span>
                <span className="text-[8.5px] font-mono shrink-0" style={{ color: s.category === "屬性" ? "#6EE7B7" : "rgba(203,213,225,0.7)" }}>
                  {s.category === "屬性" ? "屬性" : `威力 ${s.power || 0}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 魂印說明 */}
        {elf.soulMark?.description && (
          <div className="px-4 mt-3 flex flex-col gap-1">
            <span className="text-[8px] font-mono tracking-[0.18em]" style={{ color: "rgba(148,163,184,0.65)" }}>魂印</span>
            <p className="text-[9.5px] leading-relaxed" style={{ color: "rgba(203,213,225,0.85)" }}>{elf.soulMark.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
