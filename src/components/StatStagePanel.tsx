import React from 'react';
import { Elf } from '../types';
import { statusVisual } from '../battle/effectIcons';
import { ChainImage } from './SeerImages';

interface StatStagePanelProps {
  elf: Elf;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  disguiseAsNightmare?: boolean;
}

const STAT_CONFIG: Array<{
  key: keyof Required<NonNullable<Elf['statStages']>>;
  label: string;
}> = [
  { key: 'atk', label: '攻擊' },
  { key: 'def', label: '防禦' },
  { key: 'spatk', label: '特攻' },
  { key: 'spdef', label: '特防' },
  { key: 'speed', label: '速度' },
  { key: 'accuracy', label: '命中' },
];

export const StatStagePanel: React.FC<StatStagePanelProps> = ({
  elf,
  isExpanded = true,
  onToggleExpand,
  className = '',
  disguiseAsNightmare = false,
}) => {
  const rawStages = (elf.statStages || {
    atk: 0,
    def: 0,
    spatk: 0,
    spdef: 0,
    speed: 0,
    accuracy: 0,
  }) as Record<string, number>;
  // 魘昧（官方）：能力提升狀態對己方展示為 1 回合的魘昧；能力下降照常顯示。
  const maskedBoost = disguiseAsNightmare && Object.values(rawStages).some(value => Number(value) > 0);
  const stages = (disguiseAsNightmare
    ? Object.fromEntries(Object.entries(rawStages).map(([k, v]) => [k, Number(v) > 0 ? 0 : v]))
    : rawStages) as any;
  const nightmareIcon = statusVisual('魘昧')?.icon;

  let buffCount = 0;
  let debuffCount = 0;
  let totalBuffStages = 0;
  let totalDebuffStages = 0;

  STAT_CONFIG.forEach(({ key }) => {
    const val = stages[key] || 0;
    if (val > 0) {
      buffCount++;
      totalBuffStages += val;
    } else if (val < 0) {
      debuffCount++;
      totalDebuffStages += Math.abs(val);
    }
  });

  return (
    <div className={`space-y-1 ${className}`}>
      {/* 折疊列標題 */}
      <div
        onClick={onToggleExpand}
        className="flex justify-between items-center cursor-pointer hover:bg-slate-800/40 p-1 rounded transition-colors border border-transparent hover:border-slate-800/60 select-none"
      >
        <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest flex items-center gap-1">
          ⚡ 能力等級狀態 {onToggleExpand ? (isExpanded ? "▼" : "▶") : null}
        </span>
        
        {/* 摘要標籤 */}
        <div className="flex items-center gap-1">
          {buffCount > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 bg-amber-950/60 border border-amber-500/50 rounded text-amber-300 font-bold tracking-tight">
              強化 +{totalBuffStages} ({buffCount}項)
            </span>
          )}
          {debuffCount > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/50 rounded text-purple-300 font-bold tracking-tight">
              弱化 -{totalDebuffStages} ({debuffCount}項)
            </span>
          )}
          {maskedBoost && (
            <span className="text-[8px] px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/50 rounded text-purple-300 font-bold inline-flex items-center gap-0.5">
              {nightmareIcon && <ChainImage urls={[nightmareIcon]} className="w-3 h-3 rounded-sm" />}魘昧(1)
            </span>
          )}
          {buffCount === 0 && debuffCount === 0 && !maskedBoost && (
            <span className="text-[8px] px-1.5 py-0.5 bg-slate-900/60 border border-slate-700/50 rounded text-slate-400 font-medium">
              持平 (0)
            </span>
          )}
        </div>
      </div>

      {/* 6*1 網格 layout */}
      {isExpanded && (
        <div className="grid grid-cols-6 gap-1 p-0.5 bg-slate-950/70 border border-slate-800/80 rounded font-mono select-none">
          {STAT_CONFIG.map(({ key, label }) => {
            const val = stages[key] || 0;
            const isBuff = val > 0;
            const isDebuff = val < 0;

            let bgClass = "bg-slate-900/30 border-slate-800/60 text-slate-400";
            let valClass = "text-slate-500 font-normal";

            if (isBuff) {
              bgClass = "bg-amber-950/40 border-amber-600/40 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.1)]";
              valClass = "text-amber-400 font-bold drop-shadow-[0_0_2px_rgba(251,191,36,0.4)]";
            } else if (isDebuff) {
              bgClass = "bg-purple-950/40 border-purple-600/40 text-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.1)]";
              valClass = "text-purple-300 font-bold drop-shadow-[0_0_2px_rgba(192,132,252,0.4)]";
            }

            return (
              <div
                key={key}
                className={`flex flex-col items-center justify-center py-0.5 px-0.5 rounded-sm border text-center transition-all ${bgClass}`}
              >
                <span className="text-[8px] font-medium tracking-tight text-slate-300/90 leading-none">
                  {label}
                </span>
                <span className={`text-[9.5px] leading-tight mt-0.5 ${valClass}`}>
                  {val > 0 ? `+${val}` : val}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
