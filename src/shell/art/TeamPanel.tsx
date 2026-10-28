import React, { useMemo, useState } from "react";
import { Crown, X, Check, ChevronRight } from "lucide-react";
import type { Elf } from "../../types";
import type { ShellBridge } from "../bridge";
import { ElfAvatar, TypeIcon, SkillTypeIcon } from "../../components/SeerImages";
import { readLastUsedRecord, summarizeTeam, type TeamSummary } from "../lastTeam";
import { typeColor } from "../art/figure";
import { prepareSavedBattleRoster } from '../../data/prepareSavedBattleRoster';
import { readAnnualBonus } from '../../battle/annualBonusPreference';
import { createBattleInstance, saveDraft } from '../teamDraft';
import { haptic } from "../haptics";
import {ElfCardSheet} from './ElfCardSheet';
import { ElfFilterBar, useElfFilter } from '../../components/shared/ElfPicker';

/**
 * TeamBoard — 雙方隊伍並排（P1 左、P2 右）
 *
 * 使用者要求（2026-10-21）：
 *   「不要做成需要切換，最好都在同一頁左邊 P1 右邊 P2，12 隻精靈這樣下來」
 *   「有按鈕讓我點精靈，可以分別選擇要看精靈卡牌倉庫的資訊，或者換精靈」
 *
 * 版面：
 *   桌面 / 平板：左右兩欄，各 12 隻（6 出戰 + 6 待命）往下排
 *   手機直向：仍是左右兩欄，但格子縮小（不切成上下，因為使用者要「左 P1 右 P2」）
 *
 * 互動：
 *   點精靈 → 開啟該精靈的資訊卡（右側抽屜）
 *   抽屜內可「換精靈」→ 開啟精靈倉庫選人
 */

export interface SlotAction {
  side: "p1" | "p2";
  index: number;
  elf: Elf;
}

export function TeamBoard({ b }: { b: ShellBridge }) {
  const [selected, setSelected] = useState<SlotAction | null>(null);
  const [picking, setPicking] = useState<SlotAction | null>(null);
  const [version, setVersion] = useState(0); // 換人後強制重讀
  const [error, setError] = useState('');
  const [profile,setProfile]=useState<Elf|null>(null);

  const teams = useMemo(() => ({
    p1: loadTeam(b, "p1"),
    p2: loadTeam(b, "p2"),
  }), [b.allElvesCombined, version]);

  const handleReplace = (slot: SlotAction, next: Elf) => {
    const side = slot.side;
    const rec = readLastUsedRecord(side);
    const current = teams[side];
    const team = [...current.members];
    if (team.some((elf, i) => i !== slot.index && elf.id === next.id)) {
      setError('這隻精靈已在此隊伍中，請選擇其他精靈。'); return;
    }
    const replacement = createBattleInstance(next);
    team[slot.index] = replacement;
    const wasStarter = slot.elf.battleId === current.starter?.battleId;
    const starterBattleId = wasStarter ? replacement.battleId! : (rec?.starterId || current.starter?.battleId || team[0]?.battleId || '');
    if (!saveDraft(side, { members: team, starterBattleId })) {
      setError('陣容未能儲存，請檢查可用儲存空間。'); return;
    }
    setError('');
    haptic("medium");
    setPicking(null);
    setSelected(null);
    setVersion(v => v + 1);
  };

  return (
    <div className="team-board flex flex-col gap-1.5 min-h-0 flex-1">
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      {/* 兩欄：P1 左、P2 右 */}
      <div className="team-columns flex gap-1.5 flex-1 min-h-0">
        <SideColumn
          side="p1"
          team={teams.p1}
          onPick={(index, elf) => setSelected({ side: "p1", index, elf })}
        />
        <SideColumn
          side="p2"
          team={teams.p2}
          onPick={(index, elf) => setSelected({ side: "p2", index, elf })}
        />
      </div>

      {profile&&<ElfCardSheet elf={profile} onClose={()=>setProfile(null)}/>}
      {/* 精靈資訊抽屜 */}
      {selected && !picking && (
        <ElfInfoDrawer
          slot={selected}
          onClose={() => setSelected(null)}
          onReplace={() => setPicking(selected)}
          onEdit={() => { b.setEditingElf(selected.elf); b.setEditorTab(undefined); b.setView('custom'); }}
          onDetail={()=>setProfile(selected.elf)}
        />
      )}

      {/* 換精靈：倉庫選擇 */}
      {picking && (
        <ElfPickerDrawer
          error={error}
          b={b}
          current={picking.elf}
          onClose={() => setPicking(null)}
          onPick={(elf) => handleReplace(picking, elf)}
        />
      )}
    </div>
  );
}

