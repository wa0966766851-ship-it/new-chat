import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Inscription, BaseStats } from "../types";
import { INSCRIPTION_PRESETS, getDefaultInscriptions } from "../data/inscriptionsCatalog";
import { X, Sparkles, Trash2, CheckCircle2, Shield, Zap } from "lucide-react";
import { HEXAGON_CLIP } from "./InscriptionSlot";

interface InscriptionModalProps {
  slotIndex: number;
  inscription?: Inscription;
  onSave: (updated?: Inscription) => void;
  onClose: () => void;
}

export function InscriptionModal({ slotIndex, inscription, onSave, onClose }: InscriptionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from<HTMLElement>(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') || []);
      const first = controls[0], last = controls[controls.length - 1]; if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  const defaultPreset = getDefaultInscriptions()[slotIndex || 0] || { name: `巔峰·極限全能 ${slotIndex + 1}`, stats: { hp: 150, atk: 75, def: 60, spatk: 75, spdef: 60, speed: 45 } };
  const [name, setName] = useState<string>(inscription?.name || defaultPreset.name);
  const [hp, setHp] = useState<number>(inscription?.stats?.hp ?? defaultPreset.stats.hp);
  const [atk, setAtk] = useState<number>(inscription?.stats?.atk ?? defaultPreset.stats.atk);
  const [def, setDef] = useState<number>(inscription?.stats?.def ?? defaultPreset.stats.def);
  const [spatk, setSpatk] = useState<number>(inscription?.stats?.spatk ?? defaultPreset.stats.spatk);
  const [spdef, setSpdef] = useState<number>(inscription?.stats?.spdef ?? defaultPreset.stats.spdef);
  const [speed, setSpeed] = useState<number>(inscription?.stats?.speed ?? defaultPreset.stats.speed);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const totalBonus = hp + atk + def + spatk + spdef + speed;

  const handleSelectPreset = (preset: Inscription) => {
    setSelectedPresetId(preset.id || "");
    setName(preset.name);
    setHp(preset.stats.hp || 0);
    setAtk(preset.stats.atk || 0);
    setDef(preset.stats.def || 0);
    setSpatk(preset.stats.spatk || 0);
    setSpdef(preset.stats.spdef || 0);
    setSpeed(preset.stats.speed || 0);
  };

  const handleSave = () => {
    const finalStats: BaseStats = {
      hp: Math.max(0, hp),
      atk: Math.max(0, atk),
      def: Math.max(0, def),
      spatk: Math.max(0, spatk),
      spdef: Math.max(0, spdef),
      speed: Math.max(0, speed),
    };

    const finalName = name.trim() || `專屬刻印·第${slotIndex + 1}孔`;

    onSave({
      name: finalName,
      stats: finalStats,
    });
  };

  const handleRemove = () => {
    onSave(undefined);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10030] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`第 ${slotIndex + 1} 刻印孔裝備與調校`} className="bg-[#0D1017] border border-amber-500/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-[0_0_35px_rgba(245,158,11,0.15)] flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/40 via-[#131824] to-[#0D1017] px-5 py-4 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-9 bg-gradient-to-b from-amber-400 to-amber-700 p-[1px] flex items-center justify-center shadow-md"
              style={{ clipPath: HEXAGON_CLIP }}
            >
              <div
                className="w-full h-full bg-[#0A0D14] flex items-center justify-center text-amber-400 font-bold text-xs"
                style={{ clipPath: HEXAGON_CLIP }}
              >
                {slotIndex + 1}
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                第 {slotIndex + 1} 刻印孔裝備與調校
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-normal">
                  六角形專屬刻印
                </span>
              </h3>
              <p className="text-xs text-slate-400">可快速選擇賽爾號經典刻印，或自訂專屬能力數值</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉刻印調校"
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">

          {/* Quick Preset Selector */}
          <div>
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ⚡ 經典賽爾號刻印快捷套用
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {INSCRIPTION_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id || name === preset.name;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)] font-bold"
                        : "bg-[#111520] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 truncate">
                      <span className="truncate">{preset.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex flex-wrap gap-x-1">
                      {preset.stats.hp ? <span>體+{preset.stats.hp}</span> : null}
                      {preset.stats.atk ? <span>攻+{preset.stats.atk}</span> : null}
                      {preset.stats.spatk ? <span>特攻+{preset.stats.spatk}</span> : null}
                      {preset.stats.speed ? <span>速+{preset.stats.speed}</span> : null}
                      {preset.stats.def ? <span>防+{preset.stats.def}</span> : null}
                      {preset.stats.spdef ? <span>特防+{preset.stats.spdef}</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-4">
            {/* Engraving Name Input */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>刻印名稱 (自訂)</span>
                <span className="text-[10px] font-normal text-slate-400">例如：偃月·無雙、極速幻影</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入刻印名稱..."
                className="w-full bg-[#111520] border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Numeric Stat Inputs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300">數值加成調校 (直接輸入)</label>
                <span className="text-xs font-bold text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  總數值加成: +{totalBonus} 點
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#111520] p-2.5 rounded-xl border border-slate-800/80 focus-within:border-emerald-500/60 transition-colors">
                  <label className="block text-[10px] font-bold text-emerald-400 mb-1">體力 (HP)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-xs font-mono">+</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={hp}
                      onChange={(e) => setHp(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-bold text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-[#111520] p-2.5 rounded-xl border border-slate-800/80 focus-within:border-rose-500/60 transition-colors">
                  <label className="block text-[10px] font-bold text-rose-400 mb-1">攻擊 (ATK)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-xs font-mono">+</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={atk}
                      onChange={(e) => setAtk(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-bold text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-[#111520] p-2.5 rounded-xl border border-slate-800/80 focus-within:border-purple-500/60 transition-colors">
                  <label className="block text-[10px] font-bold text-purple-400 mb-1">特攻 (SP.ATK)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-xs font-mono">+</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={spatk}
                      onChange={(e) => setSpatk(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-bold text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-[#111520] p-2.5 rounded-xl border border-slate-800/80 focus-within:border-blue-500/60 transition-colors">
                  <label className="block text-[10px] font-bold text-blue-400 mb-1">防禦 (DEF)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-xs font-mono">+</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={def}
                      onChange={(e) => setDef(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-bold text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-[#111520] p-2.5 rounded-xl border border-slate-800/80 focus-within:border-cyan-500/60 transition-colors">
                  <label className="block text-[10px] font-bold text-cyan-400 mb-1">特防 (SP.DEF)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-xs font-mono">+</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={spdef}
                      onChange={(e) => setSpdef(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-bold text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-[#111520] p-2.5 rounded-xl border border-slate-800/80 focus-within:border-amber-500/60 transition-colors">
                  <label className="block text-[10px] font-bold text-amber-400 mb-1">速度 (SPEED)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-xs font-mono">+</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-bold text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-[#0A0D14] px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleRemove}
            className="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            卸下清空此孔
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-xl text-xs shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              確認保存並嵌入
            </button>
          </div>
        </div>

      </div>
    </div>, document.body
  );
}
