import React from 'react';
import type {Elf} from '../types';
import {availableElfSkins,selectedElfSkin} from '../data/elfSkins';
import {ElfAvatar} from './SeerImages';
import {ElfAnimationModePicker} from './AnimationModeSettings';

export function ElfSkinPicker({elf,onChange}:{elf:Elf;onChange:(elf:Elf)=>void}){
 const skins=availableElfSkins(elf);
 const selected=selectedElfSkin(elf);
 return <section className="rounded-xl border border-cyan-900/50 bg-black/20 p-4 space-y-3" aria-label="精靈皮膚">
  <div className="flex items-center justify-between gap-3">
   <label className="text-sm text-cyan-200 font-bold">外觀皮膚
    <select aria-label="選擇精靈皮膚" disabled={skins.length===1} value={selected?.id||''} onChange={e=>onChange({...elf,skinId:e.target.value||undefined})}
     className="ml-3 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-200">
     {skins.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
   </label>
  </div>
  <div className="h-56 flex items-center justify-center rounded-lg bg-slate-950/70">
   <ElfAvatar elf={elf} kind="body" className="h-full w-full object-contain" />
  </div>
  <p className="text-xs text-slate-400">{selected?.name||'原始外觀'} · {skins.length} 款外觀 · 隨這隻精靈保存</p>
  <ElfAnimationModePicker elf={elf}/>
 </section>;
}