/** 單側：12 隻往下排 */
function SideColumn({
  side, team, onPick,
}: {
  side: "p1" | "p2";
  team: TeamSummary;
  onPick: (index: number, elf: Elf) => void;
}) {
  const tone = side === "p1" ? "#38BDF8" : "#FB7185";
  const rows: { elf: Elf; index: number; standby: boolean }[] = [
    ...team.active.map((elf, i) => ({ elf, index: i, standby: false })),
    ...team.standby.map((elf, i) => ({ elf, index: i + 6, standby: true })),
  ];

  return (
    <div className="team-column flex-1 min-w-0 flex flex-col gap-1">
      {/* 標頭 */}
      <div className="flex items-center gap-1 px-1">
        <span
          className="text-[7.5px] font-black px-1 py-0.5 leading-none shrink-0"
          style={{ borderRadius: 3, background: tone, color: "#04121B" }}
        >
          {side === "p1" ? "P1" : "P2"}
        </span>
        <span className="text-[8px] font-mono" style={{ color: "rgba(203,213,225,0.6)" }}>
          {team.count}/{team.capacity}
        </span>
        {!team.hasTeam && (
          <span className="text-[6.5px] font-black px-1 py-0.5 leading-none" style={{ borderRadius: 2, background: "#FBBF24", color: "#04121B" }}>
            預覽
          </span>
        )}
      </div>

      {/* 12 隻：往下排（每列 2 隻，共 6 列） */}
      <div className="team-slot-grid grid grid-cols-2 gap-1">
        {rows.map(({ elf, index, standby }) => {
          const isStarter = elf.battleId === team.starter?.battleId;
          return (
            <button
              key={elf.battleId || `${side}-${index}`}
              type="button"
              onClick={() => onPick(index, elf)}
              className="team-slot relative flex flex-col items-center gap-0.5 active:scale-95 transition-transform min-w-0"
              title={`${elf.name}${standby ? "（待命）" : ""} — 點擊看資訊／換人`}
            >
              <div
                className="w-full aspect-square overflow-hidden relative"
                style={{
                  borderRadius: 7,
                  background: "rgba(10,20,30,0.88)",
                  boxShadow: isStarter
                    ? `inset 0 0 0 2px ${tone}`
                    : standby
                      ? "inset 0 0 0 1px rgba(251,191,36,0.30)"
                      : "inset 0 0 0 1px rgba(148,163,184,0.22)",
                  opacity: standby ? 0.8 : 1,
                }}
              >
                <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                {isStarter && (
                  <span
                    className="absolute top-0 left-0 px-0.5 leading-[9px]"
                    style={{ background: tone, color: "#04121B" }}
                  >
                    <Crown className="w-2 h-2" />
                  </span>
                )}
                <span
                  className="absolute bottom-0 right-0.5 text-[6px] font-mono"
                  style={{ color: "rgba(255,255,255,0.75)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <span className="text-[6.5px] truncate w-full text-center leading-tight" style={{ color: "rgba(203,213,225,0.72)" }}>
                {elf.name}
              </span>
              <TypeIcon type={elf.type} size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 精靈資訊抽屜 */
function ElfInfoDrawer({
  slot, onClose, onReplace, onEdit, onDetail,
}: {
  slot: SlotAction;
  onClose: () => void;
  onReplace: () => void;
  onEdit: () => void;
  onDetail: () => void;
}) {
  const { elf, side, index } = slot;
  const tone = side === "p1" ? "#38BDF8" : "#FB7185";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label="精靈資訊">
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        className="relative p-4 flex flex-col gap-3"
        style={{
          background: "linear-gradient(180deg, #0B1620, #060D14)",
          borderTop: `2px solid ${tone}`,
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
          maxHeight: "70dvh",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ boxShadow: `inset 0 0 0 1.5px ${tone}` }}>
            <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0 flex-1 leading-none">
            <span className="text-[15px] font-black truncate" style={{ color: "#F8FAFC" }}>{elf.name}</span><TypeIcon type={elf.type} size={14} />
            <span className="flex items-center gap-1.5 mt-1">
              <span className="text-[8.5px] font-bold px-1.5 py-px" style={{ borderRadius: 3, color: typeColor(elf.type), background: `color-mix(in srgb, ${typeColor(elf.type)} 20%, transparent)` }}>
                <TypeIcon type={elf.type} size={16} />{elf.type}
              </span>
              <span className="text-[9px] font-mono" style={{ color: "rgba(203,213,225,0.7)" }}>Lv.{elf.level}</span>
              <span className="text-[8.5px] font-mono" style={{ color: tone }}>
                {side === "p1" ? "P1" : "P2"} · 第 {index + 1} 格
              </span>
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 shrink-0" style={{ borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
            <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        {/* 數值 */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ["HP", `${elf.currentHp ?? elf.maxHp}/${elf.maxHp}`],
            ["攻", elf.calculatedStats?.atk ?? "-"],
            ["防", elf.calculatedStats?.def ?? "-"],
            ["特攻", elf.calculatedStats?.spatk ?? "-"],
            ["特防", elf.calculatedStats?.spdef ?? "-"],
            ["速", elf.calculatedStats?.speed ?? "-"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex flex-col items-center py-1.5" style={{ borderRadius: 7, background: "rgba(255,255,255,0.05)" }}>
              <span className="text-[7.5px] font-mono" style={{ color: "rgba(148,163,184,0.7)" }}>{k}</span>
              <span className="text-[12px] font-black font-mono mt-0.5" style={{ color: "#F1F5F9" }}>{String(v)}</span>
            </div>
          ))}
        </div>

        {/* 魂印 / 技能摘要 */}
        {elf.soulMark?.name && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[7.5px] font-mono tracking-[0.16em]" style={{ color: "rgba(148,163,184,0.7)" }}>魂印</span>
            <span className="text-[10px] font-bold" style={{ color: "#C4B5FD" }}>{elf.soulMark.name}</span>
          </div>
        )}

        {elf.skills?.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[7.5px] font-mono tracking-[0.16em]" style={{ color: "rgba(148,163,184,0.7)" }}>技能</span>
            <div className="flex flex-col gap-0.5">
              {elf.skills.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1" style={{ borderRadius: 6, background: "rgba(255,255,255,0.04)" }}>
                  <span className="text-[8px] font-mono shrink-0" style={{ color: "rgba(148,163,184,0.6)" }}>{i + 1}</span>
                  <span className="text-[9.5px] font-bold truncate flex-1" style={{ color: "#E2E8F0" }}>{s.name}</span>
                  <span className="text-[8px] font-mono shrink-0" style={{ color: s.category === "屬性" ? "#6EE7B7" : "rgba(203,213,225,0.7)" }}>
                    {s.category === "屬性" ? "屬性" : `威力 ${s.power || 0}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="button" className="py-2 text-cyan-200" onClick={onDetail}>完整精靈介紹</button>
        <button type="button" className="py-2 text-cyan-200" onClick={onEdit}>開啟精靈卡牌／編輯技能</button>
        <button
          type="button"
          onClick={onReplace}
          className="py-2.5 text-[12px] font-black active:scale-95 transition-transform flex items-center justify-center gap-1.5"
          style={{ borderRadius: 10, background: tone, color: "#04121B" }}
        >
          <ChevronRight className="w-4 h-4" />
          換精靈（從倉庫選）
        </button>
      </div>
    </div>
  );
}

/** 精靈倉庫：選一隻替換 */
export function ElfPickerDrawer({
  b, current, onClose, onPick, error,
}: {
  b: ShellBridge;
  current: Elf;
  error?: string;
  onClose: () => void;
  onPick: (elf: Elf) => void;
}) {
  const f = useElfFilter();
  const list = useMemo(() => f.filter(b.allElvesCombined), [f.filter, b.allElvesCombined]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label="選擇精靈">
      {error && <p role="alert" className="absolute top-4 inset-x-4 z-10 bg-slate-950 p-3 text-amber-200">{error}</p>}
      <button type="button" aria-label="關閉" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div
        className="relative p-3 flex flex-col gap-2"
        style={{
          background: "linear-gradient(180deg, #0B1620, #060D14)",
          borderTop: "1px solid var(--p-accent)",
          borderRadius: "20px 20px 0 0",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)",
          maxHeight: "75dvh",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black flex-1" style={{ color: "#F8FAFC" }}>
            換掉「{current.name}」
          </span>
          <button type="button" onClick={onClose} className="p-1.5" style={{ borderRadius: 8, background: "rgba(255,255,255,0.08)" }}>
            <X className="w-4 h-4" style={{ color: "#CBD5E1" }} />
          </button>
        </div>

        <ElfFilterBar state={f} variant="shell" placeholder="搜尋精靈名稱或 ID" count={`${list.length}`} />

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-4 gap-1">
            {list.map(elf => (
              <button
                key={elf.id || elf.name}
                type="button"
                onClick={() => onPick(elf)}
                className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                title={elf.name}
              >
                <div className="w-full aspect-square overflow-hidden" style={{ borderRadius: 7, background: "rgba(10,20,30,0.9)", boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.2)" }}>
                  <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" />
                </div>
                <span className="text-[7px] truncate w-full text-center" style={{ color: "rgba(203,213,225,0.72)" }}>{elf.name}</span>
              </button>
            ))}
          </div>
          {!list.length && (
            <p className="text-center text-[10px] py-6" style={{ color: "rgba(148,163,184,0.6)" }}>沒有符合條件的精靈</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 讀取隊伍；沒有存檔時用精靈池預覽 */
function loadTeam(b: ShellBridge, side: "p1" | "p2"): TeamSummary {
  const rec = readLastUsedRecord(side);
  const s = summarizeTeam(rec ? { ...rec, team: prepareSavedBattleRoster(rec.team, b.allElvesCombined, readAnnualBonus(side), side) } : null);
  if (s.hasTeam) return s;
  const offset = side === "p1" ? 0 : 12;
  const members = b.allElvesCombined.slice(offset, offset + 12).map(createBattleInstance);
  return {
    hasTeam: false,
    count: members.length,
    capacity: 12,
    active: members.slice(0, 6),
    standby: members.slice(6, 12),
    starter: members[0] ?? null,
    members,
  };
}
