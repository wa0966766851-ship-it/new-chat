import React from "react";
import { Elf } from "../types";
import { Timer } from "../battle/timers";
import { Mark } from "../battle/marks";
import { canonicalStatusName } from '../effects/statusIdentity';
import { plainDescription } from '../utils/descFormat';
import { EffectDescription } from './EffectDescription';
import { effectDefinitionEntries } from '../battle/effectSources';
import { elfForViewer, hiddenFromViewer, UNKNOWN_ELF, maskViewerText, viewerMaskTerms } from '../battle/viewerPerspective';
import { activeEffectViews, visibleEffectSourceText } from '../battle/activeEffectViews';
import {statusCountClasses, type StatusCountTone} from '../battle/statusImmunityCount';
import { getStatuses } from '../utils/battleHelpers';
import { statusVisual, UNKNOWN_EFFECT_ICON } from '../battle/effectIcons';
import { ChainImage } from './SeerImages';

export type StateCategory = "異常" | "能力" | "防護" | "印記" | "回合類" | "其他計時" | "次數類" | "常駐";

export interface ActiveEffect {
  name: string;
  desc: string;
  category: StateCategory;
  remaining?: number;
  unit?: "回合" | "次";
  polarity: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  stacks?: number;
  stackUnit?: string;
  icon?: string;
  source?: string;
  tone?: StatusCountTone;
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    paralyzed: "麻痺", poisoned: "中毒", burned: "燒傷", scared: "害怕",
    sleeping: "睡眠", petrified: "石化", confused: "混亂", icebound: "冰封", blind: "失明",
    cursed: "詛咒", disabled: "癱瘓", tired: "疲憊"
  };
  return canonicalStatusName(map[status] || status);
}

export function getActiveEffects(side: "p1" | "p2", state: any): ActiveEffect[] {
  if (!state) return [];
  const source: Elf | null = side === "p1" ? state.p1 : state.p2;
  if (!source || hiddenFromViewer(source, side)) return [];
  const elf = elfForViewer(source, side);

  const effects: ActiveEffect[] = [];
  const hiddenTerms = viewerMaskTerms(state.p2Team || [state.p2]);
  const mask = (text: string | undefined) => maskViewerText(text, hiddenTerms);
  for (const entry of effectDefinitionEntries(elf)) effects.push({ name: `${entry.kind} · ${entry.name}`,
    desc: entry.description || '固有效果與被動技能', category: '常駐', polarity: 'POSITIVE' });

  const statuses = getStatuses(elf);
  // 與現行異常登記表／簡介一致：異常與能力提升顯示為1回合魘昧，下降照常。
  const masked = Object.entries(getStatuses(state.p1) || {}).some(([name, turns]) => canonicalStatusName(name) === '魘昧' && Number(turns) > 0);
  const hasStates = Object.values(statuses).some(turns => Number(turns) > 0);
  const stages = Object.entries(elf.statStages || {});
  if (masked && hasStates) effects.push({ name: '魘昧', desc: '異常狀態受到魘味遮蔽；顯示的1回合不是實際期限。', remaining: 1, unit: '回合', category: '異常', polarity: 'NEGATIVE', icon: statusVisual('魘昧')?.icon || UNKNOWN_EFFECT_ICON });
  for (const [status, turns] of masked ? [] : Object.entries(statuses)) {
    const remaining = Number(turns);
    const visual = statusVisual(status);
    if (remaining > 0) effects.push({
      name: translateStatus(status), desc: visual?.desc || "目前生效中的異常狀態。", category: "異常", remaining: visual?.category === 'BOSS_ONLY' ? undefined : remaining, unit: "回合", polarity: "NEGATIVE", icon: visual?.icon || UNKNOWN_EFFECT_ICON
    });
  }

  const stageNames: Record<string, string> = { atk: "攻擊", spatk: "特攻", spa: "特攻", def: "防禦", spdef: "特防", spd: "特防", speed: "速度", spe: "速度", accuracy: "命中", evasion: "閃避" };
  if (masked && stages.some(([, value]) => Number(value) > 0)) effects.push({ name: '魘昧', desc: '能力提升受到魘味遮蔽；顯示的1回合不是實際期限。', remaining: 1, unit: '回合', category: '能力', polarity: 'NEUTRAL', icon: statusVisual('魘昧')?.icon || UNKNOWN_EFFECT_ICON });
  for (const [key, value] of stages) {
    const stage = Number(value);
    if (masked && stage > 0) continue;
    if (stage !== 0) effects.push({
      name: `${stageNames[key] || key} ${stage > 0 ? "+" : ""}${stage}`,
      desc: `${stageNames[key] || key}能力等級變化。`, category: "能力", stacks: stage, stackUnit: "級",
      polarity: stage > 0 ? "POSITIVE" : "NEGATIVE"
    });
  }

  const marks: Mark[] = side === "p1" ? (state.p1Marks || []) : (state.p2Marks || []);
  const timers: Timer[] = side === "p1" ? (state.p1Timers || []) : (state.p2Timers || []);
  const categories: Record<string, StateCategory> = { mark: '印記', turn: '回合類', round: '其他計時', count: '次數類', mechanism: '常駐', protection: '防護' };
  for (const view of activeEffectViews(elf, marks, timers, (side === 'p1' ? state.p1RegistryState : state.p2RegistryState) || {}, visibleEffectSourceText(side === 'p1' ? state.p2 : state.p1, side === 'p1' ? 'p2' : 'p1'))) {
    const metricIsStack = view.category === 'mark' || view.category === 'protection';
    effects.push({ name: mask(view.label), desc: mask(view.description), category: categories[view.category], icon: view.icon, source: mask(view.source), tone: view.tone,
      polarity: view.polarity.toUpperCase() as ActiveEffect['polarity'],
      ...(metricIsStack ? { stacks: view.value, stackUnit: view.unit } : { remaining: view.value, unit: view.unit as '回合' | '次' | undefined }) });
  }
  return effects;
}

