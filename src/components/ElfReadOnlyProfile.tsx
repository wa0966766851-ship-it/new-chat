import React, { useState } from "react";
import type { Elf, Skill } from "../types";
import { ElfAvatar, TypeIcon } from "./SeerImages";
import { hiddenFromViewer } from "../battle/viewerPerspective";
import { ElfTraitCards } from "./ElfTraitCards";
import { InfoHint } from "./InfoHint";
import { formatEffectText } from "../utils/descFormat";
import { EffectBlockToggle } from './EffectBlockToggle';

/** 百科與戰鬥共用唯讀介紹；此元件沒有保存、修改精靈或訓練設定的入口。 */
export const ElfReadOnlyProfile: React.FC<{
  elf: Elf; onClose: () => void; subtitle?: string;
  effectiveBody?: { height: number; weight: number }; children?: React.ReactNode;
  getSkillMaxPp?: (skill: Skill, elf: Elf) => number;
  /** 戰鬥中開啟時的陣營：己方隱匿精靈完整顯示，敵方才掩蓋。 */
  battleSide?: "p1" | "p2";
}> = ({ elf, onClose, subtitle, effectiveBody, children, getSkillMaxPp, battleSide }) => {
  const [tab, setTab] = useState<"traits" | "stats" | "skills">("traits");
  const concealed = hiddenFromViewer(elf, battleSide);
  return <div className="space-y-5" data-testid="elf-readonly-profile">
    <header className="flex items-start gap-4 border-b border-white/10 pb-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full overflow-hidden bg-black/20 ring-1 ring-white/15">
        <ElfAvatar elf={elf} battleSide={battleSide} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-xs text-slate-400">{subtitle || "精靈介紹"} · 唯讀</p>
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-100 break-words">{concealed ? "未知精靈" : elf.name}</h2>
        {!concealed && <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          <TypeIcon type={elf.type} size={20} /><span>{elf.type}</span>
          <span className="text-slate-500">{effectiveBody?.height ?? elf.height ?? "—"} cm · {effectiveBody?.weight ?? elf.weight ?? "—"} kg</span>
        </div>}
      </div>
      <button type="button" aria-label="關閉精靈介紹" onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-xl text-slate-300 shrink-0">×</button>
    </header>
    {concealed ? <p className="text-sm text-slate-400">此精靈正處於隱匿，真實資料暫不展示。</p> : <>
      <nav className="ios-segment w-full" aria-label="精靈介紹分類">
        {([['traits', '專屬特性'], ['stats', '能力資料'], ['skills', '技能']] as const).map(([key, label]) =>
          <button key={key} type="button" className="flex-1" data-active={tab === key} onClick={() => setTab(key)}>{label}</button>)}
      </nav>
      {tab === "traits" && <ElfTraitCards elf={elf} />}
      {tab === "stats" && <>
        <div className="ios-card p-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">目前體力<InfoHint label="體力資料說明">體力值與上限分別顯示。神降等規則可允許負體力，這裡不將其改成 0。</InfoHint></span>
          <span className="text-lg tabular-nums text-emerald-300">{elf.currentHp ?? "—"} / {elf.maxHp ?? elf.calculatedStats?.hp ?? "—"}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([['hp','體力'],['atk','攻擊'],['def','防禦'],['spatk','特攻'],['spdef','特防'],['speed','速度']] as const).map(([key,label]) =>
            <div key={key} className="ios-card p-4">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="text-xl tabular-nums text-slate-100 mt-1">{elf.calculatedStats?.[key] ?? "—"}</p>
              <p className="text-xs text-slate-500 mt-2">種族 {elf.baseStats?.[key] ?? "—"} · 學習力 {elf.evs?.[key] ?? "—"}</p>
            </div>)}
        </div>
        {children}
      </>}
      {tab === "skills" && <div className="space-y-3">{(elf.skills || []).map((skill, i) =>
        <details key={`${skill.name}-${i}`} className="ios-card p-4" open={i === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-100">
            <span className="inline-flex items-center gap-2"><TypeIcon type={skill.type} size={18} />{skill.name}{skill.isFifthSkill && <span className="text-xs text-amber-300">第五</span>}</span>
          </summary>
          <p className="mt-3 text-xs text-slate-400 flex flex-wrap gap-3"><span>{skill.category} · {skill.type}</span><span>威力 {skill.power}</span><span>PP {skill.currentPp ?? skill.pp} / {getSkillMaxPp?.(skill, elf) ?? skill.maxPp ?? skill.pp}</span><span>先制 {skill.priority || 0}</span></p>
          <EffectBlockToggle skill={skill}><p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{formatEffectText(skill.description)}</p></EffectBlockToggle>
        </details>)}</div>}
    </>}
  </div>;
};
