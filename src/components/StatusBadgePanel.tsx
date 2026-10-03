import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EFFECT_CATALOG, EffectInstance } from '../data/effectCatalog';
import { Elf } from '../types';
import { getStatuses } from '../utils/battleHelpers';
import { StatusRegistry } from '../effects/statusRegistry';
import { statusVisual, buffIconFor } from '../battle/effectIcons';
import { ChainImage } from './SeerImages';

interface StatusBadgePanelProps {
  elf: Elf;
  otherEffects?: EffectInstance[];
  emptyHint?: string;
  categoryFilter?: string[];
  disguiseAbnormalStatuses?: boolean;
}

export const StatusBadgePanel: React.FC<StatusBadgePanelProps> = ({ elf, otherEffects = [], emptyHint, categoryFilter, disguiseAbnormalStatuses = false }) => {
  const [selectedEffect, setSelectedEffect] = useState<any | null>(null);
  
  // 1. Convert standard statuses from StatusRegistry
  const mergedStatuses = getStatuses(elf);
  let registryStatuses = Object.entries(mergedStatuses)
    .filter(([id]) => StatusRegistry[id])
    .map(([id, turns]) => ({
      catalogId: id,
      remainingTurns: turns as number,
      isStandardStatus: true,
      data: StatusRegistry[id]
    }));
  
  // 2. Add non-standard effects from EFFECT_CATALOG
  let catalogEffects = Object.entries(mergedStatuses)
    .filter(([id]) => !StatusRegistry[id] && EFFECT_CATALOG[id])
    .map(([id, turns]) => ({
      catalogId: id,
      remainingTurns: turns as number,
      isStandardStatus: false
    }));

  // 魘味只遮蔽己方看到的異常名稱；底層狀態、效果和計時器保持原樣。
  if (disguiseAbnormalStatuses && (registryStatuses.length > 0 || catalogEffects.length > 0)) {
    registryStatuses = [{
      catalogId: '魘昧',
      remainingTurns: 1,
      isStandardStatus: true,
      data: StatusRegistry['魘昧'],
    }];
    catalogEffects = [];
  }

  // 3. Add an immunity indicator if immune
  const extraEffects: any[] = [];
  if (elf.statusImmuneTurns && elf.statusImmuneTurns > 0) {
    extraEffects.push({
      catalogId: 'status_immune',
      remainingTurns: elf.statusImmuneTurns,
      isStandardStatus: false
    });
  }

  // Combine all
  const allEffects = [...registryStatuses, ...catalogEffects, ...extraEffects, ...(otherEffects || [])];
  
  const getCategoryStyle = (categories: string[], name?: string) => {
    if (categories.includes('BOSS_ONLY')) return name === '神話'
      ? { label: 'BOSS特性', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', badge: '★' }
      : { label: 'BOSS特性', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40', badge: '🛡️' };
    if (categories.includes('CONTROL')) return { label: '控制', color: 'bg-red-500/20 text-red-400 border-red-500/40', badge: '🚫' };
    if (categories.includes('WEAKENING')) return { label: '弱化', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40', badge: '🔻' };
    if (categories.includes('RESTRICTIVE')) return { label: '限制', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40', badge: '⛓️' };
    if (categories.includes('EVOLUTIONARY')) return { label: '衍化', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', badge: '🧬' };
    if (categories.includes('AUXILIARY')) return { label: '附屬', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40', badge: '🔹' };
    return { label: '異常', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40', badge: '⚠️' };
  };

  // Grouping
  const categories: Record<string, { label: string; items: any[] }> = {
    CONTROL: { label: '【控制類異常】', items: [] },
    WEAKENING: { label: '【弱化類異常】', items: [] },
    RESTRICTIVE: { label: '【限制類異常】', items: [] },
    EVOLUTIONARY: { label: '【衍化類異常】', items: [] },
    AUXILIARY: { label: '【附屬類異常】', items: [] },
    BOSS_ONLY: { label: '【BOSS特性狀態】', items: [] },
    INDICIA: { label: '【我方印記與專屬】', items: [] },
    INDICIA_HOSTILE: { label: '【他源印記】', items: [] },
    POSITIVE_TURN: { label: '【正面回合類效果】', items: [] },
    NEGATIVE_TURN: { label: '【負面回合類效果】', items: [] },
    SHIELD_BARRIER: { label: '【護盾與護罩】', items: [] },
    COUNT_EFFECT: { label: '【次數性效果】', items: [] },
    NONE: { label: '【一般狀態】', items: [] },
  };

  const CAT_NAMES: Record<string, string> = {
    control: '控制類異常',
    weakening: '弱化類異常',
    restrictive: '限制類異常',
    evolutionary: '衍化類異常',
    auxiliary: '附屬類異常',
    positive_turn: '正面回合類',
    negative_turn: '負面回合類',
    count_effect: '次數性效果',
    shield_barrier: '護盾護罩類',
    indicia: '我方印記',
    indicia_hostile: '他源印記',
    boss_only: 'BOSS特性狀態',
    none: '一般異常'
  };

  allEffects.forEach(e => {
    if (e.isStandardStatus) {
      const reg = e.data;
      let catKey = 'NONE';
      if (reg.categories.includes('BOSS_ONLY')) catKey = 'BOSS_ONLY';
      else if (reg.categories.includes('CONTROL')) catKey = 'CONTROL';
      else if (reg.categories.includes('WEAKENING')) catKey = 'WEAKENING';
      else if (reg.categories.includes('RESTRICTIVE')) catKey = 'RESTRICTIVE';
      else if (reg.categories.includes('EVOLUTIONARY')) catKey = 'EVOLUTIONARY';
      else if (reg.categories.includes('AUXILIARY')) catKey = 'AUXILIARY';
      
      if (categories[catKey]) categories[catKey].items.push(e);
      return;
    }

    const template = EFFECT_CATALOG[e.catalogId];
    if (!template) return;
    
    let catKey = 'NONE';
    if (template.categories.includes('indicia_hostile')) catKey = 'INDICIA_HOSTILE';
    else if (template.categories.includes('indicia')) catKey = 'INDICIA';
    else if (template.categories.includes('control')) catKey = 'CONTROL';
    else if (template.categories.includes('weakening')) catKey = 'WEAKENING';
    else if (template.categories.includes('restrictive')) catKey = 'RESTRICTIVE';
    else if (template.categories.includes('evolutionary')) catKey = 'EVOLUTIONARY';
    else if (template.categories.includes('auxiliary')) catKey = 'AUXILIARY';
    else if (template.categories.includes('positive_turn')) catKey = 'POSITIVE_TURN';
    else if (template.categories.includes('negative_turn')) catKey = 'NEGATIVE_TURN';
    else if (template.categories.includes('shield_barrier')) catKey = 'SHIELD_BARRIER';
    else if (template.categories.includes('count_effect')) catKey = 'COUNT_EFFECT';

    if (categories[catKey]) {
      categories[catKey].items.push(e);
    }
  });

  const displayCategories: Record<string, { label: string; items: any[] }> = categoryFilter 
    ? categoryFilter.reduce((acc, key) => {
        if (categories[key]) acc[key] = categories[key];
        return acc;
      }, {} as Record<string, { label: string; items: any[] }>)
    : categories;

  const hasAnyItems = Object.values(displayCategories).some(cat => cat.items.length > 0);
  if (!hasAnyItems) {
    if (emptyHint) {
      return <div className="text-[10px] text-slate-600 font-mono italic select-none">{emptyHint}</div>;
    }
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(displayCategories).map(([key, cat]) => (
        cat.items.length > 0 && (
          <div key={key} className="flex flex-col">
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {cat.items.map((inst, idx) => {
                  let badge = '';
                  let label = '';
                  let color = '';
                  let displayValue = '';

                  const isShieldOrBarrier = inst.catalogId === 'shield_active' || inst.catalogId === 'barrier_active';
                  if (inst.isStandardStatus) {
                    const style = getCategoryStyle(inst.data.categories, inst.data.name);
                    badge = style.badge;
                    label = inst.data.name;
                    color = style.color;
                    displayValue = !inst.data.categories.includes('BOSS_ONLY') && inst.remainingTurns > 0 ? `${inst.remainingTurns}回合` : '';
                  } else {
                    const template = EFFECT_CATALOG[inst.catalogId];
                    if (!template) return null;
                    badge = template.badge;
                    label = template.label;
                    color = template.color;
                    displayValue = inst.stacks !== undefined 
                      ? `${inst.stacks}${inst.maxStacks ? `/${inst.maxStacks}` : ''}${inst.unit || (isShieldOrBarrier ? '點' : '層')}`
                      : inst.remainingTurns !== undefined && inst.remainingTurns > 0
                      ? `${inst.remainingTurns}回合`
                      : '';
                  }

                  return (
                    <motion.div
                      key={`${inst.catalogId}-${idx}`}
                      initial={{ opacity: 0, scale: 0.9, y: 3 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -5, transition: { duration: 0.3 } }}
                      className="group relative"
                    >
                      <span
                        onClick={() => setSelectedEffect(inst)}
                        title={`點擊查看【${label}】詳細效果說明`}
                        className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-mono cursor-pointer select-none transition-all hover:brightness-125 hover:scale-105 active:scale-95 ${color}`}
                      >
                        {(() => { const ic = statusVisual(label)?.icon || buffIconFor(label); return ic ? <ChainImage urls={[ic]} className="w-3.5 h-3.5 rounded-sm" fallback={<span className="font-extrabold">{badge}</span>} /> : <span className="font-extrabold">{badge}</span>; })()}
                        <span>{label}</span>
                        {displayValue && <span className="opacity-80 scale-90">{displayValue}</span>}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )
      ))}

      {/* Detail Modal for Click */}
      {selectedEffect && (() => {
        let badge = '';
        let label = '';
        let color = '';
        let displayValue = '';
        let description = '';
        let catLabels = '';

        if (selectedEffect.isStandardStatus) {
          const style = getCategoryStyle(selectedEffect.data.categories, selectedEffect.data.name);
          badge = style.badge;
          label = selectedEffect.data.name;
          color = style.color;
          displayValue = !selectedEffect.data.categories.includes('BOSS_ONLY') && selectedEffect.remainingTurns > 0 ? `${selectedEffect.remainingTurns}回合` : '';
          description = selectedEffect.data.description || statusVisual(label)?.desc || '';
          catLabels = selectedEffect.data.categories.join(' / ');
        } else {
          const template = EFFECT_CATALOG[selectedEffect.catalogId];
          if (!template) return null;
          badge = template.badge;
          label = template.label;
          color = template.color;
          const isShieldOrBarrier = selectedEffect.catalogId === 'shield_active' || selectedEffect.catalogId === 'barrier_active';
          displayValue = selectedEffect.stacks !== undefined 
            ? `${selectedEffect.stacks}${selectedEffect.maxStacks ? `/${selectedEffect.maxStacks}` : ''}${selectedEffect.unit || (isShieldOrBarrier ? '點' : '層')}`
            : selectedEffect.remainingTurns !== undefined && selectedEffect.remainingTurns > 0
            ? `${selectedEffect.remainingTurns}回合`
            : '';
          description = (template.describe ? template.describe(selectedEffect) : '') || statusVisual(label)?.desc || label;
          catLabels = template.categories.map(c => CAT_NAMES[c] || c).join(' / ');
        }

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={() => setSelectedEffect(null)}>
            <div className="bg-[#0A0C11] border border-cyan-500/50 p-5 rounded-2xl shadow-2xl max-w-sm w-full text-left relative animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedEffect(null)} className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/50 hover:bg-slate-700">
                ✕
              </button>
              <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-3 pr-8">
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-[10px] font-extrabold border ${color}`}>
                  {badge}
                </span>
                <span className="font-bold text-slate-100 text-base">{label}</span>
                {displayValue && <span className="text-xs text-amber-400 font-mono font-bold">[{displayValue}]</span>}
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-700 font-mono font-bold">
                  {catLabels}
                </span>
              </div>
              <div className="text-slate-200 text-xs leading-relaxed bg-slate-900/80 p-3 rounded-xl border border-slate-800 whitespace-pre-wrap font-sans">
                {description}
              </div>
              <div className="mt-4 text-right">
                <button
                  onClick={() => setSelectedEffect(null)}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  知道了
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
