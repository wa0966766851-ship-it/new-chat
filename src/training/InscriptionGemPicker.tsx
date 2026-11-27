import React from 'react';
import {INSCRIPTION_GEMS,gemDescription} from './gems';
import type {Elf,Inscription} from '../types';
export function InscriptionGemPicker({value,skills,onChange}:{value:Inscription['gem'];skills:Elf['skills'];onChange:(value:Inscription['gem'])=>void}){
 return <section className="space-y-2 text-xs" aria-label="刻印寶石"><h4 className="text-cyan-200">嵌入寶石</h4><div className="grid grid-cols-2 gap-2"><label>寶石<select className="w-full bg-slate-900 rounded p-2" aria-label="刻印寶石種類" value={value?.id||''} onChange={e=>onChange(e.target.value?{id:e.target.value,skillName:value?.skillName||skills[0]?.name||''}:undefined)}><option value="">不嵌入</option>{INSCRIPTION_GEMS.map(g=><option key={g.id} value={g.id}>{g.name}（{g.generation}代）</option>)}</select></label><label>綁定技能<select className="w-full bg-slate-900 rounded p-2" aria-label="寶石綁定技能" disabled={!value||!skills.length} value={value?.skillName||''} onChange={e=>value&&onChange({...value,skillName:e.target.value})}>{value&&!skills.some(s=>s.name===value.skillName)&&<option value={value.skillName}>{value.skillName||'尚未綁定'}（未裝備，暫停生效）</option>}{skills.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select></label></div>
  {!skills.length&&<p className="text-slate-400">請先在培養頁裝備技能，再綁定寶石。</p>}
  {value&&<p>{gemDescription(value.id)}</p>}<p className="text-slate-400">一代預設10級、二代5級；機率與嵌入率100%。只對綁定技能生效。</p>
 </section>;
}
