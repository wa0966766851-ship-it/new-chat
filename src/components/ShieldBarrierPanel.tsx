import React from 'react';
import { Elf } from '../types';
import { ChainImage } from './SeerImages';
import { buffIconFor } from '../battle/effectIcons';

interface ShieldBarrierPanelProps {
  elf: Elf;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const ShieldBarrierPanel: React.FC<ShieldBarrierPanelProps> = ({
  elf,
  isExpanded,
  onToggleExpand,
}) => {
  const shield = elf.shield || 0;
  const barrier = elf.barrier || 0;
  const maxHp = elf.maxHp || 1000;

  // Percentage relative to maxHp for bar width display
  const shieldPercent = Math.min(100, Math.max(0, (shield / maxHp) * 100));
  const barrierPercent = Math.min(100, Math.max(0, (barrier / maxHp) * 100));
  const shieldIcon = buffIconFor('護盾') || '/seer/buff/33.png';
  const barrierIcon = buffIconFor('護罩') || '/seer/buff/32.png';
  const effectIcon = (url: string) => <ChainImage urls={[url]} className="w-4 h-4 rounded-sm shrink-0" />;

  return (
    <div className="mb-2">
      <div
        onClick={onToggleExpand}
        className="flex justify-between items-center p-1.5 rounded cursor-pointer hover:bg-slate-800/40 transition-colors border border-slate-800/60 bg-slate-950/40 select-none"
      >
        <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-1">
          {effectIcon(shieldIcon)} 精靈護盾與護罩 {isExpanded ? "▼" : "▶"}
        </span>
        
        {/* 折疊處小UI：分別顯示護盾與護罩，互相不干擾、不統計為一個數字 */}
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all flex items-center gap-1 border ${
              shield > 0
                ? "bg-cyan-950/90 border-cyan-500/60 text-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.3)]"
                : "bg-slate-900/40 border-slate-800 text-slate-500"
            }`}
          >
            {effectIcon(shieldIcon)} 護盾: <span className="font-mono">{shield > 0 ? shield : 0}</span>
          </span>

          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all flex items-center gap-1 border ${
              barrier > 0
                ? "bg-fuchsia-950/90 border-fuchsia-500/60 text-fuchsia-300 shadow-[0_0_6px_rgba(217,70,239,0.3)]"
                : "bg-slate-900/40 border-slate-800 text-slate-500"
            }`}
          >
            {effectIcon(barrierIcon)} 護罩: <span className="font-mono">{barrier > 0 ? barrier : 0}</span>
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-1 border border-slate-800 rounded bg-slate-950/80 p-2 space-y-2.5 font-mono select-none">
          {/* 精靈護盾 (Attack / Skill Shield) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                {effectIcon(shieldIcon)} 精靈護盾 <span className="text-[8px] text-slate-500 font-normal">(吸收技能攻擊傷害)</span>
              </span>
              <span className="text-[11px] font-black text-cyan-200">
                {shield} <span className="text-[8px] text-slate-500">點</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 border border-cyan-950 rounded-full overflow-hidden p-0.5 relative">
              <div
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                style={{ width: `${shieldPercent}%` }}
              />
            </div>
          </div>

          {/* 精靈護罩 (Fixed / Percent Barrier) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-fuchsia-400 font-bold flex items-center gap-1">
                {effectIcon(barrierIcon)} 精靈護罩 <span className="text-[8px] text-slate-500 font-normal">(吸收固傷/百分比傷害)</span>
              </span>
              <span className="text-[11px] font-black text-fuchsia-200">
                {barrier} <span className="text-[8px] text-slate-500">點</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 border border-fuchsia-950 rounded-full overflow-hidden p-0.5 relative">
              <div
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-fuchsia-500 via-pink-400 to-purple-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]"
                style={{ width: `${barrierPercent}%` }}
              />
            </div>
          </div>

          {/* 表格詳細數據 - 獨立呈現 */}
          <div className="border border-slate-900 rounded bg-slate-900/50 overflow-hidden text-[9px]">
            <div className="grid grid-cols-3 bg-slate-900/80 border-b border-slate-800 px-1.5 py-0.5 text-slate-400 font-bold text-center">
              <div>防護類型</div>
              <div>吸收類別</div>
              <div>當前狀態</div>
            </div>
            <div className="grid grid-cols-3 border-b border-slate-900/60 px-1.5 py-1 text-center items-center">
              <div className="text-cyan-400 font-medium flex items-center justify-center gap-0.5">
                {effectIcon(shieldIcon)} 精靈護盾
              </div>
              <div className="text-slate-400">技能攻擊傷害</div>
              <div className={shield > 0 ? "text-cyan-300 font-bold" : "text-slate-600"}>
                {shield > 0 ? `${shield} 點` : "0 點 (未開啟)"}
              </div>
            </div>
            <div className="grid grid-cols-3 px-1.5 py-1 text-center items-center">
              <div className="text-fuchsia-400 font-medium flex items-center justify-center gap-0.5">
                {effectIcon(barrierIcon)} 精靈護罩
              </div>
              <div className="text-slate-400">固定/百分比傷害</div>
              <div className={barrier > 0 ? "text-fuchsia-300 font-bold" : "text-slate-600"}>
                {barrier > 0 ? `${barrier} 點` : "0 點 (未開啟)"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