const ORDER: StateCategory[] = ["異常", "能力", "防護", "印記", "回合類", "其他計時", "次數類", "常駐"];

export function StatusInspector({ state }: { state: any }) {
  const [side, setSide] = React.useState<"p1" | "p2">("p1");
  const [category, setCategory] = React.useState<StateCategory>("異常");
  const [expandedPermanent, setExpandedPermanent] = React.useState<Record<string, boolean>>({});
  const elf: Elf | null = side === "p1" ? state?.p1 : state?.p2;
  const visibleName = elf ? hiddenFromViewer(elf, side) ? UNKNOWN_ELF : elfForViewer(elf, side).name : '';
  const all = getActiveEffects(side, state);

  if (!elf) return <div className="p-6 text-center text-xs font-bold text-slate-500">目前沒有出戰精靈資訊</div>;

  const items = all.filter(effect => effect.category === category);
  return (
    <div id="status-inspector-panel" className="flex-1 flex flex-col gap-3 p-3 sm:p-4 overflow-y-auto custom-scrollbar bg-slate-950/40 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-100">{side.toUpperCase()}・{visibleName} 狀態</h3>
          <p className="mt-1 text-[10px] font-bold text-slate-500">先選對戰方，再按類別查看；每頁只呈現一種類型</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(["p1", "p2"] as const).map(playerSide => (
            <button key={playerSide} onClick={() => setSide(playerSide)}
              className={`rounded-md px-3 py-1 text-[10px] font-black ${side === playerSide ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}>
              {playerSide.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        {ORDER.map(cat => {
          const count = all.filter(effect => effect.category === cat).length;
          return (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${category === cat ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200" : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"}`}>
              {cat} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="text-xs font-black tracking-wide text-slate-200">{category}狀態</h4>
          <span className="text-[10px] font-black text-slate-400">{items.length} 項</span>
        </div>
        {items.length === 0 ? (
          <div className="py-8 text-center text-[11px] font-bold text-slate-500">目前沒有生效中的{category}狀態</div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {items.map((effect, index) => {
              const tone = effect.tone ? statusCountClasses(effect.tone) : effect.polarity === "NEGATIVE" ? "border-rose-900/40 bg-rose-950/20 text-rose-100"
                : effect.polarity === "POSITIVE" ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-100"
                  : "border-slate-800 bg-slate-900/60 text-slate-200";
              return (
                <article key={`${effect.category}-${effect.name}-${index}`} className={`flex flex-col gap-1 rounded-lg border p-3 ${tone}`}>
                  <div className="flex items-start justify-between gap-2">
                    {effect.icon && <ChainImage urls={[effect.icon]} className="h-6 w-6 shrink-0 object-contain" />}
                    {category === "常駐" ? (
                      <button type="button" title={plainDescription(effect.desc)}
                        onClick={() => setExpandedPermanent(prev => ({ ...prev, [effect.name]: !prev[effect.name] }))}
                        className="flex flex-1 items-center justify-between gap-2 text-left text-[12px] font-black leading-tight hover:text-white">
                        <span>{effect.name}</span><span className="shrink-0 text-[9px] font-bold text-cyan-300">{expandedPermanent[effect.name] ? "收合" : "查看說明"}</span>
                      </button>
                    ) : <span className="text-[11px] font-black leading-tight">{effect.name}</span>}
                    {effect.stacks !== undefined && <span className="shrink-0 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">{effect.stacks} {effect.stackUnit || "層"}</span>}
                  </div>
                  {(category !== "常駐" || expandedPermanent[effect.name]) && <EffectDescription description={effect.desc} className="text-[12px] font-medium leading-5 text-slate-300" />}
                  {effect.source && <div className="text-[10px] text-slate-400">來源：{effect.source}</div>}
                  {effect.remaining !== undefined && <div className="mt-1 text-[9px] font-black text-slate-500">剩餘 {effect.remaining} {effect.unit || "回合"}</div>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
