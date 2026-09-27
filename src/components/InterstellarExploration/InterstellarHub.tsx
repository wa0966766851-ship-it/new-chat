import React, { useState, useEffect, useMemo } from "react";
import { Elf } from "../../types";
import { Rocket, Lock, ArrowLeft, Play, Shield, Diamond, Zap, RefreshCw, Info, Check, AlertTriangle, HelpCircle, Trophy, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import InterstellarRun from "./InterstellarRun";
import { SUIT_CATALOG } from "../../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../../data/titles";
import { DIFFICULTY_MODIFIERS } from "../../data/interstellarData";

interface InterstellarHubProps {
  allElves: Elf[];
  onBack: () => void;
  onStartBattle: (p1: Elf[], p2: Elf[], mode: any, options?: any) => void;
}

type MenuState = "mode_select" | "basic_setup" | "in_run";

export default function InterstellarHub({ allElves, onBack, onStartBattle }: InterstellarHubProps) {
  const [menuState, setMenuState] = useState<MenuState>("mode_select");
  const [hasActiveRun, setHasActiveRun] = useState(false);

  useEffect(() => {
    const active = localStorage.getItem("INTERSTELLAR_ACTIVE_RUN");
    setHasActiveRun(!!active);
  }, [menuState]);

  // Meta-progression states (loaded from localStorage)
  const [metaData, setMetaData] = useState(() => {
    const saved = localStorage.getItem("INTERSTELLAR_META");
    if (saved) return JSON.parse(saved);
    return { exp: 0, level: 1, lastLayerReached: 0, unlockedEquips: ["morning_star", "zhandou_aihaozhe"] };
  });

  const baseDiamonds = 3;
  const bonusDiamonds = metaData.lastLayerReached >= 3 ? 2 : 0;
  const startingDiamonds = baseDiamonds + bonusDiamonds;

  // Save meta data whenever it changes
  useEffect(() => {
    localStorage.setItem("INTERSTELLAR_META", JSON.stringify(metaData));
  }, [metaData]);

  // Equipment Selection for basic setup
  const [selectedEquipType, setSelectedEquipType] = useState<"suit" | "title">("suit");
  const [selectedEquipId, setSelectedEquipId] = useState<string>("morning_star");
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  const handleAbandonRun = () => {
    localStorage.removeItem("INTERSTELLAR_ACTIVE_RUN");
    localStorage.removeItem("interstellar_run_data");
    setHasActiveRun(false);
    setShowAbandonConfirm(false);
    setMenuState("basic_setup");
  };

  const availableSuits = useMemo(() => Object.values(SUIT_CATALOG).map(s => ({
    id: s.id,
    name: s.name,
    desc: s.description,
    locked: false // All unlocked as requested
  })), []);

  const availableTitles = useMemo(() => Object.values(TITLE_CATALOG).map(t => ({
    id: t.id,
    name: t.name,
    desc: t.description,
    locked: false // All unlocked as requested
  })), []);

  const scoreMultiplier = useMemo(() => {
    return selectedModifiers.reduce((acc, id) => {
      const mod = DIFFICULTY_MODIFIERS.find(m => m.id === id);
      return acc + (mod?.scoreMult || 0);
    }, 1).toFixed(2);
  }, [selectedModifiers]);

  const toggleModifier = (id: string) => {
    setSelectedModifiers(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleStartBasicRun = () => {
    if (!hasActiveRun) {
      localStorage.removeItem("INTERSTELLAR_ACTIVE_RUN");
    }
    setMenuState("in_run");
  };

  const handleRunEnd = (finalLayer: number, earnedExp: number) => {
    localStorage.removeItem("INTERSTELLAR_ACTIVE_RUN");
    setMetaData((prev: any) => ({
      ...prev,
      exp: prev.exp + earnedExp,
      level: Math.floor((prev.exp + earnedExp) / 1000) + 1,
      lastLayerReached: finalLayer
    }));
    setMenuState("mode_select");
  };

  if (menuState === "in_run") {
    return (
        <InterstellarRun
          allElves={allElves}
          startingDiamonds={startingDiamonds}
          initialEquipType={selectedEquipType}
          initialEquipId={selectedEquipId}
          selectedModifiers={selectedModifiers}
          onEndRun={(layer, exp) => handleRunEnd(layer, exp)}
          onStartBattle={onStartBattle}
        />
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-6 sm:p-12 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <button 
          onClick={menuState === "mode_select" ? onBack : () => setMenuState("mode_select")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 cursor-pointer w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          {menuState === "mode_select" ? "返回首頁" : "返回模式選擇"}
        </button>

        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 flex items-center gap-3">
              <Rocket className="w-10 h-10 text-blue-500" />
              星際探索 <span className="text-lg text-blue-500 font-normal">Roguelike Mode</span>
            </h1>
            <p className="text-slate-400 mt-2">
              帶領你的精靈小隊，在無盡的星際旅途中收集資源、招募強者、擊敗強敵！
            </p>
          </div>
          <button 
            onClick={() => setShowInstructions(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl border border-white/5 flex items-center gap-2 transition-all"
          >
            <HelpCircle className="w-4 h-4" /> 遊戲說明
          </button>
        </header>

        <AnimatePresence>
          {showInstructions && (
            <motion.div 
              key="instructions_backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh]"
              >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    <Info className="w-6 h-6 text-blue-500" /> 星際探索規則說明
                  </h3>
                  <button onClick={() => setShowInstructions(false)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                  <section>
                    <h4 className="text-blue-400 font-black mb-3 flex items-center gap-2 uppercase tracking-wider text-xs">
                      <Zap className="w-4 h-4" /> 核心機制 / Core Mechanics
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-300 font-medium">
                      這是一個隨機生成的探索模式。每一層地圖都有多個節點，你需要規劃航線前往最終 Boss。移動會消耗「燃料」，燃料耗盡則無法前進。
                    </p>
                  </section>
                  <section>
                    <h4 className="text-blue-400 font-black mb-3 flex items-center gap-2 uppercase tracking-wider text-xs">
                      <Shield className="w-4 h-4" /> 裝備與收藏品 / Gear & Artifacts
                    </h4>
                    <ul className="text-sm space-y-3">
                      <li className="flex gap-3">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                        <p><strong className="text-white">戰術套裝</strong>：開局選擇，提供全局核心增益。目前所有裝備均已解鎖供您體驗。</p>
                      </li>
                      <li className="flex gap-3">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                        <p><strong className="text-white">特種裝備 (收藏品)</strong>：在探索過程中獲得，效果可無限疊加，提升全隊戰鬥力。</p>
                      </li>
                    </ul>
                  </section>
                  <section>
                    <h4 className="text-blue-400 font-black mb-3 flex items-center gap-2 uppercase tracking-wider text-xs">
                      <Diamond className="w-4 h-4" /> 招募精靈 / Recruitment
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-300 font-medium">
                      你可以使用「鑽石」招募高等級精靈（S/SS級）。初始鑽石有限，請謹慎選擇招募時機。招募後的精靈將進入你的探索背包。
                    </p>
                  </section>
                </div>
                <div className="p-8 bg-slate-950/50 border-t border-white/5">
                  <button 
                    onClick={() => setShowInstructions(false)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-600/20"
                  >
                    我明白了
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showAbandonConfirm && (
            <motion.div 
              key="abandon_backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-slate-900 border border-rose-500/20 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl p-8 text-center"
              >
                <div className="w-20 h-20 bg-rose-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10 text-rose-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">確定要終止任務？</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium">
                  終止任務將會永久丟失目前所有的探索資源、進度以及在旅途中招募的精靈夥伴。<br/>此操作不可撤銷。
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleAbandonRun}
                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-rose-600/20"
                  >
                    確定終止並清除紀錄
                  </button>
                  <button 
                    onClick={() => setShowAbandonConfirm(false)}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all border border-white/5"
                  >
                    返回繼續探索
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {menuState === "mode_select" ? (
            <motion.div 
              key="mode_select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              {/* Meta Progress Indicator */}
              <div className="p-6 bg-slate-900 border border-white/5 rounded-3xl flex items-center gap-6 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-blue-600/30">
                  {metaData.level}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pilot Certification</span>
                      <div className="text-lg font-black text-white">精英探險家</div>
                    </div>
                    <span className="text-xs font-bold text-blue-400">{metaData.exp % 1000} / 1000 EXP</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${(metaData.exp % 1000) / 10}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Mode */}
                <div 
                  onClick={() => {
                    if (hasActiveRun) {
                      setMenuState("in_run");
                    } else {
                      setMenuState("basic_setup");
                    }
                  }}
                  className="group relative bg-slate-900/60 border border-blue-500/30 rounded-2xl p-8 hover:bg-blue-900/20 hover:border-blue-500/60 transition-all cursor-pointer overflow-hidden flex flex-col"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Rocket className="w-32 h-32 text-blue-400 transform rotate-12" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2 relative z-10">
                    {hasActiveRun ? "繼續上次探索" : "基礎模式"}
                    <span className="text-xs font-normal px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                      {hasActiveRun ? "進行中" : "可遊玩"}
                    </span>
                  </h2>
                  <p className="text-slate-400 text-sm mb-6 relative z-10 flex-grow">
                    {hasActiveRun 
                      ? "檢測到正在進行中的星際任務，點擊立即返回航道繼續挑戰。" 
                      : "標準的星際探索流程。體驗招募、遭遇事件、佔領星球以及挑戰每一層的守護者Boss。適合熟悉機制的玩家。"}
                  </p>
                  <div className="flex items-center text-blue-400 font-bold text-sm mt-auto relative z-10 group-hover:translate-x-2 transition-transform">
                    {hasActiveRun ? "返回任務" : "前往配置"} <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                  </div>
                </div>

                {hasActiveRun && (
                  <button 
                    onClick={() => setShowAbandonConfirm(true)}
                    className="group relative bg-slate-950/40 border border-rose-500/30 rounded-2xl p-8 hover:bg-rose-900/10 hover:border-rose-500/50 transition-all cursor-pointer flex flex-col justify-center items-center gap-2"
                  >
                    <div className="text-rose-400 font-bold flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                      放棄進度並重新開始
                    </div>
                    <p className="text-[10px] text-rose-500/60 uppercase tracking-widest font-black">Abandon Mission</p>
                  </button>
                )}

                {/* Advanced Mode (Locked) */}
                <div className="relative bg-slate-950/80 border border-slate-800 rounded-2xl p-8 opacity-70 cursor-not-allowed flex flex-col">
                  <div className="absolute inset-0 bg-slate-950/40 rounded-2xl z-10 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="flex flex-col items-center text-slate-500 bg-slate-900/90 px-6 py-4 rounded-xl border border-slate-700 shadow-xl">
                      <Lock className="w-8 h-8 mb-2" />
                      <span className="font-bold">尚未解鎖</span>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Shield className="w-32 h-32 text-purple-400 transform -rotate-12" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-300 mb-2 flex items-center gap-2">
                    進階模式
                  </h2>
                  <p className="text-slate-500 text-sm mb-6 flex-grow">
                    更高難度的挑戰，更複雜的隨機事件與強大的隱藏敵人。需要通關基礎模式後解鎖。
                  </p>
                </div>
              </div>
            </motion.div>
          ) : menuState === "basic_setup" ? (
            <motion.div 
              key="basic_setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-slate-900 border border-white/10 rounded-[40px] p-8 sm:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                <Play className="w-5 h-5 text-blue-400" /> 出發前配置
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Left Col: Resources & Modifiers */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-slate-300 font-bold mb-3 flex items-center gap-2">
                      <Diamond className="w-4 h-4 text-cyan-400" /> 初始資源預覽
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-cyan-950 rounded-lg flex items-center justify-center border border-cyan-800 text-cyan-400">
                            <Diamond className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-200">初始鑽石</div>
                            <div className="text-[11px] text-slate-500">可用於招募</div>
                          </div>
                        </div>
                        <div className="text-xl font-black text-cyan-400">
                          {startingDiamonds}
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-950 rounded-lg flex items-center justify-center border border-orange-800 text-orange-400">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-200">初始燃料</div>
                            <div className="text-[11px] text-slate-500">消耗移動</div>
                          </div>
                        </div>
                        <div className="text-xl font-black text-orange-400">10</div>
                      </div>
                    </div>
                  </div>

                  {/* Difficulty Modifiers (The Wheels of Fate style) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-slate-300 font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" /> 難度負面詞條
                      </h3>
                      <div className="text-xs font-bold text-rose-400 px-2 py-1 bg-rose-500/10 border border-rose-500/20 rounded">
                        經驗倍率: x{scoreMultiplier}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {DIFFICULTY_MODIFIERS.map(mod => (
                        <div 
                          key={mod.id}
                          onClick={() => toggleModifier(mod.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                            selectedModifiers.includes(mod.id)
                              ? "bg-rose-950/20 border-rose-500/50"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${selectedModifiers.includes(mod.id) ? "text-rose-400" : "text-slate-300"}`}>
                              {mod.name}
                            </span>
                            <span className="text-[10px] text-slate-500">{mod.description}</span>
                          </div>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            selectedModifiers.includes(mod.id) 
                              ? "bg-rose-600 border-rose-500" 
                              : "bg-slate-900 border-slate-700 group-hover:border-slate-500"
                          }`}>
                            {selectedModifiers.includes(mod.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Col: Tactical Equipment */}
                <div>
                  <h3 className="text-slate-300 font-bold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" /> 選擇初始戰術裝備
                  </h3>
                  
                  {/* Toggle between Suits and Titles */}
                  <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 mb-6">
                    <button 
                      onClick={() => { setSelectedEquipType("suit"); setSelectedEquipId("morning_star"); }}
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${selectedEquipType === "suit" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      特殊套裝
                    </button>
                    <button 
                      onClick={() => { setSelectedEquipType("title"); setSelectedEquipId("zhandou_aihaozhe"); }}
                      className={`flex-1 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${selectedEquipType === "title" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      能力稱號
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-3 custom-scrollbar">
                    {(selectedEquipType === "suit" ? availableSuits : availableTitles).map((eq) => (
                      <div 
                        key={eq.id}
                        onClick={() => !eq.locked && setSelectedEquipId(eq.id)}
                        className={`p-4 rounded-2xl border relative transition-all group ${
                          eq.locked 
                            ? "bg-slate-950/50 border-slate-800 opacity-60 cursor-not-allowed" 
                            : selectedEquipId === eq.id
                              ? "bg-blue-600/10 border-blue-500/50 cursor-pointer shadow-xl"
                              : "bg-slate-950/80 border-white/5 hover:border-white/20 cursor-pointer"
                        }`}
                      >
                        {eq.locked && (
                          <div className="absolute inset-0 bg-slate-950/40 rounded-2xl flex items-center justify-center backdrop-blur-[2px] z-10">
                            <Lock className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedEquipId === eq.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                              {selectedEquipType === "suit" ? <Shield className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                            </div>
                            <span className={`font-black text-sm tracking-tight ${selectedEquipId === eq.id && !eq.locked ? 'text-blue-400' : 'text-slate-300'}`}>
                              {eq.name}
                            </span>
                          </div>
                          {selectedEquipId === eq.id && !eq.locked && (
                            <motion.div layoutId="check" className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400/80 leading-relaxed font-medium pl-11">{eq.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  onClick={handleStartBasicRun}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                >
                  <Rocket className="w-5 h-5" />
                  發射啟航
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
