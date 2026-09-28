import React, { useState } from "react";
import { BaseStats, Inscription } from "../types";
import { SEER_NATURES, getNatureFromModifiers, getModifiersFromNature, EV_PRESETS, SeerNature } from "../utils/seerNatures";
import { calculateElfStats, getDefaultEvs } from "../utils/statCalculator";
import { Sparkles, Zap, Shield, Sword, Heart, Wind, RotateCcw, CheckCircle2, AlertTriangle, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

interface EvNaturePanelProps {
  baseStats: BaseStats;
  ivs?: BaseStats;
  evs?: BaseStats;
  natureModifiers?: { [key in keyof BaseStats]?: number };
  inscriptions?: { stats: BaseStats }[];
  guildBonuses?: BaseStats;
  hasAnnualBonus?: boolean;
  level?: number;
  onEvsChange: (newEvs: BaseStats) => void;
  onNatureChange: (newMods: { [key in keyof BaseStats]: number }) => void;
  readonly?: boolean;
}

export default function EvNaturePanel({
  baseStats,
  ivs,
  evs,
  natureModifiers,
  inscriptions,
  guildBonuses,
  hasAnnualBonus,
  level = 100,
  onEvsChange,
  onNatureChange,
  readonly = false
}: EvNaturePanelProps) {
  const [showFormula, setShowFormula] = useState(true);
  const currentEvs = evs || getDefaultEvs(baseStats);
  const currentMods = natureModifiers || { hp: 1.0, atk: 1.0, def: 1.0, spatk: 1.0, spdef: 1.0, speed: 1.0 };
  
  const currentNature: SeerNature = getNatureFromModifiers(currentMods);

  const totalEvs = Object.values(currentEvs).reduce((sum, v) => sum + (v || 0), 0);
  const isEvOverLimit = totalEvs > 510;

  const calculatedStats = calculateElfStats(
    baseStats,
    level,
    ivs,
    currentEvs,
    currentMods,
    inscriptions as Inscription[],
    guildBonuses,
    hasAnnualBonus
  );

  const handleStatEvChange = (stat: keyof BaseStats, value: number) => {
    if (readonly) return;
    const clampedValue = Math.max(0, Math.min(255, isNaN(value) ? 0 : value));
    
    // Reallocate from other stats when all 510 points are already assigned.
    // This keeps the standard full EV preset editable without a separate clearing step.
    const nextEvs = { ...currentEvs };
    const otherSum = Object.entries(currentEvs)
      .filter(([k]) => k !== stat)
      .reduce((sum, [, v]) => sum + (v || 0), 0);
    let excess = Math.max(0, otherSum + clampedValue - 510);
    if (excess > 0) {
      const donors = (Object.keys(nextEvs) as (keyof BaseStats)[])
        .filter(key => key !== stat)
        .sort((a, b) => nextEvs[b] - nextEvs[a]);
      for (const donor of donors) {
        const taken = Math.min(excess, nextEvs[donor]);
        nextEvs[donor] -= taken;
        excess -= taken;
        if (!excess) break;
      }
    }
    nextEvs[stat] = clampedValue - excess;
    onEvsChange(nextEvs);
  };

  const handleApplyPreset = (presetEvs: BaseStats) => {
    if (readonly) return;
    onEvsChange({ ...presetEvs });
  };

  const handleNatureSelect = (natureName: string) => {
    if (readonly) return;
    const newMods = getModifiersFromNature(natureName);
    onNatureChange(newMods);
  };

  const handleManualNatureChange = (type: "up" | "down", stat: keyof BaseStats | "none") => {
    if (readonly) return;
    const nextMods: { [key in keyof BaseStats]: number } = { hp: 1.0, atk: 1.0, def: 1.0, spatk: 1.0, spdef: 1.0, speed: 1.0 };
    
    let targetUp: keyof BaseStats | null = currentNature.up;
    let targetDown: keyof BaseStats | null = currentNature.down;
    
    if (type === "up") {
      targetUp = stat === "none" ? null : stat;
      if (targetUp === targetDown) targetDown = null;
      if (targetUp && !targetDown) targetDown = nonHpStats.find(s => s !== targetUp) || null;
    } else {
      targetDown = stat === "none" ? null : stat;
      if (targetDown === targetUp) targetUp = null;
      if (targetDown && !targetUp) targetUp = nonHpStats.find(s => s !== targetDown) || null;
    }

    if (targetUp) nextMods[targetUp] = 1.1;
    if (targetDown) nextMods[targetDown] = 0.9;
    
    if (!targetUp || !targetDown) {
      nextMods.atk = 1.0;
      nextMods.def = 1.0;
      nextMods.spatk = 1.0;
      nextMods.spdef = 1.0;
      nextMods.speed = 1.0;
    }
    onNatureChange(nextMods);
  };

  const statLabels: { key: keyof BaseStats; label: string; icon: any; color: string }[] = [
    { key: "hp", label: "體力", icon: Heart, color: "text-rose-400" },
    { key: "atk", label: "攻擊", icon: Sword, color: "text-amber-400" },
    { key: "def", label: "防禦", icon: Shield, color: "text-emerald-400" },
    { key: "spatk", label: "特攻", icon: Zap, color: "text-blue-400" },
    { key: "spdef", label: "特防", icon: Shield, color: "text-indigo-400" },
    { key: "speed", label: "速度", icon: Wind, color: "text-cyan-400" },
  ];

  const nonHpStats: (keyof BaseStats)[] = ["atk", "def", "spatk", "spdef", "speed"];

  return (
    <div className="bg-[#0A0D14] border border-slate-800/90 rounded-2xl p-5 space-y-6 shadow-xl">
      {/* Top Banner: Traditional Chinese Explanation */}
      <div className="bg-[#06080E] border border-blue-500/30 rounded-2xl overflow-hidden transition-all duration-300">
        <div 
          className="p-3.5 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-transparent flex items-center justify-between cursor-pointer hover:bg-blue-900/20 transition-all"
          onClick={() => setShowFormula(!showFormula)}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <h4 className="text-xs font-bold text-blue-300 tracking-wide">
              📜 《賽爾號》學習力與能力值演算公式說明 (正統實裝)
            </h4>
          </div>
          <button type="button" className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
            {showFormula ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {showFormula && (
          <div className="p-4 border-t border-slate-800/80 text-[11.5px] text-slate-300 leading-relaxed space-y-2.5 font-sans">
            <p>
              在《賽爾號》中，每隻精靈最多可獲得 <strong className="text-amber-400 font-bold">510 點</strong> 學習力，單項上限為 <strong className="text-amber-400 font-bold">255 點</strong>。每增加 <strong className="text-blue-400 font-bold">4 點</strong> 學習力，該項能力值就能提升 <strong className="text-blue-400 font-bold">1 點</strong>。要達到單項能力極限，通常刷至 <strong className="text-amber-400 font-bold">252 點</strong> 即可。
            </p>
            
            <div className="bg-[#040609] border border-slate-800/90 p-3 rounded-xl font-mono text-slate-200 text-[11px] space-y-1.5 shadow-inner">
              <div className="text-blue-300 font-bold flex items-center gap-1.5">
                <span>⚡ 滿級 (100級) 精靈的能力值計算公式如下：</span>
              </div>
              <div className="pl-2 border-l-2 border-blue-500/50 space-y-1">
                <div>
                  <span className="text-slate-400">非體力項（攻擊、特攻、防禦、特防、速度）：</span>
                  <br />
                  <code className="text-emerald-300 font-bold">能力值 = Int[(種族值 × 2 + 學習力 ÷ 4 + 個體值 + 5) × 性格修正]</code>
                </div>
                <div className="pt-1">
                  <span className="text-slate-400">體力項（HP）：</span>
                  <br />
                  <code className="text-amber-300 font-bold">能力值 = Int(種族值 × 2 + 學習力 ÷ 4 + 個體值 + 110)</code>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60 leading-normal">
              <span className="text-amber-300 font-bold">💡 公式參數說明：</span>
              <br />• <strong className="text-slate-200">性格修正：</strong>提升項為 <code className="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded">1.1</code>，平衡項為 <code className="text-slate-300 font-bold bg-slate-700/30 px-1 py-0.5 rounded">1.0</code>，降低項為 <code className="text-cyan-400 font-bold bg-cyan-500/10 px-1 py-0.5 rounded">0.9</code>。
              <br />• <strong className="text-slate-200">Int：</strong>代表取整，即計算結果直接無條件捨去小數部分。
              <br /><span className="text-slate-500 italic">*(註：此公式為基礎面板計算，未包含刻印、套裝或稱號等額外加成)*</span>
            </div>
          </div>
        )}
      </div>

      {/* Part 1: Nature Selection Section (性格配置) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm"></span>
            性格調校系統 (Official Natures)
          </h4>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">當前性格：</span>
            <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-full text-xs">
              {currentNature.name} {currentNature.description !== "平衡性格 (全部 1.0x)" ? `(${currentNature.description})` : "(平衡 1.0x)"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#06080E] p-3.5 rounded-xl border border-slate-800/80">
          {/* Option A: Select official Nature from 25 Natures */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
              🔮 從 25 種官方性格直接挑選：
            </label>
            <select
              value={currentNature.name}
              onChange={(e) => handleNatureSelect(e.target.value)}
              disabled={readonly}
              className="w-full bg-[#0E1118] border border-slate-700/80 text-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
            >
              <optgroup label="🔥 物攻強化 (+10% 攻擊)">
                {SEER_NATURES.filter(n => n.category === "物攻").map(n => (
                  <option key={n.name} value={n.name}>{n.name} ({n.description})</option>
                ))}
              </optgroup>
              <optgroup label="⚡ 特攻強化 (+10% 特攻)">
                {SEER_NATURES.filter(n => n.category === "特攻").map(n => (
                  <option key={n.name} value={n.name}>{n.name} ({n.description})</option>
                ))}
              </optgroup>
              <optgroup label="💨 速度強化 (+10% 速度)">
                {SEER_NATURES.filter(n => n.category === "速度").map(n => (
                  <option key={n.name} value={n.name}>{n.name} ({n.description})</option>
                ))}
              </optgroup>
              <optgroup label="🛡️ 防禦強化 (+10% 防禦)">
                {SEER_NATURES.filter(n => n.category === "防禦").map(n => (
                  <option key={n.name} value={n.name}>{n.name} ({n.description})</option>
                ))}
              </optgroup>
              <optgroup label="✨ 特防強化 (+10% 特防)">
                {SEER_NATURES.filter(n => n.category === "特防").map(n => (
                  <option key={n.name} value={n.name}>{n.name} ({n.description})</option>
                ))}
              </optgroup>
              <optgroup label="⚖️ 平衡性格 (全部 1.0x)">
                {SEER_NATURES.filter(n => n.category === "平衡").map(n => (
                  <option key={n.name} value={n.name}>{n.name} ({n.description})</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Option B: Manual Up/Down Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-rose-400 mb-1.5 flex items-center gap-1">
                <span>🔺 強化項 (1.1x)</span>
              </label>
              <select
                value={currentNature.up || "none"}
                onChange={(e) => handleManualNatureChange("up", e.target.value as any)}
                disabled={readonly}
                className="w-full bg-[#0E1118] border border-rose-500/30 text-rose-300 rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-rose-500"
              >
                <option value="none">無 (平衡)</option>
                {nonHpStats.map(s => (
                  <option key={s} value={s}>
                    {s === "atk" ? "攻擊 (+10%)" : s === "def" ? "防禦 (+10%)" : s === "spatk" ? "特攻 (+10%)" : s === "spdef" ? "特防 (+10%)" : "速度 (+10%)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-cyan-400 mb-1.5 flex items-center gap-1">
                <span>🔻 弱化項 (0.9x)</span>
              </label>
              <select
                value={currentNature.down || "none"}
                onChange={(e) => handleManualNatureChange("down", e.target.value as any)}
                disabled={readonly}
                className="w-full bg-[#0E1118] border border-cyan-500/30 text-cyan-300 rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-cyan-500"
              >
                <option value="none">無 (平衡)</option>
                {nonHpStats.map(s => (
                  <option key={s} value={s}>
                    {s === "atk" ? "攻擊 (-10%)" : s === "def" ? "防禦 (-10%)" : s === "spatk" ? "特攻 (-10%)" : s === "spdef" ? "特防 (-10%)" : "速度 (-10%)"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="text-[10.5px] text-slate-400 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>性格保存規則保障：系統已強制執行「一項 1.1、一項 0.9，或全部 1.0」之賽爾號正統性格協議，無任何保存衝突或浮點數 Bug。</span>
        </div>
      </div>

      {/* Part 2: Learning Points (EVs) Section (學習力配置) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm"></span>
            學習力分配系統 (Effort Values)
          </h4>
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="text-slate-400">總學習力分配：</span>
              <span className={`px-2 py-0.5 rounded border ${isEvOverLimit ? "bg-rose-500/20 border-rose-500 text-rose-300" : totalEvs === 510 ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-blue-500/10 border-blue-500/30 text-blue-300"}`}>
                {totalEvs} / 510
              </span>
            </div>
          </div>
        </div>

        {/* Preset Spreads Buttons */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            ⚡ 快捷刷法推薦 (一鍵套用)：
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EV_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                disabled={readonly}
                onClick={() => handleApplyPreset(preset.evs)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-blue-900/40 border border-slate-800 hover:border-blue-500/60 text-slate-300 hover:text-white rounded-lg text-xs transition-all font-medium flex items-center gap-1"
                title={preset.desc}
              >
                <span>{preset.name}</span>
                <span className="text-[10px] text-slate-500">({preset.desc.split(" ")[0]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 6 Stats EV Sliders & Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {statLabels.map(({ key, label, icon: Icon, color }) => {
            const evVal = currentEvs[key] || 0;
            const baseVal = baseStats[key] || 0;
            const ivVal = ivs ? (ivs[key] || 31) : 31;
            const modVal = currentMods[key] || 1.0;
            const calcVal = calculatedStats[key] || 0;
            
            return (
              <div key={key} className="bg-[#05070A] border border-slate-800/80 rounded-xl p-3 space-y-2.5 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs font-bold text-slate-200">{label}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      (種族:{baseVal})
                    </span>
                  </div>
                  
                  {/* Nature badge for non-HP */}
                  {key !== "hp" && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${Math.abs(modVal - 1.1) < 0.01 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : Math.abs(modVal - 0.9) < 0.01 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-500"}`}>
                      {Math.abs(modVal - 1.1) < 0.01 ? "▲ 強化 1.1x" : Math.abs(modVal - 0.9) < 0.01 ? "▼ 弱化 0.9x" : "— 1.0x"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="255"
                    step="1"
                    disabled={readonly}
                    value={evVal}
                    onChange={(e) => handleStatEvChange(key, parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <input
                    type="number"
                    min="0"
                    max="255"
                    disabled={readonly}
                    value={evVal}
                    onChange={(e) => handleStatEvChange(key, parseInt(e.target.value))}
                    className="w-14 bg-[#0E1118] border border-slate-700 rounded px-1.5 py-1 text-xs text-center font-mono text-amber-300 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-900 pt-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => handleStatEvChange(key, 252)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-blue-900/30 border border-slate-800 hover:border-blue-500/50 text-slate-300 rounded transition-all"
                      title="設定為極限 252"
                    >
                      252
                    </button>
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => handleStatEvChange(key, evVal + 4)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded transition-all"
                      title="增加 4 點 (+1能力值)"
                    >
                      +4
                    </button>
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => handleStatEvChange(key, evVal - 4)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded transition-all"
                      title="減少 4 點"
                    >
                      -4
                    </button>
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => handleStatEvChange(key, 0)}
                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-rose-900/30 border border-slate-800 hover:border-rose-500/50 text-slate-400 rounded transition-all"
                      title="歸零"
                    >
                      0
                    </button>
                  </div>

                  <div className="font-mono text-right">
                    <span className="text-slate-500">實戰：</span>
                    <span className="text-xs font-bold text-emerald-400">{calcVal}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
