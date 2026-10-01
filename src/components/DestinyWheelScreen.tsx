import React, { useState, useEffect } from "react";
import { ElfAvatar, TypeIcon } from "./SeerImages";
import { Elf, BattleMode } from "../types";
import { DestinyElfInstance, perform12Pull, simulateAiBan, simulateAiPick } from "../utils/destinyGacha";
import { motion, AnimatePresence } from "motion/react";
import DestinyIntroRuleTable from "./DestinyIntroRuleTable";
import { Sparkles, Shield, Swords, AlertCircle, RefreshCw, CheckCircle2, XCircle, ChevronRight, Crown, Zap, Flame, Trophy, HelpCircle, ArrowLeft, RotateCcw } from "lucide-react";

interface DestinyWheelScreenProps {
  initialBattleMode?: BattleMode;
  allElves: Elf[];
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
  onBack: () => void;
  p1Suit?: string;
  p1Eyewear?: string;
  p2Suit?: string;
  p2Eyewear?: string;
  p1Title?: string;
  p2Title?: string;
}

type DraftPhase = 'intro' | 'pulling' | 'reveal' | 'ban' | 'pick' | 'ready';

export default function DestinyWheelScreen({
  initialBattleMode = 'PVE',
  allElves,
  onStartBattle,
  onBack,
  p1Suit = "",
  p1Eyewear = "",
  p2Suit = "",
  p2Eyewear = "",
  p1Title = "命運之輪主宰",
  p2Title = "宿命挑戰者"
}: DestinyWheelScreenProps) {
  const [phase, setPhase] = useState<DraftPhase>('intro');
  const [battleMode, setBattleMode] = useState<BattleMode>(initialBattleMode);
  const [isMathStyle, setIsMathStyle] = useState<boolean>(true);
  
  useEffect(() => {
    if (initialBattleMode) {
      setBattleMode(initialBattleMode);
    }
  }, [initialBattleMode]);

  // 雙方的 12 抽卡池
  const [p1Pool, setP1Pool] = useState<DestinyElfInstance[]>([]);
  const [p2Pool, setP2Pool] = useState<DestinyElfInstance[]>([]);

  // 翻牌狀態：B-2 雙選項並存 —— 逐張點翻（revealedIds）或一次全翻（isRevealingAll）
  // 注意：p1/p2 是兩個獨立 12 池，不再共用 revealIndex 前綴，避免點一池開到另一池。
  const [revealIndex, setRevealIndex] = useState<number>(-1); // 保留舊欄位避免外部引用斷裂，實際以 revealedIds 為準
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [isRevealingAll, setIsRevealingAll] = useState<boolean>(false);

  // Ban 階段選擇 (最多 3 隻)
  const [p1BannedIds, setP1BannedIds] = useState<string[]>([]); // 玩家Ban掉AI/對手的精靈ID
  const [p2BannedIds, setP2BannedIds] = useState<string[]>([]); // AI或對手Ban掉玩家的精靈ID

  // Pick 階段選擇 (需選 6 隻)
  const [p1PickedIds, setP1PickedIds] = useState<string[]>([]);
  const [p1StarterId, setP1StarterId] = useState<string>("");
  const [p2PickedIds, setP2PickedIds] = useState<string[]>([]);
  const [p2StarterId, setP2StarterId] = useState<string>("");

  // 詳細資訊模態框
  const [inspectElf, setInspectElf] = useState<DestinyElfInstance | null>(null);

  // 開始抽獎
  const handleStartPull = () => {
    setPhase('pulling');
    const p1Results = perform12Pull(allElves);
    const p2Results = perform12Pull(allElves);
    
    setP1Pool(p1Results);
    setP2Pool(p2Results);
    setRevealIndex(-1);
    setRevealedIds([]);
    setIsRevealingAll(false);

    // 模擬 1.5 秒抽卡轉盤動畫後進入卡牌揭曉
    setTimeout(() => {
      setPhase('reveal');
    }, 1500);
  };

  // B-2 雙選項並存：點未翻開的卡只翻開那一張；想跳過再按「一次全翻」
  const handleNextReveal = (instanceId?: string) => {
    if (!instanceId) return;
    setRevealedIds((prev) => (prev.includes(instanceId) ? prev : [...prev, instanceId]));
  };

  const handleRevealAll = () => {
    setRevealedIds([...p1Pool.map((e) => e.instanceId), ...p2Pool.map((e) => e.instanceId)]);
    setIsRevealingAll(true);
  };
  const isCardRevealed = (instanceId: string) => isRevealingAll || revealedIds.includes(instanceId);

  // 進入 Ban 階段
  const handleProceedToBan = () => {
    setPhase('ban');
    setP1BannedIds([]);
    if (battleMode === 'PVE') {
      // 模擬 AI 立即決定 Ban 玩家的哪 3 隻
      const aiBans = simulateAiBan(p1Pool, 3);
      setP2BannedIds(aiBans);
    } else {
      // PVP 雙人對決模式，由真人 P2 自行選擇 Ban
      setP2BannedIds([]);
    }
  };

  // 玩家點擊 AI/對手 陣容中的卡牌進行 Ban
  const toggleBan = (instanceId: string) => {
    if (p1BannedIds.includes(instanceId)) {
      setP1BannedIds(prev => prev.filter(id => id !== instanceId));
    } else {
      if (p1BannedIds.length >= 3) return; // 只能 Ban 3 隻
      setP1BannedIds(prev => [...prev, instanceId]);
    }
  };

  // 雙人對決模式下，P2 點擊 P1 陣容中的卡牌進行 Ban
  const toggleP2Ban = (instanceId: string) => {
    if (p2BannedIds.includes(instanceId)) {
      setP2BannedIds(prev => prev.filter(id => id !== instanceId));
    } else {
      if (p2BannedIds.length >= 3) return;
      setP2BannedIds(prev => [...prev, instanceId]);
    }
  };

  // 確認 Ban 並進入 Pick 階段
  const handleConfirmBan = () => {
    if (battleMode === 'PVE') {
      if (p1BannedIds.length !== 3) return;
    } else {
      if (p1BannedIds.length !== 3 || p2BannedIds.length !== 3) return;
    }
    
    // 更新池子裡的 isBanned 標籤
    const updatedP1 = p1Pool.map(e => ({ ...e, isBanned: p2BannedIds.includes(e.instanceId) }));
    const updatedP2 = p2Pool.map(e => ({ ...e, isBanned: p1BannedIds.includes(e.instanceId) }));
    
    setP1Pool(updatedP1);
    setP2Pool(updatedP2);

    if (battleMode === 'PVE') {
      // AI 自動進行 Pick 6 和首發決定
      const aiPickRes = simulateAiPick(updatedP2);
      setP2PickedIds(aiPickRes.pickedIds);
      setP2StarterId(aiPickRes.starterId);
    } else {
      // PVP 模式下，預設將 P2 未被 Ban 的前 6 隻自動選上，提供 P2 手動調整
      const availP2 = updatedP2.filter(e => !e.isBanned);
      const initialP2Ids = availP2.slice(0, 6).map(e => e.instanceId);
      setP2PickedIds(initialP2Ids);
      if (initialP2Ids.length > 0) {
        setP2StarterId(initialP2Ids[0]);
      }
    }

    // 預設將玩家未被 Ban 的前 6 隻自動選上，方便快速遊戲
    const availP1 = updatedP1.filter(e => !e.isBanned);
    const initialPickIds = availP1.slice(0, 6).map(e => e.instanceId);
    setP1PickedIds(initialPickIds);
    if (initialPickIds.length > 0) {
      setP1StarterId(initialPickIds[0]);
    }

    setPhase('pick');
  };

  // 玩家在 Pick 階段切換選用 6 隻
  const togglePick = (instanceId: string) => {
    if (p1PickedIds.includes(instanceId)) {
      if (p1PickedIds.length <= 1) return; // 至少保留1隻
      const newIds = p1PickedIds.filter(id => id !== instanceId);
      setP1PickedIds(newIds);
      if (p1StarterId === instanceId && newIds.length > 0) {
        setP1StarterId(newIds[0]);
      }
    } else {
      if (p1PickedIds.length >= 6) return; // 最多選 6 隻
      setP1PickedIds(prev => [...prev, instanceId]);
      if (!p1StarterId) setP1StarterId(instanceId);
    }
  };

  // 雙人對決模式下，P2 在 Pick 階段切換選用 6 隻
  const toggleP2Pick = (instanceId: string) => {
    if (p2PickedIds.includes(instanceId)) {
      if (p2PickedIds.length <= 1) return;
      const newIds = p2PickedIds.filter(id => id !== instanceId);
      setP2PickedIds(newIds);
      if (p2StarterId === instanceId && newIds.length > 0) {
        setP2StarterId(newIds[0]);
      }
    } else {
      if (p2PickedIds.length >= 6) return;
      setP2PickedIds(prev => [...prev, instanceId]);
      if (!p2StarterId) setP2StarterId(instanceId);
    }
  };

  // 進入對戰
  const handleLaunchBattle = () => {
    if (p1PickedIds.length !== 6 || !p1StarterId || p2PickedIds.length !== 6 || !p2StarterId) return;

    // 將 DestinyElfInstance 轉換回純粹的 Elf 並攜帶 destinyRank 與 interceptorEffect 進入對戰
    const p1TeamFinal: Elf[] = p1PickedIds.map(id => {
      const found = p1Pool.find(e => e.instanceId === id)!;
      return {
        ...found,
        currentHp: found.maxHp,
        statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }
      };
    });

    const p2TeamFinal: Elf[] = p2PickedIds.map(id => {
      const found = p2Pool.find(e => e.instanceId === id)!;
      return {
        ...found,
        currentHp: found.maxHp,
        statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }
      };
    });

    // 找出首發 ID 在 Team 中的實際精靈 ID
    const starter1Elf = p1Pool.find(e => e.instanceId === p1StarterId);
    const starter2Elf = p2Pool.find(e => e.instanceId === p2StarterId);

    onStartBattle(
      battleMode,
      p1TeamFinal,
      p2TeamFinal,
      starter1Elf ? starter1Elf.id || starter1Elf.name : p1TeamFinal[0].id || p1TeamFinal[0].name,
      starter2Elf ? starter2Elf.id || starter2Elf.name : p2TeamFinal[0].id || p2TeamFinal[0].name,
      p1Suit,
      p1Eyewear,
      p2Suit,
      p2Eyewear,
      p1Title,
      p2Title,
      "peak_6v6"
    );
  };

  // 渲染稀有度邊框顏色
  const getRankStyle = (rank: 'S' | 'A' | 'B' | 'C') => {
    switch (rank) {
      case 'S':
        return {
          border: "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]",
          badgeBg: "bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black",
          glow: "from-amber-500/20 via-yellow-500/10 to-transparent",
          title: "👑 S級·真神"
        };
      case 'A':
        return {
          border: "border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]",
          badgeBg: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold",
          glow: "from-purple-500/20 via-indigo-500/10 to-transparent",
          title: "🔥 A級·主力"
        };
      case 'C':
        return {
          border: "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]",
          badgeBg: "bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold",
          glow: "from-emerald-500/20 via-teal-500/10 to-transparent",
          title: "🛡️ C級·攔截特化"
        };
      case 'B':
      default:
        return {
          border: "border-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.3)]",
          badgeBg: "bg-slate-700 text-blue-200 font-medium",
          glow: "from-blue-500/10 via-slate-500/5 to-transparent",
          title: "⚡ B級·常規"
        };
    }
  };

  return (
    <div 
      className={`min-h-screen h-auto w-full ${isMathStyle ? 'text-slate-100' : 'bg-gradient-to-br from-slate-950 via-indigo-950/90 to-slate-950 text-slate-100'} p-4 md:p-8 flex flex-col relative overflow-y-auto`}
      style={isMathStyle ? { 
        backgroundImage: "url('/images/img_018.png')", 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#050c21'
      } : {}}
    >
      {/* 命運之輪 · 數理分析矩陣與量子機率網格背景 (Analytical Math HUD Theme) */}
      {isMathStyle && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-25 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#36B2BC_1px,transparent_1px),linear-gradient(to_bottom,#36B2BC_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]"></div>
          {/* 幾何座標與機率波式 */}
          <div className="absolute top-4 left-8 text-[11px] font-mono text-[#36B2BC] tracking-wider flex items-center gap-3">
            <span className="px-2 py-0.5 bg-[#36B2BC]/20 rounded border border-[#36B2BC]/40 font-bold">Φ-MATRIX</span>
            <span>DESTINY QUANTUM PROBABILITY WAVE V3.2 // P(S)=4.0% · P(A)=16.0% · P(B)=55.0% · P(C)=25.0%</span>
          </div>
          <div className="absolute top-4 right-8 text-[11px] font-mono text-[#36B2BC] tracking-widest">
            E[X] = Σ p(x_i)·v_i // MONTE CARLO GUARANTEE MATRIX
          </div>
          <div className="absolute bottom-4 left-8 text-[11px] font-mono text-[#36B2BC] flex items-center gap-3">
            <span className="text-amber-400">● SEED: 0x7FA9B2</span>
            <span>MARKOV STOCHASTIC FIELD // INTERCEPTOR SHIELDING ENGAGED</span>
          </div>
          <div className="absolute bottom-4 right-8 text-[11px] font-mono text-[#36B2BC]">
            DESTINY ROTOR // ω = 2πf · Ω / α / β / γ CLASS SYSTEM
          </div>
          {/* 同心圓雷達與正弦波紋裝飾 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full border border-[#36B2BC]/20 border-dashed animate-[spin_60s_linear_infinite]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-purple-500/20"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-amber-500/15 border-dotted"></div>
        </div>
      )}

      {/* 背景裝飾光斑 */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />

      {/* 頂部導航列 */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-[#36B2BC]/30 relative z-10 gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" /> 返回大廳
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎡</span>
            <div>
              <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-[#36B2BC] via-purple-300 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
                <span>命運之輪 (Wheel of Destiny)</span>
                {isMathStyle && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#36B2BC]/20 text-[#36B2BC] border border-[#36B2BC]/50 font-normal">
                    ANALYTICAL HUD v3.2
                  </span>
                )}
              </h1>
            </div>
          </div>
        </div>

        {/* 階段指示器 */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
          <span className={`px-3 py-1 rounded-full border ${phase === 'intro' || phase === 'pulling' || phase === 'reveal' ? 'bg-[#36B2BC]/20 border-[#36B2BC] text-[#36B2BC]' : 'bg-slate-900/60 border-slate-700 text-slate-500'}`}>
            01/ 12連抽隨機矩陣
          </span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${phase === 'ban' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900/60 border-slate-700 text-slate-500'}`}>
            02/ Ban 3 禁選博弈
          </span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={`px-3 py-1 rounded-full border ${phase === 'pick' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-slate-900/60 border-slate-700 text-slate-500'}`}>
            03/ Pick 6 陣容向量
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMathStyle(!isMathStyle)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
              isMathStyle ? 'bg-[#36B2BC]/20 border-[#36B2BC] text-[#36B2BC] shadow-[0_0_12px_rgba(54,178,188,0.3)]' : 'bg-slate-800 border-slate-600 text-slate-300'
            }`}
          >
            <span>📐 {isMathStyle ? '命運數理矩陣 (MATH HUD)' : '標準科技風'}</span>
          </button>
          <button
            onClick={() => setBattleMode(m => m === 'PVE' ? 'PVP' : 'PVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
              battleMode === 'PVE' ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200' : 'bg-amber-600/30 border-amber-500 text-amber-200'
            }`}
          >
            {battleMode === 'PVE' ? '🤖 PVE (對戰智能AI)' : '👥 PVP (輪流操作模式)'}
          </button>
        </div>
      </header>

      {/* ================= 階段一：遊戲介紹與召喚大廳 ================= */}
      {phase === 'intro' && (
        <DestinyIntroRuleTable
          allElves={allElves}
          onStartPull={handleStartPull}
          isMathStyle={isMathStyle}
        />
      )}

      {/* ================= 階段二：抽卡中動畫 ================= */}
      {phase === 'pulling' && (
        <div className="flex-1 flex flex-col items-center justify-center z-10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-32 h-32 rounded-full border-4 border-t-amber-400 border-r-purple-500 border-b-indigo-500 border-l-emerald-400 mb-8 shadow-[0_0_40px_rgba(168,85,247,0.8)]"
          />
          <h3 className="text-2xl font-black bg-gradient-to-r from-amber-300 via-purple-300 to-white bg-clip-text text-transparent animate-pulse">
            🎡 命運之輪轉動中... 正在自全圖鑑抽獎卡池配置 S/A/B/C 階級卡！
          </h3>
          <p className="text-slate-400 text-sm mt-2">正在為 C 級精靈注入專屬命運攔截被動...</p>
        </div>
      )}

      {/* ================= 階段三：抽卡揭曉與展示 (Reveal Phase) ================= */}
      {phase === 'reveal' && (
        <div className="flex-1 flex flex-col z-10 max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 bg-slate-900/80 border border-slate-700 p-4 rounded-xl">
            <div>
              <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
                ✨ {battleMode === 'PVE' ? '雙方 12 連抽揭曉！請檢視你與對手的卡池！' : '雙人對決 12 連抽揭曉！雙方真人檢視各自卡池！'}
              </h3>
              <p className="text-xs text-slate-400">
                💡 點未翻開的卡只翻開那一張（已翻 <span className="text-amber-300 font-bold">{revealedIds.length} / 24</span>）；想跳過可按「一次全翻」。點擊已翻開的卡片可檢視詳細效果。
              </p>
            </div>
            <div className="flex gap-3 mt-3 md:mt-0">
              {!isRevealingAll && (
                <button
                  onClick={handleRevealAll}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black transition shadow-md shadow-amber-500/20 cursor-pointer animate-pulse"
                >
                  ⚡ 點一次全翻所有牌
                </button>
              )}
              <button
                onClick={handleProceedToBan}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105 cursor-pointer"
              >
                下一步：進入 Ban 3 禁選階段 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 雙方卡池對比展示 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-y-auto pb-6">
            {/* 玩家 12 抽 */}
            <div className="bg-slate-900/60 border border-indigo-500/30 rounded-xl p-4 flex flex-col">
              <h4 className="text-sm font-bold text-indigo-300 mb-3 flex items-center justify-between">
                <span>👤 我方的 12 抽卡池 ({p1Title})</span>
                <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700">
                  S級 × {p1Pool.filter(e=>e.destinyRank==='S').length} | A級 × {p1Pool.filter(e=>e.destinyRank==='A').length} | C攔截 × {p1Pool.filter(e=>e.destinyRank==='C').length}
                </span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {p1Pool.map((elf) => {
                  const isRevealed = isCardRevealed(elf.instanceId);
                  const style = getRankStyle(elf.destinyRank);

                  if (!isRevealed) {
                    return (
                      <div
                        key={elf.instanceId}
                        onClick={() => handleNextReveal(elf.instanceId)}
                        className="aspect-[3/4] rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-purple-950 border-2 border-dashed border-indigo-500/40 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition animate-pulse"
                      >
                        <span className="text-2xl mb-1">🎡</span>
                        <span className="text-[10px] text-amber-300 font-bold">點擊翻開此牌</span>
                      </div>
                    );
                  }

                  return (
                    <motion.div
                      key={elf.instanceId}
                      initial={{ scale: 0.8, rotateY: 90 }}
                      animate={{ scale: 1, rotateY: 0 }}
                      onClick={() => setInspectElf(elf)}
                      className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${style.border} p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:scale-105 transition group`}
                    >
                      <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg}`}>
                        {style.title}
                      </div>

                      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                        <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain group-hover:scale-110 transition duration-300" />
                      </div>

                      <div className="text-center z-10">
                        <div className="text-xs font-bold text-white truncate">{elf.name}</div>
                        <div className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><TypeIcon type={elf.type} size={12} showLabelWhenMissing={false} />{elf.type}</div>
                      </div>

                      {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-emerald-900/90 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500 font-bold">
                          🛡️ {elf.interceptorEffect.name}
                        </div>
                      )}
                      {elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-amber-950/90 text-amber-300 text-[9px] px-1.5 py-0.5 rounded border border-amber-500 font-bold">
                          ✨ 【界】魂印
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* AI/P2 12 抽 */}
            <div className="bg-slate-900/60 border border-purple-500/30 rounded-xl p-4 flex flex-col">
              <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center justify-between">
                <span>{battleMode === 'PVE' ? '🤖 對手 AI 的 12 抽卡池' : '🎯 挑戰者 P2 的 12 抽卡池'} ({p2Title})</span>
                <span className="text-xs bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-700">
                  S級 × {p2Pool.filter(e=>e.destinyRank==='S').length} | A級 × {p2Pool.filter(e=>e.destinyRank==='A').length} | C攔截 × {p2Pool.filter(e=>e.destinyRank==='C').length}
                </span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {p2Pool.map((elf) => {
                  const isRevealed = isCardRevealed(elf.instanceId);
                  const style = getRankStyle(elf.destinyRank);

                  if (!isRevealed) {
                    return (
                      <div
                        key={elf.instanceId}
                        onClick={() => handleNextReveal(elf.instanceId)}
                        className="aspect-[3/4] rounded-xl bg-gradient-to-tr from-slate-900 via-purple-950 to-slate-950 border-2 border-dashed border-purple-500/40 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition animate-pulse"
                      >
                        <span className="text-2xl mb-1">🎰</span>
                        <span className="text-[10px] text-amber-300 font-bold">點擊翻開此牌</span>
                      </div>
                    );
                  }

                  return (
                    <motion.div
                      key={elf.instanceId}
                      initial={{ scale: 0.8, rotateY: 90 }}
                      animate={{ scale: 1, rotateY: 0 }}
                      onClick={() => setInspectElf(elf)}
                      className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${style.border} p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:scale-105 transition group`}
                    >
                      <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg}`}>
                        {style.title}
                      </div>

                      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                        <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain group-hover:scale-110 transition duration-300" />
                      </div>

                      <div className="text-center z-10">
                        <div className="text-xs font-bold text-white truncate">{elf.name}</div>
                        <div className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><TypeIcon type={elf.type} size={12} showLabelWhenMissing={false} />{elf.type}</div>
                      </div>

                      {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-emerald-900/90 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500 font-bold">
                          🛡️ {elf.interceptorEffect.name}
                        </div>
                      )}
                      {elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-amber-950/90 text-amber-300 text-[9px] px-1.5 py-0.5 rounded border border-amber-500 font-bold">
                          ✨ 【界】魂印
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 階段四：Ban 3 禁選階段 (Ban Phase) ================= */}
      {phase === 'ban' && (
        <div className="flex-1 flex flex-col z-10 max-w-7xl mx-auto w-full">
          <div className="bg-slate-900/90 border border-purple-500/50 p-4 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-purple-300 flex items-center gap-2">
                🚫 {battleMode === 'PVE' ? '禁選博弈階段 (Ban 3)：請從對手 AI 的卡池中點選 3 隻精靈禁用！' : '雙人禁選博弈階段 (Ban 3)：雙方真人從對手卡池中點選 3 隻精靈禁用！'}
              </h3>
              <p className="text-xs text-slate-400">
                {battleMode === 'PVE' ? 'AI 也正同步思考禁用你的 3 隻主力！' : 'P1 與 P2 真人輪流或同時選擇要禁用的敵方主力！'} 當前 P1 已選 Ban： <span className="text-amber-400 font-bold text-sm">{p1BannedIds.length} / 3</span> 隻 {battleMode === 'PVP' && <span>| P2 已選 Ban： <span className="text-purple-400 font-bold text-sm">{p2BannedIds.length} / 3</span> 隻</span>}。
              </p>
            </div>
            <button
              onClick={handleConfirmBan}
              disabled={battleMode === 'PVE' ? p1BannedIds.length !== 3 : (p1BannedIds.length !== 3 || p2BannedIds.length !== 3)}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition ${
                (battleMode === 'PVE' ? p1BannedIds.length === 3 : (p1BannedIds.length === 3 && p2BannedIds.length === 3))
                  ? "bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white shadow-[0_0_15px_rgba(251,191,36,0.5)] cursor-pointer" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              確認禁用 (Ban 3) 並進入 Pick 6 <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-y-auto pb-6">
            {/* 對手 AI 池子：玩家點選 Ban */}
            <div className="bg-slate-900/60 border-2 border-purple-500/40 rounded-xl p-4">
              <h4 className="text-sm font-bold text-purple-300 mb-3 flex items-center justify-between">
                <span>🎯 點擊敵方 ({p2Title}) 精靈進行禁用 - P1 剩餘可 Ban: {3 - p1BannedIds.length}</span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {p2Pool.map(elf => {
                  const isBannedByP1 = p1BannedIds.includes(elf.instanceId);
                  const style = getRankStyle(elf.destinyRank);

                  return (
                    <div
                      key={elf.instanceId}
                      onClick={() => toggleBan(elf.instanceId)}
                      className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${
                        isBannedByP1 ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7)] scale-95 opacity-70" : style.border
                      } p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer transition hover:scale-105`}
                    >
                      <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg}`}>
                        {style.title}
                      </div>

                      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                        <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain" />
                      </div>

                      <div className="text-center z-10">
                        <div className="text-xs font-bold text-white truncate">{elf.name}</div>
                      </div>

                      {isBannedByP1 && (
                        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-20">
                          <XCircle className="w-10 h-10 text-red-500 animate-pulse" />
                          <span className="text-xs font-black text-red-300 mt-1">已禁用 (BANNED)</span>
                        </div>
                      )}

                      {elf.destinyRank === 'C' && elf.interceptorEffect && !isBannedByP1 && !elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-emerald-900/90 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500 font-bold">
                          🛡️ {elf.interceptorEffect.name}
                        </div>
                      )}
                      {elf.name.includes("六界神王") && !isBannedByP1 && (
                        <div className="absolute bottom-1 right-1 bg-amber-950/90 text-amber-300 text-[9px] px-1.5 py-0.5 rounded border border-amber-500 font-bold">
                          ✨ 【界】魂印
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 玩家池子：展示 AI Ban 掉了誰，或者在 PVP 下由 P2 點選 Ban */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 opacity-90">
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center justify-between">
                <span>{battleMode === 'PVE' ? '🛡️ 我方卡池 (AI 同步禁用中...)' : `🎯 點擊敵方 (${p1Title}) 精靈進行禁用 - P2 剩餘可 Ban: ${3 - p2BannedIds.length}`}</span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {p1Pool.map(elf => {
                  const isBannedByAI = p2BannedIds.includes(elf.instanceId);
                  const style = getRankStyle(elf.destinyRank);

                  return (
                    <div
                      key={elf.instanceId}
                      onClick={() => battleMode === 'PVP' ? toggleP2Ban(elf.instanceId) : undefined}
                      className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${
                        isBannedByAI ? "border-red-500/80 opacity-60 grayscale" : style.border
                      } p-2 flex flex-col justify-between relative overflow-hidden ${battleMode === 'PVP' ? 'cursor-pointer hover:scale-105 transition' : ''}`}
                    >
                      <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg}`}>
                        {style.title}
                      </div>

                      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                        <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain" />
                      </div>

                      <div className="text-center z-10">
                        <div className="text-xs font-bold text-white truncate">{elf.name}</div>
                      </div>

                      {isBannedByAI && (
                        <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center z-20">
                          <XCircle className="w-8 h-8 text-red-500" />
                          <span className="text-[10px] font-bold text-red-300">{battleMode === 'PVE' ? 'AI 禁用' : 'P2 禁用'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 階段五：Pick 6 陣容與首發選擇 ================= */}
      {phase === 'pick' && (
        <div className="flex-1 flex flex-col z-10 max-w-7xl mx-auto w-full">
          <div className="bg-slate-900/90 border border-emerald-500/50 p-4 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-emerald-400 flex items-center gap-2">
                ✅ {battleMode === 'PVE' ? '陣容組建 (Pick 6)：自未被禁用的 9 隻中，挑選 6 隻並設定首發！' : '雙人對決陣容組建 (Pick 6)：雙方各自挑選 6 隻並設定首發！'}
              </h3>
              <p className="text-xs text-slate-400">
                當前 P1 已出戰： <span className="text-amber-400 font-bold text-sm">{p1PickedIds.length} / 6</span> 隻 {battleMode === 'PVP' && <span>| P2 已出戰： <span className="text-purple-400 font-bold text-sm">{p2PickedIds.length} / 6</span> 隻</span>}。點選卡片右上角👑皇冠可設定為【首發精靈】！
              </p>
            </div>
            <button
              onClick={handleLaunchBattle}
              disabled={p1PickedIds.length !== 6 || !p1StarterId || (battleMode === 'PVP' && (p2PickedIds.length !== 6 || !p2StarterId))}
              className={`px-8 py-3 rounded-xl font-black text-base flex items-center gap-2 transition ${
                p1PickedIds.length === 6 && p1StarterId && (battleMode === 'PVE' || (p2PickedIds.length === 6 && p2StarterId))
                  ? "bg-gradient-to-r from-amber-500 via-emerald-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.6)] cursor-pointer hover:scale-105" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <Swords className="w-5 h-5" /> 啟動巔峰對決 (6v6 攔截戰) <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-y-auto pb-6">
            {/* 玩家剩餘 9 隻中選 6 隻 */}
            <div className="bg-slate-900/60 border-2 border-emerald-500/40 rounded-xl p-4">
              <h4 className="text-sm font-bold text-emerald-300 mb-3 flex items-center justify-between">
                <span>🎯 P1 ({p1Title}) 可用卡池 - 點擊選擇出戰，點選👑設為首發</span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                {p1Pool.filter(e => !e.isBanned).map(elf => {
                  const isPicked = p1PickedIds.includes(elf.instanceId);
                  const isStarter = p1StarterId === elf.instanceId;
                  const style = getRankStyle(elf.destinyRank);

                  return (
                    <div
                      key={elf.instanceId}
                      onClick={() => togglePick(elf.instanceId)}
                      className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${
                        isPicked 
                          ? isStarter ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] scale-102" : "border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                          : "border-slate-800 opacity-60 hover:opacity-90"
                      } p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer transition`}
                    >
                      <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg}`}>
                        {style.title}
                      </div>

                      {/* 首發設定按鈕 */}
                      {isPicked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setP1StarterId(elf.instanceId);
                          }}
                          title="設為首發精靈"
                          className={`absolute top-6 right-1 z-30 p-1.5 rounded-full border transition ${
                            isStarter 
                              ? "bg-amber-500 text-slate-950 border-white font-black shadow-lg scale-110" 
                              : "bg-slate-900/80 text-slate-400 border-slate-600 hover:text-amber-400"
                          }`}
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      )}

                      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                        <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain" />
                      </div>

                      <div className="text-center z-10">
                        <div className="text-xs font-bold text-white truncate">{elf.name}</div>
                        {isStarter ? (
                          <span className="inline-block bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 animate-pulse">
                            👑 首發出戰
                          </span>
                        ) : isPicked ? (
                          <span className="inline-block bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                            ✅ 已入戰隊
                          </span>
                        ) : (
                          <span className="inline-block bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full mt-1">
                            未選用
                          </span>
                        )}
                      </div>

                      {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 left-1 bg-emerald-900/90 text-emerald-300 text-[8px] px-1 py-0.5 rounded border border-emerald-500 font-bold">
                          🛡️ {elf.interceptorEffect.name}
                        </div>
                      )}
                      {elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 left-1 bg-amber-950/90 text-amber-300 text-[8px] px-1 py-0.5 rounded border border-amber-500 font-bold">
                          ✨ 【界】魂印
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI 或 P2 的 Pick 陣容/卡池 */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
              <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center justify-between">
                <span>{battleMode === 'PVE' ? '🤖 AI 最終出戰陣容 (自動選出 6 隻)' : `🎯 P2 (${p2Title}) 可用卡池 - 點擊選擇出戰與首發`}</span>
                <span className="text-xs text-amber-400">{battleMode === 'PVE' ? '👑 AI首發已就緒' : `已選 ${p2PickedIds.length}/6 隻`}</span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                {p2Pool.filter(e => !e.isBanned).map(elf => {
                  if (battleMode === 'PVE' && !p2PickedIds.includes(elf.instanceId)) return null;

                  const isPicked = p2PickedIds.includes(elf.instanceId);
                  const isStarter = p2StarterId === elf.instanceId;
                  const style = getRankStyle(elf.destinyRank);

                  return (
                    <div
                      key={elf.instanceId}
                      onClick={() => battleMode === 'PVE' ? setInspectElf(elf) : toggleP2Pick(elf.instanceId)}
                      className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${
                        isPicked 
                          ? isStarter ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] scale-102" : "border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          : "border-slate-800 opacity-60 hover:opacity-90"
                      } p-2 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:scale-105 transition`}
                    >
                      <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg}`}>
                        {style.title}
                      </div>

                      {/* PVP 下的首發設定按鈕 */}
                      {battleMode === 'PVP' && isPicked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setP2StarterId(elf.instanceId);
                          }}
                          title="設為 P2 首發精靈"
                          className={`absolute top-6 right-1 z-30 p-1.5 rounded-full border transition ${
                            isStarter 
                              ? "bg-amber-500 text-slate-950 border-white font-black shadow-lg scale-110" 
                              : "bg-slate-900/80 text-slate-400 border-slate-600 hover:text-amber-400"
                          }`}
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      )}

                      <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                        <ElfAvatar elf={elf} kind="body" className="max-w-full max-h-full object-contain" />
                      </div>

                      <div className="text-center z-10">
                        <div className="text-xs font-bold text-white truncate">{elf.name}</div>
                        {isStarter ? (
                          <span className="inline-block bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full mt-1 animate-pulse">
                            👑 {battleMode === 'PVE' ? 'AI首發' : 'P2首發'}
                          </span>
                        ) : isPicked ? (
                          <span className="inline-block bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                            ✅ 已入戰隊
                          </span>
                        ) : (
                          <span className="inline-block bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full mt-1">
                            未選用
                          </span>
                        )}
                      </div>

                      {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-emerald-900/90 text-emerald-300 text-[8px] px-1 py-0.5 rounded border border-emerald-500 font-bold">
                          🛡️ {elf.interceptorEffect.name}
                        </div>
                      )}
                      {elf.name.includes("六界神王") && (
                        <div className="absolute bottom-1 right-1 bg-amber-950/90 text-amber-300 text-[8px] px-1 py-0.5 rounded border border-amber-500 font-bold">
                          ✨ 【界】魂印
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 檢視精靈卡片詳細效果模態框 ================= */}
      <AnimatePresence>
        {inspectElf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setInspectElf(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border-2 border-indigo-500 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative"
            >
              <button
                onClick={() => setInspectElf(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>

              <div className="flex items-center gap-4 mb-4 border-b border-slate-800 pb-4">
                <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden">
                  <ElfAvatar elf={inspectElf} kind="head" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white">{inspectElf.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${getRankStyle(inspectElf.destinyRank).badgeBg}`}>
                      {getRankStyle(inspectElf.destinyRank).title}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    屬性: <span className="inline-flex items-center gap-0.5 align-middle"><TypeIcon type={inspectElf.type} size={14} showLabelWhenMissing={false} />{inspectElf.type}</span> | 魂印: 【{inspectElf.soulMark?.name || "無"}】
                  </div>
                </div>
              </div>

              {/* 魂印與特殊特性 */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 text-xs text-slate-300 leading-relaxed">
                <div className="font-bold text-amber-400 mb-1">💫 魂印效果：</div>
                {inspectElf.soulMark?.description || "（無記載）"}
              </div>

              {/* 異能特質 */}
              {inspectElf.alienTraits && (
                <div className="space-y-2 mb-4">
                  {inspectElf.alienTraits.gen2Trait && (
                    <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-500/40 text-xs text-amber-100 leading-relaxed">
                      <div className="font-bold text-amber-300 mb-1">🌟 二代異能特質：【{inspectElf.alienTraits.gen2Trait.name}】</div>
                      {inspectElf.alienTraits.gen2Trait.description}
                    </div>
                  )}
                  {inspectElf.alienTraits.exclusiveTrait && (
                    <div className="bg-red-950/30 p-3 rounded-xl border border-red-500/40 text-xs text-red-100 leading-relaxed">
                      <div className="font-bold text-red-300 mb-1">🔥 專屬異能特質：【{inspectElf.alienTraits.exclusiveTrait.name}】</div>
                      {inspectElf.alienTraits.exclusiveTrait.description}
                    </div>
                  )}
                  {(inspectElf.alienTraits.exclusiveTraits || []).map((trait) => (
                    <div key={trait.name} className="text-red-200">
                      <div className="font-bold text-red-300 mb-1">🔥 專屬異能特質：【{trait.name}】</div>
                      <div className="whitespace-pre-wrap">{trait.description}</div>
                    </div>
                  ))}
                  {inspectElf.alienTraits.generalTrait && (
                    <div className="bg-blue-950/30 p-3 rounded-xl border border-blue-500/40 text-xs text-blue-100 leading-relaxed">
                      <div className="font-bold text-blue-300">💠 通用特性：【{inspectElf.alienTraits.generalTrait.name}】 ({inspectElf.alienTraits.generalTrait.description})</div>
                    </div>
                  )}
                </div>
              )}

              {/* 如果是 C 級，展示專屬命運攔截 */}
              {inspectElf.destinyRank === 'C' && inspectElf.interceptorEffect && !inspectElf.name.includes("六界神王") && (
                <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/60 mb-4 text-xs leading-relaxed">
                  <div className="font-black text-emerald-400 mb-1 flex items-center gap-1">
                    <Shield className="w-4 h-4" /> 🎡 C級·命運攔截被動：【{inspectElf.interceptorEffect.name}】
                  </div>
                  <p className="text-emerald-200">{inspectElf.interceptorEffect.description}</p>
                </div>
              )}

              {/* 技能表 */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <div className="font-bold text-xs text-slate-400 mb-1">⚔️ 主要技能名冊：</div>
                {inspectElf.skills?.map((sk, idx) => (
                  <div key={idx} className="bg-slate-950/60 border border-slate-800 p-2 rounded-lg text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-indigo-300 mr-2">{sk.name}</span>
                      <span className="text-[10px] text-slate-500"><span className="inline-flex items-center gap-0.5 align-middle"><TypeIcon type={sk.type} size={11} showLabelWhenMissing={false} /></span>[{sk.type}/{sk.category}] 威力:{sk.power} PP:{sk.pp}</span>
                    </div>
                    {sk.priority && sk.priority !== 0 ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">先制{sk.priority > 0 ? `+${sk.priority}` : sk.priority}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
