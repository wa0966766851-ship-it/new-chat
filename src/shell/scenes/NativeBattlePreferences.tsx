import React,{lazy,Suspense,useState,useEffect} from 'react';
import type {ShellBridge} from '../bridge';
import {FreeBattleSetupPanel} from '../../components/FreeBattleSetupPanel';
import {readPeakRules} from '../peakDraft';
const AI=lazy(()=>import('../../components/BattleAIQuickSettings').then(m=>({default:m.BattleAIQuickSettings})));
export function NativeBattlePreferences({b}:{b:ShellBridge;key?:string|number}){
 const [rules,setRules]=useState(()=>readPeakRules(b.battleFormat)),[error,setError]=useState('');
 useEffect(()=>setRules(readPeakRules(b.battleFormat)),[b.battleFormat]);
 const change=(patch:Partial<typeof rules>)=>{try{const all=JSON.parse(localStorage.getItem('seer_peak_draft_rules_v1')||'{}'),next={...rules,...patch};localStorage.setItem('seer_peak_draft_rules_v1',JSON.stringify({...all,[b.battleFormat]:next}));setRules(next);setError('');}catch{setError('選禁規則未能儲存');}};
 return <section className="native-battle-preferences text-xs space-y-3 pb-2">
  <div className="flex flex-wrap gap-4 py-2">
   <label>操作模式 <select aria-label="操作模式" value={b.battleMode} onChange={e=>b.setBattleMode(e.target.value as 'PVE'|'PVP')}><option value="PVE">對戰AI</option><option value="PVP">雙人同屏</option></select></label>
   <label>賽制 <select aria-label="賽制" value={b.battleFormat} onChange={e=>b.setBattleFormat(e.target.value as ShellBridge['battleFormat'])}><option value="normal_6v6">自由戰6V6</option><option value="solo_1v1">單挑1V1</option><option value="peak_6v6">巔峰6V6</option><option value="peak_3v3">巔峰3V3</option></select></label>
   <label title="先制與速度完全相同時，房主方優先">房主 <select aria-label="房主" value={b.hostPlayer} onChange={e=>b.setHostPlayer(e.target.value as 'p1'|'p2')}><option value="p1">P1</option><option value="p2">{b.battleMode==='PVE'?'AI':'P2'}</option></select></label>
  </div>
  {b.battleFormat.startsWith('peak')&&<div className="flex gap-4"><label>禁用數量 <select aria-label="巔峰禁用數量" value={rules.ban} onChange={e=>change({ban:Number(e.target.value)})}>{[0,1,2,3,4].map(n=><option key={n} value={n}>{n}隻</option>)}</select></label><label>出戰數量 <select aria-label="巔峰出戰數量" value={rules.pick} onChange={e=>change({pick:Number(e.target.value)})}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}隻</option>)}</select></label>{error&&<p role="alert">{error}</p>}</div>}
  <FreeBattleSetupPanel/>
  {b.battleFormat.startsWith('peak')&&<p className="text-slate-400">巔峰使用選禁流程的場地與配裝規則；上述中央場地選擇用於自由戰及單挑。</p>}
  {b.battleMode==='PVE'&&<details><summary className="cursor-pointer py-2 text-cyan-200">AI策略與思考設定</summary><Suspense fallback={<p>載入AI設定…</p>}><AI pve/></Suspense></details>}
 </section>;
}
