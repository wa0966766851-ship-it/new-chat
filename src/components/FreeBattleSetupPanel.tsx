import React,{useState} from 'react';
import {BATTLEFIELDS} from '../battle/battlefields';
import {BATTLE_FLAMES} from '../data/battleFlames';
import {FREE_FIELD_IDS,FREE_FIELD_KEY,readFreeBattleSetup} from '../battle/freeBattleSetup';
import {readAnnualBonus} from '../battle/annualBonusPreference';
export function FreeBattleSetupPanel(){
 const [setup,setSetup]=useState(()=>readFreeBattleSetup()),[error,setError]=useState('');
 const [annual,setAnnual]=useState(()=>({p1:readAnnualBonus('p1'),p2:readAnnualBonus('p2')}));
 const write=(key:string,value:string)=>{try{localStorage.setItem(key,value);setSetup(readFreeBattleSetup());setAnnual({p1:readAnnualBonus('p1'),p2:readAnnualBonus('p2')});setError('');}catch{setError('設定未儲存，請檢查可用空間');}};
 return <section className="rounded-xl border border-cyan-800 bg-slate-950/80 p-3 space-y-2 text-xs" aria-label="自由戰場地與火焰">
  <h3>自由戰 · 場地與火焰</h3><div className="flex flex-wrap gap-3"><label>中央場地 <select aria-label="自由戰場地" value={setup.fieldId} onChange={e=>write(FREE_FIELD_KEY,e.target.value)}>{FREE_FIELD_IDS.map(id=><option key={id} value={id}>{BATTLEFIELDS[id].name}</option>)}</select></label>
  {(['p1','p2'] as const).map(side=><label key={side}>{side.toUpperCase()} 火焰 <select aria-label={`${side.toUpperCase()}自由戰火焰`} value={setup.flames[side]||''} onChange={e=>write(`seer_${side}_flame`,e.target.value)}><option value="">不使用</option>{BATTLE_FLAMES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>)}</div>
  <p className="text-slate-400">{BATTLEFIELDS[setup.fieldId].description}{setup.fieldId==='eclipse'&&' 自由戰不載入肉鴿進度與關卡遺物。'}</p>
  {(['p1','p2'] as const).map(side=>{const f=BATTLE_FLAMES.find(v=>v.id===setup.flames[side]);return f&&<p key={side}>{side.toUpperCase()} {f.short}：{f.effect}</p>;})}
  <div className="flex flex-wrap gap-5">{(['p1','p2'] as const).map(side=><label key={side} className="flex items-center gap-2"><input type="checkbox" aria-label={`${side.toUpperCase()}年費加成`} checked={annual[side]} onChange={e=>write(`seer_${side}_annual_bonus`,e.target.checked?'1':'0')}/>{side.toUpperCase()} 年費加成 · 全能力+10</label>)}</div>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
