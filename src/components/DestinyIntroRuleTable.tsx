import React, { useState, useMemo } from 'react';
import { ElfAvatar, TypeIcon, SkillTypeIcon } from "./SeerImages";
import { skillDisplayType } from '../utils/skillPresentation';
import { matchesElfQuery } from '../utils/elfSearch';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Shield, Swords, Crown, Zap, Trophy, HelpCircle, 
  Search, Table as TableIcon, Grid as GridIcon, ChevronRight, 
  Info, Eye, X, Flame, Layers, Activity 
} from 'lucide-react';
import { Elf, Skill } from '../types';
import { buildDestinyPool, DestinyElfInstance, DestinyRank } from '../utils/destinyGacha';
import { describeRankRule, describeAllRankRules, rankStats } from '../utils/destinyRankMeta';
import { EffectDescription } from './EffectDescription';
import { RichDescription, RichInline } from './RichDescription';

interface DestinyIntroRuleTableProps {
  allElves: Elf[];
  pool?: DestinyElfInstance[];
  onStartPull: () => void;
  isMathStyle?: boolean;
}

export default function DestinyIntroRuleTable({
  allElves,
  pool,
  onStartPull,
  isMathStyle = false
}: DestinyIntroRuleTableProps) {
  const [selectedRankTab, setSelectedRankTab] = useState<'all' | DestinyRank>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [inspectingElf, setInspectingElf] = useState<DestinyElfInstance | null>(null);

  // 實時動態運算：每當精靈圖鑑 allElves 更新時，自動重新計算全池分級與統計數值
  const dynamicPool = useMemo(() => {
    return pool ?? buildDestinyPool(allElves);
  }, [allElves,pool]);

  // 分級數據與佔比統計
  const poolStats = useMemo(() => {
    const st = rankStats(dynamicPool);
    return { total: st.total, sCount: st.counts.S, aCount: st.counts.A, bCount: st.counts.B, cCount: st.counts.C,
      sPct: st.pct.S, aPct: st.pct.A, bPct: st.pct.B, cPct: st.pct.C };
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
    <div className="flex-1 flex flex-col items-center justify-start text-left max-w-7xl mx-auto w-full z-10 py-6 px-4 overflow-y-auto *:shrink-0">
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

        <h1 className="text-2xl md:text-4xl font-black text-white mb-5 tracking-tight"
          title="從全圖鑑為雙方各抽 12 隻，保底至少 1S＋3A＋2C；雙方各 Ban 對手 3 隻，再從剩餘 9 隻挑 6 隻並指定首發。">
          命運之輪
        </h1>

        <button
          onClick={onStartPull}
          className={`px-8 py-4 rounded-xl font-black text-base md:text-lg transition duration-300 flex items-center justify-center gap-3 mx-auto cursor-pointer hover:scale-105 ${
            isMathStyle 
              ? 'bg-gradient-to-r from-[#36B2BC] to-teal-600 hover:from-teal-400 hover:to-[#36B2BC] text-white shadow-[0_0_25px_rgba(54,178,188,0.4)]' 
              : 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.6)]'
          }`}
        >
          <Sparkles className="w-5 h-5 animate-spin" /> 
          <span>立即啟動命運輪盤</span> 
          <Swords className="w-5 h-5" />
        </button>
      </motion.div>

      {/* 2. 賽制規則：每張卡只留標籤與一行重點，完整說明放 tooltip（D-10） */}
      <div className="w-full mb-10">
        <div className="flex items-center gap-2 mb-4 text-slate-200 font-black text-lg">
          <Shield className={`w-5 h-5 ${isMathStyle ? 'text-[#36B2BC]' : 'text-indigo-400'}`} />
          <span>核心賽制</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div title="雙方各自從圖鑑隨機抽取 12 隻不同精靈。保底至少 1 隻 S、3 隻 A、2 隻 C，其餘 6 隻混合抽取；卡池不足時提示原因，不開始抽卡。" className="border rounded-xl p-5 transition relative overflow-hidden bg-slate-950/80 border-slate-700/80">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
              <Trophy className="w-4 h-4 shrink-0" />
              <span>1. 12 連抽</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">保底 1S＋3A＋2C</p>
          </div>
          <div title="抽卡揭曉後，雙方檢視彼此卡池，各禁用對手 3 隻精靈。" className="border rounded-xl p-5 transition relative overflow-hidden bg-slate-950/80 border-slate-700/80">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
              <X className="w-4 h-4 shrink-0" />
              <span>2. Ban 3</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">禁用對手 3 隻</p>
          </div>
          <div title="從扣除禁用的 9 隻精靈中挑選 6 隻出戰，並指定首發。PVE 為 AI 對手，PVP 為雙人輪流。" className="border rounded-xl p-5 transition relative overflow-hidden bg-slate-950/80 border-slate-700/80">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2">
              <Swords className="w-4 h-4 shrink-0" />
              <span>3. Pick 6</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">剩 9 選 6 並指定首發</p>
          </div>
          <div title="非六界神王的 C 級卡綁定封技攔截、時空枷鎖、悲歌護盾、索魂同歸、英靈祝福之一，於登場或陣亡時觸發；六界神王改以【界】魂印取代。" className="border rounded-xl p-5 transition relative overflow-hidden bg-slate-950/80 border-emerald-500/50">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
              <Zap className="w-4 h-4 shrink-0" />
              <span>4. C 級攔截</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">出場或陣亡時觸發</p>
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
              <Activity className={`w-6 h-6 ${isMathStyle ? 'text-[#36B2BC]' : 'text-amber-400'}`} />
              <span>卡池分級表</span>
            </div>
            <p className="text-xs text-slate-400 mt-1" title="表格連接目前圖鑑，精靈更新時占比即時同步。">
              共 {poolStats.total} 隻
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

        {/* 階級判定準則：由 elfDisplayRank 的規則表即時產生（D-03），不寫死 */}
        <div data-testid="rank-rules" title="命運模式評級與一般圖鑑評級同源（getElfDisplayRank）；資料已預設等級者優先。"
          className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 mb-6 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-amber-300 mb-1.5">
            <Info className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{selectedRankTab === 'all' ? '分級判定準則' : `${selectedRankTab} 級判定準則`}</span>
          </div>
          {(selectedRankTab === 'all' ? describeAllRankRules().split('\n') : [describeRankRule(selectedRankTab)]).map(line => <p key={line} className="whitespace-pre-wrap">{line}</p>)}
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
                  <th className="py-3 px-3.5 font-bold">魂印機制</th>
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
                          <ElfAvatar elf={elf} className="w-full h-full object-contain"/>
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
                            【{elf.interceptorEffect.name}】：<RichInline text={elf.interceptorEffect.description} />
                          </span>
                        ) : elf.soulMark?.name ? (
                          <span>
                            <strong className="text-amber-300">【{elf.soulMark.name}】</strong>
                            {elf.soulMark.description ? <>：<RichInline text={elf.soulMark.description} /></> : ''}
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
                      <ElfAvatar elf={elf} className="w-full h-full object-contain"/>
                    </div>
                    <div className="font-bold text-xs text-white text-center truncate w-full">{elf.name}</div>
                    <div className="text-[10px] text-slate-400 text-center mt-0.5"><span className="inline-flex items-center gap-0.5"><TypeIcon type={elf.type} size={12} showLabelWhenMissing={false} />{elf.type}</span> · 總值 {totalStats}</div>
                  </div>

                  <div className="bg-slate-900/90 rounded p-1.5 text-[9px] text-slate-300 border border-slate-800/80 truncate text-center">
                    {elf.destinyRank === 'C' && elf.interceptorEffect && !elf.name.includes("六界神王") ? (
                      <span className="text-emerald-400 font-bold">{elf.interceptorEffect.name}</span>
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
                  <ElfAvatar elf={inspectingElf} className="w-full h-full object-contain"/>
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
                    <div className="font-bold text-emerald-400 mb-0.5" title="此特效為命運之輪模式專門賦予，於精靈登場或陣亡時自動觸發。">C 級專屬攔截：【{inspectingElf.interceptorEffect.name}】</div>
                    <RichDescription text={inspectingElf.interceptorEffect.description} className="text-xs" />
                  </div>
                ) : inspectingElf.soulMark?.name ? (
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <div className="font-bold text-amber-300 mb-0.5">【{inspectingElf.soulMark.name}】魂印</div>
                    <EffectDescription description={inspectingElf.soulMark.description || "提供實時對戰增益效果。"} className="text-xs leading-relaxed" />
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
                    inspectingElf.skills.slice(0, 5).map((skill, idx) => (
                      <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{skill.name}</span>
                            {skill.isFifthSkill && <span data-fifth-skill="true" className="px-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">第五技能</span>}
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 inline-flex items-center gap-0.5"><SkillTypeIcon skill={skill} size={11} showLabelWhenMissing={false} />{skillDisplayType(skill)}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] ${skill.category === '物理' ? 'bg-amber-950 text-amber-300 border border-amber-800' : skill.category === '特殊' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-300'}`}>
                              {skill.category}
                            </span>
                          </div>
                          <div className="text-slate-400 font-mono text-[11px]">
                            威力: <span className="text-white font-bold">{skill.power}</span> | PP: {skill.pp} {skill.priority ? <span className="text-amber-400 font-bold ml-1">(先制{skill.priority > 0 ? `+${skill.priority}` : skill.priority})</span> : null}
                          </div>
                        </div>
                        <RichDescription text={skill.description} fallback="造成一般傷害。" className="text-slate-400 text-[11px]" />
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
