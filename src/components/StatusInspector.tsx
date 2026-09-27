import React from "react";
import { Elf } from "../types";
import { Timer } from "../battle/timers";
import { Mark } from "../battle/marks";

export type StateCategory = "特殊" | "常駐" | "回合類" | "次數類" | "異常";

export interface ActiveEffect {
  name: string;
  desc: string;
  category: StateCategory;
  remaining?: number;
  polarity: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  stacks?: number;
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    paralyzed: "麻痺",
    poisoned: "中毒",
    burned: "燒傷",
    frozen: "凍傷",
    scared: "害怕",
    sleeping: "睡眠",
    petrified: "石化",
    confused: "混亂",
    icebound: "冰封",
    blind: "失明",
    cursed: "詛咒",
    disabled: "癱瘓",
    tired: "疲憊"
  };
  return map[status] || status;
}

export function getActiveEffects(side: "p1" | "p2", state: any): ActiveEffect[] {
  if (!state) return [];
  const elf: Elf | null = side === "p1" ? state.p1 : state.p2;
  if (!elf) return [];

  const effects: ActiveEffect[] = [];

  // 1. 常駐 / 魂印效果 (carried)
  if (elf.soulMark) {
    effects.push({
      name: `魂印 · ${elf.soulMark.name}`,
      desc: elf.soulMark.description || "天生固有特權與被動技能",
      category: "常駐",
      polarity: "POSITIVE"
    });
  }

  // 2. 異常狀態 (異常)
  if (elf.battleStatus && elf.battleStatus !== "normal" && elf.battleStatus !== "none") {
    effects.push({
      name: translateStatus(elf.battleStatus),
      desc: `受到此異常狀態限制，持續生效中。`,
      category: "異常",
      remaining: elf.battleStatusDuration || 1,
      polarity: "NEGATIVE"
    });
  }

  if (elf.battleStatuses) {
    for (const [st, rem] of Object.entries(elf.battleStatuses)) {
      if (st !== elf.battleStatus && rem > 0) {
        effects.push({
          name: translateStatus(st),
          desc: `持有此異常狀態。`,
          category: "異常",
          remaining: rem,
          polarity: "NEGATIVE"
        });
      }
    }
  }

  // 3. 特殊印記 (特殊 / 常駐)
  const marks: Mark[] = side === "p1" ? (state.p1Marks || []) : (state.p2Marks || []);
  for (const mark of marks) {
    if (mark.count > 0) {
      effects.push({
        name: mark.name,
        desc: mark.description || "特殊印記狀態",
        category: "特殊",
        stacks: mark.count,
        polarity: "POSITIVE"
      });
    }
  }

  // 4. 計時器與效果 (回合類 / 次數類)
  const timers: Timer[] = side === "p1" ? (state.p1Timers || []) : (state.p2Timers || []);
  for (const timer of timers) {
    const isTurn = timer.kind === "turn_effect";
    const polarity = timer.payload?.polarity || "POSITIVE";
    effects.push({
      name: timer.name || (isTurn ? "回合類效果" : "次數限制"),
      desc: timer.description || "啟用中的技能或魂印模組化效果",
      category: isTurn ? "回合類" : "次數類",
      remaining: timer.remaining,
      polarity: polarity as any
    });
  }

  // 5. 其他戰鬥內動態狀態 (回合類)
  if (elf.statusImmuneTurns && elf.statusImmuneTurns > 0) {
    effects.push({
      name: "異常狀態免疫",
      desc: "豁免所有受到的控制、弱化或限制類異常狀態（BOSS有效）",
      category: "回合類",
      remaining: elf.statusImmuneTurns,
      polarity: "POSITIVE"
    });
  }

  if (elf.cannotUseAttrSkillsTurns && elf.cannotUseAttrSkillsTurns > 0) {
    effects.push({
      name: "屬性技能封鎖",
      desc: "暫時無法使用屬性類（非攻擊性）技能",
      category: "回合類",
      remaining: elf.cannotUseAttrSkillsTurns,
      polarity: "NEGATIVE"
    });
  }

  if (elf.cannotUseAttackSkillsTurns && elf.cannotUseAttackSkillsTurns > 0) {
    effects.push({
      name: "攻擊技能失效",
      desc: "暫時無法使用任何物理或特殊攻擊技能",
      category: "回合類",
      remaining: elf.cannotUseAttackSkillsTurns,
      polarity: "NEGATIVE"
    });
  }

  if (elf.shield && elf.shield > 0) {
    effects.push({
      name: "機械護盾",
      desc: `當前吸收護盾容量: ${elf.shield} 點`,
      category: "次數類",
      stacks: elf.shield,
      polarity: "POSITIVE"
    });
  }

  if (elf.barrier && elf.barrier > 0) {
    effects.push({
      name: "戰術護罩",
      desc: `當前吸收護罩容量: ${elf.barrier} 點`,
      category: "次數類",
      stacks: elf.barrier,
      polarity: "POSITIVE"
    });
  }

  return effects;
}

const ORDER: StateCategory[] = ["特殊", "常駐", "回合類", "次數類", "異常"];

export function StatusInspector({ side, state }: { side: "p1" | "p2"; state: any }) {
  const all = getActiveEffects(side, state);
  const elf = side === "p1" ? state?.p1 : state?.p2;

  if (!elf) {
    return (
      <div className="p-6 text-slate-500 text-center text-xs tracking-widest font-black uppercase">
        無出戰精靈資訊
      </div>
    );
  }

  return (
    <div id="status-inspector-panel" className="flex-1 flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar bg-slate-950/40 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-cyan-500" />
          <div>
            <h3 className="font-black text-sm text-slate-100 tracking-wider">
              【{elf.name}】 狀態檢視器
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5 tracking-wide">
              即時統計當前在場精靈的所有魂印、印記、計時器及異常狀態
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-slate-800 text-cyan-400 font-black px-2.5 py-1 rounded border border-slate-700 uppercase tracking-widest">
          ACTIVE EFFECTS: {all.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ORDER.map(cat => {
          const items = all.filter(e => e.category === cat);
          return (
            <div key={cat} className="flex flex-col bg-slate-900/30 rounded-lg border border-slate-800 p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <span className="text-xs font-black tracking-widest text-slate-400">
                  ◆ {cat}狀態
                </span>
                <span className="text-[10px] font-black text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-6 text-[10px] text-slate-600 font-black uppercase tracking-widest italic">
                  NO ACTIVE
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {items.map((e, i) => {
                    const isNeg = e.polarity === "NEGATIVE";
                    const isPos = e.polarity === "POSITIVE";
                    let bgClass = "bg-slate-900/50 border-slate-800/80 text-slate-300";
                    if (isNeg) {
                      bgClass = "bg-red-950/10 border-red-900/30 text-red-200";
                    } else if (isPos) {
                      bgClass = "bg-emerald-950/10 border-emerald-900/30 text-emerald-200";
                    }

                    return (
                      <div 
                        key={i} 
                        className={`flex flex-col gap-1 p-3 rounded-md border transition-all hover:bg-slate-900/70 ${bgClass}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-black text-[11px] leading-tight tracking-wide">
                            {e.name}
                          </span>
                          {e.stacks !== undefined && (
                            <span className="text-[9px] font-black bg-slate-800/80 text-cyan-400 px-1.5 py-0.5 rounded border border-slate-700">
                              {e.stacks} 層
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          {e.desc}
                        </p>
                        {e.remaining !== undefined && (
                          <div className="flex items-center gap-1.5 mt-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
                            剩餘 {e.remaining} 回合
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
