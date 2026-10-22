import React, { useState, useEffect, lazy, Suspense } from "react";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Elf, BattleMode } from "./types";
import { DEFAULT_ELVES } from "./data/defaultElves";
import { applySavedSkillCorrections } from './data/savedSkillCorrections';
import { calculateElfStats, resetElfStateForBattle, setDynamicMatchups } from "./utils/statCalculator";
import { applyElfOverrides } from "./data/elfRegistry";
import { useShellMode } from "./shell/shellMode";
import { LegacyShell, ShellSwitchButton } from "./shell/LegacyShell";
import { AegisShell } from "./shell/AegisShell";
import type { ShellBridge, AppView, BattleFormat } from "./shell/bridge";
import { GameDataProvider, useGameData } from "./contexts/GameDataContext";
const PerformanceProbe = lazy(() => import('./components/PerformanceProbe'));

/**
 * 雙殼架構（Aegis Shell）：
 *   - 這裡只負責「狀態 + 兩個殼共用的介面」，不再負責畫面。
 *   - LegacyShell / AegisShell 各自只是外框；內容一律來自 LegacyScenes。
 *   - 新功能請先登記到 src/shell/features.ts，兩殼會同時看得到。
 */

export default function App() {
  return (
    <GameDataProvider>
      <style>{`@keyframes appHeaderBtnIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <AppContent />
    </GameDataProvider>
  );
}

function AppContent() {
  const { allElves, customElves, addCustomElf, updateElf, deleteCustomElf, restoreDeletedElves, deletedCount } = useGameData();
  const { mode: shellMode, toggle: toggleShell } = useShellMode();

  const [view, setView] = useState<AppView>("start");
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  const [showHeader, setShowHeader] = useState(() =>
    typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches
  );

  useEffect(() => {
    if (view === "battle" && typeof window !== "undefined" && (window.innerHeight <= 560 || window.innerWidth < 1100)) setShowHeader(false);
  }, [view]);

  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [showPerformanceProbe, setShowPerformanceProbe] = useState(false);
  useEffect(() => { const open = () => setShowPerformanceProbe(true); window.addEventListener('open-performance-probe', open); return () => window.removeEventListener('open-performance-probe', open); }, []);

  const [battleMode, setBattleMode] = useState<BattleMode>("PVE");
  const [battleFormat, setBattleFormat] = useState<BattleFormat>("normal_6v6");
  const [battleKey, setBattleKey] = useState<number>(0);
  const restartedRef = React.useRef(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [p1Team, setP1Team] = useState<Elf[]>([]);
  const [p2Team, setP2Team] = useState<Elf[]>([]);
  const [p1StarterId, setP1StarterId] = useState<string>("");
  const [p2StarterId, setP2StarterId] = useState<string>("");
  const [hostPlayer, setHostPlayer] = useState<"p1" | "p2">("p1");
  const [p1Suit, setP1Suit] = useState<string>("");
  const [p1Eyewear, setP1Eyewear] = useState<string>("");
  const [p2Suit, setP2Suit] = useState<string>("");
  const [p2Eyewear, setP2Eyewear] = useState<string>("");
  const [p1Title, setP1Title] = useState<string>("");
  const [p2Title, setP2Title] = useState<string>("");
  const [editingElf, setEditingElf] = useState<Elf | null>(null);
  const [specialMode, setSpecialMode] = useState<"destiny" | "interstellar" | undefined>();
  const [interstellarOptions, setInterstellarOptions] = useState<any>(null);
  const [customSkillsMap] = useState<Record<string, any>>({});
  const [customInscriptionsMap] = useState<Record<string, any>>({});
  const [customResistancesMap] = useState<Record<string, any>>({});
  const elvesRef = React.useRef<Elf[]>([]);
  const [editorTab, setEditorTab] = useState<"ai" | "manual" | "blockly" | undefined>(undefined);

  // 其他頁面要求開啟精靈編輯（例如解構報告的「用積木編輯」）
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const syncLayout = (matches: boolean) => {
      setIsCompactLayout(matches);
      if (matches) setShowHeader(false);
    };
    const onChange = (event: MediaQueryListEvent) => syncLayout(event.matches);
    syncLayout(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isCompactLayout) setShowHeader(false);
  }, [view, showEncyclopedia, isCompactLayout]);

  useEffect(() => {
    const onEditElf = (e: Event) => {
      const d = (e as CustomEvent<{ elf?: Elf; elfId?: string; tab?: "ai" | "manual" | "blockly" }>).detail;
      const elf = d?.elf || elvesRef.current.find(x => x && (x.id === d?.elfId || x.name === d?.elfId));
      if (!elf) return;
      setEditingElf(elf);
      setEditorTab(d.tab);
      setView("custom");
    };
    window.addEventListener("edit-elf", onEditElf);
    return () => window.removeEventListener("edit-elf", onEditElf);
  }, []);

  const [deletedElfIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("seer_deleted_elves");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const storedMatchups = localStorage.getItem("seer_custom_matchups");
      if (storedMatchups) setDynamicMatchups(JSON.parse(storedMatchups));
    } catch (e) {
      console.error("讀取本地數據失敗:", e);
    }
  }, []);

  const allElvesCombined = React.useMemo(() => allElves.filter((elf, index, self) => {
    if (!elf) return false;
    const key = elf.id || elf.name;
    if (deletedElfIds.includes(key) || deletedElfIds.includes(elf.name) || (elf.id && deletedElfIds.includes(elf.id))) return false;
    return index === self.findIndex((t) => (t.id && elf.id && t.id === elf.id) || t.name === elf.name);
  }).map(elf => {
    const key = elf.id || elf.name;
    let { updated, needsRecalc } = applyElfOverrides(elf, DEFAULT_ELVES);

    if (!elf.isCustom) {
      if (customSkillsMap[key]) updated.skills = customSkillsMap[key];
      if (customInscriptionsMap[key]) { updated.inscriptions = customInscriptionsMap[key]; needsRecalc = true; }
      if (customResistancesMap[key]) updated.resistances = customResistancesMap[key];
    }

    if (needsRecalc) {
      const calc = calculateElfStats(updated.baseStats, updated.level || 100, updated.ivs, updated.evs,
        updated.natureModifiers, updated.inscriptions, updated.guildBonuses, updated.hasAnnualBonus);
      updated.calculatedStats = calc;
      updated.maxHp = calc.hp;
      updated.currentHp = calc.hp;
    }
    return applySavedSkillCorrections(updated, DEFAULT_ELVES);
  }), [allElves, deletedElfIds, customSkillsMap, customInscriptionsMap, customResistancesMap]);
  elvesRef.current = allElvesCombined;

  const handleStartBattle = (
    mode: BattleMode, team1: Elf[], team2: Elf[], starter1Id: string, starter2Id: string,
    suit1?: string, eyewear1?: string, suit2?: string, eyewear2?: string,
    title1?: string, title2?: string, format?: BattleFormat, options?: any
  ) => {
    if (team1.length > 0 && team2.length > 0) {
      const resetTeam = (team: Elf[], suit?: string, starterId?: string) => team.map(saved => {
        const elf = applySavedSkillCorrections(saved, DEFAULT_ELVES);
        return options?.preparedTeams ? elf : resetElfStateForBattle(elf, elf.id === starterId || elf.battleId === starterId, suit);
      });
      setP1Team(resetTeam(team1, suit1, starter1Id));
      setP2Team(resetTeam(team2, suit2, starter2Id));
      setP1StarterId(starter1Id);
      setP2StarterId(starter2Id);
      setP1Suit(suit1 || "");
      setP1Eyewear(eyewear1 || "");
      setP2Suit(suit2 || "");
      setP2Eyewear(eyewear2 || "");
      setP1Title(title1 || "");
      setP2Title(title2 || "");
      if (format) setBattleFormat(format);
      setBattleMode(mode);
      setSpecialMode(options?.specialMode);
      setInterstellarOptions(options?.interstellarOptions || null);

      restartedRef.current = false;
      setIsTransitioning(true);
      setTimeout(() => {
        setView("battle");
        setBattleKey(k => k + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleRestartBattle = () => setBattleKey(k => k + 1);

  const bridge: ShellBridge = {
    view, setView,
    allElves, allElvesCombined, updateElf,
    handleStartBattle, battleMode, setBattleMode, battleFormat, setBattleFormat, battleKey, restartedRef, handleRestartBattle,
    isTransitioning,
    p1Team, p2Team, p1StarterId, p2StarterId,
    p1Suit, p1Eyewear, p2Suit, p2Eyewear, p1Title, p2Title,
    hostPlayer, setHostPlayer,
    specialMode, interstellarOptions, setInterstellarOptions,
    editingElf, setEditingElf, editorTab, setEditorTab,
    showEncyclopedia, setShowEncyclopedia,
    showPerformanceProbe, setShowPerformanceProbe,
  };

  return (
    <>
      {shellMode === "aegis" && view !== "battle"
        ? <AegisShell b={bridge} onSwitchShell={toggleShell} />
        : <LegacyShell
            b={bridge}
            showHeader={showHeader}
            setShowHeader={setShowHeader}
            isCompactLayout={isCompactLayout}
          />}

      {/* Legacy 殼的切換鈕：掛在 body，不受任何 overflow 裁切 */}
      {shellMode === "legacy" && (
        <ShellSwitchButton onClick={toggleShell} target="aegis" />
      )}
      {showPerformanceProbe && (
        <Suspense fallback={null}>
          <PerformanceProbe onClose={() => setShowPerformanceProbe(false)} />
        </Suspense>
      )}
    </>
  );
}
