import React from "react";
import type { Elf } from "../types";
import { ElfAvatar, TypeIcon } from "./SeerImages";
import { getElfDisplayRank, DISPLAY_RANK_NOTE } from "../utils/elfDisplayRank";

/** 輕量背包型卡片：列表不解析積木或掛載整份效果拆解。 */
export const ElfRosterCard: React.FC<{ elf: Elf; onDetail: () => void }> = ({ elf, onDetail }) => {
  return <article className="ios-card p-4 space-y-3 min-w-0">
    <button type="button" onClick={onDetail} className="flex items-center gap-3 w-full text-left rounded-xl focus-visible:outline-2 focus-visible:outline-blue-400" aria-label={`查看 ${elf.name} 的介紹`}>
      <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden bg-black/20 ring-1 ring-white/10"><ElfAvatar elf={elf} className="w-full h-full object-cover" /></div>
      <div className="min-w-0 space-y-1">
        <h3 className="text-base font-semibold text-slate-100 break-words">{elf.name}</h3>
        <div className="flex items-center gap-2 text-xs text-slate-300"><TypeIcon type={elf.type} size={18} /><span>{elf.type}</span><span title={DISPLAY_RANK_NOTE} className="text-cyan-300">參考 {getElfDisplayRank(elf)}</span></div>
      </div>
    </button>
    <div className="flex justify-between text-xs text-slate-400"><span>Lv.{elf.level || 100}</span><span className="text-emerald-300 tabular-nums">體力 {elf.calculatedStats?.hp ?? elf.maxHp ?? "—"}</span></div>
    <dl className="grid grid-cols-3 gap-2 text-xs text-slate-400">
      {([['atk','攻擊'],['spatk','特攻'],['speed','速度'],['def','防禦'],['spdef','特防']] as const).map(([key,label]) =>
        <div key={key}><dt className="inline">{label} </dt><dd className="inline text-slate-200 tabular-nums">{elf.calculatedStats?.[key] ?? "—"}</dd></div>)}
    </dl>
    <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs"><span className="text-violet-300">魂印 · {elf.soulMark?.name || "無"}</span><button type="button" onClick={onDetail} className="text-blue-300 py-1 px-2 rounded-lg hover:bg-white/5">查看詳情</button></div>
  </article>;
};
