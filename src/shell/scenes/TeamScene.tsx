import React, { useMemo, useState, useRef } from "react";
import { X, Check, Search, Crown, Plus, Trash2, ChevronLeft, ChevronRight, Sparkles, Package } from "lucide-react";
import type { ShellBridge } from "../bridge";
import type { Elf } from "../../types";
import { ElfAvatar, TypeIcon, SkillTypeIcon } from "../../components/SeerImages";
import { cueCss } from "../../design/cues";
import { typeColor } from "../art/figure";
import {
  TEAM_CAPACITY, emptyDraft, addMember, removeMember, setStarter,
  moveMember, saveDraft, draftFromRecord, type TeamDraft,
} from "../teamDraft";
import { readLastUsedRecord } from "../lastTeam";
import { haptic } from "../haptics";
import { AegisBackdrop } from "../art/backdrop";

/**
 * TeamScene — Aegis 原生編成（Phase 3）
 *
 * 手遊編成的標準做法（明日方舟／原神／妮姬都一樣）：
 *   上方 = 目前隊伍（格子制，空格顯示 +）
 *   下方 = 可選角色庫（可搜尋、可篩屬性）
 *   點角色 → 進隊；點隊員 → 設首發；長按或垃圾桶 → 移出
 *
 * 存檔直接寫回 Legacy 的 key，所以切回舊介面看到的是同一隊。
 */

type Side = "p1" | "p2";

