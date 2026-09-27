// src/components/GoldenTestModal.tsx
import React, { useState } from "react";
import { X, Check, AlertTriangle, Play, RefreshCw, Terminal, Download, ShieldCheck, FileText } from "lucide-react";
import { GOLDEN_SCENARIOS, GoldenScenario } from "../tests/goldenScenarios";

interface GoldenTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAutoRun: (mode: "record" | "verify") => void;
  isRunning: boolean;
  currentScenarioIndex: number;
  testResults: Record<string, { passed: boolean; diff?: string; logs: string[] }>;
  onDownloadSnapshots?: () => void;
}

export default function GoldenTestModal({
  isOpen,
  onClose,
  onStartAutoRun,
  isRunning,
  currentScenarioIndex,
  testResults,
  onDownloadSnapshots,
}: GoldenTestModalProps) {
  const [selectedTab, setSelectedTab] = useState<"status" | "logs">("status");
  const [activeScenarioId, setActiveScenarioId] = useState<string>(GOLDEN_SCENARIOS[0].id);

  if (!isOpen) return null;

  const passedCount = Object.values(testResults).filter((r) => r.passed).length;
  const totalCount = GOLDEN_SCENARIOS.length;
  const isAllCompleted = Object.keys(testResults).length === totalCount;
  const isAllPassed = isAllCompleted && passedCount === totalCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#0F1117] border-2 border-emerald-500/60 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.3)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-950/40 border-b border-emerald-500/30">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 animate-pulse" />
            <div>
              <h2 className="text-lg font-black text-emerald-300 font-display tracking-wide">
                🧪 安全重構施工防禦網：黃金對戰快照驗收系統
              </h2>
              <p className="text-xs text-emerald-400/80">
                嚴格保證重構期間「零遊戲邏輯風險」與「一個像素都不改變既有對戰行為」
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#161922] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onStartAutoRun("verify")}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all ${
                isRunning
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer shadow-emerald-900/40"
              }`}
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? `正在執行測試 (${currentScenarioIndex + 1}/${totalCount})...` : "▶ 一鍵執行黃金快照驗收 (Verify)"}
            </button>

            <button
              onClick={() => onStartAutoRun("record")}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                isRunning
                  ? "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed"
                  : "bg-amber-500/10 border-amber-500/40 hover:border-amber-500/80 text-amber-300 cursor-pointer"
              }`}
            >
              🔴 錄製基準快照 (Dump Record)
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isAllCompleted && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${
                  isAllPassed
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                    : "bg-rose-500/20 border-rose-500 text-rose-300"
                }`}
              >
                {isAllPassed ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {isAllPassed ? "🟢 5/5 全部場景通過 - 零迴歸完美驗收！" : `🔴 發現差異 (${passedCount}/${totalCount} 通過)`}
              </span>
            )}

            {onDownloadSnapshots && (
              <button
                onClick={onDownloadSnapshots}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all"
                title="下載當前測試結果為 golden.json"
              >
                <Download className="w-3.5 h-3.5" />
                下載 JSON 快照
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Scenarios List */}
          <div className="w-80 border-r border-slate-800 bg-[#0A0C10] flex flex-col overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-800/80 font-bold text-xs text-slate-400 tracking-wider">
              測試場景列表 (5 大高複雜度基準)
            </div>
            {GOLDEN_SCENARIOS.map((sc, idx) => {
              const res = testResults[sc.id];
              const isCurrent = isRunning && currentScenarioIndex === idx;
              const isSelected = activeScenarioId === sc.id;

              return (
                <div
                  key={sc.id}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`p-3.5 border-b border-slate-800/50 cursor-pointer transition-all flex items-start justify-between ${
                    isSelected ? "bg-slate-800/60 border-l-4 border-l-emerald-500" : "hover:bg-slate-900/60"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-500">#{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-200">{sc.name.split(" ")[0]}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {sc.p1ElfName.split(" ")[sc.p1ElfName.split(" ").length - 1]} vs{" "}
                      {sc.p2ElfName.split(" ")[sc.p2ElfName.split(" ").length - 1]}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Seed: {sc.seed} | Turns: {sc.maxTurns}</div>
                  </div>

                  <div className="pt-1">
                    {isCurrent ? (
                      <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                    ) : res ? (
                      res.passed ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          <Check className="w-3 h-3" /> PASS
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" /> FAIL
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-600 font-mono">WAITING</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Side: Scenario Detail & Diff Viewer */}
          <div className="flex-1 flex flex-col bg-[#0D0F14] overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center border-b border-slate-800 bg-[#12141C] px-4">
              <button
                onClick={() => setSelectedTab("status")}
                className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                  selectedTab === "status"
                    ? "border-emerald-500 text-emerald-300 bg-slate-800/30"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                對比結果與摘要
              </button>
              <button
                onClick={() => setSelectedTab("logs")}
                className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                  selectedTab === "logs"
                    ? "border-emerald-500 text-emerald-300 bg-slate-800/30"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                完整對戰日誌 Dump ({testResults[activeScenarioId]?.logs.length || 0} 條)
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-slate-300">
              {(() => {
                const sc = GOLDEN_SCENARIOS.find((s) => s.id === activeScenarioId);
                const res = testResults[activeScenarioId];

                if (!sc) return <div>找不到場景</div>;

                if (selectedTab === "status") {
                  return (
                    <div className="space-y-6">
                      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
                        <h3 className="text-sm font-bold text-slate-200 font-sans flex items-center gap-2">
                          📌 場景規格: {sc.name}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-slate-400 text-xs">
                          <div><span className="text-slate-500 font-sans">P1 精靈：</span>{sc.p1ElfName}</div>
                          <div><span className="text-slate-500 font-sans">P2 精靈：</span>{sc.p2ElfName}</div>
                          <div><span className="text-slate-500 font-sans">隨機種子：</span><span className="text-amber-400 font-bold">{sc.seed}</span></div>
                          <div><span className="text-slate-500 font-sans">執行回合：</span>{sc.maxTurns} 回合</div>
                        </div>
                      </div>

                      {res ? (
                        res.passed ? (
                          <div className="bg-emerald-950/30 border-2 border-emerald-500/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                              <Check className="w-8 h-8" />
                            </div>
                            <h4 className="text-base font-bold text-emerald-300 font-sans">
                              測試通過 (Zero-Regression Passed)
                            </h4>
                            <p className="text-xs text-emerald-400/80 max-w-md font-sans">
                              目前的戰鬥引擎輸出日誌與黃金基準快照 100% 逐字元一致。這證實當前的重構改動沒有影響到任何技能機制、數值計算或效果觸發順序。
                            </p>
                          </div>
                        ) : (
                          <div className="bg-rose-950/30 border-2 border-rose-500/50 p-6 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 text-rose-400 font-bold font-sans text-sm">
                              <AlertTriangle className="w-5 h-5" />
                              發現不一致！(Regression Detected)
                            </div>
                            <div className="bg-black/60 p-4 rounded-xl border border-rose-500/30 overflow-x-auto">
                              <div className="text-rose-300 font-bold mb-2 font-sans">第一個文字差異點描述：</div>
                              <pre className="text-rose-400 text-[11px] whitespace-pre-wrap leading-relaxed">
                                {res.diff || "日誌內容長度或文字發生改變"}
                              </pre>
                            </div>
                            <p className="text-xs text-rose-400/80 font-sans">
                              ⚠️ 提示：請檢查最近修改的狀態代碼或閉包引用。如果不確定，可以使用「完整對戰日誌 Dump」標籤分頁進行人工核對。
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                          <Play className="w-8 h-8 text-slate-600 animate-pulse" />
                          <p className="text-xs text-slate-500 font-sans">
                            點擊上方「▶ 一鍵執行黃金快照驗收」來啟動自動測試套件。
                          </p>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div className="space-y-3">
                      <div className="text-slate-400 text-xs font-sans">
                        以下為當前場景執行完畢後 dump 出來的完整 combat log 陣列 ({res?.logs.length || 0} 條日誌)：
                      </div>
                      {res && res.logs.length > 0 ? (
                        <div className="bg-black/80 p-4 rounded-xl border border-slate-800 space-y-1.5 max-h-[480px] overflow-y-auto">
                          {res.logs.map((lg, i) => (
                            <div key={i} className="text-[11px] leading-relaxed border-b border-slate-900/80 pb-1 font-mono text-slate-300">
                              <span className="text-slate-600 mr-2">[{i + 1}]</span>
                              {lg}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-slate-600 text-center py-12">尚未生成日誌，請先執行測試</div>
                      )}
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
