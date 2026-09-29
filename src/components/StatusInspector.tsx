import React from "react";
import { Elf } from "../types";
import { Timer } from "../battle/timers";
import { Mark } from "../battle/marks";

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
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    paralyzed: "麻痺", poisoned: "中毒", burned: "燒傷", frozen: "凍傷", scared: "害怕",
    sleeping: "睡眠", petrified: "石化", confused: "混亂", icebound: "冰封", blind: "失明",
    cursed: "詛咒", disabled: "癱瘓", tired: "疲憊"
  };
  return map[status] || status;
}

export function getActiveEffects(side: "p1" | "p2", state: any): ActiveEffect[] {
  if (!state) return [];
  const elf: Elf | null = side === "p1" ? state.p1 : state.p2;
  if (!elf) return [];

  const effects: ActiveEffect[] = [];
  if (elf.soulMark) effects.push({
    name: `魂印 · ${elf.soulMark.name}`, desc: elf.soulMark.description || "固有效果與被動技能",
    category: "常駐", polarity: "POSITIVE"
  });
  if (elf.alienTraits) {
    for (const trait of Object.values(elf.alienTraits) as any[]) {
      if (trait?.name) effects.push({ name: trait.name, desc: trait.description || "精靈特質", category: "常駐", polarity: "POSITIVE" });
    }
  }
  if (elf.trait?.name) effects.push({ name: elf.trait.name, desc: elf.trait.description || "精靈特性", category: "常駐", polarity: "POSITIVE" });

  const statuses = elf.battleStatuses || {};
  const primaryStatus = elf.battleStatus;
  if (primaryStatus && primaryStatus !== "normal" && primaryStatus !== "none") {
    const remaining = Number(elf.battleStatusDuration || statuses[primaryStatus] || 0);
    effects.push({ name: translateStatus(primaryStatus), desc: "目前生效中的異常狀態。", category: "異常", remaining: remaining > 0 ? remaining : undefined, unit: "回合", polarity: "NEGATIVE" });
  }
  for (const [status, turns] of Object.entries(statuses)) {
    const remaining = Number(turns);
    if (status !== primaryStatus && remaining > 0) effects.push({
      name: translateStatus(status), desc: "目前生效中的異常狀態。", category: "異常", remaining, unit: "回合", polarity: "NEGATIVE"
    });
  }
  if (elf.statusImmuneTurns && elf.statusImmuneTurns > 0) effects.push({
    name: "異常狀態免疫", desc: "暫時免疫可被此效果抵抗的異常狀態。", category: "異常", remaining: elf.statusImmuneTurns, unit: "回合", polarity: "POSITIVE"
  });

  const stageNames: Record<string, string> = { atk: "攻擊", spa: "特攻", def: "防禦", spd: "特防", spe: "速度", accuracy: "命中", evasion: "閃避" };
  for (const [key, value] of Object.entries(elf.statStages || {})) {
    const stage = Number(value);
    if (stage !== 0) effects.push({
      name: `${stageNames[key] || key} ${stage > 0 ? "+" : ""}${stage}`,
      desc: `${stageNames[key] || key}能力等級變化。`, category: "能力", stacks: stage, stackUnit: "級",
      polarity: stage > 0 ? "POSITIVE" : "NEGATIVE"
    });
  }

  const marks: Mark[] = side === "p1" ? (state.p1Marks || []) : (state.p2Marks || []);
  for (const mark of marks) {
    if ((mark.count > 0 || mark.visibleWhenZero) && (!mark.ownerBattleId || mark.ownerBattleId === (elf.battleId || elf.id))) effects.push({
      name: mark.name, desc: mark.description || "特殊印記狀態", category: "印記",
      stacks: mark.remainingRounds ?? mark.count, stackUnit: mark.remainingRounds !== undefined ? "回合" : (mark.unit || "層"),
      polarity: mark.polarity === "negative" ? "NEGATIVE" : mark.polarity === "positive" ? "POSITIVE" : "NEUTRAL"
    });
  }

  const timers: Timer[] = side === "p1" ? (state.p1Timers || []) : (state.p2Timers || []);
  for (const timer of timers) {
    if (timer.remaining <= 0) continue;
    const category: StateCategory = timer.kind === "turn_effect" ? "回合類" : timer.kind === "use_counter" ? "次數類" : "其他計時";
    const polarity = String(timer.payload?.polarity || "POSITIVE").toUpperCase() as ActiveEffect["polarity"];
    effects.push({
      name: timer.name || (category === "次數類" ? "次數限制" : "計時效果"),
      desc: timer.description || "啟用中的技能或魂印效果。", category, remaining: timer.remaining,
      unit: category === "次數類" ? "次" : "回合", polarity: ["POSITIVE", "NEGATIVE", "NEUTRAL"].includes(polarity) ? polarity : "POSITIVE"
    });
  }

  for (const [field, name, description] of [
    ["cannotUseAttrSkillsTurns", "屬性技能封鎖", "暫時無法使用屬性類技能。"],
    ["cannotUseAttackSkillsTurns", "攻擊技能失效", "暫時無法使用物理或特殊攻擊技能。"]
  ] as const) {
    const remaining = Number((elf as any)[field] || 0);
    if (remaining > 0) effects.push({ name, desc: description, category: "回合類", remaining, unit: "回合", polarity: "NEGATIVE" });
  }
  if (elf.shield && elf.shield > 0) effects.push({ name: "護盾", desc: `吸收技能攻擊傷害，容量 ${elf.shield}。`, category: "防護", stacks: elf.shield, polarity: "POSITIVE" });
  if (elf.barrier && elf.barrier > 0) effects.push({ name: "護罩", desc: `吸收固定與百分比傷害，容量 ${elf.barrier}。`, category: "防護", stacks: elf.barrier, polarity: "POSITIVE" });
  return effects;
}

const ORDER: StateCategory[] = ["異常", "能力", "防護", "印記", "回合類", "其他計時", "次數類", "常駐"];

export function StatusInspector({ state }: { state: any }) {
  const [side, setSide] = React.useState<"p1" | "p2">("p1");
  const [category, setCategory] = React.useState<StateCategory>("異常");
  const elf: Elf | null = side === "p1" ? state?.p1 : state?.p2;
  const all = getActiveEffects(side, state);

  if (!elf) return <div className="p-6 text-center text-xs font-bold text-slate-500">目前沒有出戰精靈資訊</div>;

  const items = all.filter(effect => effect.category === category);
  return (
    <div id="status-inspector-panel" className="flex-1 flex flex-col gap-3 p-3 sm:p-4 overflow-y-auto custom-scrollbar bg-slate-950/40 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-100">{side.toUpperCase()}・{elf.name} 狀態</h3>
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
              const tone = effect.polarity === "NEGATIVE" ? "border-rose-900/40 bg-rose-950/20 text-rose-100"
                : effect.polarity === "POSITIVE" ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-100"
                  : "border-slate-800 bg-slate-900/60 text-slate-200";
              return (
                <article key={`${effect.category}-${effect.name}-${index}`} className={`flex flex-col gap-1 rounded-lg border p-3 ${tone}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-black leading-tight">{effect.name}</span>
                    {effect.stacks !== undefined && <span className="shrink-0 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-black text-cyan-300">{effect.stacks} {effect.stackUnit || "層"}</span>}
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed text-slate-400">{effect.desc}</p>
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