export function TeamScene({ b, onSetup }: { b: ShellBridge; onSetup?: () => void }) {
  const [side, setSide] = useState<Side>("p1");
  const [draft, setDraft] = useState<TeamDraft>(() =>
    draftFromRecord(readLastUsedRecord("p1"))
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const drafts = useRef<Partial<Record<Side, TeamDraft>>>({});
  const [saveError, setSaveError] = useState('');
  const switchSide = (next: Side) => {
    if (next === side) return;
    drafts.current[side] = draft;
    setSide(next);
    setDraft(drafts.current[next] ?? draftFromRecord(readLastUsedRecord(next)));
    setSaved(false);
  };

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    b.allElvesCombined.forEach(e => e.type && set.add(e.type));
    return [...set];
  }, [b.allElvesCombined]);

  const library = useMemo(() => {
    const q = query.trim();
    return b.allElvesCombined.filter(e => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (!q) return true;
      return e.name.includes(q) || String(e.id ?? "").includes(q);
    }).slice(0, 120);
  }, [b.allElvesCombined, query, typeFilter]);

  const inTeam = (elf: Elf) =>
    draft.members.some(m => (m.id || m.name) === (elf.id || elf.name));

  const handleSave = () => {
    if (!saveDraft(side, draft)) { setSaveError('未能儲存陣容，請檢查儲存空間。'); return; }
    setSaveError('');
    haptic("medium");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section data-scene="team" className="relative w-full flex flex-col overflow-hidden" style={{ height: "100%", minHeight: 0 }}>
      <AegisBackdrop image={null} desaturate={0.4} sceneOpacity={0.32} />

      <div className="relative z-10 flex flex-col gap-1.5 px-2.5 pt-1.5 flex-1 min-h-0">

        {/* ── 標題 + 側別切換 + 儲存 ── */}
        <div className="shrink-0 flex flex-wrap items-center gap-1.5">
          {onSetup && <button type="button" onClick={onSetup} className="rounded-lg bg-slate-800 px-3 py-2 text-xs">完整戰前設定</button>}
          <div className="flex flex-col leading-none">
            <span className="text-[7.5px] font-mono tracking-[0.2em]" style={{ color: "rgba(203,213,225,0.6)" }}>SQUAD</span>
            <span className="text-[13px] font-black mt-0.5" style={{ color: "#F8FAFC" }}>編成</span>
          </div>

          <div className="flex items-center ml-1" style={{ borderRadius: 8, background: "rgba(6,16,26,0.8)", border: "1px solid rgba(148,163,184,0.2)" }}>
            {(["p1", "p2"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => switchSide(s)}
                className="px-2.5 py-1 text-[10px] font-bold transition-colors"
                style={{
                  borderRadius: 7,
                  background: side === s ? "color-mix(in srgb, var(--p-accent) 26%, transparent)" : "transparent",
                  color: side === s ? "var(--p-accent-hot)" : "rgba(203,213,225,0.6)",
                }}
              >
                {s === "p1" ? "我方" : "對手"}
              </button>
            ))}
          </div>

          <span className="text-[9px] font-mono ml-1" style={{ color: "rgba(203,213,225,0.55)" }}>
            {draft.members.length}/{TEAM_CAPACITY}
          </span>
          {draft.members.length === 0 && (
            <span className="text-[8px] ml-1" style={{ color: "rgba(251,191,36,0.85)" }}>
              尚未儲存陣容（大廳顯示的是預覽）
            </span>
          )}

          {/* 背包從這裡進（主導航已移除背包，避免暴露在首頁） */}
          <button
            type="button"
            onClick={() => b.setView("bag")}
            className="ml-auto flex items-center gap-1 px-2 py-1.5 active:scale-95 transition-transform"
            style={{
              borderRadius: 8,
              background: "rgba(6,16,26,0.8)",
              border: "1px solid rgba(148,163,184,0.22)",
              color: "rgba(203,213,225,0.85)",
            }}
            title="背包管理（含雙方裝備與精靈倉庫）"
          >
            <Package className="w-3 h-3" />
            <span className="text-[10px] font-bold">背包</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 active:scale-95 transition-transform"
            style={{
              borderRadius: 8,
              background: saved ? "#22C55E" : "var(--p-accent)",
              color: "#03121B",
              transitionDuration: cueCss("pressUp"),
            }}
          >
            {saved ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            <span className="text-[10.5px] font-black">{saved ? "已儲存" : "儲存"}</span>
          </button>
        </div>

        {saveError && <p role="alert" className="text-amber-200">{saveError}</p>}
        <button type="button" className="text-left text-cyan-200" onClick={() => { b.setEditingElf(draft.members.find(e => e.battleId === draft.starterBattleId) ?? b.allElvesCombined[0] ?? null); b.setEditorTab('manual'); }}>編輯首發精靈／技能</button>
        {/* ── 隊伍格（12 格） ── */}
        <div
          className="shrink-0 p-1.5"
          style={{ borderRadius: 12, background: "rgba(4,10,18,0.66)", backdropFilter: "blur(10px)", border: "1px solid rgba(148,163,184,0.16)" }}
        >
          <div className="team-draft-grid grid grid-cols-6 gap-1">
            {Array.from({ length: TEAM_CAPACITY }).map((_, i) => {
              const elf = draft.members[i];
              return (
                <React.Fragment key={i}>
                  {elf ? (
                    <div className="flex flex-col items-center gap-0.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setDraft(d => setStarter(d, elf.battleId || ""))}
                        className="w-full aspect-square overflow-hidden relative active:scale-95 transition-transform"
                        style={{
                          borderRadius: 8,
                          background: "rgba(10,20,30,0.9)",
                          boxShadow: elf.battleId === draft.starterBattleId
                            ? "inset 0 0 0 2px var(--p-accent), 0 0 10px -2px var(--p-accent)"
                            : "inset 0 0 0 1px rgba(148,163,184,0.24)",
                        }}
                        title="點擊設為首發"
                      >
                        <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                        {elf.battleId === draft.starterBattleId && (
                          <span className="absolute top-0 left-0 px-0.5" style={{ background: "var(--p-accent)", color: "#03121B" }}>
                            <Crown className="w-2 h-2" />
                          </span>
                        )}
                      </button>
                      <span className="text-[8px] truncate w-full text-center" style={{ color: "rgba(241,245,249,0.88)" }}>
                        {elf.name}
                      </span>
                      <TypeIcon type={elf.type} size={16} />
                      <button
                        type="button"
                        onClick={() => setDraft(d => removeMember(d, elf.battleId || ""))}
                        className="absolute -mt-1 opacity-0"
                        aria-hidden
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full aspect-square flex items-center justify-center"
                      style={{ borderRadius: 8, border: "1px dashed rgba(148,163,184,0.3)", background: "rgba(10,20,30,0.4)" }}
                    >
                      <Plus className="w-3 h-3" style={{ color: "rgba(148,163,184,0.5)" }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* 移出按鈕：列出隊員，點一下就移除（比長按可靠） */}
          {draft.members.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(148,163,184,0.14)" }}>
              {draft.members.map(m => (
                <button
                  key={m.battleId}
                  type="button"
                  onClick={() => setDraft(d => removeMember(d, m.battleId || ""))}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 active:scale-95 transition-transform"
                  style={{ borderRadius: 5, background: "rgba(244,63,94,0.14)", border: "1px solid rgba(244,63,94,0.32)" }}
                  title={`移出 ${m.name}`}
                >
                  <Trash2 className="w-2 h-2" style={{ color: "#FB7185" }} />
                  <span className="text-[7.5px]" style={{ color: "#FDA4AF" }}>{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 隊伍摘要：首發 + 屬性分佈（一眼看懂這隊是什麼組成） ── */}
        {draft.members.length > 0 && (
          <div
            className="shrink-0 flex items-center gap-2 px-2 py-1"
            style={{ borderRadius: 9, background: "rgba(4,10,18,0.6)", backdropFilter: "blur(10px)", border: "1px solid rgba(148,163,184,0.14)" }}
          >
            <span className="text-[7.5px] font-mono shrink-0" style={{ color: "rgba(148,163,184,0.7)" }}>首發</span>
            {(() => {
              const s = draft.members.find(m => m.battleId === draft.starterBattleId) ?? draft.members[0];
              return s ? (
                <>
                  <span className="text-[9.5px] font-bold shrink-0 truncate max-w-[90px]" style={{ color: "var(--p-accent-hot)" }}>{s.name}</span>
                  <span className="text-[8px] shrink-0 px-1 py-px" style={{ borderRadius: 3, color: typeColor(s.type), background: `color-mix(in srgb, ${typeColor(s.type)} 20%, transparent)` }}><SkillTypeIcon skill={s} size={16} />{s.type}</span>
                </>
              ) : null;
            })()}
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {Object.entries(
                draft.members.reduce((acc: Record<string, number>, m) => {
                  const t = m.type || "無";
                  acc[t] = (acc[t] ?? 0) + 1;
                  return acc;
                }, {})
              ).slice(0, 4).map(([t, n]) => (
                <span key={t} className="text-[7.5px] font-mono px-1 py-px"
                  style={{ borderRadius: 3, color: typeColor(t), background: `color-mix(in srgb, ${typeColor(t)} 16%, transparent)` }}>
                  {t}{n}
                </span>
              ))}
              <span className="text-[7.5px] font-mono" style={{ color: "rgba(148,163,184,0.6)" }}>
                空 {TEAM_CAPACITY - draft.members.length}
              </span>
            </div>
          </div>
        )}

        {/* ── 搜尋 + 屬性篩選 ── */}
        <div className="shrink-0 flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "rgba(148,163,184,0.7)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜尋名稱或 ID"
              className="w-full pl-7 pr-2 py-1.5 text-[10px] outline-none"
              style={{
                borderRadius: 8,
                background: "rgba(6,16,26,0.82)",
                border: "1px solid rgba(148,163,184,0.22)",
                color: "#F1F5F9",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setTypeFilter("")}
            className="px-2 py-1.5 text-[9px] font-bold shrink-0"
            style={{
              borderRadius: 8,
              background: typeFilter ? "rgba(6,16,26,0.82)" : "color-mix(in srgb, var(--p-accent) 22%, transparent)",
              border: "1px solid rgba(148,163,184,0.22)",
              color: typeFilter ? "rgba(203,213,225,0.6)" : "var(--p-accent-hot)",
            }}
          >
            全部
          </button>
        </div>

        {/* 屬性快篩 */}
        <div className="shrink-0 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {allTypes.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(prev => prev === t ? "" : t)}
              className="px-1.5 py-0.5 text-[8px] font-bold shrink-0 active:scale-95 transition-transform"
              style={{
                borderRadius: 5,
                background: typeFilter === t ? `color-mix(in srgb, ${typeColor(t)} 34%, transparent)` : "rgba(6,16,26,0.7)",
                border: `1px solid ${typeFilter === t ? typeColor(t) : "rgba(148,163,184,0.18)"}`,
                color: typeFilter === t ? typeColor(t) : "rgba(203,213,225,0.6)",
              }}
            >
              <span className="inline-flex items-center gap-1"><TypeIcon type={t} size={16} />{t}</span>
            </button>
          ))}
        </div>

        {/* ── 角色庫 ── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-1"
          style={{ borderRadius: 12, background: "rgba(4,10,18,0.6)", backdropFilter: "blur(10px)" }}
        >
          <div className="elf-library grid grid-cols-4 gap-1">
            {library.map((elf, i) => {
              const used = inTeam(elf);
              return (
                <React.Fragment key={elf.id || elf.name || i}>
                  <button
                    type="button"
                    onClick={() => setDraft(d => addMember(d, elf))}
                    disabled={used || draft.members.length >= TEAM_CAPACITY}
                    className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform disabled:opacity-35"
                    title={used ? "已在隊伍中" : `加入 ${elf.name}`}
                  >
                    <div
                      className="w-full aspect-square overflow-hidden relative"
                      style={{
                        borderRadius: 8,
                        background: "rgba(10,20,30,0.9)",
                        boxShadow: used
                          ? "inset 0 0 0 2px #22C55E"
                          : "inset 0 0 0 1px rgba(148,163,184,0.2)",
                      }}
                    >
                      <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                      {used && (
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 flex items-center justify-center rounded-bl"
                          style={{ background: "#22C55E" }}>
                          <Check className="w-1.5 h-1.5" style={{ color: "#04121C" }} />
                        </span>
                      )}
                    </div>
                    <span className="text-[7.5px] truncate w-full text-center" style={{ color: "rgba(203,213,225,0.72)" }}>
                      {elf.name}
                    </span>
                    <TypeIcon type={elf.type} size={16} />
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          {!library.length && (
            <p className="text-center text-[10px] py-6" style={{ color: "rgba(148,163,184,0.6)" }}>
              沒有符合條件的精靈
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
