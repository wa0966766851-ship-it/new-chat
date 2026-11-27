import React, { useState, useEffect, lazy, Suspense } from "react";
import { MotionConfigContext } from "motion/react";
import { perfLiteActive, PERF_EVENT } from "./shell/perfMode";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Elf, BattleMode } from "./types";
import { DEFAULT_ELVES } from "./data/defaultElves";
import { applySavedSkillCorrections } from './data/savedSkillCorrections';
import { resetElfStateForBattle, setDynamicMatchups } from "./utils/statCalculator";
import {readFreeBattleSetup} from './battle/freeBattleSetup';
import { useShellMode } from "./shell/shellMode";
import { LegacyShell, ShellSwitchButton } from "./shell/LegacyShell";

import { controlScene, type ShellBridge, type AppView, type BattleFormat } from "./shell/bridge";
import { FullscreenProvider } from "./contexts/FullscreenContext";
import { GameDataProvider, useGameData } from "./contexts/GameDataContext";
import TechLoadingScreen from "./components/TechLoadingScreen";
const AegisShell = lazy(() => import('./shell/AegisShell').then(module => ({ default: module.AegisShell })));
const ControlHub = lazy(() => import('./components/ControlHub'));
const PerformanceProbe = lazy(() => import('./components/PerformanceProbe'));

/**
 * 雙殼架構（Aegis Shell）：
 *   - 這裡只負責「狀態 + 兩個殼共用的介面」，不再負責畫面。
 *   - LegacyShell / AegisShell 各自只是外框；內容一律來自 LegacyScenes。
 *   - 新功能請先登記到 src/shell/features.ts，兩殼會同時看得到。
 */

export default function App() {
  // 效能模式：精簡時 motion 元件改用減少動態（data-perf 由 perfMode 設在 <html>）。
  const [lite, setLite] = useState(() => perfLiteActive());
  useEffect(() => { const sync = () => setLite(perfLiteActive()); window.addEventListener(PERF_EVENT, sync); return () => window.removeEventListener(PERF_EVENT, sync); }, []);
  const parentMotion = React.useContext(MotionConfigContext);
  const motionConfig = React.useMemo(() => ({ ...parentMotion, reducedMotion: lite ? 'always' as const : 'user' as const }), [parentMotion, lite]);
  return (
    <MotionConfigContext.Provider value={motionConfig}>
    <GameDataProvider>
      <style>{`@keyframes appHeaderBtnIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <FullscreenProvider><AppContent /></FullscreenProvider>
    </GameDataProvider>
    </MotionConfigContext.Provider>
  );
}

function AppContent() {
  const { allElves, customElves, addCustomElf, updateElf, deleteCustomElf, restoreDeletedElves, deletedCount } = useGameData();
  const { mode: shellMode, toggle: toggleShell } = useShellMode();

  const [view, setView] = useState<AppView>("start");
  /**
   * 2026-10-29：記錄「進入 bag 之前在哪」。
   * 背包已從主導航隱藏，只能從編成（custom）或大廳（start）進入；
   * 原本返回一律回首頁，從編成進背包後按返回會跳過編成。
   */
  const previousViewRef = React.useRef<AppView>("start");
  const navigate = React.useCallback((v: AppView) => {
    setView(prev => {
      if (v !== prev) previousViewRef.current = prev;
      return v;
    });
  }, []);
  const goBackFromBag = React.useCallback(() => {
    const target = previousViewRef.current === "bag" ? "start" : previousViewRef.current;
    setView(target);
  }, []);
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  const [showHeader, setShowHeader] = useState(() =>
    typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches
  );

  const [battleKey, setBattleKey] = useState<number>(0);
  const [battleChrome, setBattleChrome] = useState<{ battle: number | null; sidebar: boolean }>({ battle: null, sidebar: false });
  const showBattleChrome = view === "battle" && battleChrome.battle === battleKey;
  useEffect(() => {
    if (view !== "battle") {
      setBattleChrome({ battle: null, sidebar: false });
      return;
    }
    const toggle = () => setBattleChrome(previous => ({
      battle: previous.battle === battleKey ? null : battleKey, sidebar: false,
    }));
    window.addEventListener('toggle-battle-shell-tools', toggle);
    return () => window.removeEventListener('toggle-battle-shell-tools', toggle);
  }, [view, battleKey]);

  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [showPerformanceProbe, setShowPerformanceProbe] = useState(false);
  useEffect(() => { const open = () => setShowPerformanceProbe(true); window.addEventListener('open-performance-probe', open); return () => window.removeEventListener('open-performance-probe', open); }, []);

  const [battleMode, setBattleMode] = useState<BattleMode>("PVE");
  const [battleFormat, setBattleFormat] = useState<BattleFormat>("normal_6v6");
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
  const [battlefieldId,setBattlefieldId]=useState<string>();
  const [interstellarOptions, setInterstellarOptions] = useState<any>(null);
  const [battleFlames, setBattleFlames] = useState<{ p1?: string; p2?: string } | null>(null);
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

  useEffect(() => {
    try {
      const storedMatchups = localStorage.getItem("seer_custom_matchups");
      if (storedMatchups) setDynamicMatchups(JSON.parse(storedMatchups));
    } catch (e) {
      console.error("讀取本地數據失敗:", e);
    }
  }, []);

  // 目錄整備集中在 GameDataProvider，新舊殼、圖鑑與介紹共用同一份資料。
  const allElvesCombined = allElves;
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
      const free=!options?.specialMode&&(!format||format==='normal_6v6'||format==='solo_1v1')?readFreeBattleSetup():undefined;
      setBattleFlames(options?.flames || free?.flames || null);
      setBattlefieldId(options?.fieldId||free?.fieldId);

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
    view, setView: navigate, goBackFromBag,
    allElves, allElvesCombined, updateElf,
    handleStartBattle, battleMode, setBattleMode, battleFormat, setBattleFormat, battleKey, restartedRef, handleRestartBattle,
    isTransitioning,
    p1Team, p2Team, p1StarterId, p2StarterId,
    p1Suit, p1Eyewear, p2Suit, p2Eyewear, p1Title, p2Title,
    hostPlayer, setHostPlayer,
    specialMode, interstellarOptions, setInterstellarOptions, battleFlames,battlefieldId,
    editingElf, setEditingElf, editorTab, setEditorTab,
    showEncyclopedia, setShowEncyclopedia,
    showPerformanceProbe, setShowPerformanceProbe,
  };

  return (
    <>
      {shellMode === "aegis" && view !== "battle"
        ? <Suspense fallback={<TechLoadingScreen />}>
            <AegisShell b={bridge} onSwitchShell={() => { if (view === "bag") setView("start"); toggleShell(); }} />
          </Suspense>
        : <LegacyShell
            b={bridge}
            showHeader={view === "battle" ? showBattleChrome && battleChrome.sidebar : showHeader}
            setShowHeader={view === "battle" ? sidebar => setBattleChrome(previous => ({ ...previous, sidebar })) : setShowHeader}
            hideSidebarTrigger={view === "battle" && !showBattleChrome}
            isCompactLayout={isCompactLayout}
          />}

      <Suspense fallback={null}>
        <ControlHub preferModern={shellMode === "aegis"} hideTriggers={view === "battle" && !showBattleChrome} currentScene={controlScene(bridge)} canApplyUpdates={view === 'start' && !editingElf && !showEncyclopedia} />
      </Suspense>

      {/* Legacy 殼的切換鈕：掛在 body，不受任何 overflow 裁切 */}
      {shellMode === "legacy" && (view !== "battle" || showBattleChrome) && (
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
