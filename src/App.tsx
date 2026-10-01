import React from "react";
import { createPortal } from "react-dom";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { Elf, BattleMode } from "./types";
import { DEFAULT_ELVES } from "./data/defaultElves";
import { SKILL_STONE_ATTRIBUTES, PERFECT_SKILL_STONE_EFFECTS, createSkillStone, isStoneThrower } from "./data/skillStones";
import { calculateElfStats, resetElfStateForBattle, setDynamicMatchups } from "./utils/statCalculator";
import { applyElfOverrides } from "./data/elfRegistry";
import StartScreen from "./components/StartScreen";
import { ElfAvatar } from "./components/SeerImages";
import { ImageCopyMenu } from "./components/ImageCopyMenu";
import { PageErrorBoundary } from "./components/PageErrorBoundary";

import TechLoadingScreen from "./components/TechLoadingScreen";
import { SiteUpdateNotice } from "./components/SiteUpdateNotice";

import ControlHub from "./components/ControlHub";
import { ThemeBackground } from "./components/ThemeController";
import { Sparkles, HelpCircle, Book, Disc, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Menu, Home, Settings, Database, Swords, TestTubes, Puzzle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { GameDataProvider, useGameData } from "./contexts/GameDataContext";
const ElfEditor = lazy(() => import("./components/ElfEditor"));
const PerformanceProbe = lazy(() => import('./components/PerformanceProbe'));
const Encyclopedia = lazy(() => import("./components/Encyclopedia"));
const DestinyWheelScreen = lazy(() => import("./components/DestinyWheelScreen"));
const TestRunnerPage = lazy(() => import("./components/TestRunnerPage"));
const BattleScreen = lazy(() => import("./components/BattleScreen"));
const InterstellarHub = lazy(() => import("./components/InterstellarExploration/InterstellarHub"));

export default function App() {
  return (
    <GameDataProvider>
      <AppContent />
    </GameDataProvider>
  );
}

function AppContent() {
  const { allElves, customElves, addCustomElf, updateElf, deleteCustomElf, restoreDeletedElves, deletedCount } = useGameData();
  const [view, setView] = useState<"start" | "custom" | "battle" | "destiny_wheel" | "interstellar_exploration" | "test_runner">("start");
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  const [showHeader, setShowHeader] = useState(() =>
    typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches
  );
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [showPerformanceProbe, setShowPerformanceProbe] = useState(false);
  useEffect(() => { const open = () => setShowPerformanceProbe(true); window.addEventListener('open-performance-probe', open); return () => window.removeEventListener('open-performance-probe', open); }, []);
  const [battleMode, setBattleMode] = useState<BattleMode>("PVE");
  const [battleFormat, setBattleFormat] = useState<"normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3">("normal_6v6");
  const [battleKey, setBattleKey] = useState<number>(0);
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
  const [interstellarOptions, setInterstellarOptions] = useState<any>(null);
  const [customSkillsMap, setCustomSkillsMap] = useState<Record<string, any>>({});
  const [customInscriptionsMap, setCustomInscriptionsMap] = useState<Record<string, any>>({});
  const [customResistancesMap, setCustomResistancesMap] = useState<Record<string, any>>({});
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

  const [deletedElfIds, setDeletedElfIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("seer_deleted_elves");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load custom matchups from localStorage on mount
  useEffect(() => {
    try {
      const storedMatchups = localStorage.getItem("seer_custom_matchups");
      if (storedMatchups) {
        setDynamicMatchups(JSON.parse(storedMatchups));
      }
    } catch (e) {
      console.error("讀取本地數據失敗:", e);
    }
  }, []);

  // Save new elf to localStorage
  const allElvesCombined = React.useMemo(() => allElves.filter((elf, index, self) => {
    if (!elf) return false;
    const key = elf.id || elf.name;
    if (deletedElfIds.includes(key) || deletedElfIds.includes(elf.name) || (elf.id && deletedElfIds.includes(elf.id))) {
      return false;
    }
    // Priority to the first appearance (which will be customElves due to spread order)
    // Correctly filter out duplicate IDs and names using findIndex
    return index === self.findIndex((t) => (t.id && elf.id && t.id === elf.id) || t.name === elf.name);
  }).map(elf => {
    const key = elf.id || elf.name;
    
    let { updated, needsRecalc } = applyElfOverrides(elf, DEFAULT_ELVES);

    // Apply custom overrides if they exist in external maps (legacy support)
    // Only apply to default elfs that haven't been fully customized/saved yet
    if (!elf.isCustom) {
      if (customSkillsMap[key]) {
        updated.skills = customSkillsMap[key];
      }
      if (customInscriptionsMap[key]) {
        updated.inscriptions = customInscriptionsMap[key];
        needsRecalc = true;
      }
      if (customResistancesMap[key]) {
        updated.resistances = customResistancesMap[key];
      }
    }
    
    if (needsRecalc) {
      const calc = calculateElfStats(updated.baseStats, updated.level || 100, updated.ivs, updated.evs,
        updated.natureModifiers, updated.inscriptions, updated.guildBonuses, updated.hasAnnualBonus);
      updated.calculatedStats = calc;
      updated.maxHp = calc.hp;
      updated.currentHp = calc.hp;
    }
    return updated;
  }), [allElves, deletedElfIds, customSkillsMap, customInscriptionsMap, customResistancesMap]);
  elvesRef.current = allElvesCombined;


  const handleStartBattle = (
    mode: BattleMode,
    team1: Elf[],
    team2: Elf[],
    starter1Id: string,
    starter2Id: string,
    suit1?: string,
    eyewear1?: string,
    suit2?: string,
    eyewear2?: string,
    title1?: string,
    title2?: string,
    format?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3",
    options?: any
  ) => {
    if (team1.length > 0 && team2.length > 0) {
      const resetTeam = (team: Elf[], suit?: string, starterId?: string) => team.map(e => resetElfStateForBattle(e, e.id === starterId || (e as any).battleId === starterId, suit));
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
      setInterstellarOptions(options?.interstellarOptions || null);
      
      setIsTransitioning(true);
      setTimeout(() => {
        setView("battle");
        setBattleKey(k => k + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleStartBattle2 = (
    mode: BattleMode,
    team1: Elf[],
    team2: Elf[],
    starter1Id: string,
    starter2Id: string,
    suit1?: string,
    eyewear1?: string,
    suit2?: string,
    eyewear2?: string,
    title1?: string,
    title2?: string,
    format?: "normal_6v6" | "solo_1v1" | "peak_6v6" | "peak_3v3",
    options?: any
  ) => {
    if (team1.length > 0 && team2.length > 0) {
      const resetTeam = (team: Elf[], suit?: string, starterId?: string) => team.map(e => resetElfStateForBattle(e, e.id === starterId || (e as any).battleId === starterId, suit));
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
      setInterstellarOptions(options?.interstellarOptions || null);
      
      setIsTransitioning(true);
      setTimeout(() => {
        setView("battle");
        setBattleKey(k => k + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  return (
    <div className="h-screen w-full flex relative bg-transparent text-slate-100 overflow-hidden" id="app-wrapper">
      <ControlHub currentScene={showEncyclopedia ? "encyclopedia" : view} />
      
      {/* Sidebar Navigation */}
      {/* 以寬度收合：內容區立即接手空間，不會留下空白 */}
      <motion.aside
        initial={false}
        animate={{ width: showHeader ? 256 : 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={`ios-sidebar z-[100] shrink-0 h-full shadow-2xl overflow-hidden ${isCompactLayout ? "fixed inset-y-0 left-0" : "relative"} ${showHeader ? "border-r" : "border-r-0"}`}
        aria-hidden={!showHeader}
      >
          <div className="w-64 h-full flex flex-col relative">
            {/* 邊緣收合把手 */}
            <div
              onClick={() => setShowHeader(false)}
              className="absolute right-0 top-0 bottom-0 w-3 cursor-pointer flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/5 transition-colors z-20"
              title="隱藏側邊欄"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </div>

            <div className="p-5 border-b border-slate-800 flex items-center justify-between pr-8">
              <button
                onClick={() => setView("start")}
                className="flex items-center gap-3 text-slate-100 hover:text-white select-none cursor-pointer font-display"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-blue-400/30 bg-blue-950/20 shrink-0" title="聖靈譜尼 · 右鍵可複製圖片">
                  <ElfAvatar elf={DEFAULT_ELVES.find(elf => elf.name === "聖靈譜尼") || DEFAULT_ELVES[0]} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-start overflow-hidden">
                  <h1 className="text-base font-bold tracking-tight text-blue-400 flex items-center whitespace-nowrap">
                    賽爾號模擬器
                  </h1>
                  <span className="text-[10px] font-normal text-slate-500 uppercase bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded mt-1">v1.0 Beta</span>
                </div>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto flex flex-col gap-2 p-4">
              <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">選單</div>
              
              <button
                onClick={() => setView("start")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left ${
                  view === "start"
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Home className="w-5 h-5" />
                首頁 / 模式
              </button>
              
              <button
                onClick={() => setView("custom")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left ${
                  view === "custom"
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Settings className="w-5 h-5" />
                精靈自定
              </button>
              
              <button
                onClick={() => setShowEncyclopedia(true)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left ${
                  showEncyclopedia
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Book className="w-5 h-5" />
                戰鬥百科
              </button>
              
              <button
                onClick={() => {
                  if (p1Team.length > 0 && p2Team.length > 0) {
                    setView("battle");
                  } else {
                    const t1 = allElves[0] ? [allElves[0]] : [];
                    const t2 = allElves[1] ? [allElves[1]] : (allElves[0] ? [allElves[0]] : []);
                    if (t1.length > 0 && t2.length > 0) {
                      handleStartBattle(battleMode, t1, t2, t1[0].id, t2[0].id);
                    }
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left ${
                  view === "battle"
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Swords className="w-5 h-5" />
                實戰演練
              </button>
              
              <button
                onClick={() => setView("test_runner")}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left pr-8 ${
                  view === "test_runner"
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner pr-8"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent pr-8"
                }`}
              >
                <TestTubes className="w-5 h-5" />
                自動測試
              </button>


            </nav>

            <div className="p-4 border-t border-slate-800 flex flex-col gap-4 pr-6">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer w-full text-left text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50 group"
              >
                <Settings className="w-5 h-5 text-blue-400 group-hover:rotate-90 transition-transform" />
                系統控制中心
              </button>

              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-medium text-xs flex items-center gap-2 bg-emerald-400/10 px-2.5 py-1.5 rounded-md border border-emerald-400/20">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  連線就緒
                </span>
                
                <button 
                  onClick={() => setShowHeader(false)}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="隱藏側邊欄"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
      </motion.aside>

      {isCompactLayout && showHeader && (
        <button
          type="button"
          aria-label="關閉側邊欄"
          onClick={() => setShowHeader(false)}
          className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-[1px]"
        />
      )}

      {!showHeader && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setShowHeader(true)}
          className="fixed top-4 left-0 z-[90] p-3 bg-slate-900/80 backdrop-blur-md border border-l-0 border-slate-700 rounded-r-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center group"
          title="展開側邊欄"
        >
          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </motion.button>
      )}

      {/* Main Content Area Wrapper */}
      <div className="flex-grow flex flex-col h-full overflow-hidden relative z-[60]">
        <SiteUpdateNotice active={view === "start" && !editingElf} />
        <main className="flex-grow flex flex-col bg-transparent relative overflow-y-auto overflow-x-hidden w-full">
          {/* 專屬渲染於一般頁面的背景圖層 */}
        <ThemeBackground currentScene={showEncyclopedia ? "encyclopedia" : view} />
        {/* Decorative Grid BG */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-15 pointer-events-none -z-10"></div>

        {isTransitioning && <TechLoadingScreen />}
        <PageErrorBoundary key={view} onBack={() => setView("start")}>
        <Suspense fallback={<TechLoadingScreen />}>

        {view === "start" && (
          <StartScreen
            hostPlayer={hostPlayer}
            onHostPlayerChange={setHostPlayer}
            onStartBattle={handleStartBattle}
            onNavigateToDestinyWheel={(mode) => {
              if (mode) setBattleMode(mode);
              setView("destiny_wheel");
            }}
            onNavigateToInterstellar={() => {
              setView("interstellar_exploration");
            }}
            onNavigateToCustom={() => {
              setEditingElf(null);
              setEditorTab(undefined);
              setView("custom");
            }}
            onEditElf={(elf) => {
              setEditingElf(elf);
              setEditorTab(undefined);
              setView("custom");
            }}
          />
        )}

        {view === "custom" && (
          <React.Fragment key={(editingElf?.id || "new") + (editorTab || "")}>
          <ElfEditor
            initialElf={editingElf || undefined}
            initialTab={editorTab}
            onSaveElf={(elf) => {
              updateElf(elf);
              setEditingElf(null);
              setView("start");
            }}
            onBack={() => setView("start")}
          />
          </React.Fragment>
        )}

        {view === "destiny_wheel" && (
          <DestinyWheelScreen
            initialBattleMode={battleMode}
            allElves={allElvesCombined}
            onStartBattle={(mode, team1, team2, starter1Id, starter2Id, s1, e1, s2, e2, t1, t2, fmt) => {
              handleStartBattle(mode || "PVE", team1, team2, starter1Id, starter2Id, s1 || "destiny_armor", e1 || "", s2 || "destiny_armor", e2 || "", t1 || "命運之神", t2 || "宿命之敵", fmt || "normal_6v6");
            }}
            onBack={() => setView("start")}
          />
        )}

        {view === "interstellar_exploration" && (
          <InterstellarHub
            allElves={allElvesCombined}
            onBack={() => setView("start")}
            onStartBattle={(p1, p2, mode, options) => {
              handleStartBattle(mode, p1, p2, p1[0]?.battleId || p1[0]?.id, p2[0]?.battleId || p2[0]?.id, options?.suit1, options?.eyewear1, options?.suit2, options?.eyewear2, options?.title1, options?.title2, options?.format);
              if (options?.interstellarOptions) {
                setInterstellarOptions(options.interstellarOptions);
              }
            }}
          />
        )}

        {view === "battle" && p1Team.length > 0 && p2Team.length > 0 && (
          <Suspense fallback={<TechLoadingScreen />}>
            <BattleScreen
              key={battleKey}
              initialP1Team={p1Team}
              initialP2Team={p2Team}
              p1StarterId={p1StarterId}
              p2StarterId={p2StarterId}
              p1Suit={p1Suit}
              p1Eyewear={p1Eyewear}
              p2Suit={p2Suit}
              p2Eyewear={p2Eyewear}
              p1Title={p1Title}
              p2Title={p2Title}
              battleMode={battleMode}
              battleFormat={battleFormat}
              hostPlayer={hostPlayer}
              onHostPlayerChange={setHostPlayer}
              interstellarOptions={interstellarOptions}
              onBackToMenu={() => {
                if (interstellarOptions) {
                  setView("interstellar_exploration");
                } else {
                  setView("start");
                }
                setInterstellarOptions(null);
              }}
              onRestartBattle={() => setBattleKey(k => k + 1)}
            />
          </Suspense>
        )}

        {view === "test_runner" && (
          <TestRunnerPage />
        )}


        </Suspense>
        </PageErrorBoundary>
        {showEncyclopedia && createPortal(<PageErrorBoundary onBack={() => setShowEncyclopedia(false)}><Suspense fallback={<TechLoadingScreen />}><Encyclopedia onClose={() => setShowEncyclopedia(false)} /></Suspense></PageErrorBoundary>, document.body)}
        <ImageCopyMenu />
        {showPerformanceProbe && <Suspense fallback={null}><PerformanceProbe onClose={() => setShowPerformanceProbe(false)} /></Suspense>}


        </main>

        {/* Bottom Bar: Stats Quick View */}
        <footer className="bg-slate-900/85 backdrop-blur-md border-t border-slate-800 py-3 sm:py-0 sm:h-10 flex flex-col sm:flex-row items-center px-4 sm:px-8 text-[10px] text-slate-400 gap-2 sm:gap-8 font-mono shrink-0 select-none relative z-10">
          <span>計算公式: [(攻擊方LV×0.4+2)×技能威力×攻擊/防禦/50+2]×修正</span>
          <span className="hidden md:inline">屬性係數: 本系修正(1.5x) / 克制係數(0.5x-4.0x)</span>
          <span className="sm:ml-auto">© 2026 AI 賽爾號對戰模擬器 - 繁體中文版</span>
        </footer>
      </div>
    </div>
  );
}
