import React, {useState} from 'react';
import {draftFromRecord, type TeamDraft} from './teamDraft';
import {slimTeamPresets} from '../data/savedTeamCompact';

/** Same slots as the classic roster; only the presentation differs. */
export function BackpackPresets({side,draft,onLoad}:{side:'p1'|'p2';draft:TeamDraft;onLoad:(draft:TeamDraft)=>void}){
 const [slot,setSlot]=useState('1'),[message,setMessage]=useState('');
 const key=`seer_${side}_backpack_presets`;
 const read=()=>JSON.parse(localStorage.getItem(key)||'{}');
 const save=()=>{try{
  if(!draft.members.length){setMessage('請先加入精靈');return;}
  const presets=read();
  presets[slot]={...presets[slot],team:draft.members,starterId:draft.starterBattleId};
  localStorage.setItem(key,JSON.stringify(slimTeamPresets(presets)));
  setMessage(`已儲存插槽${slot}`);
 }catch{setMessage('未能儲存，原插槽未更動');}};
 const load=()=>{try{
  const record=read()[slot];
  if(!record?.team?.length){setMessage('這個插槽尚未儲存');return;}
  onLoad(draftFromRecord(record));setMessage(`已載入插槽${slot}`);
 }catch{setMessage('插槽資料無法讀取，保留目前編成');}};
 return <details className="text-xs text-slate-300 shrink-0"><summary className="cursor-pointer py-1">背包插槽</summary><div className="flex flex-wrap items-center gap-2 pb-1">
  <select aria-label="背包插槽" className="bg-slate-900 p-1" value={slot} onChange={e=>{setSlot(e.target.value);setMessage('');}}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>插槽{n}</option>)}</select>
  <button type="button" onClick={save}>儲存至插槽</button><button type="button" onClick={load}>載入插槽</button><span role="status">{message}</span>
 </div></details>;
}
