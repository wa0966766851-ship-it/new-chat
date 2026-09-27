import React, { useState, useEffect, useRef } from "react";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { getAllTestableElves, generateSkillCyclingScript } from "../tests/allElvesRunner";
import { Elf, Skill, BattleLog, BattleItem } from "../types";
import BattleScreen from "./BattleScreen";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Cpu, 
  FileText, 
  ShieldAlert, 
  Copy, 
  Check, 
  Search, 
  Sliders, 
  Activity,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types for Test Runner State
interface ElfTestResult {
  elfName: string;
  status: "idle" | "running" | "success" | "failed";
  turnsRun: number;
  logsCount: number;
  errorMessage?: string;
  skillCoverage: Record<string, {
    category: string;
    skillDmg: boolean;
    fixedDmg: boolean;
    percentDmg: boolean;
    trueDmg: boolean;
    heal: boolean;
  }>;
  sourceCodeLogs: {
    skillName: string;
    description: string;
    sourcePath: string;
    logText: string;
  }[];
}

export default function TestRunnerPage() {
  // List of all elves dynamically from DEFAULT_ELVES
  const allElves = DEFAULT_ELVES;
  
  // Selection state
  const [selectedElfIds, setSelectedElfIds] = useState<Record<string, boolean>>(() => {
    // Select all by default
    const initial: Record<string, boolean> = {};
    allElves.forEach(e => {
      initial[e.id] = true;
    });
    return initial;
  });

  // Runner configuration
  const [opponentElfId, setOpponentElfId] = useState<string>("mirror"); // "mirror" or direct id
  const [testTurns, setTestTurns] = useState<number>(12);
  const [actionDelay, setActionDelay] = useState<number>(100); // ms
  
  // Running state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentQueueIdx, setCurrentQueueIdx] = useState<number>(-1);
  const [activeTest, setActiveTest] = useState<{
    p1Elf: Elf;
    p2Elf: Elf;
    key: number;
  } | null>(null);

  // Results aggregation
  const [results, setResults] = useState<Record<string, ElfTestResult>>(() => {
    const initial: Record<string, ElfTestResult> = {};
    allElves.forEach(e => {
      initial[e.name] = {
        elfName: e.name,
        status: "idle",
        turnsRun: 0,
        logsCount: 0,
        skillCoverage: {},
        sourceCodeLogs: []
      };
    });
    return initial;
  });

  // Active view tab
  const [activeTab, setActiveTab] = useState<"overview" | "code_paths" | "coverage">("overview");
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Refs for driving and timeout guards
  const driverRef = useRef<any>(null);
  const currentTurnRef = useRef<number>(0);
  const scriptRef = useRef<number[]>([]);
  const timeoutRef = useRef<any>(null);
  const safetyTimeoutRef = useRef<any>(null);
  const skillCoverageMapRef = useRef<Record<string, any>>({});
  const battleLogsRef = useRef<BattleLog[]>([]);

  // Clone an elf
  const cloneElf = (elf: Elf): Elf => JSON.parse(JSON.stringify(elf));

  // Select All / Deselect All helpers
  const handleSelectAll = () => {
    const updated: Record<string, boolean> = {};
    allElves.forEach(e => {
      updated[e.id] = true;
    });
    setSelectedElfIds(updated);
  };

  const handleDeselectAll = () => {
    setSelectedElfIds({});
  };

  // Trigger clipboard copy with feedback
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // Format CSV helper for exports
  const exportToCSV = (type: "paths" | "coverage") => {
    let csvContent = "";
    if (type === "paths") {
      csvContent += "精靈名稱,技能/觸發點,原文描述,原始碼路徑,日誌內容\n";
      (Object.values(results) as ElfTestResult[]).forEach(res => {
        res.sourceCodeLogs.forEach(item => {
          const row = [
            `"${res.elfName.replace(/"/g, '""')}"`,
            `"${item.skillName.replace(/"/g, '""')}"`,
            `"${item.description.replace(/\n/g, ' ').replace(/"/g, '""')}"`,
            `"${item.sourcePath.replace(/"/g, '""')}"`,
            `"${item.logText.replace(/"/g, '""')}"`
          ].join(",");
          csvContent += row + "\n";
        });
      });
      copyToClipboard(csvContent, "csv_paths");
    } else {
      csvContent += "精靈名稱,技能名稱,技能類型,是否觸發技能傷害,是否觸發固定傷害,是否觸發百分比傷害,是否觸發真實傷害,是否觸發回復吸血\n";
      (Object.values(results) as ElfTestResult[]).forEach(res => {
        Object.entries(res.skillCoverage).forEach(([sName, cov]) => {
          const row = [
            `"${res.elfName.replace(/"/g, '""')}"`,
            `"${sName.replace(/"/g, '""')}"`,
            `"${cov.category}"`,
            cov.skillDmg ? "是" : "否",
            cov.fixedDmg ? "是" : "否",
            cov.percentDmg ? "是" : "否",
            cov.trueDmg ? "是" : "否",
            cov.heal ? "是" : "否"
          ].join(",");
          csvContent += row + "\n";
        });
      });
      copyToClipboard(csvContent, "csv_coverage");
    }
  };

  // Start the automated test series
  const startTesting = () => {
    if (isRunning) return;
    
    // Build queue of elf IDs that are selected
    const selectedIds = allElves.filter(e => selectedElfIds[e.id]).map(e => e.id);
    if (selectedIds.length === 0) {
      alert("請至少選擇一隻精靈進行測試！");
      return;
    }

    setQueue(selectedIds);
    setIsRunning(true);
    setCurrentQueueIdx(0);
    
    // Clear results of selected elves to 'idle' and keep others
    setResults(prev => {
      const next = { ...prev };
      allElves.forEach(e => {
        if (selectedElfIds[e.id]) {
          next[e.name] = {
            elfName: e.name,
            status: "idle",
            turnsRun: 0,
            logsCount: 0,
            skillCoverage: {},
            sourceCodeLogs: []
          };
        }
      });
      return next;
    });

    // Start first elf test
    triggerTestForElfIndex(selectedIds, 0);
  };

  // Trigger test for a specific index in the queue
  const triggerTestForElfIndex = (currentQueue: string[], index: number) => {
    if (index >= currentQueue.length) {
      // All tests completed!
      setIsRunning(false);
      setActiveTest(null);
      return;
    }

    const elfId = currentQueue[index];
    const p1ElfOriginal = allElves.find(e => e.id === elfId);
    if (!p1ElfOriginal) {
      // Skip if not found
      triggerTestForElfIndex(currentQueue, index + 1);
      return;
    }

    // Determine opponent
    let p2ElfOriginal = p1ElfOriginal; // mirror default
    if (opponentElfId !== "mirror") {
      p2ElfOriginal = allElves.find(e => e.id === opponentElfId) || p1ElfOriginal;
    }

    const p1Elf = cloneElf(p1ElfOriginal);
    const p2Elf = cloneElf(p2ElfOriginal);

    // Update result status to running
    setResults(prev => ({
      ...prev,
      [p1Elf.name]: {
        ...prev[p1Elf.name],
        status: "running"
      }
    }));

    // Generate script based on P1 skills
    const script = generateSkillCyclingScript(p1Elf.skills.length, testTurns);
    scriptRef.current = script;
    currentTurnRef.current = 0;
    skillCoverageMapRef.current = {};
    battleLogsRef.current = [];

    // Clear any previous timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    // Initialize coverage map for all skills
    p1Elf.skills.forEach(s => {
      skillCoverageMapRef.current[s.name] = {
        category: s.category,
        skillDmg: false,
        fixedDmg: false,
        percentDmg: false,
        trueDmg: false,
        heal: false
      };
    });

    // Start Safety Timeout (12 seconds per battle max, to prevent hangs)
    safetyTimeoutRef.current = setTimeout(() => {
      handleTestFinished(p1Elf.name, "failed", "測試逾時（可能發生引擎死結或未結算狀態）", currentQueue, index);
    }, 12000);

    // Trigger mount of BattleScreen
    setActiveTest({
      p1Elf,
      p2Elf,
      key: Date.now() + index
    });
  };

  // Handle completion of a single test
  const handleTestFinished = (
    elfName: string, 
    status: "success" | "failed", 
    errorMsg?: string,
    currentQueue?: string[],
    index?: number
  ) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    const activeQueue = currentQueue || queue;
    const activeIdx = index !== undefined ? index : currentQueueIdx;

    // Filter and compile sourceCode log records
    const finalLogs = battleLogsRef.current;
    const sourceLogs = finalLogs
      .filter(log => log.sourceCode)
      .map(log => {
        const parts = log.sourceCode!.split(":");
        const filePath = parts[0] || "";
        const identifier = parts[1] || "";

        // Get skill description
        const originalElf = allElves.find(e => e.name === elfName);
        const originalSkill = originalElf?.skills.find(s => s.name === identifier);
        const description = originalSkill 
          ? originalSkill.description 
          : (identifier === "soulmark" ? (originalElf?.soulMark.description || "") : "（無特殊效果）");

        return {
          skillName: identifier === "soulmark" ? "【魂印被動】" : identifier,
          description,
          sourcePath: filePath,
          logText: log.text
        };
      });

    // Save final results for this elf
    setResults(prev => ({
      ...prev,
      [elfName]: {
        ...prev[elfName],
        status,
        turnsRun: currentTurnRef.current,
        logsCount: finalLogs.length,
        errorMessage: errorMsg,
        skillCoverage: { ...skillCoverageMapRef.current },
        sourceCodeLogs: sourceLogs
      }
    }));

    // Advance queue after a brief unmount delay to allow React to clean up
    setTimeout(() => {
      const nextIdx = activeIdx + 1;
      setCurrentQueueIdx(nextIdx);
      triggerTestForElfIndex(activeQueue, nextIdx);
    }, 50);
  };

  // Stop/Pause current runs
  const stopTesting = () => {
    setIsRunning(false);
    setActiveTest(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    
    // Mark current running as idle or failed
    setResults(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k].status === "running") {
          next[k].status = "idle";
        }
      });
      return next;
    });
  };

  // Reset entire dashboard
  const resetAll = () => {
    stopTesting();
    setResults(() => {
      const initial: Record<string, ElfTestResult> = {};
      allElves.forEach(e => {
        initial[e.name] = {
          elfName: e.name,
          status: "idle",
          turnsRun: 0,
          logsCount: 0,
          skillCoverage: {},
          sourceCodeLogs: []
        };
      });
      return initial;
    });
    setCurrentQueueIdx(-1);
    setQueue([]);
  };

  // Handle reactive state changes emitted from BattleScreen
  const handleStateChange = (state: any) => {
    if (!isRunning || !state) return;

    // Save logs to ref continuously
    battleLogsRef.current = state.logs || [];

    // Track active skill damage & effect coverage from p1TurnStats
    const p1SelectedSkill = state.p1SelectedSkill;
    if (p1SelectedSkill && skillCoverageMapRef.current[p1SelectedSkill.name]) {
      const cov = skillCoverageMapRef.current[p1SelectedSkill.name];
      const stats = state.p1TurnStats;
      if (stats) {
        if (stats.skillDmg > 0) cov.skillDmg = true;
        if (stats.fixedDmg > 0) cov.fixedDmg = true;
        if (stats.percentDmg > 0) cov.percentDmg = true;
        if (stats.trueDmg > 0) cov.trueDmg = true;
        if (stats.heal > 0) cov.heal = true;
      }
    }

    // Check if battle is over
    if (state.winner || state.phase === "game_over") {
      handleTestFinished(state.p1.name, "success", undefined, queue, currentQueueIdx);
      return;
    }

    // Drive next player selection phase
    if (state.phase === "p1_select") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
        if (!isRunning || !driverRef.current) return;
        const curState = driverRef.current.getState();
        if (curState.phase !== "p1_select" || curState.winner) return;

        const p1Skills = curState.p1.skills;
        if (!p1Skills || p1Skills.length === 0) {
          handleTestFinished(curState.p1.name, "success", undefined, queue, currentQueueIdx);
          return;
        }

        const turn = currentTurnRef.current;
        if (turn >= scriptRef.current.length) {
          // Finished the scripted turn limit successfully
          handleTestFinished(curState.p1.name, "success", undefined, queue, currentQueueIdx);
          return;
        }

        // Cycle through skills
        const skillIdx = scriptRef.current[turn] % p1Skills.length;
        let skill = p1Skills[skillIdx];

        // Safe PP fallback
        if (skill.currentPp !== undefined && skill.currentPp <= 0) {
          const usableSkill = p1Skills.find(s => s.currentPp === undefined || s.currentPp > 0);
          if (usableSkill) skill = usableSkill;
        }

        // Execute selection
        currentTurnRef.current = turn + 1;
        driverRef.current.onSkillSelect("p1", skill);
      }, actionDelay);
    }

    // Drive forced switch phase
    if (state.phase === "forced_switch_p1") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        if (!isRunning || !driverRef.current) return;
        const curState = driverRef.current.getState();
        if (curState.phase !== "forced_switch_p1") return;

        const p1Team = curState.p1Team;
        const nextActiveIdx = p1Team.findIndex((elf: Elf, idx: number) => idx !== curState.p1ActiveIndex && elf.currentHp > 0);
        if (nextActiveIdx !== -1) {
          driverRef.current.onSwitchElf("p1", nextActiveIdx);
        } else {
          // No replacements left
          handleTestFinished(curState.p1.name, "success", undefined, queue, currentQueueIdx);
        }
      }, actionDelay);
    }
  };

  // Compile statistics for progress
  const totalSelected = allElves.filter(e => selectedElfIds[e.id]).length;
  const completedCount = (Object.values(results) as ElfTestResult[]).filter(r => selectedElfIds[allElves.find(e => e.name === r.elfName)?.id || ""] && (r.status === "success" || r.status === "failed")).length;
  const successCount = (Object.values(results) as ElfTestResult[]).filter(r => selectedElfIds[allElves.find(e => e.name === r.elfName)?.id || ""] && r.status === "success").length;
  const failedCount = (Object.values(results) as ElfTestResult[]).filter(r => selectedElfIds[allElves.find(e => e.name === r.elfName)?.id || ""] && r.status === "failed").length;

  const currentElfName = isRunning && queue[currentQueueIdx] 
    ? allElves.find(e => e.id === queue[currentQueueIdx])?.name 
    : "";

  // Compile all sourceCode logs for view
  const aggregatedSourceLogs: { elfName: string; skillName: string; description: string; sourcePath: string; logText: string }[] = [];
  (Object.values(results) as ElfTestResult[]).forEach(res => {
    res.sourceCodeLogs.forEach(item => {
      aggregatedSourceLogs.push({
        elfName: res.elfName,
        ...item
      });
    });
  });

  const filteredSourceLogs = aggregatedSourceLogs.filter(item => {
    const s = searchTerm.toLowerCase();
    return (
      item.elfName.toLowerCase().includes(s) ||
      item.skillName.toLowerCase().includes(s) ||
      item.logText.toLowerCase().includes(s) ||
      item.sourcePath.toLowerCase().includes(s)
    );
  });

  // Compile coverage rows for view
  const aggregatedCoverage: { elfName: string; skillName: string; category: string; skillDmg: boolean; fixedDmg: boolean; percentDmg: boolean; trueDmg: boolean; heal: boolean }[] = [];
  (Object.values(results) as ElfTestResult[]).forEach(res => {
    Object.entries(res.skillCoverage).forEach(([sName, cov]) => {
      aggregatedCoverage.push({
        elfName: res.elfName,
        skillName: sName,
        ...cov
      });
    });
  });

  const filteredCoverage = aggregatedCoverage.filter(item => {
    const s = searchTerm.toLowerCase();
    return (
      item.elfName.toLowerCase().includes(s) ||
      item.skillName.toLowerCase().includes(s) ||
      item.category.toLowerCase().includes(s)
    );
  });

  return (
    <div id="test-runner-container" className="absolute inset-0 flex flex-col overflow-y-auto bg-slate-950/90 backdrop-blur-md text-slate-100 font-sans p-4 md:p-6 pb-20 z-10">
      
      {/* Hidden Battle Engine Frame */}
      {activeTest && (
        <div className="opacity-0 pointer-events-none fixed -top-[9999px] -left-[9999px] w-1 h-1 overflow-hidden z-0">
          <BattleScreen
            key={activeTest.key}
            initialP1Team={[activeTest.p1Elf]}
            initialP2Team={[activeTest.p2Elf]}
            p1StarterId={activeTest.p1Elf.id}
            p2StarterId={activeTest.p2Elf.id}
            battleMode="PVE"
            onBackToMenu={() => {}}
            onRestartBattle={() => {}}
            onDriverInit={(d) => {
              driverRef.current = d;
            }}
            onStateChange={(s) => {
              handleStateChange(s);
            }}
          />
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-indigo-400 animate-pulse" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white font-mono">
              全精靈自動化測試引擎
            </h1>
            <span className="bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase">
              V2 Real-Drive
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            透過實際掛載 <span className="text-slate-200 underline">BattleScreen</span> 核心引擎，逐一驅動精靈執行完整技能循環。檢測程式碼路徑、記錄魂印/技能對應日誌，並即時產出傷害類型與回復效果覆蓋報告。
          </p>
        </div>
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2">
          {!isRunning ? (
            <button
              onClick={startTesting}
              disabled={totalSelected === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-lg hover:shadow-indigo-500/20 cursor-pointer transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              開始測試 ({totalSelected})
            </button>
          ) : (
            <button
              onClick={stopTesting}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-lg hover:shadow-red-500/20 cursor-pointer transition-all"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              暫停 / 停止
            </button>
          )}
          
          <button
            onClick={resetAll}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置數據
          </button>
        </div>
      </div>

      {/* Grid Layout: Controls & Live progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        
        {/* Left column: Parameters & Selections (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Params configuration */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5 font-mono">
              <Sliders className="w-4 h-4 text-slate-400" />
              測試參數配置
            </h2>
            
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-mono">對戰對手</label>
                <select
                  value={opponentElfId}
                  onChange={(e) => setOpponentElfId(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 font-mono focus:outline-none transition-colors"
                >
                  <option value="mirror">鏡像對手 (相同精靈自打)</option>
                  {allElves.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">技能循環限制</label>
                  <select
                    value={testTurns}
                    onChange={(e) => setTestTurns(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 font-mono focus:outline-none transition-colors"
                  >
                    <option value={4}>4 回合</option>
                    <option value={8}>8 回合</option>
                    <option value={12}>12 回合 (推薦)</option>
                    <option value={16}>16 回合</option>
                    <option value={20}>20 回合</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">行動間隔 (Speed)</label>
                  <select
                    value={actionDelay}
                    onChange={(e) => setActionDelay(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 font-mono focus:outline-none transition-colors"
                  >
                    <option value={10}>10ms (極速)</option>
                    <option value={50}>50ms (快速)</option>
                    <option value={100}>100ms (標準)</option>
                    <option value={250}>250ms (偏慢)</option>
                    <option value={500}>500ms (慢速)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Elves Selection List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-[250px] max-h-[450px]">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                <Activity className="w-4 h-4 text-slate-400" />
                精靈測試範圍 ({totalSelected}/{allElves.length})
              </h2>
              <div className="flex gap-2 text-[10px]">
                <button
                  onClick={handleSelectAll}
                  disabled={isRunning}
                  className="text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                >
                  全選
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={handleDeselectAll}
                  disabled={isRunning}
                  className="text-slate-400 hover:text-slate-300 disabled:opacity-40"
                >
                  清除
                </button>
              </div>
            </div>

            <div className="overflow-y-auto pr-1 space-y-1 flex-1 border border-slate-950 bg-slate-950/60 p-2 rounded-lg text-xs">
              {allElves.map(e => {
                const checked = Boolean(selectedElfIds[e.id]);
                const result = results[e.name];
                return (
                  <label
                    key={e.id}
                    className={`flex items-center justify-between p-2 rounded-md border transition-all ${
                      checked 
                        ? "bg-slate-900/80 border-slate-800 text-slate-200" 
                        : "bg-transparent border-transparent text-slate-500"
                    } ${isRunning ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:bg-slate-900/50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isRunning}
                        onChange={() => {
                          setSelectedElfIds(prev => ({
                            ...prev,
                            [e.id]: !prev[e.id]
                          }));
                        }}
                        className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 bg-slate-950"
                      />
                      <span className="font-medium">{e.name}</span>
                    </div>
                    
                    {/* Status badge */}
                    <div className="text-[10px]">
                      {result.status === "running" && (
                        <span className="text-amber-400 font-mono animate-pulse">測試中...</span>
                      )}
                      {result.status === "success" && (
                        <span className="text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          通過
                        </span>
                      )}
                      {result.status === "failed" && (
                        <span className="text-red-400 font-mono flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-red-400" />
                          異常
                        </span>
                      )}
                      {result.status === "idle" && checked && (
                        <span className="text-slate-600 font-mono">等候中</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right column: Running report & metrics (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl text-center">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-mono block">總測試範圍</span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">{totalSelected}</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl text-center">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-mono block">已測試</span>
              <span className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">
                {completedCount} <span className="text-xs text-slate-500">/ {totalSelected}</span>
              </span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl text-center border-l-2 border-l-emerald-500">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-mono block">通過案例</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">{successCount}</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl text-center border-l-2 border-l-red-500">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-mono block">異常阻斷</span>
              <span className="text-2xl font-bold font-mono text-red-400 mt-1 block">{failedCount}</span>
            </div>
          </div>

          {/* Running progress panel */}
          {isRunning && (
            <div className="bg-indigo-950/30 border border-indigo-900/60 rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span className="text-xs font-semibold text-indigo-300 font-mono">引擎即時狀態</span>
                </div>
                <span className="text-xs font-mono text-indigo-300">
                  {Math.round((completedCount / totalSelected) * 100)}%
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-2 mb-4 overflow-hidden border border-slate-800">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(completedCount / totalSelected) * 100}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/80 border border-indigo-950 p-3 rounded-lg text-xs font-mono">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span>執行進度:</span>
                  <span className="text-white font-semibold">[{completedCount + 1}/{totalSelected}]</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-indigo-300 font-bold">{currentElfName}</span>
                </div>
                <div className="text-slate-400">
                  測試時點: <span className="text-indigo-300">第 {currentTurnRef.current} 回合</span> / 共 {testTurns} 回合
                </div>
              </div>
            </div>
          )}

          {/* Detailed results tabs & table views */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl flex flex-col flex-1 min-h-[350px]">
            
            {/* Tabs & Search header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 p-4">
              <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => { setActiveTab("overview"); setSearchTerm(""); }}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  測試清單總覽
                </button>
                <button
                  onClick={() => { setActiveTab("code_paths"); setSearchTerm(""); }}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all cursor-pointer ${
                    activeTab === "code_paths"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  日誌代碼對照表
                </button>
                <button
                  onClick={() => { setActiveTab("coverage"); setSearchTerm(""); }}
                  className={`px-3 py-1.5 rounded-md font-medium text-xs transition-all cursor-pointer ${
                    activeTab === "coverage"
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  傷害效果覆蓋報告
                </button>
              </div>

              {/* Table search / actions */}
              <div className="flex items-center gap-2">
                {activeTab !== "overview" ? (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="搜尋結果..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                ) : null}

                {activeTab !== "overview" && (
                  <button
                    onClick={() => exportToCSV(activeTab === "code_paths" ? "paths" : "coverage")}
                    className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    {copiedText === `csv_${activeTab === "code_paths" ? "paths" : "coverage"}` ? "已複製 CSV！" : "匯出 CSV"}
                  </button>
                )}
              </div>
            </div>

            {/* Tab content frames */}
            <div className="flex-1 overflow-auto max-h-[500px]">
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="p-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase tracking-wider">
                        <th className="py-2 px-3">精靈名稱</th>
                        <th className="py-2 px-3">測試進度</th>
                        <th className="py-2 px-3">實測回合數</th>
                        <th className="py-2 px-3">產生事件數</th>
                        <th className="py-2 px-3">執行狀態與異常原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {allElves.map(e => {
                        const res = results[e.name];
                        const checked = selectedElfIds[e.id];
                        if (!checked) return null;
                        return (
                          <tr key={e.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-3 font-medium text-white">{e.name}</td>
                            <td className="py-3 px-3">
                              {res.status === "idle" && (
                                <span className="bg-slate-950 text-slate-500 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono">
                                  WAITING
                                </span>
                              )}
                              {res.status === "running" && (
                                <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-mono animate-pulse">
                                  RUNNING
                                </span>
                              )}
                              {res.status === "success" && (
                                <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-mono">
                                  COMPLETED
                                </span>
                              )}
                              {res.status === "failed" && (
                                <span className="bg-red-950/80 text-red-300 border border-red-800 px-2 py-0.5 rounded text-[10px] font-mono">
                                  ABORTED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400">{res.turnsRun}</td>
                            <td className="py-3 px-3 font-mono text-slate-400">{res.logsCount}</td>
                            <td className="py-3 px-3">
                              {res.status === "failed" ? (
                                <span className="text-red-400 text-[11px] font-medium block max-w-md break-all">
                                  ⚠️ {res.errorMessage || "測試失敗"}
                                </span>
                              ) : res.status === "success" ? (
                                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> 成功驅動完畢
                                </span>
                              ) : (
                                <span className="text-slate-600 font-mono">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {totalSelected === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500 font-mono">
                            無已選擇精靈。請在左側選取要執行測試的精靈範圍。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: CODE PATHS */}
              {activeTab === "code_paths" && (
                <div className="p-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase tracking-wider">
                        <th className="py-2 px-3">精靈</th>
                        <th className="py-2 px-3">技能/觸發點</th>
                        <th className="py-2 px-3 w-1/4">原文效果描述 (defaultElves.ts)</th>
                        <th className="py-2 px-3 font-mono">原始碼位置</th>
                        <th className="py-2 px-3 w-1/3">實際產生之戰鬥日誌</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredSourceLogs.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3 font-medium text-white">{item.elfName}</td>
                          <td className="py-3 px-3 font-semibold text-indigo-400">{item.skillName}</td>
                          <td className="py-3 px-3 text-slate-400 leading-relaxed whitespace-pre-wrap max-w-xs text-[11px]">
                            {item.description}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                            {item.sourcePath}
                          </td>
                          <td className="py-3 px-3 text-slate-100 font-sans leading-relaxed text-[11px]">
                            {item.logText}
                          </td>
                        </tr>
                      ))}
                      {filteredSourceLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500 font-mono">
                            {searchTerm ? "找不到符合搜尋的日誌項目" : "尚未有任何日誌記錄。請在點選「開始測試」後生成。"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: COVERAGE */}
              {activeTab === "coverage" && (
                <div className="p-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase tracking-wider">
                        <th className="py-2 px-3">精靈</th>
                        <th className="py-2 px-3">技能名稱</th>
                        <th className="py-2 px-3">屬性分類</th>
                        <th className="py-2 px-3 text-center">技能傷害</th>
                        <th className="py-2 px-3 text-center">固定傷害</th>
                        <th className="py-2 px-3 text-center">百分比傷害</th>
                        <th className="py-2 px-3 text-center">真實傷害</th>
                        <th className="py-2 px-3 text-center">恢復/吸血</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredCoverage.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3 font-medium text-white">{item.elfName}</td>
                          <td className="py-3 px-3 font-semibold text-slate-300">{item.skillName}</td>
                          <td className="py-3 px-3 text-slate-400 font-mono">{item.category}</td>
                          <td className="py-3 px-3 text-center">
                            {item.skillDmg ? (
                              <span className="inline-block bg-indigo-950 text-indigo-400 border border-indigo-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                TRIGGERED
                              </span>
                            ) : (
                              <span className="text-slate-700 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.fixedDmg ? (
                              <span className="inline-block bg-pink-950 text-pink-400 border border-pink-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                FIXED
                              </span>
                            ) : (
                              <span className="text-slate-700 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.percentDmg ? (
                              <span className="inline-block bg-amber-950 text-amber-400 border border-amber-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                PERCENT
                              </span>
                            ) : (
                              <span className="text-slate-700 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.trueDmg ? (
                              <span className="inline-block bg-red-950 text-red-400 border border-red-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                TRUE_DMG
                              </span>
                            ) : (
                              <span className="text-slate-700 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.heal ? (
                              <span className="inline-block bg-emerald-950 text-emerald-400 border border-emerald-900 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                HEAL
                              </span>
                            ) : (
                              <span className="text-slate-700 font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredCoverage.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500 font-mono">
                            {searchTerm ? "找不到符合搜尋的效果涵蓋" : "無涵蓋分析。請啟動測試，引擎在驅動時會自動解析。"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
