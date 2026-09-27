import React, { useState, useContext, createContext } from 'react';
import { TypeIcon } from "./SeerImages";
import { Activity, Crown } from 'lucide-react';
import { Elf, Skill, BattleLog, BattleMode, BattleItem } from '../types';
import { getAttributeBadgeColor } from '../utils/statCalculator';
import { BattleContextProps, BattleContext, useBattle } from './BattleScreen';

// --- Helper Components ---

export const ExtraElfPanel = ({ side, elves, inline }: { side: "p1" | "p2", elves: any[], inline?: boolean }) => {
  const [selectedElf, setSelectedElf] = useState<any | null>(null);
  const activeElves = (elves || []).filter(e => e && e.currentHp > 0);
  
  if (activeElves.length === 0) {
    if (inline) return <span className="text-[10px] text-slate-600 font-mono italic">無額外伴生精靈</span>;
    return null;
  }

  const renderModal = () => {
    if (!selectedElf) return null;
    const hpPercent = (selectedElf.currentHp / selectedElf.maxHp) * 100;
    return (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
        onClick={() => setSelectedElf(null)}
      >
        <div 
          className="bg-[#0A0C10] border-2 border-cyan-500/80 rounded-2xl max-w-lg w-full p-6 shadow-[0_0_40px_rgba(6,182,212,0.3)] text-slate-200 relative animate-scale-up"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedElf.badge || '✨'}</span>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
                  {selectedElf.name}
                  <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${getAttributeBadgeColor(selectedElf.type || '水')} inline-flex items-center gap-1`}>
                    {selectedElf.type && <TypeIcon type={selectedElf.type} size={14} showLabelWhenMissing={false} />}{selectedElf.type || '額外精靈'}
                  </span>
                </h3>
                <span className="text-xs text-cyan-400 font-mono">獨立協同伴生精靈 · 專屬狀態檢視</span>
              </div>
            </div>
            <button 
              onClick={() => setSelectedElf(null)}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 mb-4">
            <div className="flex justify-between items-center text-xs font-mono mb-1.5">
              <span className="text-slate-400 font-bold">當前剩餘體力 (HP)</span>
              <span className="font-bold text-slate-100 text-sm">{selectedElf.currentHp} / {selectedElf.maxHp} <span className="text-cyan-400">({Math.round(hpPercent)}%)</span></span>
            </div>
            <div className="relative h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div 
                className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
                  hpPercent > 50 ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : hpPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${hpPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              當前獨立能力值面板
            </div>
            <div className="grid grid-cols-6 gap-2 py-2.5 px-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center font-mono">
              {['atk', 'def', 'spatk', 'spdef', 'speed'].map(stat => (
                <div key={stat} className="border-r border-slate-800/60 last:border-0">
                  <div className="text-[9px] text-slate-500 uppercase font-bold">{stat === 'atk' ? '攻擊' : stat === 'def' ? '防禦' : stat === 'spatk' ? '特攻' : stat === 'spdef' ? '特防' : '速度'}</div>
                  <div className="font-bold text-slate-100 text-sm mt-0.5">{(selectedElf.stats as any)?.[stat] || 0}</div>
                </div>
              ))}
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">體力上限</div>
                <div className="font-bold text-cyan-400 text-sm mt-0.5">{selectedElf.maxHp}</div>
              </div>
            </div>
          </div>

          <div className="bg-[#050608] border border-slate-800 rounded-xl p-3.5 max-h-56 overflow-y-auto">
            <div className="text-[11px] font-bold text-amber-400 mb-2 flex items-center gap-1.5">
              <span>⚡</span> 專屬伴生特性與效果說明
            </div>
            <p className="text-slate-300 text-xs leading-[1.75] whitespace-pre-wrap antialiased font-sans">
              {selectedElf.description?.replace(/([；;])\s*/g, '$1\n\n') || "協同作戰中的特殊單位，具有獨立的能力值與運算邏輯。"}
            </p>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => setSelectedElf(null)}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              關閉面板
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {activeElves.map((elf, idx) => {
          const hpPercent = (elf.currentHp / elf.maxHp) * 100;
          return (
            <div 
              key={idx} 
              onClick={(e) => { e.stopPropagation(); setSelectedElf(elf); }}
              className="flex items-center gap-1 bg-[#050608] border border-cyan-500/40 hover:border-cyan-400 rounded px-2 py-0.5 text-[10px] font-mono shadow-sm cursor-pointer transition-all hover:scale-105"
              title="點擊查看精靈能力值與效果詳情"
            >
              <span>{elf.badge || '✨'}</span>
              <span className="font-bold text-slate-200">{elf.name}</span>
              <span className={hpPercent > 50 ? 'text-cyan-400 font-bold' : 'text-amber-400 font-bold'}>{elf.currentHp}/{elf.maxHp}</span>
            </div>
          );
        })}
        {renderModal()}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 animate-fade-in">
      <div className="flex items-center gap-1 mb-0.5 px-0.5">
        <Activity className="w-3 h-3 text-cyan-400" />
        <span className="text-[10px] font-black text-cyan-300 uppercase tracking-wider">額外精靈 (點擊卡片檢視能力與效果)</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {activeElves.map((elf, idx) => {
          const hpPercent = (elf.currentHp / elf.maxHp) * 100;
          return (
            <div 
              key={idx} 
              onClick={(e) => { e.stopPropagation(); setSelectedElf(elf); }}
              className="group relative bg-[#050608] border border-slate-800 rounded-lg p-1.5 shadow-sm hover:border-cyan-500/60 transition-all duration-200 cursor-pointer hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            >
              <div className="flex justify-between items-center mb-1 gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] shrink-0">{elf.badge || '✨'}</span>
                  <span className="font-bold text-[11px] text-slate-100 group-hover:text-cyan-400 transition-colors truncate">{elf.name}</span>
                </div>
                <span className={`text-[8px] px-1 py-0.2 rounded font-bold shrink-0 ${getAttributeBadgeColor(elf.type || '水')} inline-flex items-center gap-0.5`}>
                  {elf.type && <TypeIcon type={elf.type} size={10} showLabelWhenMissing={false} />}{elf.type || '額外'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 mb-0.5">
                <span>HP</span>
                <span className="font-bold text-slate-200">{elf.currentHp}/{elf.maxHp} ({Math.round(hpPercent)}%)</span>
              </div>
              <div className="relative h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80">
                <div 
                  className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
                    hpPercent > 50 ? 'bg-cyan-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${hpPercent}%` }}
                ></div>
              </div>
              
              {/* Simplified Tooltip for preview */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#0A0C10] border border-slate-800 p-2 rounded-lg shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 text-[10px]">
                <p className="font-bold text-cyan-400 mb-1">{elf.name}</p>
                <p className="text-slate-400 line-clamp-3">{elf.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      {renderModal()}
    </div>
  );
};

export const getHpBarColor = (curr: number, max: number) => {
  if (max <= 0) return "bg-slate-800";
  const percent = (curr / max) * 100;
  if (percent > 50) return "bg-gradient-to-r from-emerald-600 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
  if (percent > 20) return "bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]";
  return "bg-gradient-to-r from-rose-600 to-pink-500 shadow-[0_0_10px_rgba(244,63,94,0.4)] animate-pulse";
};
