import React, { useState, useMemo } from 'react';
import { TypeIcon } from "./SeerImages";
import { matchesElfQuery } from '../utils/elfSearch';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Shield, Swords, Crown, Zap, Trophy, HelpCircle, 
  Search, Table as TableIcon, Grid as GridIcon, ChevronRight, 
  Info, Eye, X, Flame, Layers, Activity 
} from 'lucide-react';
import { Elf, Skill } from '../types';
import { buildDestinyPool, DestinyElfInstance, DestinyRank, INTERCEPTOR_EFFECTS } from '../utils/destinyGacha';

interface DestinyIntroRuleTableProps {
  allElves: Elf[];
  onStartPull: () => void;
  isMathStyle?: boolean;
}

export default function DestinyIntroRuleTable({
  allElves,
  onStartPull,
  isMathStyle = false
}: DestinyIntroRuleTableProps) {
  const [selectedRankTab, setSelectedRankTab] = useState<'all' | DestinyRank>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [inspectingElf, setInspectingElf] = useState<DestinyElfInstance | null>(null);

  // 實時動態運算：每當精靈圖鑑 allElves 更新時，自動重新計算全池分級與統計數值
  const dynamicPool = useMemo(() => {
    return buildDestinyPool(allElves);
  }, [allElves]);

  // 分級數據與佔比統計
  const poolStats = useMemo(() => {
    const total = dynamicPool.length;
    if (total === 0) return { total: 0, sCount: 0, aCount: 0, bCount: 0, cCount: 0, sPct: '0', aPct: '0', bPct: '0', cPct: '0' };
    
    const sCount = dynamicPool.filter(e => e.destinyRank === 'S').length;
    const aCount = dynamicPool.filter(e => e.destinyRank === 'A').length;
    const bCount = dynamicPool.filter(e => e.destinyRank === 'B').length;
    const cCount = dynamicPool.filter(e => e.destinyRank === 'C').length;

    return {
      total,
      sCount,
      aCount,
      bCount,
      cCount,
      sPct: ((sCount / total) * 100).toFixed(1),
      aPct: ((aCount / total) * 100).toFixed(1),
      bPct: ((bCount / total) * 100).toFixed(1),
      cPct: ((cCount / total) * 100).toFixed(1)
    };
  }, [dynamicPool]);

  // 過濾與搜尋精靈表
  const filteredElves = useMemo(() => {
    return dynamicPool.filter(elf => {
      const matchesRank = selectedRankTab === 'all' || elf.destinyRank === selectedRankTab;
      return matchesRank && matchesElfQuery(elf, searchTerm);
    }).sort((a, b) => {
      // 默認排序：稀有度 S > A > B > C，同稀有度比較種族值總和
      const rankOrder: Record<DestinyRank, number> = { 'S': 4, 'A': 3, 'B': 2, 'C': 1 };
      if (rankOrder[a.destinyRank] !== rankOrder[b.destinyRank]) {
        return rankOrder[b.destinyRank] - rankOrder[a.destinyRank];
      }
      const totalA = (a.baseStats?.hp || 0) + (a.baseStats?.atk || 0) + (a.baseStats?.def || 0) + (a.baseStats?.spatk || 0) + (a.baseStats?.spdef || 0) + (a.baseStats?.speed || 0);
      const totalB = (b.baseStats?.hp || 0) + (b.baseStats?.atk || 0) + (b.baseStats?.def || 0) + (b.baseStats?.spatk || 0) + (b.baseStats?.spdef || 0) + (b.baseStats?.speed || 0);
      return totalB - totalA;
    });
  }, [dynamicPool, selectedRankTab, searchTerm]);

  const getRankStyle = (rank: DestinyRank) => {
    switch (rank) {
      case 'S':
        return {
          border: "border-amber-400/60 shadow-[0_0_15px_rgba(251,191,36,0.2)]",
          badgeBg: "bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black",
          text: "text-amber-400",
          title: "S 級 · 巔峰真神",
          shortTitle: "S 級",
          bgHover: "hover:bg-amber-950/30"
        };
      case 'A':
        return {
          border: "border-purple-400/60 shadow-[0_0_15px_rgba(168,85,247,0.2)]",
          badgeBg: "bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold",
          text: "text-purple-400",
          title: "A 級 · 巔峰主力",
          shortTitle: "A 級",
          bgHover: "hover:bg-purple-950/30"
        };
      case 'B':
        return {
          border: "border-slate-600/60",
          badgeBg: "bg-slate-700 text-slate-200 font-medium",
          text: "text-slate-300",
          title: "B 級 · 中流砥柱",
          shortTitle: "B 級",
          bgHover: "hover:bg-slate-800/40"
        };
      case 'C':
        return {
          border: "border-emerald-400/60 shadow-[0_0_15px_rgba(52,211,153,0.2)]",
          badgeBg: "bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black",
          text: "text-emerald-400",
          title: "C 級 · 命運攔截",
          shortTitle: "C 級",
          bgHover: "hover:bg-emerald-950/30"
        };
    }
  };

  const getTotalStats = (stats?: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }) => {
    if (!stats) return 600;
    return stats.hp + stats.atk + stats.def + stats.spatk + stats.spdef + stats.speed;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start text-left max-w-7xl mx-auto w-full z-10 py-6 px-4 overflow-y-auto">
      {/* 1. 頂部橫幅與啟動行動區 */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${
          isMathStyle 
            ? 'bg-slate-950/80 border border-[#36B2BC]/50 shadow-[0_0_20px_rgba(54,178,188,0.2)]' 
            : 'bg-slate-900/90 border border-indigo-500/40 rounded-2xl shadow-2xl backdrop-blur-md'
        } rounded-2xl p-6 md:p-8 relative overflow-hidden mb-8 text-center`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Sparkles className={`w-64 h-64 ${isMathStyle ? 'text-[#36B2BC]' : 'text-amber-400'}`} />
        </div>

        <div className={`w-16 h-16 md:w-20 md:h-20 ${
          isMathStyle 
            ? 'bg-gradient-to-tr from-[#36B2BC] to-teal-600 shadow-teal-500/30' 
            : 'bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 shadow-purple-500/50'
        } rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-bounce`}>
          <span className="text-3xl md:text-4xl">🎡</span>
        </div>

        <h1 className="text-2xl md:text-4xl font-black text-white mb-3 tracking-tight">
          {isMathStyle 
            ? '命運之輪 (Destiny Wheel)：線性博弈矩陣與量子隨機對決' 
            : '12 連抽 × 巔峰 Ban 3 進 6 策略博弈賽！'}
        </h1>
        <p className="text-slate-300 text-sm md:text-base mb-6 max-w-3xl mx-auto leading-relaxed">
          {isMathStyle 
            ? '打破固定解！在數理分析模式下，系統將自全圖鑑隨機展開 12 維精靈狀態向量。透過精準的雙向消除法 (Ban) 與陣容首發向量組裝，展開高維度策略競技與極致賽局博弈。' 
            : '告別固定國家隊！在「命運之輪」中，系統將從全圖鑑精靈中為雙方各自隨機抽取 12 隻精靈！透過嚴格的戰術禁用 (Ban) 與陣容搭配，體驗高自由度、零門檻的頂級策略競技！'}
        </p>

        <button
          onClick={onStartPull}
          className={`px-8 py-4 rounded-xl font-black text-base md:text-lg transition duration-300 flex items-center justify-center gap-3 mx-auto cursor-pointer hover:scale-105 ${
            isMathStyle 
              ? 'bg-gradient-to-r from-[#36B2BC] to-teal-600 hover:from-teal-400 hover:to-[#36B2BC] text-white shadow-[0_0_25px_rgba(54,178,188,0.4)]' 
              : 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.6)]'
          }`}
        >
          <Sparkles className="w-5 h-5 animate-spin" /> 
          <span>{isMathStyle ? '啟動量子隨機矩陣 (展開雙方狀態矢)' : '立即啟動命運輪盤 (雙方 12 連抽)'}</span> 
          <Swords className="w-5 h-5" />
        </button>
      </motion.div>

      {/* 2. 賽制規則與機制深度解析 */}
      <div className="w-full mb-10">
        <div className="flex items-center gap-2 mb-4 text-slate-200 font-black text-lg">
          <Shield className={`w-5 h-5 ${isMathStyle ? 'text-[#36B2BC]' : 'text-indigo-400'}`} />
          <span>{isMathStyle ? '系統結構 · 線性博弈演算法與狀態轉換規約' : '命運之輪 · 核心賽制與博弈規則'}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`border rounded-xl p-5 hover:border-slate-500 transition relative overflow-hidden ${
            isMathStyle ? 'bg-slate-950/80 border-[#36B2BC]/30' : 'bg-slate-900/80 border-slate-700/80'
          }`}>
            <div className={`flex items-center gap-2 font-bold text-sm mb-2 ${isMathStyle ? 'text-[#36B2BC]' : 'text-amber-400'}`}>
              <Trophy className="w-4 h-4 shrink-0" />
              <span>{isMathStyle ? '1. 量子隨機 12 連抽' : '1. 隨機 12 連抽'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isMathStyle 
                ? '系統依據古典機率分佈自全圖鑑隨機生成雙方 12 階精靈子空間。必出：1 隻 S 級真神 + 3 隻 A 級主力 + 8 隻 B/C 級精靈，雙方資源權重完全對等。'
                : '雙方各自從底層圖鑑與特化卡池中隨機抽取 12 隻精靈。系統嚴格執行保底：必出 1 隻 S級真神 + 3 隻 A級主力 + 8 隻 B/C級精靈，雙方起跑線完全平等。'}
            </p>
          </div>

          <div className={`border rounded-xl p-5 hover:border-slate-500 transition relative overflow-hidden ${
            isMathStyle ? 'bg-slate-950/80 border-purple-500/30' : 'bg-slate-900/80 border-slate-700/80'
          }`}>
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{isMathStyle ? '2. 雙向消減 Ban (禁3)' : '2. 巔峰博弈 Ban (禁3)'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isMathStyle 
                ? '雙方檢視彼此子空間向量後，輪流執行 3 次維度消除 (Ban)。旨在切斷敵方的核心連鎖、保護我方奇點核心，此為極致的零和對稱博弈。'
                : '抽卡揭曉後，雙方檢視彼此卡池，輪流禁用 (Ban) 對手 3 隻最危險的精靈！如何斬斷敵方的核心連鎖、保護我方真神，考驗對戰局的精準預判。'}
            </p>
          </div>

          <div className={`border rounded-xl p-5 hover:border-slate-500 transition relative overflow-hidden ${
            isMathStyle ? 'bg-slate-950/80 border-indigo-500/30' : 'bg-slate-900/80 border-slate-700/80'
          }`}>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2">
              <Swords className="w-4 h-4 shrink-0" />
              <span>{isMathStyle ? '3. 陣容初態 Pick (選6)' : '3. 精銳 Pick (選6進戰)'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isMathStyle 
                ? '在殘存的 9 維狀態矢中，挑選 6 隻作為出戰張量並指定首發精靈。無論是 PVE 智能演算法（AI）還是 PVP 實體操作，陣列的首位排序決定初始動能。'
                : '從扣除禁用的 9 隻精靈中，挑選 6 隻精華出戰，並可指定首發王牌！無論是 PVE 智能 AI 或是 PVP 雙人輪流博弈，都帶來千變萬化的戰局。'}
            </p>
          </div>

          <div className={`border rounded-xl p-5 transition relative overflow-hidden ${
            isMathStyle 
              ? 'bg-slate-950/80 border-emerald-500/40 bg-gradient-to-b from-emerald-950/10 to-transparent hover:border-emerald-400' 
              : 'bg-slate-900/80 border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 to-transparent hover:border-emerald-400'
          }`}>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
              <Zap className="w-4 h-4 shrink-0" />
              <span>{isMathStyle ? '4. 奇點攔截 (C級專屬)' : '4. C級攔截革命！'}</span>
            </div>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              {isMathStyle 
                ? '引入奇點反轉定理！所有 C 級常規精靈均綁定【封技攔截 / 悲歌護盾 / 索魂同歸 / 英靈祝福】等特異魂印，戰死之際即為反物質湮滅與機制翻盤之時。'
                : '在命運之輪中，C級卡不再是倉管！所有 C 級卡牌均綁定 【封技攔截 / 悲歌護盾 / 索魂同歸 / 英靈祝福】 等特殊逆天被動，送死即可反轉逆境！'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. 流動式精靈等級與特性說明表 */}
      <div className={`w-full ${
        isMathStyle ? 'bg-slate-950/80 border border-[#36B2BC]/30' : 'bg-slate-900/80 border border-slate-800'
      } rounded-2xl p-6 shadow-xl`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 ${
          isMathStyle ? 'border-b border-[#36B2BC]/20' : 'border-b border-slate-800'
        }`}>
          <div>
            <div className="flex items-center gap-2 text-white font-black text-xl">
              <Activity className={`w-6 h-6 ${isMathStyle ? 'text-[#36B2BC]' : 'text-amber-400'} animate-pulse`} />
              <span>{isMathStyle ? '全圖鑑機率空間分佈與維度權重監測' : '流動式精靈等級表格與實時監測'}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${isMathStyle ? 'bg-[#36B2BC]' : 'bg-emerald-400'} animate-ping`} />
              <span>
                {isMathStyle 
                  ? `實時機率空間特徵運算中：當前已對接底層圖鑑空間 (${poolStats.total} 階精靈子集) 進行實時歸一化。`
                  : `實時動態運算中：當前表格連接底層圖鑑 (${poolStats.total} 隻精靈) 實時運算，精靈更新時表格與占比即時同步！`}
              </span>
            </p>
          </div>

          {/* 搜尋與視圖切換 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="名稱、ID、屬性或魂印（可用空白組合）"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-60 md:w-72 transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex bg-slate-950 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="表格模式 (詳細數值)"
              >
                <TableIcon className="w-4 h-4" />
                <span className="hidden sm:inline">表格</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="網格卡片模式"
              >
                <GridIcon className="w-4 h-4" />
                <span className="hidden sm:inline">網格</span>
              </button>
            </div>
          </div>
        </div>

        {/* 分級頁籤與佔比展示條 */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setSelectedRankTab('all')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
              selectedRankTab === 'all'
                ? 'bg-slate-800 border-slate-400 text-white shadow-md'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-300" />
            <span>全部精靈 ({poolStats.total} 隻)</span>
          </button>

          <button
            onClick={() => setSelectedRankTab('S')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
              selectedRankTab === 'S'
                ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-amber-500/30 hover:text-amber-400/80'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>S級 真神 ({poolStats.sCount} 隻 · {poolStats.sPct}%)</span>
          </button>

          <button
            onClick={() => setSelectedRankTab('A')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
              selectedRankTab === 'A'
                ? 'bg-purple-950/60 border-purple-400 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-purple-500/30 hover:text-purple-400/80'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>A級 主力 ({poolStats.aCount} 隻 · {poolStats.aPct}%)</span>
          </button>

          <button
            onClick={() => setSelectedRankTab('B')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
              selectedRankTab === 'B'
                ? 'bg-slate-800 border-slate-500 text-slate-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-slate-300" />
            <span>B級 中堅 ({poolStats.bCount} 隻 · {poolStats.bPct}%)</span>
          </button>

          <button
            onClick={() => setSelectedRankTab('C')}
            className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer border ${
              selectedRankTab === 'C'
                ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-400/80'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            <span>C級 命運攔截 ({poolStats.cCount} 隻 · {poolStats.cPct}%)</span>
          </button>
        </div>

        {/* 階級判斷準則資訊盒 */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 mb-6 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-amber-300 mb-1.5">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>目前所選等級準則與特性解析 ({selectedRankTab === 'all' ? '全卡池綜覽' : `${selectedRankTab} 級精靈`})：</span>
          </div>
          {selectedRankTab === 'all' && (
            <p>命運之輪精靈庫將全圖鑑精靈與專屬擴展卡自動劃分為 S/A/B/C 四大稀有度。透過科學的種族值總和與技能機制判定，確保抽卡保底與對局平衡。點擊下方表格任意精靈可查看詳細數值與技能組成。</p>
          )}
          {selectedRankTab === 'S' && (
            <p><span className="text-amber-400 font-bold">【S級 巔峰神權】</span>：判定準則為 <code className="text-amber-300">種族值總和 ≥ 730</code> 或擁有 6 技能神權的頂級天花板（如聖靈譜尼、人皇帝辛、眾神之父奧丁、次元龍、混沌魔君索倫森等）。此階級精靈具有極強的單兵作戰與統治力，每次 12 連抽保底出現 1 隻。</p>
          )}
          {selectedRankTab === 'A' && (
            <p><span className="text-purple-400 font-bold">【A級 巔峰主力】</span>：判定準則為 <code className="text-purple-300">種族值總和 680 ~ 729</code> 或擁有第五技能強力中流砥柱（如戰神聯盟王化完全體、冰魄柯爾德、混沌布萊克、魔獅迪露等）。為戰隊提供核心輸出與聯防抗性，每次連抽保底出現 3 隻。</p>
          )}
          {selectedRankTab === 'B' && (
            <p><span className="text-slate-300 font-bold">【B級 中流砥柱】</span>：判定準則為 <code className="text-slate-200">種族值總和 601 ~ 679</code>，為經典精靈與多功能戰術卡。在 6v6 博弈中可用於聯防過渡、強化拆解或異常消耗，是豐富戰術層次的基石。</p>
          )}
          {selectedRankTab === 'C' && (
            <p><span className="text-emerald-400 font-bold">【C級 命運攔截】</span>：判定準則為 <code className="text-emerald-300">種族值總和 ≤ 600 或命運之輪擴展特化卡</code>。**革命機制**：所有 C 級卡在場上出場或陣亡時，均自動觸發【封技攔截 / 悲歌護盾 / 索魂同歸 / 英靈祝福】等特殊送死逆天被動！</p>
          )}
        </div>

        {/* 精靈列表展示區 (表格 vs 網格) */}
        {filteredElves.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>沒有找到符合條件的精靈，請嘗試調整關鍵字或選擇其他頁籤。</p>
          </div>
        ) : viewMode === 'table' ? (
          /* 表格視圖 */
          <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 font-bold">階級</th>
                  <th className="py-3 px-3.5 font-bold">精靈名稱</th>
                  <th className="py-3 px-3.5 font-bold">屬性</th>
                  <th className="py-3 px-3.5 font-bold text-center">種族總和</th>
                  <th className="py-3 px-2 font-bold text-center text-rose-400">體力</th>
                  <th className="py-3 px-2 font-bold text-center text-amber-400">攻擊</th>
                  <th className="py-3 px-2 font-bold text-center text-blue-400">防禦</th>
                  <th className="py-3 px-2 font-bold text-center text-purple-400">特攻</th>
                  <th className="py-3 px-2 font-bold text-center text-teal-400">特防</th>
                  <th className="py-3 px-2 font-bold text-center text-emerald-400">速度</th>
                  <th className="py-3 px-3.5 font-bold">專屬特性 / 魂印機制</th>
                  <th className="py-3 px-2 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                {filteredElves.map((elf) => {
                  const style = getRankStyle(elf.destinyRank);
                  const totalStats = getTotalStats(elf.baseStats);
                  
                  return (
                    <tr 
                      key={elf.instanceId} 
                      onClick={() => setInspectingElf(elf)}
                      className={`transition cursor-pointer ${style.bgHover} hover:bg-slate-800/80 group`}
                    >
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${style.badgeBg}`}>
                          {style.shortTitle}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-white font-sans flex items-center gap-2 whitespace-nowrap">
                        <div className="w-6 h-6 rounded bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {elf.path ? (
                            <img src={elf.path} alt={elf.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px]">{elf.name.substring(0, 1)}</span>
                          )}
                        </div>
                        <span>{elf.name}</span>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-300 font-sans whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] inline-flex items-center gap-1">
                          <TypeIcon type={elf.type} size={13} showLabelWhenMissing={false} />{elf.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded ${totalStats >= 700 ? 'bg-amber-500/20 text-amber-300 font-black' : totalStats >= 650 ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-slate-300'}`}>
                          {totalStats}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center text-rose-300">{elf.baseStats?.hp || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-amber-300">{elf.baseStats?.atk || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-blue-300">{elf.baseStats?.def || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-purple-300">{elf.baseStats?.spatk || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-teal-300">{elf.baseStats?.spdef || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-emerald-300">{elf.baseStats?.speed || '-'}</td>
                      <td className="py-2.5 px-3.5 font-sans max-w-xs truncate text-slate-300">
                        {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") ? (
                          <span className="text-emerald-400 font-bold">
                            ⚡ 【{elf.interceptorEffect.name}】：{elf.interceptorEffect.description}
                          </span>
                        ) : elf.soulMark?.name ? (
                          <span>
                            <strong className="text-amber-300">【{elf.soulMark.name}】</strong>
                            {elf.soulMark.description ? `：${elf.soulMark.description}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500">一般精靈特性</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingElf(elf);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition inline-flex items-center gap-1"
                          title="檢視精靈技能與數值"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-[10px]">詳情</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* 網格卡片視圖 */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredElves.map((elf) => {
              const style = getRankStyle(elf.destinyRank);
              const totalStats = getTotalStats(elf.baseStats);

              return (
                <div
                  key={elf.instanceId}
                  onClick={() => setInspectingElf(elf)}
                  className={`aspect-[3/4] rounded-xl bg-slate-950 border-2 ${style.border} p-2.5 flex flex-col justify-between relative overflow-hidden cursor-pointer hover:scale-105 transition group shadow-md`}
                >
                  <div className={`absolute top-0 left-0 right-0 text-[10px] text-center py-0.5 ${style.badgeBg} z-10`}>
                    {style.title}
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center pt-4 pb-1">
                    <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden mb-2 shadow-inner group-hover:border-amber-400 transition">
                      {elf.path ? (
                        <img src={elf.path} alt={elf.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-lg font-black">{elf.name.substring(0, 1)}</span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-white text-center truncate w-full">{elf.name}</div>
                    <div className="text-[10px] text-slate-400 text-center mt-0.5"><span className="inline-flex items-center gap-0.5"><TypeIcon type={elf.type} size={12} showLabelWhenMissing={false} />{elf.type}</span> · 總值 {totalStats}</div>
                  </div>

                  <div className="bg-slate-900/90 rounded p-1.5 text-[9px] text-slate-300 border border-slate-800/80 truncate text-center">
                    {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") ? (
                      <span className="text-emerald-400 font-bold">⚡ {elf.interceptorEffect.name}</span>
                    ) : elf.soulMark?.name ? (
                      <span className="text-amber-300 font-bold">【{elf.soulMark.name}】魂印</span>
                    ) : (
                      <span className="text-slate-500">標準精靈</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 底部再次呼應開戰按鈕 */}
      <div className="w-full mt-8 text-center pb-8">
        <p className="text-xs text-slate-400 mb-3">準備好迎接巔峰隨機博弈了嗎？點擊按鈕開啟你的 12 連抽與禁用挑戰！</p>
        <button
          onClick={onStartPull}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-black text-base shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:scale-105 transition duration-300 inline-flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>立即前往抽卡與禁選大廳</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ================= 精靈詳細資訊與技能彈窗 ================= */}
      <AnimatePresence>
        {inspectingElf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInspectingElf(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl text-left relative"
            >
              <button
                onClick={() => setInspectingElf(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {inspectingElf.path ? (
                    <img src={inspectingElf.path} alt={inspectingElf.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-2xl font-black">{inspectingElf.name.substring(0, 1)}</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white">{inspectingElf.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded text-xs ${getRankStyle(inspectingElf.destinyRank).badgeBg}`}>
                      {getRankStyle(inspectingElf.destinyRank).title}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    屬性：<span className="text-amber-300 font-bold inline-flex items-center gap-1 align-middle"><TypeIcon type={inspectingElf.type} size={14} showLabelWhenMissing={false} />{inspectingElf.type}</span> | 種族值總和：<span className="text-indigo-300 font-bold">{getTotalStats(inspectingElf.baseStats)}</span>
                  </div>
                </div>
              </div>

              {/* 六項種族值數值表 */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 mb-2">六項種族值面板：</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-mono">
                  <div className="bg-slate-950 p-2 rounded border border-rose-500/30">
                    <div className="text-[10px] text-rose-400 font-sans">體力</div>
                    <div className="text-sm font-bold text-white">{inspectingElf.baseStats?.hp || 100}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-amber-500/30">
                    <div className="text-[10px] text-amber-400 font-sans">攻擊</div>
                    <div className="text-sm font-bold text-white">{inspectingElf.baseStats?.atk || 100}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-blue-500/30">
                    <div className="text-[10px] text-blue-400 font-sans">防禦</div>
                    <div className="text-sm font-bold text-white">{inspectingElf.baseStats?.def || 100}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-purple-500/30">
                    <div className="text-[10px] text-purple-400 font-sans">特攻</div>
                    <div className="text-sm font-bold text-white">{inspectingElf.baseStats?.spatk || 100}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-teal-500/30">
                    <div className="text-[10px] text-teal-400 font-sans">特防</div>
                    <div className="text-sm font-bold text-white">{inspectingElf.baseStats?.spdef || 100}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-emerald-500/30">
                    <div className="text-[10px] text-emerald-400 font-sans">速度</div>
                    <div className="text-sm font-bold text-white">{inspectingElf.baseStats?.speed || 100}</div>
                  </div>
                </div>
              </div>

              {/* 魂印或攔截特性 */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                <h3 className="text-xs font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>核心特性 / 魂印機制解析</span>
                </h3>
                {inspectingElf.destinyRank === 'C' && inspectingElf.interceptorEffect && !inspectingElf.name.includes("六界神王") ? (
                  <div className="text-xs text-emerald-300 leading-relaxed">
                    <div className="font-bold text-emerald-400 mb-0.5">⚡ 命運之輪 C 級專屬攔截：【{inspectingElf.interceptorEffect.name}】</div>
                    <p>{inspectingElf.interceptorEffect.description}</p>
                    <p className="text-[11px] text-slate-400 mt-1">※ 提示：此特效為命運之輪模式專門賦予，於精靈登場或陣亡時自動觸發。</p>
                  </div>
                ) : inspectingElf.soulMark?.name ? (
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <div className="font-bold text-amber-300 mb-0.5">【{inspectingElf.soulMark.name}】魂印</div>
                    <p>{inspectingElf.soulMark.description || "提供實時對戰增益效果。"}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">標準精靈，依靠技能組成與基礎數值進行博弈。</p>
                )}
              </div>

              {/* 技能列表 */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 mb-3">攜帶招式技能池 ({inspectingElf.skills?.length || 0} 招)：</h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {inspectingElf.skills && inspectingElf.skills.length > 0 ? (
                    inspectingElf.skills.map((skill, idx) => (
                      <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{skill.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 inline-flex items-center gap-0.5"><TypeIcon type={skill.type} size={11} showLabelWhenMissing={false} />{skill.type}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] ${skill.category === '物理' ? 'bg-amber-950 text-amber-300 border border-amber-800' : skill.category === '特殊' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'}`}>
                              {skill.category}
                            </span>
                          </div>
                          <div className="text-slate-400 font-mono text-[11px]">
                            威力: <span className="text-white font-bold">{skill.power}</span> | PP: {skill.pp} {skill.priority ? <span className="text-amber-400 font-bold ml-1">(先制{skill.priority > 0 ? `+${skill.priority}` : skill.priority})</span> : null}
                          </div>
                        </div>
                        <div className="text-slate-400 text-[11px] leading-relaxed">{skill.description || "造成一般傷害。"}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-4 text-center">無登錄技能資料</div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
