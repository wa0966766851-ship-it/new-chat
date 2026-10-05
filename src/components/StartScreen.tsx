import { TeamSetupTools } from "./TeamSetupTools";
import { bindInitialCounterparts } from '../battle/illusion';
import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { matchesElfQuery } from '../utils/elfSearch';
import { createPortal } from 'react-dom';
import { Elf, BattleMode, Inscription } from "../types";
import { SEER_TYPES, calculateElfStats, getDefaultEvs, getAttributeBadgeColor } from "../utils/statCalculator";
import { ElfAvatar, TypeIcon } from "./SeerImages";
import { isStoneThrower } from "../data/skillStones";
import { formatEffectText } from "../utils/descFormat";
import { getElfDisplayRank as getElfDestinyRank } from "../utils/elfDisplayRank";
import { InfoHint } from "./InfoHint";
import { getNatureFromModifiers, getDefaultNatureModifiers } from "../utils/seerNatures";
import { SUIT_CATALOG, EYEWEAR_CATALOG } from "../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../data/titles";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { GENERAL_TRAITS } from "../data/generalTraits";
import { ALIEN_TRAITS } from "../data/alienTraits";
import { InscriptionSlot } from "./InscriptionSlot";
import { motion, AnimatePresence } from "motion/react";
import { Swords, Plus, Bot, User, Trash2, Crown, Sparkles, Check, HelpCircle, AlertCircle, Copy, Shuffle, Cpu, Edit3, Eye, Zap, MessageSquare, X, Search, Briefcase, Save, FolderOpen, Bookmark, CheckCircle2, Shield, RotateCcw, ShieldAlert, Flame, ArrowUp, ArrowDown, ArrowUpDown, ArrowLeftRight, Move, Layers, BookOpen, Disc, Dice5, ChevronRight, Rocket, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { EffectBlockToggle } from './EffectBlockToggle';
const EvNaturePanel = lazy(() => import("./EvNaturePanel"));
const TypeMatchupPanel = lazy(() => import("./TypeMatchupPanel").then(m => ({ default: m.TypeMatchupPanel })));
const ResistancePanel = lazy(() => import("./ResistancePanel"));
const InscriptionModal = lazy(() => import("./InscriptionModal").then(m => ({ default: m.InscriptionModal })));
const LazyBlockProgramView = lazy(() => import("./LazyBlockProgramView"));
const EffectLibraryModal = lazy(() => import("./EffectLibraryModal").then(m => ({ default: m.EffectLibraryModal })));
const detailLoading = <p role="status" className="p-3 text-sm text-slate-400">載入效果資料…</p>;
const detailPanelLoading = <p role="status" className="ios-card min-h-24 p-4 text-sm text-slate-400">載入詳細面板…</p>;

interface StartScreenProps {
  allElves?: Elf[];
  onStartBattle: (
    mode: BattleMode,
    team1: Elf[],
    team2: Elf[],
    starter1Id: string,
    starter2Id: string,
    p1Suit?: string,
    p1Eyewear?: string,
    p2Suit?: string,
    p2Eyewear?: string,
    p1Title?: string,
    p2Title?: string,
    format?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3"
  ) => void;
  hostPlayer?: "p1" | "p2";
  onHostPlayerChange?: (host: "p1" | "p2") => void;
  onNavigateToCustom: () => void;
  onNavigateToDestinyWheel?: (mode?: BattleMode) => void;
  onNavigateToInterstellar?: () => void;
  onEditElf?: (elf: Elf) => void;
}

interface TeamInstance extends Elf {
  battleId: string;
}

import { useGameData } from "../contexts/GameDataContext";

/** 已保存陣容的預設精靈：技能 PP／PP上限以目前資料為準（避免舊存檔的 PP 值殘留） */
function syncSavedSkillPp(e: any) {
  const def: any = DEFAULT_ELVES.find((d: any) => d.name === e?.name);
  if (!def || !Array.isArray(e?.skills)) return;
  const all = [...(def.skills || []), ...(def.skillPool || [])];
  e.skills.forEach((s: any) => {
    const d = all.find((x: any) => x.name === s.name);
    if (!d) return;
    s.pp = d.pp;
    s.maxPp = d.maxPp !== undefined ? d.maxPp : d.pp;
    if (d.category === "屬性" && d.type) s.type = d.type; // 屬性技能圖示以目前資料為準（無屬性）
  });
}


export default function StartScreen({
  hostPlayer = "p1",
  onHostPlayerChange,
  onStartBattle,
  onNavigateToCustom,
  onNavigateToDestinyWheel,
  onNavigateToInterstellar,
  onEditElf,
}: StartScreenProps) {
  const { allElves, customElves, updateElf, deleteCustomElf, restoreDeletedElves, deletedCount, clearLocalCache, forceReloadData } = useGameData();
  
  // Map context functions to old prop names used in the file
  const onUpdateElf = updateElf;
  const onDeleteCustomElf = deleteCustomElf;
  const onRestoreDeletedElves = restoreDeletedElves;

  const [battleMode, setBattleMode] = useState<BattleMode>("PVE");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [showTypeFilters, setShowTypeFilters] = useState<boolean>(false);
  const [replacingSlotIndex, setReplacingSlotIndex] = useState<number | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<Record<string, number>>({});

  const [p1Suit, setP1Suit] = useState<string>(() => localStorage.getItem("seer_p1_suit") || "");
  const [p1Eyewear, setP1Eyewear] = useState<string>(() => localStorage.getItem("seer_p1_eyewear") || "");
  const [p2Suit, setP2Suit] = useState<string>(() => localStorage.getItem("seer_p2_suit") || "");
  const [p2Eyewear, setP2Eyewear] = useState<string>(() => localStorage.getItem("seer_p2_eyewear") || "");
  const [p1Title, setP1Title] = useState<string>(() => localStorage.getItem("seer_p1_title") || "");
  const [p2Title, setP2Title] = useState<string>(() => localStorage.getItem("seer_p2_title") || "");

  const handleSetP1Suit = (val: string) => {
    setP1Suit(val);
    localStorage.setItem("seer_p1_suit", val);
  };
  const handleSetP1Eyewear = (val: string) => {
    setP1Eyewear(val);
    localStorage.setItem("seer_p1_eyewear", val);
  };
  const handleSetP2Suit = (val: string) => {
    setP2Suit(val);
    localStorage.setItem("seer_p2_suit", val);
  };
  const handleSetP2Eyewear = (val: string) => {
    setP2Eyewear(val);
    localStorage.setItem("seer_p2_eyewear", val);
  };
  const handleSetP1Title = (val: string) => {
    setP1Title(val);
    localStorage.setItem("seer_p1_title", val);
  };
  const handleSetP2Title = (val: string) => {
    setP2Title(val);
    localStorage.setItem("seer_p2_title", val);
  };

  const handleClearCacheWithConfirm = () => {
    if (window.confirm("這會清除所有自訂精靈與修改記錄，確定要繼續嗎？")) {
      clearLocalCache();
      alert("本地緩存已清空，精靈資料已重置！");
    }
  };

  const handleForceReload = () => {
    forceReloadData();
    alert("資料重新載入與清理流程執行成功！");
  };

  const toggleTypeFilter = (type: string) => {
    if (type === "全部") {
      setSelectedTypes([]);
      return;
    }
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };
  const [analyzeText, setAnalyzeText] = useState<string>("");
  const [showAnalyzeModal, setShowAnalyzeModal] = useState<Elf | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Elf | null>(null);
  const detailStats = useMemo(() => showDetailModal ? calculateElfStats(
    showDetailModal.baseStats, showDetailModal.level || 100, showDetailModal.ivs,
    showDetailModal.evs, showDetailModal.natureModifiers,
    showDetailModal.inscriptions as Inscription[], showDetailModal.guildBonuses,
    showDetailModal.hasAnnualBonus
  ) : null, [showDetailModal]);

  const updateTraining = (changes: Pick<Elf, "evs" | "natureModifiers">) => {
    if (!showDetailModal) return;
    const nextElf = { ...showDetailModal, ...changes };
    const stats = calculateElfStats(nextElf.baseStats, nextElf.level || 100, nextElf.ivs,
      nextElf.evs, nextElf.natureModifiers, nextElf.inscriptions as Inscription[],
      nextElf.guildBonuses, nextElf.hasAnnualBonus);
    nextElf.calculatedStats = stats;
    nextElf.maxHp = stats.hp;
    nextElf.currentHp = stats.hp;
    setShowDetailModal(nextElf);
    onUpdateElf(nextElf);
  };
  // Esc 關閉：先關技能替換庫，再關詳情
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (replacingSlotIndex !== null) setReplacingSlotIndex(null);
      else if (showDetailModal) setShowDetailModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replacingSlotIndex, showDetailModal]);
  const [isEffectModalOpen, setIsEffectModalOpen] = useState<boolean>(false);
  const [editingModalInscIndex, setEditingModalInscIndex] = useState<number | null>(null);

  // Multi-Elf teams states
  const [p1Team, setP1Team] = useState<TeamInstance[]>([]);
  const [p2Team, setP2Team] = useState<TeamInstance[]>([]);
  const [p1StarterId, setP1StarterId] = useState<string>("");
  const [p2StarterId, setP2StarterId] = useState<string>("");
  const [p1SelectedIdx, setP1SelectedIdx] = useState<number | null>(null);
  const [p2SelectedIdx, setP2SelectedIdx] = useState<number | null>(null);
  const [showSelectionModal, setShowSelectionModal] = useState<{ player: "p1" | "p2"; slotIndex: number } | null>(null);
  const [p1AnnualBonus, setP1AnnualBonus] = useState<boolean>(false);
  const [p2AnnualBonus, setP2AnnualBonus] = useState<boolean>(false);
  const [draggedSlot, setDraggedSlot] = useState<{ player: "p1" | "p2"; index: number } | null>(null);

  const handleSwapTeams = () => {
    const tempP1 = [...p1Team];
    const tempP2 = [...p2Team];
    const tempP1Starter = p1StarterId;
    const tempP2Starter = p2StarterId;
    const tempP1Bonus = p1AnnualBonus;
    const tempP2Bonus = p2AnnualBonus;
    const tempP1Suit = p1Suit;
    const tempP2Suit = p2Suit;
    const tempP1Eye = p1Eyewear;
    const tempP2Eye = p2Eyewear;
    const tempP1Title = p1Title;
    const tempP2Title = p2Title;

    setP1Team(tempP2);
    setP2Team(tempP1);
    setP1StarterId(tempP2Starter);
    setP2StarterId(tempP1Starter);
    setP1AnnualBonus(tempP2Bonus);
    setP2AnnualBonus(tempP1Bonus);
    handleSetP1Suit(tempP2Suit);
    handleSetP2Suit(tempP1Suit);
    handleSetP1Eyewear(tempP2Eye);
    handleSetP2Eyewear(tempP1Eye);
    handleSetP1Title(tempP2Title);
    handleSetP2Title(tempP1Title);
  };

  // Peak Arena BP & Format States
  const [battleFormat, setBattleFormat] = useState<"normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3">("normal_6v6");
  const [banCount, setBanCount] = useState<number>(1);
  const [pickCount, setPickCount] = useState<number>(6);
  const [bpPhase, setBpPhase] = useState<"closed" | "ban_p1" | "ban_p2" | "pick_p1" | "pick_p2" | "pick_standby_p1" | "pick_standby_p2">("closed");
  const [p1BannedIds, setP1BannedIds] = useState<string[]>([]);
  const [p2BannedIds, setP2BannedIds] = useState<string[]>([]);
  const [p1PickedIds, setP1PickedIds] = useState<string[]>([]);
  const [p2PickedIds, setP2PickedIds] = useState<string[]>([]);
  const [p1StandbyIds, setP1StandbyIds] = useState<string[]>([]);
  const [p2StandbyIds, setP2StandbyIds] = useState<string[]>([]);
  const [p1BpStarterId, setP1BpStarterId] = useState<string>("");
  const [p2BpStarterId, setP2BpStarterId] = useState<string>("");

  // Loadout Backpack & Last Used Record State
  const [lastUsedRecord, setLastUsedRecord] = useState<{ team: TeamInstance[]; starterId: string; timestamp?: string } | null>(() => {
    try {
      const sanitizeTeam = (team: any[]) => {
        return team.map((e: any) => {
          if (e.skills) {
            e.skills.forEach((s: any) => {
              if (s.category === '屬性') s.type = '無屬性';
            });
            syncSavedSkillPp(e);
          }
          return e;
        });
      };

      const stored = localStorage.getItem("seer_last_used_p1_team");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.team) {
          parsed.team = sanitizeTeam(parsed.team);
        }
        return parsed;
      }
    } catch (e) {}
    return null;
  });

  const [lastUsedRecordP2, setLastUsedRecordP2] = useState<{ team: TeamInstance[]; starterId: string } | null>(() => {
    try {
      const record = JSON.parse(localStorage.getItem("seer_last_used_p2_team") || "null");
      if (!Array.isArray(record?.team)) return null;
      record.team = record.team.filter((e: any) => e?.calculatedStats && Array.isArray(e.skills));
      record.team.forEach(syncSavedSkillPp);
      return record;
    } catch { return null; }
  });
  const handleSaveLastUsedP2 = () => {
    if (!p2Team.length) { alert("請先在 P2 加入至少 1 隻精靈才能保存紀錄！"); return; }
    const record = structuredClone({ team: p2Team, starterId: p2StarterId });
    localStorage.setItem("seer_last_used_p2_team", JSON.stringify(record));
    setLastUsedRecordP2(record);
    setSaveSuccessMsg("已保存 P2 陣容紀錄");
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };
  const handleLoadLastUsedP2 = () => {
    if (!lastUsedRecordP2?.team.length) return;
    const team = lastUsedRecordP2.team.map(e => createInstance(e, true));
    const index = lastUsedRecordP2.team.findIndex(e => e.battleId === lastUsedRecordP2.starterId);
    setP2Team(team); setP2StarterId(team[Math.max(0, index)]?.battleId || "");
  };

  const [backpackPresets, setBackpackPresets] = useState<Record<number, { name: string; team: TeamInstance[]; starterId: string }>>(() => {
    try {
      const sanitizeTeam = (team: any[]) => {
        return team.map((e: any) => {
          if (e.skills) {
            e.skills.forEach((s: any) => {
              if (s.category === '屬性') s.type = '無屬性';
            });
            syncSavedSkillPp(e);
          }
          return e;
        });
      };

      const stored = localStorage.getItem("seer_p1_backpack_presets");
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const key in parsed) {
          if (parsed[key] && parsed[key].team) {
            parsed[key].team = sanitizeTeam(parsed[key].team);
          }
        }
        return parsed;
      }
    } catch (e) {}
    return {
      1: { name: "配裝壹·巔峰競技隊", team: [], starterId: "" },
      2: { name: "配裝貳·特化測試隊", team: [], starterId: "" },
      3: { name: "配裝參·自定娛樂隊", team: [], starterId: "" }
    };
  });

  const [backpackPresetsP2, setBackpackPresetsP2] = useState<Record<number, { name: string; team: TeamInstance[]; starterId: string }>>(() => {
    try {
      const sanitizeTeam = (team: any[]) => {
        return team.map((e: any) => {
          if (e.skills) {
            e.skills.forEach((s: any) => {
              if (s.category === '屬性') s.type = '無屬性';
            });
            syncSavedSkillPp(e);
          }
          return e;
        });
      };

      const stored = localStorage.getItem("seer_p2_backpack_presets");
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const key in parsed) {
          if (parsed[key] && parsed[key].team) {
            parsed[key].team = sanitizeTeam(parsed[key].team);
          }
        }
        return parsed;
      }
    } catch (e) {}
    return {
      1: { name: "配裝壹·巔峰競技隊", team: [], starterId: "" },
      2: { name: "配裝貳·特化測試隊", team: [], starterId: "" },
      3: { name: "配裝參·自定娛樂隊", team: [], starterId: "" }
    };
  });

  const [showBackpackModal, setShowBackpackModal] = useState(false);
  const [showBackpackModalP2, setShowBackpackModalP2] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // 雙方各自還原保存的配裝及首發；沒有紀錄才建立預設陣容。
  useEffect(() => {
    if (!allElves.length) return;
    const initialize = (side: "p1" | "p2") => {
      const team = side === "p1" ? p1Team : p2Team;
      if (team.length) return;
      const record = side === "p1" ? lastUsedRecord : lastUsedRecordP2;
      const setTeam = side === "p1" ? setP1Team : setP2Team;
      const setStarter = side === "p1" ? setP1StarterId : setP2StarterId;
      if (record?.team?.length) {
        const restored = record.team.map(e => createInstance(e, true));
        const index = record.team.findIndex(e => e.battleId === record.starterId);
        setTeam(restored); setStarter(restored[Math.max(0, index)]?.battleId || "");
      } else {
        const initial = allElves.slice(0, 12).map((_, i) => createInstance(allElves[(i + (side === "p2" ? 1 : 0)) % allElves.length]));
        setTeam(initial); setStarter(initial[0]?.battleId || "");
      }
    };
    initialize("p1"); initialize("p2");
  }, [allElves]);

  // Dynamically sync p1Team and p2Team when allElves changes (e.g. inscriptions or skills updated)
  useEffect(() => {
    const syncTeam = (
      team: TeamInstance[],
      setTeam: React.Dispatch<React.SetStateAction<TeamInstance[]>>,
      teamKey: "p1" | "p2",
      starterId: string,
      setStarterId: (id: string) => void
    ) => {
      if (team.length === 0) return;
      const validTeam = team.filter((inst) =>
        allElves.some((e) => e && ((e.id && e.id === inst.id) || e.name === inst.name))
      );

      let changed = validTeam.length !== team.length;
      const synced = validTeam.map((inst) => {
        const latest = allElves.find((e) => e && ((e.id && e.id === inst.id) || e.name === inst.name));
        if (latest) {
          const inscChanged = JSON.stringify(latest.inscriptions) !== JSON.stringify(inst.inscriptions);
          const statsChanged = JSON.stringify(latest.calculatedStats) !== JSON.stringify(inst.calculatedStats);
          const trainingChanged = JSON.stringify(latest.evs) !== JSON.stringify(inst.evs)
            || JSON.stringify(latest.natureModifiers) !== JSON.stringify(inst.natureModifiers)
            || JSON.stringify(latest.guildBonuses) !== JSON.stringify(inst.guildBonuses);
          const poolChanged = JSON.stringify(latest.skillPool) !== JSON.stringify(inst.skillPool);
          const soulMarkChanged = JSON.stringify(latest.soulMark) !== JSON.stringify(inst.soulMark);
          const descChanged = latest.description !== inst.description;
          const nameChanged = latest.name !== inst.name;
          const typeChanged = latest.type !== inst.type;
          const equippedSkills = inst.skills?.map(skill => {
            const { currentPp, ...saved } = skill as typeof skill & { currentPp?: number };
            return saved;
          });
          const skillsChanged = JSON.stringify(latest.skills) !== JSON.stringify(equippedSkills);
          const missingSkills = !inst.skills || inst.skills.length === 0;

          if (inscChanged || statsChanged || trainingChanged || poolChanged || soulMarkChanged || descChanged || nameChanged || typeChanged || skillsChanged || missingSkills) {
            changed = true;
            return {
              ...inst,
              name: latest.name,
              type: latest.type,
              description: latest.description,
              soulMark: latest.soulMark,
              inscriptions: latest.inscriptions,
              evs: latest.evs,
              natureModifiers: latest.natureModifiers,
              guildBonuses: latest.guildBonuses,
              skills: (latest.skills || inst.skills || []).map(skill => ({
                ...skill,
                currentPp: inst.skills?.find(old => old.name === skill.name)?.currentPp ?? skill.pp,
              })),
              skillPool: latest.skillPool,
              calculatedStats: latest.calculatedStats,
              maxHp: latest.maxHp,
              currentHp: Math.min(inst.currentHp, latest.maxHp),
            };
          }
        }
        return inst;
      });

      if (changed) {
        setTeam(synced);
        if (starterId && !synced.some((e) => e.battleId === starterId)) {
          setStarterId(synced[0]?.battleId || "");
        }
      }
    };

    syncTeam(p1Team, setP1Team, "p1", p1StarterId, setP1StarterId);
    syncTeam(p2Team, setP2Team, "p2", p2StarterId, setP2StarterId);
  }, [allElves]);

  const createInstance = (elf: Elf, preserveConfiguration = false): TeamInstance => {
    const source = preserveConfiguration ? elf : allElves.find((e) => e && ((e.id && e.id === elf.id) || e.name === elf.name)) || elf;
    const latest = JSON.parse(JSON.stringify(source)) as Elf;
    return {
      ...latest,
      battleId: `${elf.id}_inst_${Math.random().toString(36).substr(2, 9)}`,
      statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 },
      battleStatus: "normal",
      battleStatusDuration: 0,
      shield: 0,
      currentHp: latest.calculatedStats.hp,
      skills: latest.skills.map(s => ({ ...s, currentPp: s.pp }))
    };
  };

  const handleSaveModalInscription = (updated?: Inscription) => {
    if (!showDetailModal || editingModalInscIndex === null) return;
    const nextInsc = [
      showDetailModal.inscriptions?.[0],
      showDetailModal.inscriptions?.[1],
      showDetailModal.inscriptions?.[2],
    ];
    nextInsc[editingModalInscIndex] = updated;
    
    const nextStats = calculateElfStats(
      showDetailModal.baseStats,
      showDetailModal.level || 100,
      showDetailModal.ivs,
      showDetailModal.evs,
      showDetailModal.natureModifiers,
      nextInsc as Inscription[], showDetailModal.guildBonuses, showDetailModal.hasAnnualBonus
    );

    const nextElf: Elf = {
      ...showDetailModal,
      inscriptions: nextInsc as Inscription[],
      calculatedStats: nextStats,
      maxHp: nextStats.hp,
      currentHp: nextStats.hp,
    };

    setShowDetailModal(nextElf);
    onUpdateElf?.(nextElf);

    // Immediately sync matching instances in p1Team and p2Team
    const syncInstant = (team: TeamInstance[], setTeam: React.Dispatch<React.SetStateAction<TeamInstance[]>>, teamKey: "p1" | "p2") => {
      let changed = false;
      const next = team.map(inst => {
        if ((inst?.id === nextElf?.id || inst?.name === nextElf?.name)) {
          changed = true;
          return {
            ...inst,
            inscriptions: nextElf.inscriptions,
            calculatedStats: nextStats,
            maxHp: nextStats.hp,
            currentHp: Math.min(inst.currentHp, nextStats.hp)
          };
        }
        return inst;
      });
      if (changed) {
        setTeam(next);
      }
    };
    syncInstant(p1Team, setP1Team, "p1");
    syncInstant(p2Team, setP2Team, "p2");

    setEditingModalInscIndex(null);
  };

  const handleAddP1 = (elf: Elf) => {
    if (p1Team.length >= 12) return;
    const inst = createInstance(elf);
    setP1Team((prev) => {
      const next = [...prev, inst];
      if (!p1StarterId || prev.length === 0) {
        setP1StarterId(inst.battleId);
      }
      return next;
    });
  };

  const handleAddP2 = (elf: Elf) => {
    if (p2Team.length >= 12) return;
    const inst = createInstance(elf);
    setP2Team((prev) => {
      const next = [...prev, inst];
      if (!p2StarterId || prev.length === 0) {
        setP2StarterId(inst.battleId);
      }
      return next;
    });
  };

  const handleRemoveP1 = (battleId: string) => {
    setP1Team((prev) => {
      const next = prev.filter((e) => e.battleId !== battleId);
      if (p1StarterId === battleId) {
        setP1StarterId(next[0]?.battleId || "");
      }
      return next;
    });
  };

  const handleRemoveP2 = (battleId: string) => {
    setP2Team((prev) => {
      const next = prev.filter((e) => e.battleId !== battleId);
      if (p2StarterId === battleId) {
        setP2StarterId(next[0]?.battleId || "");
      }
      return next;
    });
  };

  const handleSetP1Starter = (battleId: string) => {
    setP1StarterId(battleId);
  };

  const handleSetP2Starter = (battleId: string) => {
    setP2StarterId(battleId);
  };

  const handleSlotSwap = (player: "p1" | "p2", fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const team = player === "p1" ? p1Team : p2Team;
    const setTeam = player === "p1" ? setP1Team : setP2Team;
    const starterId = player === "p1" ? p1StarterId : p2StarterId;
    const setStarterId = player === "p1" ? setP1StarterId : setP2StarterId;

    if (fromIdx >= team.length) return;

    const newTeam = [...team];
    if (toIdx >= team.length) {
      const [moved] = newTeam.splice(fromIdx, 1);
      newTeam.push(moved);
    } else {
      const temp = newTeam[fromIdx];
      newTeam[fromIdx] = newTeam[toIdx];
      newTeam[toIdx] = temp;
    }
    setTeam(newTeam);

    const newStarterIdx = newTeam.findIndex(e => e.battleId === starterId);
    if (newStarterIdx >= 6 || newStarterIdx === -1) {
      if (newTeam[0]) setStarterId(newTeam[0].battleId);
    }
  };

  const handleSwapAllActiveStandby = (player: "p1" | "p2") => {
    const team = player === "p1" ? p1Team : p2Team;
    const setTeam = player === "p1" ? setP1Team : setP2Team;
    const starterId = player === "p1" ? p1StarterId : p2StarterId;
    const setStarterId = player === "p1" ? setP1StarterId : setP2StarterId;

    if (team.length <= 6) {
      alert("目前精靈數量未超過 6 隻，全部於【出戰背包】，無【待命背包】精靈可對調！");
      return;
    }
    const active = team.slice(0, 6);
    const standby = team.slice(6, 12);
    const newTeam = [...standby, ...active];
    setTeam(newTeam);

    const newStarterIdx = newTeam.findIndex(e => e.battleId === starterId);
    if (newStarterIdx >= 6 || newStarterIdx === -1) {
      if (newTeam[0]) setStarterId(newTeam[0].battleId);
    }
  };

  // Automated AI configuration functions
  const handleRandomizeAI = () => {
    if (allElves.length === 0) return;
    const tempTeam: TeamInstance[] = [];
    const shuffled = [...allElves].sort(() => Math.random() - 0.5);
    const size = Math.min(12, Math.max(12, allElves.length));
    for (let i = 0; i < 12; i++) {
      const randElf = shuffled[i % shuffled.length];
      tempTeam.push(createInstance(randElf));
    }
    setP2Team(tempTeam);
    setP2StarterId(tempTeam[0]?.battleId || "");
  };

  const handleRandomizeP1 = () => {
    if (allElves.length === 0) return;
    const tempTeam: TeamInstance[] = [];
    const shuffled = [...allElves].sort(() => Math.random() - 0.5);
    const size = Math.min(12, Math.max(12, allElves.length));
    for (let i = 0; i < 12; i++) {
      const randElf = shuffled[i % shuffled.length];
      tempTeam.push(createInstance(randElf));
    }
    setP1Team(tempTeam);
    setP1StarterId(tempTeam[0]?.battleId || "");
  };

  const handleSaveLastUsed = () => {
    if (p1Team.length === 0) {
      alert("請先在 PLAYER 1 加入至少 1 隻精靈才能保存紀錄！");
      return;
    }
    const record = {
      team: structuredClone(p1Team),
      starterId: p1StarterId,
      timestamp: new Date().toLocaleTimeString()
    };
    localStorage.setItem("seer_last_used_p1_team", JSON.stringify(record));
    setLastUsedRecord(record);
    setSaveSuccessMsg("✅ 已成功保存當前陣容至「上次使用紀錄」！(需點保存成功)");
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleLoadLastUsed = () => {
    if (!lastUsedRecord || !lastUsedRecord.team || lastUsedRecord.team.length === 0) {
      alert("目前尚無儲存的上次使用紀錄！");
      return;
    }
    const restoredTeam = lastUsedRecord.team.map(e => {
      return createInstance(e, true);
    });
    const sIdx = lastUsedRecord.team.findIndex(e => e.battleId === lastUsedRecord.starterId);
    setP1Team(restoredTeam);
    setP1StarterId(restoredTeam[sIdx >= 0 ? sIdx : 0]?.battleId || "");
    setSaveSuccessMsg("📂 已成功載入上次使用的精靈隊伍！");
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleSavePreset = (slot: number) => {
    if (p1Team.length === 0) {
      alert("請先配置至少 1 隻精靈才能儲存背包插槽！");
      return;
    }
    const updated = {
      ...backpackPresets,
      [slot]: {
        ...backpackPresets[slot],
        team: structuredClone(p1Team),
        starterId: p1StarterId
      }
    };
    setBackpackPresets(updated);
    localStorage.setItem("seer_p1_backpack_presets", JSON.stringify(updated));
    setSaveSuccessMsg(`💾 已成功保存隊伍至【背包插槽 #${slot}】！`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleLoadPreset = (slot: number) => {
    const preset = backpackPresets[slot];
    if (!preset || !preset.team || preset.team.length === 0) {
      alert(`【背包插槽 #${slot}】目前是空的，請先配置精靈並保存！`);
      return;
    }
    const restoredTeam = preset.team.map(e => {
      return createInstance(e, true);
    });
    const sIdx = preset.team.findIndex(e => e?.battleId === preset?.starterId);
    setP1Team(restoredTeam);
    setP1StarterId(restoredTeam[sIdx >= 0 ? sIdx : 0]?.battleId || "");
    setSaveSuccessMsg(`📂 已成功載入【背包插槽 #${slot}: ${preset.name}】！`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleSavePresetP2 = (slot: number) => {
    if (p2Team.length === 0) {
      alert("請先配置至少 1 隻精靈才能儲存背包插槽！");
      return;
    }
    const updated = {
      ...backpackPresetsP2,
      [slot]: {
        ...backpackPresetsP2[slot],
        team: structuredClone(p2Team),
        starterId: p2StarterId
      }
    };
    setBackpackPresetsP2(updated);
    localStorage.setItem("seer_p2_backpack_presets", JSON.stringify(updated));
    setSaveSuccessMsg(`💾 已成功保存隊伍至【P2 背包插槽 #${slot}】！`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleLoadPresetP2 = (slot: number) => {
    const preset = backpackPresetsP2[slot];
    if (!preset || !preset.team || preset.team.length === 0) {
      alert(`【P2 背包插槽 #${slot}】目前是空的，請先配置精靈並保存！`);
      return;
    }
    const restoredTeam = preset.team.map(e => {
      return createInstance(e, true);
    });
    const sIdx = preset.team.findIndex(e => e?.battleId === preset?.starterId);
    setP2Team(restoredTeam);
    setP2StarterId(restoredTeam[sIdx >= 0 ? sIdx : 0]?.battleId || "");
    setSaveSuccessMsg(`📂 已成功載入【P2 背包插槽 #${slot}: ${preset.name}】！`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);
  };

  const handleCopyP1ToAI = () => {
    if (p1Team.length === 0) return;
    const tempTeam = p1Team.map((e) => {
      const cloned = createInstance(e, true);
      return cloned;
    });
    setP2Team(tempTeam);
    // Try to match starter index
    const sIndex = p1Team.findIndex((e) => e.battleId === p1StarterId);
    setP2StarterId(tempTeam[sIndex >= 0 ? sIndex : 0]?.battleId || "");
  };

  const handleCopyAIToP1 = () => {
    if (p2Team.length === 0) return;
    const tempTeam = p2Team.map((e) => {
      const cloned = createInstance(e, true);
      return cloned;
    });
    setP1Team(tempTeam);
    // Try to match starter index
    const sIndex = p2Team.findIndex((e) => e.battleId === p2StarterId);
    setP1StarterId(tempTeam[sIndex >= 0 ? sIndex : 0]?.battleId || "");
  };

  const handleClearP1Team = () => {
    if (window.confirm("確定要清空 Player 1 的所有精靈嗎？")) {
      setP1Team([]);
      setP1StarterId("");
    }
  };

  const handleClearP2Team = () => {
    if (window.confirm("確定要清空 Player 2 的所有精靈嗎？")) {
      setP2Team([]);
      setP2StarterId("");
    }
  };

  const [showTypeFilter, setShowTypeFilter] = useState<boolean>(false);

  const renderTeamGrid = (player: "p1" | "p2", team: TeamInstance[], starterId: string, startIndex: number, type: "active" | "standby") => {
    const selectedIdx = player === "p1" ? p1SelectedIdx : p2SelectedIdx;
    const setSelectedIdx = player === "p1" ? setP1SelectedIdx : setP2SelectedIdx;
    const handleSetStarter = player === "p1" ? handleSetP1Starter : handleSetP2Starter;
    const handleRemove = player === "p1" ? handleRemoveP1 : handleRemoveP2;

    return (
      <div className="grid grid-cols-2 gap-3 mb-2">
        {Array.from({ length: 6 }).map((_, idx) => {
          const index = startIndex + idx;
          const elf = team[index];
          if (elf) {
            const isStarter = elf.battleId === starterId;
            return (
              <div
                key={`${elf.battleId}_${player}_${index}`}
                draggable={true}
                onDragStart={() => setDraggedSlot({ player, index })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedSlot && draggedSlot.player === player) {
                    handleSlotSwap(player, draggedSlot.index, index);
                    setDraggedSlot(null);
                  }
                }}
                onClick={() => {
                  if (selectedIdx === null) {
                    setSelectedIdx(index);
                  } else if (selectedIdx === index) {
                    setSelectedIdx(null);
                  } else {
                    handleSlotSwap(player, selectedIdx, index);
                    setSelectedIdx(null);
                  }
                }}
                onDoubleClick={() => setShowSelectionModal({ player, slotIndex: index })}
                className={`relative bg-white/[0.045] border ${
                  selectedIdx === index
                    ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] ring-1 ring-amber-400"
                    : isStarter
                    ? "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                    : "border-white/[0.08]"
                } rounded-[18px] p-3 flex flex-col justify-between min-h-[150px] transition-all duration-200 group cursor-pointer hover:border-slate-600`}
              >
                <div className="flex justify-between items-start gap-1">
                  <div className="flex items-center gap-1 truncate max-w-[70%]">
                    <span className="text-[10.5px] text-slate-500 font-mono font-bold shrink-0">#{index + 1}</span>
                    {elf && <span className="w-6 h-6 shrink-0 rounded-full overflow-hidden border border-slate-700 bg-slate-900"><ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400" /></span>}
                    <span className="font-bold text-slate-200 text-xs truncate" title={elf?.name}>
                      {elf?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSelectionModal({ player, slotIndex: index });
                      }}
                      className="p-1 hover:bg-slate-800 rounded text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="更換精靈"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className={`text-[10.5px] px-1 py-0.5 rounded ${getAttributeBadgeColor(elf.type)} font-bold shrink-0 inline-flex items-center gap-0.5`}>
                      <TypeIcon type={elf.type} size={14} showLabelWhenMissing={false} />{elf.type}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                    <span className="text-slate-500">HP</span>
                    <span className={elf.currentHp <= 0 ? "text-rose-500" : "text-emerald-400"}>
                      {Math.max(0, Math.floor(elf.currentHp))} / {elf.calculatedStats.hp}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        (elf.currentHp / elf.calculatedStats.hp) > 0.5 ? "bg-emerald-500" : 
                        (elf.currentHp / elf.calculatedStats.hp) > 0.2 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, (elf.currentHp / elf.calculatedStats.hp) * 100))}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-500">
                    <div className="flex flex-col">
                      <span>攻 {elf.calculatedStats.atk}</span>
                      <span>特攻 {elf.calculatedStats.spatk}</span>
                    </div>
                    <div className="flex flex-col">
                      <span>防 {elf.calculatedStats.def}</span>
                      <span>特防 {elf.calculatedStats.spdef}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-blue-400">速 {elf.calculatedStats.speed}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-1 select-none">
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] text-slate-500 font-bold truncate max-w-[40px]">{elf.soulMark.name}</span>
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-violet-950/50 border border-violet-500/30 text-violet-400 font-black text-[10.5px] cursor-help transition-all shadow-sm" title={elf.soulMark.description}>
                      {elf.soulMark.badgeChar || elf.soulMark.name?.[0] || "魂"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIdx(selectedIdx === index ? null : index);
                    }}
                    className="text-[10.5px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-950/40 border border-blue-500/20"
                  >
                    <Move className="w-2.5 h-2.5" />
                    {selectedIdx === index ? "取消" : "移動"}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.06]">
                  {isStarter ? (
                    <span className="text-[10.5px] text-amber-500 font-bold flex items-center gap-0.5">
                      <Crown className="w-3 h-3 text-amber-500" />
                      首發成員
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetStarter(elf.battleId);
                      }}
                      className="text-[10.5px] text-slate-400 hover:text-amber-500 font-bold cursor-pointer transition-all"
                    >
                      設為首發
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(elf.battleId);
                    }}
                    className="text-[10.5px] text-rose-500 hover:text-rose-400 font-bold cursor-pointer transition-all"
                  >
                    移出
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={`${player}-empty-${index}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedSlot && draggedSlot.player === player) {
                  handleSlotSwap(player, draggedSlot.index, index);
                  setDraggedSlot(null);
                }
              }}
              onClick={() => {
                if (selectedIdx !== null && selectedIdx !== index) {
                  handleSlotSwap(player, selectedIdx, index);
                  setSelectedIdx(null);
                } else {
                  setShowSelectionModal({ player, slotIndex: index });
                }
              }}
              className={`border border-dashed ${
                selectedIdx !== null ? "border-amber-500/50 hover:border-amber-400 cursor-pointer bg-amber-500/5" : "border-slate-800 bg-[#050608]/20 hover:border-blue-500/40 hover:bg-blue-500/5 cursor-pointer"
              } rounded-2xl p-3 flex flex-col items-center justify-center min-h-[140px] text-slate-600 select-none text-[10px] transition-all group`}
            >
              <Plus className="w-5 h-5 mb-1 text-slate-700 group-hover:text-blue-500 transition-colors" />
              <span>位置 #{index + 1} ({type === "active" ? "出戰" : "待命"})</span>
              <span className="text-[10px] text-slate-700 mt-1">{selectedIdx !== null ? "點擊放置至此" : "點擊加入精靈"}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const ensureBattleTeam = (team: TeamInstance[], defaultStarterId: string, format: string, customPick?: number): { team: TeamInstance[]; starterId: string } => {
    let result = [...team];
    if (result.length === 0 && allElves.length > 0) {
      result.push(createInstance(allElves[0]));
    }
    const activeLimit = customPick !== undefined ? customPick : (format === "solo_1v1" ? 1 : format === "peak_6v6" ? 6 : format === "peak_3v3" ? 3 : 6);
    const minNeeded = Math.max(activeLimit + banCount + 3, format === "solo_1v1" ? 1 : format === "peak_6v6" ? 12 : format === "peak_3v3" ? 8 : 6);
    let i = 0;
    while (result.length < minNeeded && allElves.length > 0) {
      const source = allElves[i % allElves.length];
      result.push(createInstance(source));
      i++;
    }
    result = result.map((e, idx) => ({
      ...e,
      isExtra: idx >= activeLimit
    }));
    const st = result.find(e => e.battleId === defaultStarterId)?.battleId || result[0]?.battleId || "";
    return { team: result, starterId: st };
  };

  const handleStart = () => {
    if (p1Team.length === 0 || p2Team.length === 0 || !p1StarterId || !p2StarterId) return;
    if (battleFormat === "normal_6v6" || battleFormat === "solo_1v1") {
      let p1Active = p1Team.map(e => {
        const bonusElf = { ...e, hasAnnualBonus: p1AnnualBonus };
        bonusElf.calculatedStats = calculateElfStats(
          bonusElf.baseStats, 100, bonusElf.ivs, bonusElf.evs, bonusElf.natureModifiers, bonusElf.inscriptions, bonusElf.guildBonuses, bonusElf.hasAnnualBonus
        );
        bonusElf.maxHp = bonusElf.calculatedStats.hp;
        bonusElf.currentHp = bonusElf.calculatedStats.hp;
        return bonusElf;
      });
      let p2Active = p2Team.map(e => {
        const bonusElf = { ...e, hasAnnualBonus: p2AnnualBonus };
        bonusElf.calculatedStats = calculateElfStats(
          bonusElf.baseStats, 100, bonusElf.ivs, bonusElf.evs, bonusElf.natureModifiers, bonusElf.inscriptions, bonusElf.guildBonuses, bonusElf.hasAnnualBonus
        );
        bonusElf.maxHp = bonusElf.calculatedStats.hp;
        bonusElf.currentHp = bonusElf.calculatedStats.hp;
        return bonusElf;
      });
      p1Active = bindInitialCounterparts(p1Active, 6).slice(0, 6);
      p2Active = bindInitialCounterparts(p2Active, 6).slice(0, 6);
      const st1 = p1Active.find(e => e.battleId === p1StarterId)?.battleId || p1Active[0]?.battleId || p1StarterId;
      const st2 = p2Active.find(e => e.battleId === p2StarterId)?.battleId || p2Active[0]?.battleId || p2StarterId;
      if (battleFormat === "solo_1v1") {
        p1Active = p1Active.filter(e => e.battleId === st1);
        p2Active = p2Active.filter(e => e.battleId === st2);
      }
      onStartBattle(battleMode, p1Active, p2Active, st1, st2, p1Suit, p1Eyewear, p2Suit, p2Eyewear, p1Title, p2Title, battleFormat);
    } else {
      const p1Ready = ensureBattleTeam(p1Team, p1StarterId, battleFormat, pickCount);
      const p2Ready = ensureBattleTeam(p2Team, p2StarterId, battleFormat, pickCount);
      setP1Team(p1Ready.team);
      setP2Team(p2Ready.team);
      setP1StarterId(p1Ready.starterId);
      setP2StarterId(p2Ready.starterId);

      setP1BannedIds([]);
      setP2BannedIds([]);
      setP1PickedIds([]);
      setP2PickedIds([]);
      setP1BpStarterId("");
      setP2BpStarterId("");

      let aiBans: string[] = [];
      if (battleMode === "PVE" && banCount > 0) {
        aiBans = [...p1Ready.team]
          .sort((a, b) => {
            const sumA = Object.values(a.baseStats).reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
            const sumB = Object.values(b.baseStats).reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
            return Number(sumB) - Number(sumA);
          })
          .slice(0, Math.min(banCount, p1Ready.team.length - 1))
          .map(e => e.battleId);
        setP2BannedIds(aiBans);
      }

      if (banCount > 0) {
        setBpPhase("ban_p1");
      } else {
        setBpPhase("pick_p1");
        if (battleFormat === "peak_6v6" || battleFormat === "peak_3v3") {
          const pickNum = pickCount;
          const initialP1 = p1Ready.team.slice(0, pickNum).map(e => e.battleId);
          setP1PickedIds(initialP1);
          setP1BpStarterId(initialP1[0] || "");
          if (battleMode === "PVE") {
            const sortedAI = [...p2Ready.team].sort((a, b) => {
              const sumA = Object.values(a.baseStats).reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
              const sumB = Object.values(b.baseStats).reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
              return Number(sumB) - Number(sumA);
            });
            const aiPicked = sortedAI.slice(0, pickNum).map(e => e.battleId);
            setP2PickedIds(aiPicked);
            setP2BpStarterId(aiPicked[0] || "");
          } else {
            const initialP2 = p2Ready.team.slice(0, pickNum).map(e => e.battleId);
            setP2PickedIds(initialP2);
            setP2BpStarterId(initialP2[0] || "");
          }
        }
      }
    }
  };

  const handleConfirmBansAndEnterPick = () => {
    setBpPhase("pick_p1");
    const pickNum = pickCount;
    
    // P1 initial pick setup
    const nonBannedP1 = p1Team.filter(e => !p2BannedIds.includes(e.battleId)).map(e => e.battleId);
    const initialP1 = nonBannedP1.slice(0, pickNum);
    setP1PickedIds(initialP1);
    if (!p1BpStarterId || p2BannedIds.includes(p1BpStarterId) || !initialP1.includes(p1BpStarterId)) {
      setP1BpStarterId(initialP1[0] || "");
    }

    // P2 initial pick setup
    const nonBannedP2 = p2Team.filter(e => !p1BannedIds.includes(e.battleId));
    if (battleMode === "PVE") {
      const sortedAI = [...nonBannedP2].sort((a, b) => {
        const sumA = Object.values(a.baseStats).reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
        const sumB = Object.values(b.baseStats).reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
        return Number(sumB) - Number(sumA);
      });
      const aiPicked = sortedAI.slice(0, pickNum).map(e => e.battleId);
      setP2PickedIds(aiPicked);
      setP2BpStarterId(aiPicked[0] || nonBannedP2[0]?.battleId || "");
    } else {
      const initialP2 = nonBannedP2.slice(0, pickNum).map(e => e.battleId);
      setP2PickedIds(initialP2);
      if (!p2BpStarterId || p1BannedIds.includes(p2BpStarterId) || !initialP2.includes(p2BpStarterId)) {
        setP2BpStarterId(initialP2[0] || "");
      }
    }
  };

  const handleLaunchPeakBattle = () => {
    const finalP1Active = p1Team.filter(e => p1PickedIds.includes(e.battleId)).map(e => {
      const bonusElf = { ...e, isExtra: false, hasAnnualBonus: p1AnnualBonus };
      bonusElf.calculatedStats = calculateElfStats(
        bonusElf.baseStats, 100, bonusElf.ivs, bonusElf.evs, bonusElf.natureModifiers, bonusElf.inscriptions, bonusElf.guildBonuses, bonusElf.hasAnnualBonus
      );
      bonusElf.maxHp = bonusElf.calculatedStats.hp;
      bonusElf.currentHp = bonusElf.calculatedStats.hp;
      return bonusElf;
    });

    const finalP2Active = p2Team.filter(e => p2PickedIds.includes(e.battleId)).map(e => {
      const bonusElf = { ...e, isExtra: false, hasAnnualBonus: p2AnnualBonus };
      bonusElf.calculatedStats = calculateElfStats(
        bonusElf.baseStats, 100, bonusElf.ivs, bonusElf.evs, bonusElf.natureModifiers, bonusElf.inscriptions, bonusElf.guildBonuses, bonusElf.hasAnnualBonus
      );
      bonusElf.maxHp = bonusElf.calculatedStats.hp;
      bonusElf.currentHp = bonusElf.calculatedStats.hp;
      return bonusElf;
    });

    setBpPhase("closed");
    const starter1 = p1BpStarterId || finalP1Active[0]?.battleId || p1StarterId;
    const starter2 = p2BpStarterId || finalP2Active[0]?.battleId || p2StarterId;
    
    onStartBattle(
      battleMode,
      finalP1Active.length > 0 ? bindInitialCounterparts([...finalP1Active, ...p1Team.filter(e => !p1PickedIds.includes(e.battleId) && !p2BannedIds.includes(e.battleId))], finalP1Active.length).slice(0, finalP1Active.length) : p1Team,
      finalP2Active.length > 0 ? bindInitialCounterparts([...finalP2Active, ...p2Team.filter(e => !p2PickedIds.includes(e.battleId) && !p1BannedIds.includes(e.battleId))], finalP2Active.length).slice(0, finalP2Active.length) : p2Team,
      starter1,
      starter2,
      p1Suit,
      p1Eyewear,
      p2Suit,
      p2Eyewear,
      p1Title,
      p2Title,
      battleFormat
    );
  };


  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [blockView, setBlockView] = useState(false);

  const handleCopyText = (type: 'full' | 'soulMark' | 'skill', data?: any) => {
    if (!showDetailModal) return;
    let textToCopy = "";

    if (type === 'full') {
      textToCopy += `【精靈名稱】：${showDetailModal.name}\n`;
      textToCopy += `【精靈屬性】：${showDetailModal.type}系\n`;
      textToCopy += `【基本資料】：身高 ${showDetailModal.height || 0}cm / 體重 ${showDetailModal.weight || 0}kg / 性別 ${showDetailModal.gender || '無性別'}\n`;
      if (showDetailModal.specialModeRating && showDetailModal.specialModeRating !== '未評級') {
        textToCopy += `【特殊模式評級】：${showDetailModal.specialModeRating}\n`;
      }
      textToCopy += `【基礎種族值】：體力 ${showDetailModal.baseStats.hp} / 攻擊 ${showDetailModal.baseStats.atk} / 防禦 ${showDetailModal.baseStats.def} / 特攻 ${showDetailModal.baseStats.spatk} / 特防 ${showDetailModal.baseStats.spdef} / 速度 ${showDetailModal.baseStats.speed}\n\n`;
      if (showDetailModal.soulMark) {
        textToCopy += `【魂印 / 專屬特性】 - ${showDetailModal.soulMark.name}\n${showDetailModal.soulMark.description.replace(/([；;])\s*/g, '$1\n')}\n\n`;
      }
      if (showDetailModal.alienTraits) {
        if (showDetailModal.alienTraits.gen2Trait) {
          textToCopy += `【二代特質】 - ${showDetailModal.alienTraits.gen2Trait.name}\n${showDetailModal.alienTraits.gen2Trait.description}\n\n`;
        }
        if (showDetailModal.alienTraits.exclusiveTrait) {
          textToCopy += `【專屬刻印 / 特質】 - ${showDetailModal.alienTraits.exclusiveTrait.name}\n${showDetailModal.alienTraits.exclusiveTrait.description}\n\n`;
        }
        for (const trait of showDetailModal.alienTraits.exclusiveTraits || []) {
          textToCopy += `【專屬刻印 / 特質】 - ${trait.name}\n${trait.description}\n\n`;
        }
        if (showDetailModal.alienTraits.alienTrait) {
          textToCopy += `【異能特質】 - ${showDetailModal.alienTraits.alienTrait.name}\n${showDetailModal.alienTraits.alienTrait.description}\n\n`;
        }
        if (showDetailModal.alienTraits.generalTrait) {
          textToCopy += `【通用特性】 - ${showDetailModal.alienTraits.generalTrait.name}\n${showDetailModal.alienTraits.generalTrait.description}\n\n`;
        }
      }
      if (showDetailModal.resistances) {
        textToCopy += `【抗性配置】：\n`;
        textToCopy += `- 致命一擊抗性：${showDetailModal.resistances.damageResist.crit}%\n`;
        textToCopy += `- 固定傷害抗性：${showDetailModal.resistances.damageResist.fixed}%\n`;
        textToCopy += `- 百分比傷害抗性：${showDetailModal.resistances.damageResist.percent}%\n`;
        if (showDetailModal.resistances.statusResist.allImmune) {
           textToCopy += `- 異常抗性：5% 全免抗性開啟\n`;
        }
        if (showDetailModal.resistances.statusResist.selectedStatuses?.length > 0) {
           textToCopy += `- 自選異常抗性：${showDetailModal.resistances.statusResist.selectedStatuses.join('、')}\n`;
        }
        textToCopy += `\n`;
      }
      if (showDetailModal.skills && showDetailModal.skills.length > 0) {
        textToCopy += `【核心技能組】\n`;
        showDetailModal.skills.forEach(sk => {
          const typeStr = sk.type && sk.type !== '無屬性' ? `${sk.type}系` : '';
          const fifthStr = sk.isFifthSkill ? ' (第五技能)' : '';
          textToCopy += `[${sk.name}] ${typeStr} ${sk.category}技能${fifthStr}\n威力：${sk.power} | PP：${sk.pp}\n效果：${sk.description.replace(/([；;])\s*/g, '$1\n')}\n\n`;
        });
      }
    } else if (type === 'soulMark' && showDetailModal.soulMark) {
      textToCopy = `【魂印 / 專屬特性】 - ${showDetailModal.soulMark.name}\n${showDetailModal.soulMark.description.replace(/([；;])\s*/g, '$1\n')}`;
    } else if (type === 'skill' && data) {
      const typeStr = data.type && data.type !== '無屬性' ? `${data.type}系` : '';
      const fifthStr = data.isFifthSkill ? ' (第五技能)' : '';
      textToCopy = `[${data.name}] ${typeStr} ${data.category}技能${fifthStr}\n威力：${data.power} | PP：${data.pp}\n效果：${data.description.replace(/([；;])\s*/g, '$1\n')}`;
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedSection(type + (data ? '-' + data.name : ''));
        setTimeout(() => {
          setCopiedSection(null);
        }, 2000);
      });
    }
  };

  const handleAnalyzeElf = async () => {
    if (!showAnalyzeModal || !analyzeText.trim()) return;
    
    setIsAnalyzing(showAnalyzeModal.id);
    try {
      const res = await fetch("/api/analyze-elf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          elf: showAnalyzeModal, 
          description: analyzeText 
        }),
      });
      
      const result = await res.json();
      if (result.success) {
        const updatedElf: Elf = {
          ...result.data,
          id: showAnalyzeModal.id || result.data.id || showAnalyzeModal.name,
          name: showAnalyzeModal.name || result.data.name,
          isCustom: true,
          description: analyzeText
        };

        if (onUpdateElf) {
          onUpdateElf(updatedElf);
        }
        if (showDetailModal && (showDetailModal.id === updatedElf.id || showDetailModal.name === updatedElf.name)) {
          setShowDetailModal(updatedElf);
        }

        alert("精靈邏輯已由 AI 實時修正並重新實裝！資料已自動更新保存至精靈庫。");
      } else {
        alert("AI 解析失敗: " + result.error);
      }
    } catch (e) {
      console.error(e);
      alert("AI 請求失敗，請檢查網絡連線。");
    } finally {
      setIsAnalyzing(null);
      setShowAnalyzeModal(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-8 pt-20 sm:px-6 sm:py-8" id="start-screen-container">
      {/* 標題 */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-slate-50">賽爾號對戰模擬器</h1>
        <p className="text-slate-400 mt-1 text-[15px]">6V6 精靈對戰 · 自訂陣容與首發</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 mb-8 items-stretch">
        {/* 對戰設定（iOS 分組列表） */}
        <div className="ios-panel p-2">
          {/* 模式 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
            <span className="text-[15px] text-slate-100" title="單機對戰電腦 AI，或同一台電腦雙人輪流操作">模式</span>
            <div className="ios-segment">
              <button id="btn-mode-pve" data-active={battleMode === "PVE"} onClick={() => setBattleMode("PVE")}><Bot className="w-4 h-4 inline -mt-0.5 mr-1" />對戰 AI</button>
              <button id="btn-mode-pvp" data-active={battleMode === "PVP"} onClick={() => setBattleMode("PVP")}><User className="w-4 h-4 inline -mt-0.5 mr-1" />雙人同屏</button>
            </div>
          </div>

          {/* 賽制 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
            <span className="text-[15px] text-slate-100" title="巔峰賽制會先進行 BP 禁選與首發盲選">賽制</span>
            <div className="ios-segment flex-wrap">
              <button data-active={battleFormat === "normal_6v6"} onClick={() => setBattleFormat("normal_6v6")}>自由戰</button>
              <button data-active={battleFormat === "solo_1v1"} onClick={() => setBattleFormat("solo_1v1")} title="只以首發精靈對戰">單挑 1V1</button>
              <button data-active={battleFormat === "peak_6v6"} onClick={() => { setBattleFormat("peak_6v6"); setBanCount(3); setPickCount(6); }}>巔峰 6V6</button>
              <button data-active={battleFormat === "peak_3v3"} onClick={() => { setBattleFormat("peak_3v3"); setBanCount(2); setPickCount(3); }}>巔峰 3V3</button>
            </div>
          </div>

          {battleFormat !== "normal_6v6" && battleFormat !== "solo_1v1" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[15px] text-slate-100 pl-4" title="賽前禁用對手精靈數量">禁用</span>
                <div className="ios-segment">
                  {[0, 1, 2, 3, 4].map(v => (
                    <button key={v} data-active={banCount === v} onClick={() => setBanCount(v)}>{v} 隻</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[15px] text-slate-100 pl-4" title="雙方正式上場的精靈數量">出戰</span>
                <div className="ios-segment">
                  {[1, 2, 3, 4, 5, 6].map(v => (
                    <button key={v} data-active={pickCount === v} onClick={() => setPickCount(v)}>{v} 隻</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 房主 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
            <span className="text-[15px] text-slate-100 flex items-center gap-1.5" title="雙方同時觸發「必先」或先制與速度完全相同時，房主方優先">
              <Crown className="w-4 h-4 text-amber-400" />房主
            </span>
            <div className="flex items-center gap-2">
              <div className="ios-segment">
                <button data-active={hostPlayer === "p1"} onClick={() => onHostPlayerChange?.("p1")}>P1</button>
                <button data-active={hostPlayer === "p2"} onClick={() => onHostPlayerChange?.("p2")}>{battleMode === "PVE" ? "AI" : "P2"}</button>
              </div>
              <button
                onClick={handleSwapTeams}
                className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[13px] text-slate-200 flex items-center gap-1.5"
                title="對調 P1 與 P2 的戰隊、年費加成、套裝與稱號"
              >
                <ArrowLeftRight className="w-4 h-4 text-cyan-300" />對調雙方
              </button>
            </div>
          </div>

          {/* 其他玩法 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-[15px] text-slate-100">其他玩法</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onNavigateToDestinyWheel && onNavigateToDestinyWheel(battleMode)}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/25 to-purple-500/25 hover:from-amber-500/35 hover:to-purple-500/35 text-[13px] text-amber-100 flex items-center gap-1.5"
                title="12 連抽組隊對戰"
              >
                <Disc className="w-4 h-4" />命運之輪
              </button>
              <button
                onClick={() => onNavigateToInterstellar && onNavigateToInterstellar()}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-500/25 to-cyan-500/25 hover:from-blue-500/35 hover:to-cyan-500/35 text-[13px] text-cyan-100 flex items-center gap-1.5"
                title="Roguelike 探索模式"
              >
                <Rocket className="w-4 h-4" />星際探索
              </button>
            </div>
          </div>
        </div>

        {/* 開始對戰 */}
        <div className="ios-panel p-4 flex flex-col gap-3 justify-center relative z-30">
          {p1Team.length === 0 || p2Team.length === 0 || !p1StarterId || !p2StarterId ? (
            <button id="btn-start-battle" disabled className="w-full py-5 rounded-2xl bg-white/[0.05] text-slate-400 text-[14px] font-medium flex flex-col items-center gap-1.5">
              <Swords className="w-6 h-6 text-amber-400" />
              請先在下方設定隊伍與首發
            </button>
          ) : (
            <>
              <button
                onClick={handleStart}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-[17px] font-semibold flex items-center justify-center gap-2 transition-colors"
                title="經典對戰艙（Room 1）：包含經典 IF 分支判定"
              >
                <Swords className="w-5 h-5" />開始對戰
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Teams Selection & Configuration Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
        
        {/* Player 1 Team Setup Area */}
        <div className="lg:col-span-6 ios-panel p-6 flex flex-col justify-between" id="p1-team-card">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 tracking-tight">
                  P1 陣容 <span className="text-slate-500 font-medium text-[15px]">{p1Team.length}/12</span>
                </h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`relative w-7 h-4 rounded-full transition-colors ${p1AnnualBonus ? 'bg-amber-500' : 'bg-slate-800'}`}>
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={p1AnnualBonus} 
                        onChange={(e) => setP1AnnualBonus(e.target.checked)}
                      />
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${p1AnnualBonus ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                    <span className={`text-[10px] font-bold transition-colors ${p1AnnualBonus ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                      年費加成 (全能力+10)
                    </span>
                  </label>
                  <button
                    onClick={handleClearP1Team}
                    className="text-[10px] text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空背包
                  </button>
                  <button
                    onClick={handleCopyAIToP1}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    複製 P2
                  </button>
                </div>
              </div>
              {p1Team.length > 0 && (
                <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                  首發: {p1Team.find((e) => e.battleId === p1StarterId)?.name || "未指定"}
                </span>
              )}
            </div>

            {/* Active Backpack (Slots 0-5) */}
            <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-slate-300 px-1" title="前 6 格直接參戰與盲選；可拖曳或點選對調位置">
              <span>出戰</span>
              <span className="text-xs text-slate-500 font-normal">拖曳可調整順序</span>
            </div>
            {renderTeamGrid("p1", p1Team, p1StarterId, 0, "active")}

            {/* Middle Swap Bar */}
            <div className="my-2 py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold shrink-0">
                <ArrowUpDown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>快速對調：</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => handleSwapAllActiveStandby("p1")}
                  className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  title="將出戰背包前6格與待命背包後6格全部互相對調"
                >
                  <Layers className="w-3 h-3" />
                  全部出戰⇄待命
                </button>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <button
                    key={`swap-btn-p1-${idx}`}
                    onClick={() => handleSlotSwap("p1", idx, idx + 6)}
                    disabled={!p1Team[idx] && !p1Team[idx + 6]}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded text-[10px] font-mono transition-colors cursor-pointer"
                    title={`對調第 ${idx + 1} 格與第 ${idx + 7} 格`}
                  >
                    #{idx + 1}⇄#{idx + 7}
                  </button>
                ))}
              </div>
            </div>

            {/* Standby Backpack (Slots 6-11) */}
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-cyan-400 bg-cyan-950/20 px-3 py-1.5 rounded-lg border border-cyan-500/20">
              <span className="flex items-center gap-1.5">🛡️ 待命背包 (後 6 格 - 巔峰BP備用池)</span>
              <span className="text-[10px] text-cyan-300/80 font-normal">巔峰對決一併入戰</span>
            </div>
            {renderTeamGrid("p1", p1Team, p1StarterId, 6, "standby")}
          </div>
          {p1Team.length === 0 && (
            <div className="text-center p-4 bg-blue-950/10 border border-blue-900/30 rounded-2xl flex items-center justify-center gap-2 text-xs text-blue-300">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span>請至少加入 1 隻精靈至 PLAYER 1 隊伍！</span>
            </div>
          )}

          {/* P1 Equipment Section */}
          <div className="mt-3 p-3 bg-[#050608] border border-slate-800/80 rounded-xl space-y-2">
            <div className="text-xs font-bold text-blue-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> P1 戰甲、目鏡與屬性稱號配置 (獨立保存)</span>
              {(p1Suit || p1Eyewear || p1Title) && (
                <button onClick={() => { handleSetP1Suit(""); handleSetP1Eyewear(""); handleSetP1Title(""); }} className="text-[10px] text-rose-400 hover:text-rose-300">一鍵卸下</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">【套裝】(最多 1 件)</label>
                <select
                  value={p1Suit}
                  onChange={(e) => handleSetP1Suit(e.target.value)}
                  className="w-full bg-[#0F1117] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">默認無套裝 (不配戴)</option>
                  {Object.values(SUIT_CATALOG).map((s) => (
                    <option key={s.id} value={s.id}>{s?.name || "無技能"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">【目鏡】(最多 1 件)</label>
                <select
                  value={p1Eyewear}
                  onChange={(e) => handleSetP1Eyewear(e.target.value)}
                  className="w-full bg-[#0F1117] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">默認無目鏡 (不配戴)</option>
                  {Object.values(EYEWEAR_CATALOG).map((e) => (
                    <option key={e.id} value={e.id}>{e?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">【稱號】(最多 1 個)</label>
                <select
                  value={p1Title}
                  onChange={(e) => handleSetP1Title(e.target.value)}
                  className="w-full bg-[#0F1117] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">默認無稱號 (不佩戴)</option>
                  {["一、全屬性", "二、速度", "三、體力", "四、雙攻", "五、雙防", "六、速體", "七、攻速", "八、攻體", "九、暴擊稱號", "十、其他稱號"].map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {Object.values(TITLE_CATALOG).filter((t) => t.category === cat).map((t) => (
                        <option key={t.id} value={t.id}>{t?.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            {p1Suit && SUIT_CATALOG[p1Suit] && (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                <span className="text-amber-400 font-bold">[{SUIT_CATALOG[p1Suit].name}]：</span>
                {SUIT_CATALOG[p1Suit].description}
              </div>
            )}
            {p1Eyewear && EYEWEAR_CATALOG[p1Eyewear] && (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                <span className="text-cyan-400 font-bold">[{EYEWEAR_CATALOG[p1Eyewear].name}]：</span>
                {EYEWEAR_CATALOG[p1Eyewear].description}
              </div>
            )}
            {p1Title && TITLE_CATALOG[p1Title] && (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                <span className="text-emerald-400 font-bold">[{TITLE_CATALOG[p1Title].name}]：</span>
                {TITLE_CATALOG[p1Title].description}
              </div>
            )}
          </div>

          <TeamSetupTools side="p1" names={lastUsedRecord?.team?.map(e => e.name) || []}
            onRandomize={handleRandomizeP1} onCopy={handleCopyAIToP1} onBackpack={() => setShowBackpackModal(true)}
            onSave={handleSaveLastUsed} onLoad={handleLoadLastUsed} message={saveSuccessMsg} />
        </div>

        {/* Player 2 Team Setup Area */}
        <div className="lg:col-span-6 ios-panel p-6 flex flex-col justify-between" id="p2-team-card">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 tracking-tight">
                  {battleMode === "PVE" ? "AI 陣容" : "P2 陣容"} <span className="text-slate-500 font-medium text-[15px]">{p2Team.length}/12</span>
                </h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`relative w-7 h-4 rounded-full transition-colors ${p2AnnualBonus ? 'bg-amber-500' : 'bg-slate-800'}`}>
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={p2AnnualBonus} 
                        onChange={(e) => setP2AnnualBonus(e.target.checked)}
                      />
                      <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${p2AnnualBonus ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                    <span className={`text-[10px] font-bold transition-colors ${p2AnnualBonus ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                      年費加成 (全能力+10)
                    </span>
                  </label>
                  <button
                    onClick={handleClearP2Team}
                    className="text-[10px] text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空背包
                  </button>
                  <button
                    onClick={handleCopyP1ToAI}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    複製 P1
                  </button>
                </div>
              </div>
              {p2Team.length > 0 && (
                <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 font-mono">
                  首發: {p2Team.find((e) => e.battleId === p2StarterId)?.name || "未指定"}
                </span>
              )}
            </div>

            {/* Active Backpack (Slots 0-5) */}
            <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-slate-300 px-1" title="前 6 格直接參戰與盲選；可拖曳或點選對調位置">
              <span>出戰</span>
              <span className="text-xs text-slate-500 font-normal">拖曳可調整順序</span>
            </div>
            {renderTeamGrid("p2", p2Team, p2StarterId, 0, "active")}

            {/* Middle Swap Bar */}
            <div className="my-2 py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold shrink-0">
                <ArrowUpDown className="w-4 h-4 text-amber-400 shrink-0" />
                <span>快速對調：</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => handleSwapAllActiveStandby("p2")}
                  className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  title="將出戰背包前6格與待命背包後6格全部互相對調"
                >
                  <Layers className="w-3 h-3" />
                  全部出戰⇄待命
                </button>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <button
                    key={`swap-btn-p2-${idx}`}
                    onClick={() => handleSlotSwap("p2", idx, idx + 6)}
                    disabled={!p2Team[idx] && !p2Team[idx + 6]}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded text-[10px] font-mono transition-colors cursor-pointer"
                    title={`對調第 ${idx + 1} 格與第 ${idx + 7} 格`}
                  >
                    #{idx + 1}⇄#{idx + 7}
                  </button>
                ))}
              </div>
            </div>

            {/* Standby Backpack (Slots 6-11) */}
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-cyan-400 bg-cyan-950/20 px-3 py-1.5 rounded-lg border border-cyan-500/20">
              <span className="flex items-center gap-1.5">🛡️ 待命背包 (後 6 格 - 巔峰BP備用池)</span>
              <span className="text-[10px] text-cyan-300/80 font-normal">巔峰對決一併入戰</span>
            </div>
            {renderTeamGrid("p2", p2Team, p2StarterId, 6, "standby")}
          </div>

          {/* P2 Equipment Section */}
          <div className="mt-3 p-3 bg-[#050608] border border-slate-800/80 rounded-xl space-y-2">
            <div className="text-xs font-bold text-rose-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> P2 戰甲、目鏡與屬性稱號配置 (獨立保存)</span>
              {(p2Suit || p2Eyewear || p2Title) && (
                <button onClick={() => { handleSetP2Suit(""); handleSetP2Eyewear(""); handleSetP2Title(""); }} className="text-[10px] text-rose-400 hover:text-rose-300">一鍵卸下</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">【套裝】(最多 1 件)</label>
                <select
                  value={p2Suit}
                  onChange={(e) => handleSetP2Suit(e.target.value)}
                  className="w-full bg-[#0F1117] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="">默認無套裝 (不配戴)</option>
                  {Object.values(SUIT_CATALOG).map((s) => (
                    <option key={s.id} value={s.id}>{s?.name || "無技能"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">【目鏡】(最多 1 件)</label>
                <select
                  value={p2Eyewear}
                  onChange={(e) => handleSetP2Eyewear(e.target.value)}
                  className="w-full bg-[#0F1117] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="">默認無目鏡 (不配戴)</option>
                  {Object.values(EYEWEAR_CATALOG).map((e) => (
                    <option key={e.id} value={e.id}>{e?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">【稱號】(最多 1 個)</label>
                <select
                  value={p2Title}
                  onChange={(e) => handleSetP2Title(e.target.value)}
                  className="w-full bg-[#0F1117] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="">默認無稱號 (不佩戴)</option>
                  {["一、全屬性", "二、速度", "三、體力", "四、雙攻", "五、雙防", "六、速體", "七、攻速", "八、攻體", "九、暴擊稱號", "十、其他稱號"].map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {Object.values(TITLE_CATALOG).filter((t) => t.category === cat).map((t) => (
                        <option key={t.id} value={t.id}>{t?.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            {p2Suit && SUIT_CATALOG[p2Suit] && (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                <span className="text-amber-400 font-bold">[{SUIT_CATALOG[p2Suit].name}]：</span>
                {SUIT_CATALOG[p2Suit].description}
              </div>
            )}
            {p2Eyewear && EYEWEAR_CATALOG[p2Eyewear] && (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                <span className="text-cyan-400 font-bold">[{EYEWEAR_CATALOG[p2Eyewear].name}]：</span>
                {EYEWEAR_CATALOG[p2Eyewear].description}
              </div>
            )}
            {p2Title && TITLE_CATALOG[p2Title] && (
              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                <span className="text-emerald-400 font-bold">[{TITLE_CATALOG[p2Title].name}]：</span>
                {TITLE_CATALOG[p2Title].description}
              </div>
            )}
          </div>

          <TeamSetupTools side="p2" names={lastUsedRecordP2?.team?.map(e => e.name) || []}
            onRandomize={handleRandomizeAI} onCopy={handleCopyP1ToAI} onBackpack={() => setShowBackpackModalP2(true)}
            onSave={handleSaveLastUsedP2} onLoad={handleLoadLastUsedP2} message={saveSuccessMsg} />
        </div>

      </div>

      {/* Elf Warehouse Panel */}
      <div className="ios-panel p-6 mb-6" id="elf-roster-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex-1 w-full md:w-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 tracking-tight">
                  賽爾精靈卡牌倉庫 <span className="text-slate-500 font-medium">{allElves.length}</span>
                </h2>
                {/* 緩存管理按鈕 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleForceReload}
                    className="px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-blue-400 hover:text-white bg-slate-950 hover:bg-blue-900/30 border border-slate-800 hover:border-blue-500/50 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    title="強制重新載入並清理資料 (不清除自訂資料)"
                  >
                    <RotateCcw className="w-3 h-3 animate-spin-hover" />
                    重載清理資料
                  </button>
                  <button
                    onClick={handleClearCacheWithConfirm}
                    className="px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-rose-400 hover:text-white bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    title="清空自訂精靈與修改記錄 (需二次確認)"
                  >
                    <Trash2 className="w-3 h-3" />
                    清除本地緩存
                  </button>
                </div>
              </div>
              {/* 名稱搜尋框 */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="名稱、ID、屬性（可用空白組合）"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#050608] border border-slate-800 focus:border-blue-500/50 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* 雙屬性多選過濾標籤 - 最小化設計 */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => setShowTypeFilters(!showTypeFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                  showTypeFilters || selectedTypes.length > 0
                    ? "bg-blue-900/40 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                    : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                屬性過濾器 {selectedTypes.length > 0 && `(${selectedTypes.length})`}
                {showTypeFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {selectedTypes.length > 0 && !showTypeFilters && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                    已過濾 {selectedTypes.length} 種屬性
                  </span>
                  <button
                    onClick={() => setSelectedTypes([])}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> 清除
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showTypeFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden w-full"
                >
                  <div className="flex flex-wrap items-center gap-2 mt-3 pb-3 border-b border-white/[0.06]">
                    <button
                      onClick={() => setSelectedTypes([])}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                        selectedTypes.length === 0
                          ? "bg-blue-600 text-white"
                          : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                      }`}
                    >
                      全部
                    </button>
                    {SEER_TYPES.map(type => {
                      const isSelected = selectedTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleTypeFilter(type)}
                          className={`pl-2 pr-3 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                          }`}
                        >
                          <TypeIcon type={type} size={18} showLabelWhenMissing={false} />
                          {type}
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            {onRestoreDeletedElves && deletedCount > 0 && (
              <button
                onClick={onRestoreDeletedElves}
                title="還原所有被刪除的精靈"
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/50 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                還原已刪除 ({deletedCount})
              </button>
            )}
            <button
              id="btn-go-custom"
              onClick={onNavigateToCustom}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10"
            >
              <Plus className="w-4 h-4" />
              生成新精靈
            </button>
          </div>
        </div>

        {/* Elf list cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[580px] overflow-y-auto pr-2 custom-scrollbar">
          {allElves
            .filter(e => matchesElfQuery(e, searchQuery, selectedTypes))
            .map((elf, index) => (
            <div
              key={`${elf.id}-${index}`}
              className="ios-card relative p-3.5 flex flex-col justify-between min-h-[168px] group transition-colors duration-200"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-slate-800/80 ring-1 ring-white/10">
                    <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-base font-bold text-slate-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[15px] text-slate-100 truncate" title={elf?.name}>{elf?.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                      <TypeIcon type={elf.type} size={14} showLabelWhenMissing={false} />
                      <span>{elf.type}</span>
                      {getElfDestinyRank(elf) && (
                        <span className="px-1.5 rounded-full bg-cyan-500/15 text-cyan-300 font-semibold" title="命運之輪等級">命運 {getElfDestinyRank(elf)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="p-1.5 rounded-full text-slate-400 hover:text-blue-300 hover:bg-white/5 transition-colors self-start"
                    title="AI 實時解析與 Bug 修復"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAnalyzeModal(elf);
                      setAnalyzeText(elf.description || elf.soulMark.description);
                    }}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2 text-[11px] text-slate-500">
                  {elf.height ?? 0} cm · {elf.weight || "—"} kg{elf.gender ? ` · ${elf.gender}` : ""}
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed space-y-1 mt-2">
                  <div className="rounded-xl bg-black/25 px-2.5 py-2" title={elf.soulMark.description}>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300 select-none">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-violet-500/20 text-violet-200 text-[11px]">
                        {elf.soulMark.badgeChar || elf.soulMark.name?.[0] || "魂"}
                      </span>
                      <span className="truncate">{elf.soulMark.name || "魂印"}</span>
                      {elf.alienTraits && (
                        <span className="ml-auto px-1.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px]">異能</span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed select-none line-clamp-3">
                      {(elf.soulMark.description || "").split("【命運之輪")[0].trim()}
                    </p>
                  </div>
                  {elf.alienTraits && (
                    <div className="mt-1.5 pt-1 border-t border-slate-800/60 space-y-1">
                      {elf.alienTraits.gen2Trait && (
                        <p className="text-[10px] text-amber-400/80 leading-normal select-none line-clamp-2">
                          <span className="font-bold text-amber-300">🌟 {elf.alienTraits.gen2Trait.name}：</span>
                          {elf.alienTraits.gen2Trait.description}
                        </p>
                      )}
                      {elf.alienTraits.exclusiveTrait && (
                        <p className="text-[10px] text-red-400/80 leading-normal select-none line-clamp-2">
                          <span className="font-bold text-red-300">🔥 {elf.alienTraits.exclusiveTrait.name}：</span>
                          {elf.alienTraits.exclusiveTrait.description}
                        </p>
                      )}
                      {(elf.alienTraits.exclusiveTraits || []).map((trait) => (
                        <p key={trait.name} className="text-[10px] text-red-400/80 leading-normal select-none line-clamp-2">
                          <span className="font-bold text-red-300">🔥 {trait.name}：</span>
                          {trait.description}
                        </p>
                      ))}
                      {elf.alienTraits.generalTrait && (
                        <p className="text-[10px] text-blue-400/80 leading-normal select-none line-clamp-2 mt-1">
                          <span className="font-bold text-blue-300">💠 {elf.alienTraits.generalTrait.name} ({elf.alienTraits.generalTrait.description})</span>
                        </p>
                      )}
                    </div>
                  )}
                  {elf.description && (
                    <div className="mt-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                          <Edit3 className="w-2.5 h-2.5" /> 備註描述
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-600 leading-relaxed line-clamp-2">
                        {elf.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/[0.06]">
                <button
                  onClick={() => handleAddP1(elf)}
                  disabled={p1Team.length >= 12}
                  className="flex-1 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 disabled:text-slate-600 disabled:bg-white/[0.03] text-[11px] font-semibold rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> P1
                </button>
                <button
                  onClick={() => handleAddP2(elf)}
                  disabled={p2Team.length >= 12}
                  className="flex-1 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 disabled:text-slate-600 disabled:bg-white/[0.03] text-[11px] font-semibold rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> P2
                </button>

                <button
                  onClick={() => setShowDetailModal(elf)}
                  aria-label={`查看 ${elf.name} 的詳情`}
                  className="flex-1 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-[11px] font-semibold rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                >
                  <Eye className="w-3 h-3" /> 詳情
                </button>

                {onDeleteCustomElf && (
                  !deleteConfirmState[elf.id || elf.name] ? (
                    <button
                      title="刪除精靈 (點擊開啟2次保底確認)"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmState({ [elf.id || elf.name]: 1 });
                      }}
                      className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-full transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : deleteConfirmState[elf.id || elf.name] === 1 ? (
                    <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
                      <button
                        title="第1次確認：點擊進行第2次保底確認"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmState({ [elf.id || elf.name]: 2 });
                        }}
                        className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/50 text-[10px] font-bold rounded-lg transition-all cursor-pointer animate-pulse flex items-center gap-1 shadow-sm"
                      >
                        <span>確認(1/2)</span>
                      </button>
                      <button
                        title="取消刪除"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmState((prev) => {
                            const next = { ...prev };
                            delete next[elf.id || elf.name];
                            return next;
                          });
                        }}
                        className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
                      <button
                        title="最後保底確認：點擊永久移除"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomElf(elf.id || elf.name);
                          setDeleteConfirmState((prev) => {
                            const next = { ...prev };
                            delete next[elf.id || elf.name];
                            return next;
                          });
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 text-[10px] font-bold rounded-lg transition-all cursor-pointer animate-bounce flex items-center gap-1 shadow-lg shadow-rose-600/50"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>保底刪除(2/2)</span>
                      </button>
                      <button
                        title="取消刪除"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmState((prev) => {
                            const next = { ...prev };
                            delete next[elf.id || elf.name];
                            return next;
                          });
                        }}
                        className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Elf Detail Modal */}
      {createPortal(<AnimatePresence>
        {showDetailModal && (
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => {
              setShowDetailModal(null);
              setReplacingSlotIndex(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="ios-panel w-[min(1320px,96vw)] h-[92vh] overflow-hidden flex flex-col"
            >
              {/* Header：大頭像＋基本資訊 */}
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-5 shrink-0">
                <div className="w-20 h-20 shrink-0 rounded-full overflow-hidden bg-slate-800/80 ring-2 ring-white/10">
                  <ElfAvatar elf={showDetailModal} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-semibold text-slate-50 tracking-tight truncate">{showDetailModal.name}</h3>
                    {showDetailModal.isCustom && <Sparkles className="w-4 h-4 text-violet-400" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-slate-400">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-200">
                      <TypeIcon type={showDetailModal.type} size={16} showLabelWhenMissing={false} />{showDetailModal.type}系
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06]">#{showDetailModal.id}</span>
                    {getElfDestinyRank(showDetailModal) && <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">命運之輪 {getElfDestinyRank(showDetailModal)}</span>}
                    <span>{showDetailModal.height ?? 0} cm · {showDetailModal.weight || "—"} kg · {showDetailModal.gender || "無性別"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onEditElf && (
                    <button
                      onClick={() => {
                        onEditElf?.(showDetailModal);
                        setShowDetailModal(null);
                        setReplacingSlotIndex(null);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold rounded-full transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-4 h-4" /> 編輯
                    </button>
                  )}
                  <button
                    onClick={() => handleCopyText('full')}
                    className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 text-[13px] font-semibold rounded-full transition-colors flex items-center gap-1.5"
                    title="複製精靈全部文字資料"
                  >
                    {copiedSection === 'full' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedSection === 'full' ? '已複製' : '複製'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(null);
                      setReplacingSlotIndex(null);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-slate-300"
                    title="關閉"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content：左（資料／數值／抗性）右（魂印／特質／刻印／技能） */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6 items-start">
                  <div className="space-y-5 min-w-0">
                {/* Profile & Rating (Editable) */}
                <div className="ios-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <h4 className="text-[15px] font-semibold text-slate-100 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-violet-500 rounded-sm"></span>
                      基本資料
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-bold text-slate-300">
                    {/* ID */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs uppercase flex items-center gap-1">🆔 精靈 ID</span>
                      <input
                        type="text"
                        key={`id-${showDetailModal.id}`}
                        defaultValue={showDetailModal.id || ""}
                        onBlur={(e) => {
                          const newId = e.target.value.trim();
                          const oldId = showDetailModal.id;
                          if (!newId || newId === oldId) { e.target.value = oldId || ""; return; }
                          if (allElves.some(x => x && x.id === newId)) { alert(`ID ${newId} 已被使用`); e.target.value = oldId || ""; return; }
                          const updated = { ...showDetailModal, id: newId };
                          onUpdateElf?.(updated, oldId);
                          setShowDetailModal(updated);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="px-2.5 py-2 bg-black/30 border border-white/[0.08] focus:border-violet-500 rounded-lg text-slate-200 font-mono text-xs outline-none transition-all w-full"
                        placeholder="無"
                      />
                    </div>

                    {/* Height */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs uppercase flex items-center gap-1">📏 身高 (cm)</span>
                      <input
                        type="number"
                        value={showDetailModal.height ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                           const updated = { ...showDetailModal, height: val };
                          onUpdateElf?.(updated);
                          setShowDetailModal(updated);
                        }}
                        className="px-2.5 py-2 bg-black/30 border border-white/[0.08] focus:border-violet-500 rounded-lg text-slate-200 font-mono text-xs outline-none transition-all w-full"
                        placeholder="0"
                      />
                    </div>

                    {/* Weight */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs uppercase flex items-center gap-1">⚖️ 體重 (kg)</span>
                      <input
                        type="number"
                        value={showDetailModal.weight ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                          const updated = { ...showDetailModal, weight: val };
                          onUpdateElf?.(updated);
                          setShowDetailModal(updated);
                        }}
                        className="px-2.5 py-2 bg-black/30 border border-white/[0.08] focus:border-violet-500 rounded-lg text-slate-200 font-mono text-xs outline-none transition-all w-full"
                        placeholder="0"
                      />
                    </div>

                    {/* Gender */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs uppercase flex items-center gap-1">🚻 性別</span>
                      <select
                        value={showDetailModal.gender || "無性別"}
                        onChange={(e) => {
                          const updated = { ...showDetailModal, gender: e.target.value };
                          onUpdateElf?.(updated);
                          setShowDetailModal(updated);
                        }}
                        className="px-2.5 py-2 bg-black/30 border border-white/[0.08] focus:border-violet-500 rounded-lg text-slate-200 text-xs outline-none transition-all w-full cursor-pointer"
                      >
                        <option value="雄性">雄性</option>
                        <option value="雌性">雌性</option>
                        <option value="無性別">無性別</option>
                      </select>
                    </div>

                    {/* Destiny Rank */}
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <span className="text-cyan-400 text-xs uppercase flex items-center gap-1">🎡 命運評級</span>
                      <select
                        value={showDetailModal.destinyRank || ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : (e.target.value as 'S' | 'A' | 'B' | 'C');
                          const updated = { ...showDetailModal, destinyRank: val };
                          onUpdateElf?.(updated);
                          setShowDetailModal(updated);
                        }}
                        className="px-2.5 py-2 bg-black/30 border border-white/[0.08] focus:border-cyan-500 rounded-lg text-cyan-300 text-xs font-bold outline-none transition-all w-full cursor-pointer"
                      >
                        <option value="">系統判定 (預設)</option>
                        <option value="S">S 級·真神天花板</option>
                        <option value="A">A 級·巔峰主力</option>
                        <option value="B">B 級·中堅力量</option>
                        <option value="C">C 級·經典攔截</option>
                      </select>
                    </div>
                  </div>

                  {/* Destiny & Rating */}
                  {(getElfDestinyRank(showDetailModal) || (showDetailModal.specialModeRating && showDetailModal.specialModeRating !== '未評級')) && (
                    <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400 mt-2 pt-2 border-t border-slate-800/50">
                      {getElfDestinyRank(showDetailModal) && (
                        <div>
                          <span className="text-cyan-400 font-bold">🎡 命運之輪 {getElfDestinyRank(showDetailModal)}</span>
                        </div>
                      )}
                      {showDetailModal.specialModeRating && showDetailModal.specialModeRating !== '未評級' && (
                        <div>
                          <span className="text-slate-500 mr-1">特殊模式評級:</span>
                          <span className="text-amber-400">{showDetailModal.specialModeRating}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="ios-card p-4 grid grid-cols-[auto_1fr] gap-4 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/30 border border-white/10">
                      <ElfAvatar elf={showDetailModal} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[12px] text-slate-500">頭像</span>
                  </div>
                  <div className="h-72 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.10),transparent_70%)] flex items-center justify-center overflow-hidden">
                    <ElfAvatar elf={showDetailModal} kind="body" className="max-h-full max-w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]" />
                  </div>
                </div>

                <Suspense fallback={detailPanelLoading}>
                  <TypeMatchupPanel type={showDetailModal.type} />
                </Suspense>

                {/* Stats & Nature */}
                <div className="ios-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h4 className="text-[15px] font-semibold text-slate-100 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-blue-500 rounded-sm"></span>
                      Lv.100 能力值
                    </h4>
                    {(() => {
                      const nature = getNatureFromModifiers(showDetailModal.natureModifiers, showDetailModal.baseStats);
                      return (
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 rounded-full">
                          性格：{nature?.name} {nature.description !== "平衡性格 (全部 1.0x)" ? `(${nature.description})` : "(平衡 1.0x)"}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {(['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const).map((key) => [key, (showDetailModal.baseStats as any)?.[key] ?? 0] as [string, number]).map(([key, baseVal]) => {
                      const calcVal = (detailStats as any)?.[key] ?? baseVal;
                      const defaultEvsMap = getDefaultEvs(showDetailModal.baseStats);
                      const evVal = (showDetailModal.evs as any)?.[key] ?? (defaultEvsMap as any)[key] ?? 0;
                      const modVal = ((showDetailModal.natureModifiers ?? getDefaultNatureModifiers(showDetailModal.baseStats)) as any)?.[key] || 1.0;
                      return (
                        <div key={key} className="bg-black/25 p-3 rounded-2xl text-center">
                          <div className="text-xs text-slate-400 uppercase font-bold mb-1 flex items-center justify-center gap-1">
                            <span>{key === 'atk' ? '攻擊' : key === 'def' ? '防禦' : key === 'spatk' ? '特攻' : key === 'spdef' ? '特防' : key === 'speed' ? '速度' : '體力'}</span>
                            {key !== 'hp' && Math.abs(modVal - 1.1) < 0.01 && <span className="text-rose-400 font-bold" title="強化 1.1x">▲</span>}
                            {key !== 'hp' && Math.abs(modVal - 0.9) < 0.01 && <span className="text-cyan-400 font-bold" title="弱化 0.9x">▼</span>}
                          </div>
                          <div className="text-xl font-semibold text-emerald-300 my-0.5 tabular-nums">{calcVal}</div>
                          <div className="text-[11px] text-slate-500 leading-tight tabular-nums">種族 {baseVal}<InfoHint label={`${key === 'hp' ? '體力' : '能力值'}與學習力說明`}>學習力 {evVal}；種族值 {baseVal}。顯示的能力值已計入目前訓練與配裝，詳細演算可在下方展開。</InfoHint></div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Suspense fallback={detailPanelLoading}>
                <EvNaturePanel
                  baseStats={showDetailModal.baseStats}
                  ivs={showDetailModal.ivs}
                  evs={showDetailModal.evs}
                  natureModifiers={showDetailModal.natureModifiers}
                  inscriptions={showDetailModal.inscriptions as Inscription[]}
                  guildBonuses={showDetailModal.guildBonuses}
                  hasAnnualBonus={showDetailModal.hasAnnualBonus}
                  onEvsChange={evs => updateTraining({ evs })}
                  onNatureChange={natureModifiers => updateTraining({ natureModifiers })}
                />
                </Suspense>

                {/* Resistance Panel in Detail Modal */}
                <div className="ios-card p-3">
                  <Suspense fallback={detailPanelLoading}>
                  <ResistancePanel
                    resistances={showDetailModal.resistances}
                    readonly={!onUpdateElf}
                    onChange={(newRes) => {
                      if (onUpdateElf) {
                        const nextElf = {
                          ...showDetailModal,
                          resistances: newRes
                        };
                        setShowDetailModal(nextElf);
                        onUpdateElf(nextElf);
                      }
                    }}
                  />
                  </Suspense>
                </div>

                  </div>
                  <div className="space-y-5 min-w-0">
                {/* Soul Mark */}
                <div className="ios-card p-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 bg-blue-500/5 rounded-full -mr-4 -mt-4 blur-3xl group-hover:bg-blue-500/10 transition-all"></div>
                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm">
                      {showDetailModal.soulMark?.badgeChar || '魂'}
                    </div>
                    <div className="flex-1 flex justify-between items-start">
                      <div>
                        <h4 className="text-[15px] font-semibold text-blue-200">專屬特性:{showDetailModal.soulMark?.name || '無'}</h4>
                        
                      </div>
                      <button
                        onClick={() => handleCopyText('soulMark')}
                        className="px-2 py-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 text-[11px] font-bold rounded flex items-center gap-1 transition-all border border-blue-700/50"
                        title="複製文本"
                      >
                        {copiedSection === 'soulMark' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedSection === 'soulMark' ? '已複製' : '複製'}
                      </button>
                    </div>
                  </div>
                  {blockView && showDetailModal.soulMark ? (
                    <div className="relative z-10">
                      <Suspense fallback={detailLoading}><LazyBlockProgramView elf={showDetailModal} /></Suspense>
                    </div>
                  ) : (
                  <p className="text-left text-slate-200 text-[14px] leading-[1.75] font-sans antialiased whitespace-pre-wrap selection:bg-violet-500/40 tracking-wide relative z-10">
                    {showDetailModal.soulMark?.description?.replace(/([；;])\s*/g, '$1\n')}
                  </p>
                  )}
                </div>

                {/* Alien Traits */}
                <div className="space-y-3">
                  {showDetailModal.alienTraits?.gen2Trait && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <h4 className="text-xs font-bold text-amber-300">二代異能特質 / {showDetailModal.alienTraits.gen2Trait.name}</h4>
                      </div>
                      <EffectBlockToggle trait={showDetailModal.alienTraits.gen2Trait}><p className="text-amber-100/90 text-[14px] leading-[1.75] font-sans whitespace-pre-wrap">
                        {showDetailModal.alienTraits.gen2Trait.description.replace(/([；;])\s*/g, '$1\n')}
                      </p></EffectBlockToggle>
                    </div>
                  )}
                  {showDetailModal.alienTraits?.exclusiveTrait && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        <h4 className="text-xs font-bold text-red-300">專屬異能特質 / {showDetailModal.alienTraits.exclusiveTrait.name}</h4>
                      </div>
                      <EffectBlockToggle trait={showDetailModal.alienTraits.exclusiveTrait}><p className="text-red-100/90 text-[14px] leading-[1.75] font-sans whitespace-pre-wrap">
                        {showDetailModal.alienTraits.exclusiveTrait.description.replace(/([；;])\s*/g, '$1\n')}
                      </p></EffectBlockToggle>
                    </div>
                  )}
                  {(showDetailModal.alienTraits?.exclusiveTraits || []).map((trait) => (
                    <div key={trait.name} className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        <h4 className="text-xs font-bold text-red-300">專屬異能特質 / {trait.name}</h4>
                      </div>
                      <EffectBlockToggle trait={trait}><p className="text-red-100/90 text-[14px] leading-[1.75] font-sans whitespace-pre-wrap">
                        {trait.description.replace(/([；;])\s*/g, '$1\n')}
                      </p></EffectBlockToggle>
                    </div>
                  ))}
                  {showDetailModal.isAlienElf && (
                    <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-4 relative overflow-hidden">
                      <div className="flex flex-col gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                          <h4 className="text-[15px] font-semibold text-blue-200">一代通用特質 (異能精靈限定)</h4>
                        </div>
                        {onUpdateElf ? (
                          <select
                            value={showDetailModal.alienTraits?.alienTrait?.name || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextElf = {
                                ...showDetailModal,
                                alienTraits: {
                                  ...(showDetailModal.alienTraits || {}),
                                  alienTrait: val ? { name: val, description: ALIEN_TRAITS[val].description } : undefined
                                }
                              };
                              setShowDetailModal(nextElf);
                              onUpdateElf(nextElf);
                            }}
                            className="bg-slate-900 border border-blue-500/40 rounded px-2 py-1 text-xs text-blue-200 outline-none w-full"
                          >
                            <option value="">無 (None)</option>
                            {Object.keys(ALIEN_TRAITS).map(t => (
                              <option key={t} value={t}>{t} ({ALIEN_TRAITS[t].description})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-xs text-blue-400 font-bold">
                            【{showDetailModal.alienTraits?.alienTrait?.name || "無特質"}】
                          </div>
                        )}
                      </div>
                      {showDetailModal.alienTraits?.alienTrait && (
                        <EffectBlockToggle trait={showDetailModal.alienTraits.alienTrait}><p className="text-blue-100/90 text-[14px] leading-[1.75] font-sans whitespace-pre-wrap mt-2 pt-2 border-t border-blue-500/20">
                          {showDetailModal.alienTraits.alienTrait.description.replace(/([；;])\s*/g, '$1\n')}
                        </p></EffectBlockToggle>
                      )}
                    </div>
                  )}

                  {onUpdateElf ? (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 relative overflow-hidden">
                        <div className="flex flex-col gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <h4 className="text-[15px] font-semibold text-blue-200">通用特性</h4>
                          </div>
                          <select
                            value={showDetailModal.alienTraits?.generalTrait?.name || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextElf = {
                                ...showDetailModal,
                                alienTraits: {
                                  ...(showDetailModal.alienTraits || {}),
                                  generalTrait: val ? { name: val, description: GENERAL_TRAITS[val].description } : undefined
                                }
                              };
                              setShowDetailModal(nextElf);
                              onUpdateElf(nextElf);
                            }}
                            className="bg-slate-900 border border-blue-500/30 rounded px-2 py-1 text-xs text-blue-200 outline-none w-full"
                          >
                            <option value="">無 (None)</option>
                            {Object.keys(GENERAL_TRAITS).map(t => (
                              <option key={t} value={t}>{t} ({GENERAL_TRAITS[t].description})</option>
                            ))}
                          </select>
                        </div>
                        {showDetailModal.alienTraits?.generalTrait && (
                          <EffectBlockToggle trait={showDetailModal.alienTraits.generalTrait}><p className="text-blue-100/90 text-[14px] leading-[1.75] font-sans whitespace-pre-wrap mt-2 pt-2 border-t border-blue-500/20">
                            {showDetailModal.alienTraits.generalTrait.description.replace(/([；;])\s*/g, '$1\n')}
                          </p></EffectBlockToggle>
                        )}
                      </div>
                    ) : showDetailModal.alienTraits?.generalTrait && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          <h4 className="text-[15px] font-semibold text-blue-200">通用特性 / {showDetailModal.alienTraits.generalTrait.name} ({showDetailModal.alienTraits.generalTrait.description})</h4>
                        </div>
                        <EffectBlockToggle trait={showDetailModal.alienTraits.generalTrait}><p className="text-blue-100/90 text-[14px] leading-[1.75] font-sans whitespace-pre-wrap">
                          {showDetailModal.alienTraits.generalTrait.description.replace(/([；;])\s*/g, '$1\n')}
                        </p></EffectBlockToggle>
                      </div>
                    )}
                  </div>

                {/* Inscription System (Engravings) */}
                <div className="ios-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[15px] font-semibold text-slate-100 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-amber-400 rounded-sm inline-block"></span>
                      刻印
                    </h4>
                    <span className="text-xs text-slate-500" title="點擊刻印孔可調整並保存數值">點擊調整</span>
                  </div>
                  <div className="flex items-center justify-around gap-3 py-3 bg-[#06080E] rounded-xl border border-slate-800/80">
                    {[0, 1, 2].map((slotIdx) => (
                      <InscriptionSlot
                        key={slotIdx}
                        index={slotIdx}
                        inscription={showDetailModal.inscriptions?.[slotIdx]}
                        onClick={() => setEditingModalInscIndex(slotIdx)}
                        size="md"
                      />
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[15px] font-semibold text-slate-100 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      技能
                    </h4>
                    <div className="ios-segment" title="積木：描述轉成的效果積木（唯讀）">
                      <button data-active={!blockView} onClick={() => setBlockView(false)}>描述</button>
                      <button data-active={blockView} onClick={() => setBlockView(true)}>積木</button>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {showDetailModal.skills?.map((s, i) => {
                      const isFifth = i === 4 || s.isFifthSkill;
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-xl text-left transition-all duration-200 flex flex-col gap-2 h-auto min-h-[110px] ${
                            isFifth
                              ? "bg-gradient-to-br from-amber-950/30 via-slate-950/80 to-slate-950 border border-amber-500/40 shadow-sm shadow-amber-500/5"
                              : "bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/30"
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className={`font-bold text-[16px] flex items-center gap-1.5 ${isFifth ? "text-amber-300" : "text-sky-300"}`}>
                              {isFifth && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                              {s?.name || "無技能"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isFifth && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  第五技能
                                </span>
                              )}
                              <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                                s.category === '物理' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                s.category === '特殊' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {s.category}
                              </span>
                              <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${getAttributeBadgeColor(s.type)} inline-flex items-center gap-1`}>
                                <TypeIcon type={s.type} size={14} showLabelWhenMissing={false} />{s.type}
                              </span>
                            </div>
                          </div>
                          
                          {blockView ? <Suspense fallback={detailLoading}><LazyBlockProgramView skill={s} /></Suspense> : <p className="text-slate-200 text-[13px] leading-[1.7] font-sans antialiased whitespace-pre-wrap tracking-wide">{formatEffectText(s.description)}</p>}
                          
                          <div className="flex justify-between items-center text-xs text-slate-500 font-mono w-full border-t border-slate-900 pt-2 mt-auto">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>類型: <strong className="text-slate-300">{s.category === '物理' ? '物理攻擊' : s.category === '特殊' ? '特殊攻擊' : s.category === '屬性' ? '屬性技能' : s.category}</strong></span>
                              <span title={s.isSureHit ? "必中；固有效果失效時改用此命中率" : undefined}>命中: <strong className="text-slate-300">{s.isSureHit ? "必中・" : ""}{s.accuracy !== undefined ? `${s.accuracy}%` : '100%'}</strong></span>
                              <span>威力: <strong className="text-slate-300">{s.power}</strong></span>
                              <span>PP: <strong className="text-slate-300">{s.pp}/{s.maxPp !== undefined ? s.maxPp : s.pp}</strong>{s.isSkillStone && isStoneThrower(showDetailModal) && <strong className="text-amber-300" title="投石者：裝備的技能石 PP 上限 +10（墜星特有）"> +10</strong>}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleCopyText('skill', s)}
                                className="px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-all cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/50"
                                title="複製技能文字"
                              >
                                {copiedSection === 'skill-' + s.name ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={() => setReplacingSlotIndex(i)}
                                aria-label={`替換技能 ${s.name}`}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                                isFifth
                                  ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
                                  : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              <Shuffle className="w-3 h-3" /> 替換
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Skill Replacement Pool Modal Overlay */}
                  {createPortal(<AnimatePresence>
                    {replacingSlotIndex !== null && (
                      <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setReplacingSlotIndex(null); }}>
                        <motion.div
                          onClick={(e) => e.stopPropagation()}
                          role="dialog" aria-modal="true" aria-label="技能替換庫"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="ios-panel w-[min(860px,94vw)] rounded-3xl p-6 max-h-[88vh] flex flex-col shadow-2xl"
                        >
                          {(() => {
                            const latestElf = allElves.find(e => e && ((e.id && e.id === showDetailModal.id) || e.name === showDetailModal.name)) || showDetailModal;
                            const defMatch = DEFAULT_ELVES.find(e => e && ((e.id && e.id === showDetailModal.id) || e.name === showDetailModal.name));
                            const currentSkills = latestElf.skills && latestElf.skills.length >= 5 ? latestElf.skills : showDetailModal.skills;
                            const isFifthSlot = replacingSlotIndex === 4 || currentSkills[replacingSlotIndex]?.isFifthSkill;

                            const allKnownSkills = [
                              ...(latestElf.skillPool || []),
                              ...(latestElf.skills || []),
                              ...(showDetailModal.skillPool || []),
                              ...(showDetailModal.skills || []),
                              ...(defMatch?.skillPool || []),
                              ...(defMatch?.skills || [])
                            ];
                            const skillMap = new Map<string, any>();
                            allKnownSkills.forEach(sk => { if (sk && sk.name) skillMap.set(sk.name, sk); });
                            const availablePool = Array.from(skillMap.values()).filter(sk =>
                              isFifthSlot ? sk.isFifthSkill : !sk.isFifthSkill
                            );

                            return (
                              <>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                                  <div className="flex items-center gap-2">
                                    {isFifthSlot ? (
                                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                        <Crown className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                        <Zap className="w-4 h-4" />
                                      </div>
                                    )}
                                    <div>
                                      <h3 className={`text-lg font-bold ${isFifthSlot ? "text-amber-300" : "text-blue-400"}`}>
                                        {isFifthSlot ? "👑 第五技能獨一無二專屬替換庫" : "⚡ 普通技能替換庫"}
                                      </h3>
                                      <p className="text-sm text-slate-400">
                                        第 {replacingSlotIndex + 1} 格【{showDetailModal.skills[replacingSlotIndex]?.name}】→ 選擇新技能
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setReplacingSlotIndex(null)}
                                    aria-label="關閉技能替換庫"
                                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <p className="text-[13px] text-slate-400 mb-3">{isFifthSlot ? "第五技能僅能與第五技能互換" : "點選即替換；已裝備的技能會互換位置"}</p>

                                <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 min-h-0">
                                  {availablePool.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 text-xs">
                                      當前技能池中沒有可用的{isFifthSlot ? "其他第五技能" : "普通技能"}。
                                    </div>
                                  ) : (
                                    availablePool.map((sk, skIdx) => {
                                      const equippedIdx = showDetailModal.skills.findIndex((s, idx) => s?.name === sk?.name && idx !== replacingSlotIndex);
                                      const isEquipped = equippedIdx !== -1;
                                      const isCurrent = showDetailModal.skills[replacingSlotIndex]?.name === sk?.name;

                                      return (
                                        <div
                                          key={skIdx}
                                          onClick={() => {
                                            const nextSkills = [...showDetailModal.skills];
                                            if (isEquipped && equippedIdx !== -1) {
                                              const currentSkill = nextSkills[replacingSlotIndex];
                                              nextSkills[equippedIdx] = { ...currentSkill };
                                              nextSkills[replacingSlotIndex] = { ...sk };
                                            } else {
                                              nextSkills[replacingSlotIndex] = { ...sk };
                                            }
                                            const nextElf = { ...showDetailModal, skills: nextSkills };
                                            onUpdateElf?.(nextElf);
                                            setShowDetailModal(nextElf);

                                            // Immediately sync skill change to p1Team and p2Team
                                            const syncSkills = (team: TeamInstance[], setTeam: React.Dispatch<React.SetStateAction<TeamInstance[]>>, teamKey: "p1" | "p2") => {
                                              let changed = false;
                                              const next = team.map(inst => {
                                                if ((inst?.id === nextElf?.id || inst?.name === nextElf?.name)) {
                                                  changed = true;
                                                  return { ...inst, skills: nextSkills };
                                                }
                                                return inst;
                                              });
                                              if (changed) {
                                                setTeam(next);
                                              }
                                            };
                                            syncSkills(p1Team, setP1Team, "p1");
                                            syncSkills(p2Team, setP2Team, "p2");

                                            setReplacingSlotIndex(null);
                                          }}
                                          className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 cursor-pointer ${
                                            isCurrent
                                              ? "bg-blue-950/40 border-blue-500/50"
                                              : isEquipped
                                              ? "bg-purple-950/30 border-purple-500/50 hover:border-purple-400 hover:bg-purple-900/30"
                                              : isFifthSlot
                                              ? "bg-slate-950 border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20"
                                              : "bg-slate-950 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className={`font-bold text-[15px] flex items-center gap-2 ${isFifthSlot ? "text-amber-300" : isEquipped ? "text-purple-300" : "text-blue-400"}`}>
                                              {sk?.type && <TypeIcon type={sk.type} size={18} showLabelWhenMissing={false} />}
                                              {sk?.name || "無技能"}
                                              {isCurrent && <span className="text-[11px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">當前裝備</span>}
                                              {isEquipped && <span className="text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Shuffle className="w-2.5 h-2.5" />點擊與第 {equippedIdx + 1} 格互換</span>}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[13px] text-slate-400">
                                              <span>類型: <strong className="text-slate-300">{sk.category === '物理' ? '物理攻擊' : sk.category === '特殊' ? '特殊攻擊' : sk.category === '屬性' ? '屬性技能' : sk.category}</strong></span>
                                              <span>命中: <strong className="text-slate-300">{sk.accuracy !== undefined ? `${sk.accuracy}%` : '100%'}</strong></span>
                                              <span>威力: <strong className="text-slate-300">{sk.power}</strong></span>
                                              <span>PP: <strong className="text-slate-300">{sk.pp}/{sk.maxPp !== undefined ? sk.maxPp : sk.pp}</strong></span>
                                            </div>
                                          </div>
                                          <p className="text-[13px] text-slate-200 leading-[1.7] whitespace-pre-wrap">{formatEffectText(sk.description)}</p>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>, document.body)}
                </div>

                {/* Description */}
                {showDetailModal.description && (
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      背景設定與備註
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {showDetailModal.description}
                    </p>
                  </div>
                )}
                {/* Decomposition & Effect Reference Report in Detail Modal */}
                {showDetailModal.decompositionReport && (
                  <div className="bg-gradient-to-r from-violet-900/20 via-blue-900/20 to-cyan-900/20 border border-violet-500/30 rounded-2xl p-4 mb-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-violet-500/20 pb-2">
                      <h4 className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        AI 效果解構與規範化報告
                      </h4>
                      <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono font-bold">
                        模板化規範實裝
                      </span>
                    </div>

                    {showDetailModal.decompositionReport.decomposedTags && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-bold mr-1">解構標籤：</span>
                        {showDetailModal.decompositionReport.decomposedTags.map((tag, i) => (
                          <span key={i} className="text-xs bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-bold">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {showDetailModal.decompositionReport.referencedEffects && showDetailModal.decompositionReport.referencedEffects.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-amber-400 block">📚 引用已入庫系統效果：</span>
                        {showDetailModal.decompositionReport.referencedEffects.map((ref, i) => (
                          <div key={i} className="bg-[#050608]/80 border border-amber-500/20 rounded-lg p-2.5 text-xs">
                            <div className="flex justify-between items-center font-bold text-amber-300 mb-0.5">
                              <span>【{ref?.name}】</span>
                              <span className="text-[11px] text-slate-500">{ref.source}</span>
                            </div>
                            <p className="text-slate-300 font-mono leading-relaxed">{ref.syntax}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {showDetailModal.decompositionReport.newCatalogedEffects && showDetailModal.decompositionReport.newCatalogedEffects.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-emerald-400 block">🆕 新入庫規範化模板效果：</span>
                        {showDetailModal.decompositionReport.newCatalogedEffects.map((cat, i) => (
                          <div key={i} className="bg-[#050608]/80 border border-emerald-500/20 rounded-lg p-2.5 text-xs">
                            <div className="flex justify-between items-center font-bold text-emerald-300 mb-0.5">
                              <span>【{cat?.name}】</span>
                              <span className="text-[11px] text-slate-500">{cat.reason}</span>
                            </div>
                            <p className="text-slate-300 font-mono leading-relaxed">{cat.syntax}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {showDetailModal.decompositionReport.templateSummary && (
                      <p className="text-xs text-slate-400 bg-black/40 p-2 rounded border border-slate-800 leading-relaxed font-sans italic">
                        💡 <strong className="text-slate-300">規範化摘要：</strong>{showDetailModal.decompositionReport.templateSummary}
                      </p>
                    )}
                  </div>
                )}

                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>, document.body)}

      {editingModalInscIndex !== null && showDetailModal && (
        <Suspense fallback={
          <div role="status" className="fixed inset-0 z-[10030] bg-black/80 flex items-center justify-center text-slate-200">
            載入刻印調校…
            <button type="button" className="ml-4 ios-button" onClick={() => setEditingModalInscIndex(null)}>取消</button>
          </div>
        }>
        <InscriptionModal
          slotIndex={editingModalInscIndex}
          inscription={showDetailModal.inscriptions?.[editingModalInscIndex]}
          onSave={handleSaveModalInscription}
          onClose={() => setEditingModalInscIndex(null)}
        />
        </Suspense>
      )}

      {/* AI Analysis Modal */}
      <AnimatePresence>
        {showAnalyzeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0F1117] border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <Cpu className="w-6 h-6 text-blue-400" />
                <h3 className="text-lg font-bold text-slate-100">AI 實時解析 & 邏輯修正</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                輸入新的功能描述或 Bug 修復指令。AI 將分析文本並重新生成精靈的 JSON 戰鬥邏輯（包含專屬特性與技能）。
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">精靈文本描述 (描述您想修正或增加的效果)</label>
                  <button
                    type="button"
                    onClick={() => setIsEffectModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded text-[10px] font-bold transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3 text-violet-400" />
                    引用效果標準庫
                  </button>
                </div>
                <textarea 
                  value={analyzeText}
                  onChange={(e) => setAnalyzeText(e.target.value)}
                  className="w-full h-32 bg-[#050608] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                  placeholder="例如：請讓牠的專屬特性增加每回合回血 15% 的效果，並且將大招機率害怕改為 50%..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowAnalyzeModal(null)}
                  className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleAnalyzeElf}
                  disabled={isAnalyzing !== null}
                  className="flex-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      實時修正並實裝
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Loadout Backpack Modal */}
        {showBackpackModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0D0F17] border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      精靈負載與配裝背包系統
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                        需點擊保存
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      管理與記錄您上次出戰的精靈隊伍與預設配裝，隨時快速換裝上陣！
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBackpackModal(false)}
                  className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Section 1: Last Used Team Record */}
              <div className="bg-[#080A10] border border-amber-500/30 rounded-2xl p-4 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Bookmark className="w-4 h-4" />
                    <span>上次使用精靈紀錄 (主動保存欄位)</span>
                  </div>
                  {lastUsedRecord?.timestamp && (
                    <span className="text-[10px] text-slate-500 font-mono">保存於: {lastUsedRecord.timestamp}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  系統會保留您在此主動點擊「保存」的隊伍狀態，方便下次開啟或對戰後迅速還原！
                </p>

                {lastUsedRecord && lastUsedRecord.team?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                    {lastUsedRecord.team.map((e, idx) => (
                      <div key={`${e.id || e.name}-${idx}`} className="bg-slate-900/60 border border-slate-800 p-2 rounded-xl flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-200 truncate">{e?.name}</div>
                          <div className="text-[9px] text-slate-500">{e.battleId === lastUsedRecord.starterId ? "👑 首發出戰" : `Lv.${e.level}`}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 border border-dashed border-slate-800/80 rounded-xl text-center text-xs text-slate-600">
                    目前並無任何上次使用紀錄，請先組建隊伍後點擊右下方按鈕保存！
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={handleSaveLastUsed}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    點此保存當前陣容為上次紀錄
                  </button>
                  {lastUsedRecord && lastUsedRecord.team?.length > 0 && (
                    <button
                      onClick={() => { handleLoadLastUsed(); setShowBackpackModal(false); }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      立即載入此隊伍
                    </button>
                  )}
                </div>
              </div>

              {/* Section 2: 3 Custom Preset Slots */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  自定配裝背包預設插槽 (1 ~ 3)
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {[1, 2, 3].map((slot) => {
                    const preset = backpackPresets[slot];
                    const hasTeam = preset && preset.team && preset.team.length > 0;
                    return (
                      <div key={slot} className="bg-[#080A10] border border-slate-800 hover:border-slate-700/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-md bg-blue-950 text-blue-400 font-mono font-bold text-xs flex items-center justify-center border border-blue-500/30 shrink-0">
                              #{slot}
                            </span>
                            <span className="text-xs font-bold text-slate-200 truncate">{preset?.name || `配裝背包 #${slot}`}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${hasTeam ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 text-slate-600"}`}>
                              {hasTeam ? `已配置 ${preset.team.length} 隻` : "空插槽"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {hasTeam ? (
                              `隊伍：${preset.team.map(e => e?.name).join("、")} (首發: ${preset.team.find(e => e?.battleId === preset?.starterId)?.name || "預設"})`
                            ) : (
                              "點擊「保存當前」將目前的 Player 1 戰隊記錄到此欄位中"
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => handleSavePreset(slot)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="保存當前 P1 陣容至此背包"
                          >
                            <Save className="w-3 h-3 text-amber-400" />
                            保存
                          </button>
                          {hasTeam && (
                            <button
                              onClick={() => { handleLoadPreset(slot); setShowBackpackModal(false); }}
                              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <FolderOpen className="w-3 h-3 text-indigo-400" />
                              讀取
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowBackpackModal(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  完成並關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* P2 Loadout Backpack Modal */}
        {showBackpackModalP2 && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0D0F17] border border-rose-500/30 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      P2 精靈負載與配裝背包系統
                      <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-mono">
                        需點擊保存
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      管理與記錄 P2 出戰的精靈隊伍與預設配裝，隨時快速切換！
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBackpackModalP2(false)}
                  className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* P2 Custom Preset Slots */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  P2 自定配裝背包預設插槽 (1 ~ 3)
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {[1, 2, 3].map((slot) => {
                    const preset = backpackPresetsP2[slot];
                    const hasTeam = preset && preset.team && preset.team.length > 0;
                    return (
                      <div key={slot} className="bg-[#080A10] border border-slate-800 hover:border-slate-700/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-md bg-rose-950 text-rose-400 font-mono font-bold text-xs flex items-center justify-center border border-rose-500/30 shrink-0">
                              #{slot}
                            </span>
                            <span className="text-xs font-bold text-slate-200 truncate">{preset?.name || `P2 配裝背包 #${slot}`}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${hasTeam ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" : "bg-slate-900 text-slate-600"}`}>
                              {hasTeam ? `已配置 ${preset.team.length} 隻` : "空插槽"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {hasTeam ? (
                              `隊伍：${preset.team.map(e => e?.name).join("、")} (首發: ${preset.team.find(e => e?.battleId === preset?.starterId)?.name || "預設"})`
                            ) : (
                              "點擊「保存」將目前的 P2 戰隊記錄到此欄位中"
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => handleSavePresetP2(slot)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="保存當前 P2 陣容至此背包"
                          >
                            <Save className="w-3 h-3 text-amber-400" />
                            保存
                          </button>
                          {hasTeam && (
                            <button
                              onClick={() => { handleLoadPresetP2(slot); setShowBackpackModalP2(false); }}
                              className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <FolderOpen className="w-3 h-3 text-rose-400" />
                              讀取
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowBackpackModalP2(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  完成並關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            {/* Peak Arena BP Draft Modal Overlay (Tech Cyber Theme, Destiny Wheel Style) */}
      {bpPhase !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0813]/95 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`w-full max-w-[1400px] bg-[#0a0813] border-2 rounded-3xl p-4 md:p-6 flex flex-col max-h-[95vh] shadow-[0_0_60px_rgba(0,0,0,0.8)] ${
              bpPhase.startsWith("ban")
                ? "border-red-600/50 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                : "border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            }`}
          >
            {/* Top Action Banner Bar */}
            {(() => {
              const isBanPhase = bpPhase.startsWith("ban");

              return (
                <div className={`p-4 rounded-2xl mb-4 flex flex-col md:flex-row items-center justify-between gap-4 border shrink-0 ${
                  isBanPhase
                    ? "bg-red-950/20 border-red-500/40"
                    : "bg-cyan-950/20 border-cyan-500/40"
                }`}>
                  <div className="flex-1">
                    <h3 className={`font-black text-lg md:text-xl flex items-center gap-2 ${
                      isBanPhase ? "text-red-500" : "text-cyan-400"
                    }`}>
                      {isBanPhase ? <ShieldAlert className="w-5 h-5 text-red-500" /> : <Crown className="w-5 h-5 text-cyan-400" />}
                      {isBanPhase 
                        ? (battleMode === "PVE" ? `【${p1Title || "PLAYER 1"}】 禁選博弈 (Ban ${banCount})：請點選敵方陣容禁用精靈！` : `【雙人禁選】 禁選博弈 (Ban ${banCount})：雙方自敵方陣容點選禁用精靈！`)
                        : (battleMode === "PVE" ? `【${p1Title || "PLAYER 1"}】 陣容組建 (Pick ${pickCount})：自可用卡池挑選主力出戰，點選👑設為首發！` : `【雙人對決】 陣容組建 (Pick ${pickCount})：雙方自可用卡池挑選主力，點選👑設為首發！`)
                      }
                    </h3>
                    <p className="text-sm text-slate-300 mt-1 flex items-center gap-4 flex-wrap">
                      {isBanPhase ? (
                        <>
                          <span>P1 已選 Ban：<strong className="text-red-500 font-mono text-base ml-1">{p1BannedIds.length}</strong> / {banCount} 隻</span>
                          {battleMode === "PVP" && <span>P2 已選 Ban：<strong className="text-purple-400 font-mono text-base ml-1">{p2BannedIds.length}</strong> / {banCount} 隻</span>}
                        </>
                      ) : (
                        <>
                          <span>P1 已出戰：<strong className="text-cyan-400 font-mono text-base ml-1">{p1PickedIds.length}</strong> / {pickCount} 隻 (首發: <strong className="text-amber-400">{p1BpStarterId ? p1Team.find(e => e.battleId === p1BpStarterId)?.name : "未選擇"}</strong>)</span>
                          <span>P2 已出戰：<strong className="text-purple-400 font-mono text-base ml-1">{p2PickedIds.length}</strong> / {pickCount} 隻 (首發: <strong className="text-amber-400">{p2BpStarterId ? p2Team.find(e => e.battleId === p2BpStarterId)?.name : "未選擇"}</strong>)</span>
                        </>
                      )}
                    </p>
                  </div>
                  
                  {/* Stage Indicator Pills */}
                  <div className="flex items-center gap-2 text-xs font-semibold shrink-0 bg-[#0a0813] p-1.5 rounded-xl border border-slate-800">
                    <span className={`px-3 py-1 rounded-lg border transition-all ${
                      isBanPhase ? "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.3)]" : "bg-slate-900 border-slate-800 text-slate-600"
                    }`}>1. Ban 禁選博弈</span>
                    <span className={`px-3 py-1 rounded-lg border transition-all ${
                      !isBanPhase ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]" : "bg-slate-900 border-slate-800 text-slate-600"
                    }`}>2. Pick & Lead 挑選首發</span>
                  </div>

                  {/* Next Step Button */}
                  <button
                    onClick={() => {
                      if (isBanPhase) {
                        handleConfirmBansAndEnterPick();
                      } else {
                        handleLaunchPeakBattle();
                      }
                    }}
                    disabled={
                      isBanPhase 
                        ? (battleMode === "PVE" ? p1BannedIds.length !== banCount : (p1BannedIds.length !== banCount || p2BannedIds.length !== banCount))
                        : (p1PickedIds.length !== pickCount || !p1BpStarterId || (battleMode === "PVP" && (p2PickedIds.length !== pickCount || !p2BpStarterId)))
                    }
                    className={`px-8 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shrink-0 flex items-center gap-2 ${
                      (
                        isBanPhase 
                          ? (battleMode === "PVE" ? p1BannedIds.length === banCount : (p1BannedIds.length === banCount && p2BannedIds.length === banCount))
                          : (p1PickedIds.length === pickCount && !!p1BpStarterId && (battleMode === "PVE" || (p2PickedIds.length === pickCount && !!p2BpStarterId)))
                      )
                        ? isBanPhase
                          ? "bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] cursor-pointer"
                          : "bg-gradient-to-r from-cyan-500 via-emerald-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black shadow-[0_0_25px_rgba(34,211,238,0.6)] cursor-pointer scale-105"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    }`}
                  >
                    {isBanPhase ? "確認禁用 (進入 Pick) ❯" : "🔥 啟動巔峰聖戰 (進入對決) ❯"}
                  </button>
                </div>
              );
            })()}

            {/* 2-Column BP Interface (Wheel of Destiny Style) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pb-4 custom-scrollbar">
              {/* Left Side: P1 Pool */}
              <div className="bg-[#0a0813] border-2 border-cyan-500/40 rounded-2xl p-4 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                    <span>🎯 P1 ({p1Title || "PLAYER 1"}) 卡池</span>
                    {bpPhase.startsWith("ban") && battleMode === "PVP" && <span className="text-xs text-purple-400">P2 點擊此處禁用 P1 精靈</span>}
                    {!bpPhase.startsWith("ban") && <span className="text-xs text-slate-400">點擊卡片出戰/移出，點選👑設為首發</span>}
                  </h4>
                  <span className="text-xs font-mono bg-cyan-950/60 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/50">
                    {bpPhase.startsWith("ban") ? (battleMode === "PVE" ? `被禁: ?/${banCount}` : `被禁: ${p1Team.filter(e => p2BannedIds.includes(e.battleId)).length}/${banCount}`) : `已出戰: ${p1PickedIds.length}/${pickCount}`}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto pr-1 custom-scrollbar">
                  {p1Team.map((elf, index) => {
                    const isBanPhase = bpPhase.startsWith("ban");
                    // PVE 同步禁選：AI 對 P1 的禁用在 P1 確認前不揭曉
                    const isBanned = !(isBanPhase && battleMode === "PVE") && p2BannedIds.includes(elf.battleId);
                    const isPicked = p1PickedIds.includes(elf.battleId);
                    const isStarter = p1BpStarterId === elf.battleId;
                    
                    return (
                      <div
                        key={`${elf.battleId}-${index}`}
                        onClick={() => {
                          if (isBanPhase) {
                            if (battleMode === "PVP") {
                              if (isBanned) setP2BannedIds(prev => prev.filter(id => id !== elf.battleId));
                              else if (p2BannedIds.length < banCount) setP2BannedIds(prev => [...prev, elf.battleId]);
                            }
                          } else {
                            if (isBanned) return;
                            if (isPicked) {
                              const next = p1PickedIds.filter(id => id !== elf.battleId);
                              setP1PickedIds(next);
                              if (isStarter) setP1BpStarterId(next[0] || "");
                            } else {
                              if (p1PickedIds.length < pickCount) {
                                const next = [...p1PickedIds, elf.battleId];
                                setP1PickedIds(next);
                                if (!p1BpStarterId) setP1BpStarterId(elf.battleId);
                              }
                            }
                          }
                        }}
                        className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-102 ${
                          isBanned ? "border-red-600 bg-red-950/20 grayscale opacity-50 shadow-[0_0_15px_rgba(220,38,38,0.5)]" :
                          isStarter ? "border-amber-400 bg-amber-950/30 shadow-[0_0_20px_rgba(251,191,36,0.6)] scale-102" :
                          isPicked ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_10px_rgba(34,211,238,0.4)]" :
                          "border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600"
                        }`}
                      >
                        {/* Starter Crown Button */}
                        {!isBanPhase && !isBanned && isPicked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setP1BpStarterId(elf.battleId);
                            }}
                            title="設為首發精靈"
                            className={`absolute top-2 right-2 z-30 p-1.5 rounded-full border transition-all ${
                              isStarter
                                ? "bg-amber-500 text-slate-950 border-white font-black shadow-lg scale-110 animate-pulse"
                                : "bg-slate-900/90 text-slate-400 border-slate-600 hover:text-amber-400 hover:border-amber-400"
                            }`}
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                        )}

                        <div className="flex-1 flex items-center justify-center my-2 overflow-hidden relative">
                          <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain" />
                        </div>

                        <div className="text-center z-10">
                          <div className="text-xs font-black text-white truncate">{elf.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Lv.{elf.level} | 體{elf.calculatedStats?.hp || elf.baseStats.hp}</div>
                          {isStarter ? (
                            <span className="inline-block bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 animate-pulse shadow">
                              👑 首發出戰
                            </span>
                          ) : isPicked ? (
                            <span className="inline-block bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                              ✅ 已入戰隊
                            </span>
                          ) : null}
                        </div>

                        {isBanned && (
                          <div className="absolute inset-0 bg-red-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                            <div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-black text-lg rotate-12">
                              禁
                            </div>
                            <span className="text-[10px] font-black text-red-300 mt-1">已禁用 (BANNED)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: P2 Pool */}
              <div className="bg-[#0a0813] border-2 border-purple-500/40 rounded-2xl p-4 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-sm text-purple-300 flex items-center gap-2">
                    <span>🤖 P2 ({p2Title || "PLAYER 2"}) {battleMode === "PVE" ? "電腦陣容" : "卡池"}</span>
                    {bpPhase.startsWith("ban") && <span className="text-xs text-red-400">P1 點擊此處禁用 P2 精靈</span>}
                    {!bpPhase.startsWith("ban") && battleMode === "PVE" && <span className="text-xs text-amber-400">AI 已自動完成 6 隻挑選與首發部署</span>}
                    {!bpPhase.startsWith("ban") && battleMode === "PVP" && <span className="text-xs text-slate-400">P2 點擊卡片出戰/移出，點選👑設為首發</span>}
                  </h4>
                  <span className="text-xs font-mono bg-purple-950/60 text-purple-400 px-2 py-0.5 rounded border border-purple-800/50">
                    {bpPhase.startsWith("ban") ? `被禁: ${p2Team.filter(e => p1BannedIds.includes(e.battleId)).length}/${banCount}` : `已出戰: ${p2PickedIds.length}/${pickCount}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto pr-1 custom-scrollbar">
                  {p2Team.map((elf, index) => {
                    const isBanPhase = bpPhase.startsWith("ban");
                    const isBanned = p1BannedIds.includes(elf.battleId);
                    const isPicked = p2PickedIds.includes(elf.battleId);
                    const isStarter = p2BpStarterId === elf.battleId;
                    
                    if (!isBanPhase && battleMode === "PVE" && !isPicked) return null;

                    return (
                      <div
                        key={`${elf.battleId}-${index}`}
                        onClick={() => {
                          if (isBanPhase) {
                            if (isBanned) setP1BannedIds(prev => prev.filter(id => id !== elf.battleId));
                            else if (p1BannedIds.length < banCount) setP1BannedIds(prev => [...prev, elf.battleId]);
                          } else {
                            if (battleMode === "PVE") return;
                            if (isBanned) return;
                            if (isPicked) {
                              const next = p2PickedIds.filter(id => id !== elf.battleId);
                              setP2PickedIds(next);
                              if (isStarter) setP2BpStarterId(next[0] || "");
                            } else {
                              if (p2PickedIds.length < pickCount) {
                                const next = [...p2PickedIds, elf.battleId];
                                setP2PickedIds(next);
                                if (!p2BpStarterId) setP2BpStarterId(elf.battleId);
                              }
                            }
                          }
                        }}
                        className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-102 ${
                          isBanned ? "border-red-600 bg-red-950/20 grayscale opacity-50 shadow-[0_0_15px_rgba(220,38,38,0.5)]" :
                          isStarter ? "border-amber-400 bg-amber-950/30 shadow-[0_0_20px_rgba(251,191,36,0.6)] scale-102" :
                          isPicked ? "border-purple-400 bg-purple-950/20 shadow-[0_0_10px_rgba(168,85,247,0.4)]" :
                          "border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600"
                        }`}
                      >
                        {/* PVP Starter Crown Button */}
                        {!isBanPhase && !isBanned && battleMode === "PVP" && isPicked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setP2BpStarterId(elf.battleId);
                            }}
                            title="設為首發精靈"
                            className={`absolute top-2 right-2 z-30 p-1.5 rounded-full border transition-all ${
                              isStarter
                                ? "bg-amber-500 text-slate-950 border-white font-black shadow-lg scale-110 animate-pulse"
                                : "bg-slate-900/90 text-slate-400 border-slate-600 hover:text-amber-400 hover:border-amber-400"
                            }`}
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                        )}

                        <div className="flex-1 flex items-center justify-center my-2 overflow-hidden relative">
                          <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain scale-x-[-1]" />
                        </div>

                        <div className="text-center z-10">
                          <div className="text-xs font-black text-white truncate">{elf.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Lv.{elf.level} | 體{elf.calculatedStats?.hp || elf.baseStats.hp}</div>
                          {isStarter ? (
                            <span className="inline-block bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 animate-pulse shadow">
                              👑 首發出戰
                            </span>
                          ) : isPicked ? (
                            <span className="inline-block bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                              ✅ 已入戰隊
                            </span>
                          ) : null}
                        </div>

                        {isBanned && (
                          <div className="absolute inset-0 bg-red-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                            <div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-black text-lg rotate-12">
                              禁
                            </div>
                            <span className="text-[10px] font-black text-red-300 mt-1">已禁用 (BANNED)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setBpPhase("closed")}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-800 cursor-pointer"
              >
                取消退出
              </button>
            </div>
          </motion.div>
        </div>
      )}
 {isEffectModalOpen && <Suspense fallback={detailLoading}><EffectLibraryModal
        isOpen={isEffectModalOpen}
        onClose={() => setIsEffectModalOpen(false)}
        onSelectModule={(mod) => setAnalyzeText((prev) => prev ? prev + "\n[引用系統庫-" + mod.name + "]: " + mod.standardSyntax : mod.standardSyntax)}
      /></Suspense>}
      {showSelectionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-[#0F1117] border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-400" />
                  為 {showSelectionModal.player === "p1" ? "Player 1" : "Player 2"} 位置 #{showSelectionModal.slotIndex + 1} 選擇精靈
                </h3>
                <p className="text-xs text-slate-500 mt-1">從倉庫中選擇一隻精靈加入到此背包格子中</p>
              </div>
              <button
                onClick={() => setShowSelectionModal(null)}
                className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              {/* Modal Filter Bar */}
              <div className="space-y-3">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="名稱、ID、屬性（可用空白組合）"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#050608] border border-slate-800 focus:border-blue-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={() => setShowTypeFilter(!showTypeFilter)}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                        showTypeFilter || selectedTypes.length > 0
                          ? "bg-blue-600/10 border-blue-500/50 text-blue-400"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      屬性篩選 {selectedTypes.length > 0 && `(${selectedTypes.length})`}
                      {showTypeFilter ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {selectedTypes.length > 0 && (
                      <button
                        onClick={() => setSelectedTypes([])}
                        className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                        title="清除所有篩選"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {showTypeFilter && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl"
                  >
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTypes([])}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                          selectedTypes.length === 0
                            ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        全部
                      </button>
                      {SEER_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => toggleTypeFilter(type)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                            selectedTypes.includes(type)
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                              : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <TypeIcon type={type} size={18} showLabelWhenMissing={false} /> {type}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Modal Elf Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allElves
                  .filter(e => matchesElfQuery(e, searchQuery, selectedTypes))
                  .map((elf, index) => (
                    <button
                      key={`${elf.id}-${index}`}
                      onClick={() => {
                        const newElf = createInstance(elf);
                        if (showSelectionModal.player === "p1") {
                          const newTeam = [...p1Team];
                          newTeam[showSelectionModal.slotIndex] = newElf;
                          setP1Team(newTeam.filter(Boolean));
                          if (!p1StarterId) setP1StarterId(newElf.battleId);
                        } else {
                          const newTeam = [...p2Team];
                          newTeam[showSelectionModal.slotIndex] = newElf;
                          setP2Team(newTeam.filter(Boolean));
                          if (!p2StarterId) setP2StarterId(newElf.battleId);
                        }
                        setShowSelectionModal(null);
                      }}
                      className="group bg-[#050608] border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] flex items-center gap-4 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800 group-hover:border-blue-500/30 overflow-hidden text-slate-500 font-bold">
                        <ElfAvatar elf={elf} kind="head" className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-slate-500 font-bold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-slate-200 text-sm truncate">{elf.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${getAttributeBadgeColor(elf.type)} inline-flex items-center gap-0.5`}>
                            <TypeIcon type={elf.type} size={12} showLabelWhenMissing={false} />{elf.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1 text-[8px] text-slate-500">
                          <span>📏 {elf.height ?? 0}cm</span>
                          <span>⚖️ {elf.weight ?? 0}kg</span>
                          {getElfDestinyRank(elf) && <span className="text-cyan-400 font-bold">🎡 {getElfDestinyRank(elf)}</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate italic">{elf.soulMark.name}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/30 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                點擊任一精靈卡片以將其加入到 Player {showSelectionModal.player === "p1" ? "1" : "2"} 的第 {showSelectionModal.slotIndex + 1} 個格子。
              </span>
              <button
                onClick={() => setShowSelectionModal(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
              >
                關閉
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
