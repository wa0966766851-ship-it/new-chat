import React,{lazy,Suspense,useState} from 'react';
import {ArrowLeft,Check,Crown,ShieldOff,Shirt,Swords,X} from 'lucide-react';
import type {ShellBridge} from '../bridge';
import {ElfAvatar,TypeIcon} from '../../components/SeerImages';
import {peakCandidates,initialPeakSelection,enterPeakPick,togglePeakCard,launchPeakDraft,peakId,readPeakRules,type DraftSide} from '../peakDraft';
import {readEquipment,writeEquipment,type EquipmentSlot} from '../equipment';
import {SUIT_CATALOG,EYEWEAR_CATALOG} from '../../data/suitsAndEyewears';
import {TITLE_CATALOG} from '../../data/titles';
import {ElfCardSheet} from '../art/ElfCardSheet';
import '../art/aegisPeakDraft.css';
const Equipment=lazy(()=>import('../art/SuitRail').then(m=>({default:m.SuitRail})));
export function AegisPeakDraft({b,onBack}:{b:ShellBridge;onBack:()=>void}){
 const [teams]=useState(()=>peakCandidates(b));
 const [rules]=useState(()=>readPeakRules(b.battleFormat));const count=rules.pick,banCount=rules.ban,ai=b.battleMode==='PVE';
 const [draft,setDraft]=useState(()=>{const initial=initialPeakSelection(teams,banCount,ai);return banCount?initial:enterPeakPick(initial,teams,count,ai);}),[error,setError]=useState(''),[profile,setProfile]=useState<any>();
 const [gear,setGear]=useState<{side:DraftSide;kind:EquipmentSlot}>(),[gearVersion,setGearVersion]=useState(0);
 const insufficient=teams.p1.length<banCount+count||teams.p2.length<banCount+count;
 const canConfirm=!insufficient&&(draft.phase==='ban'?draft.banned.p2.length===banCount&&(ai||draft.banned.p1.length===banCount):(['p1','p2'] as const).every(side=>draft.picked[side].length===count&&draft.picked[side].includes(draft.starters[side])));
 const confirm=()=>{try{if(draft.phase==='ban')setDraft(enterPeakPick(draft,teams,count,ai));else launchPeakDraft(b,teams,draft,count);setError('');}catch(e){setError((e as Error).message);}};
 return <section className="apd-root" data-aegis-peak-draft>
  <header className="apd-header"><button type="button" className="atr-icon" aria-label="返回編成" onClick={onBack}><ArrowLeft size={18}/></button><div><small>巔峰 · {count}對{count}</small><h1>{draft.phase==='ban'?'禁用對手精靈':'選擇出戰與首發'}</h1></div><div className="apd-steps"><span data-active={draft.phase==='ban'}><ShieldOff size={16}/>禁用 {banCount}</span><span data-active={draft.phase==='pick'}><Crown size={16}/>出戰 {count}</span></div></header>
  {error&&<p role="alert" className="apd-error">{error}</p>}
  {insufficient&&<p role="alert" className="apd-error">可用候選不足以完成本次禁用與選用，請返回編成新增精靈或減少數量。</p>}
  <p className="apd-help">{draft.phase==='ban'?`點選對手卡片禁用${banCount}隻。${ai?'AI的禁用結果於下一階段揭曉。':'雙方分別點選對手陣容。'}`:'點卡片選用／取消，點皇冠指定首發。禁用卡片保留原位供查閱。'}</p>
  <div className="apd-columns">{(['p1','p2'] as const).map(side=>{
   const equipment=readEquipment(side),editable=draft.phase==='ban'?side==='p2'||!ai:side==='p1'||!ai;
   return <section className="apd-team" key={side} data-draft-side={side}>
    <header><h2>{side.toUpperCase()}{side==='p2'&&ai?' · AI':''}</h2><b>{draft.phase==='ban'?`禁用 ${side==='p1'&&ai?'?':draft.banned[side].length}/${banCount}`:`出戰 ${draft.picked[side].length}/${count}`}</b></header>
    <div className="apd-equipment">{([['suit',SUIT_CATALOG],['eyewear',EYEWEAR_CATALOG],['title',TITLE_CATALOG]] as const).map(([kind,catalog])=><button type="button" key={kind} onClick={()=>setGear({side,kind})} title={catalog[equipment[kind]]?.description||'未裝備'}><Shirt size={13}/>{catalog[equipment[kind]]?.name||({suit:'套裝',eyewear:'目鏡',title:'稱號'}[kind])}</button>)}</div>
    <div className="apd-grid">{teams[side].map((elf,index)=>{
     const id=peakId(elf),banned=draft.banned[side].includes(id)&&!(draft.phase==='ban'&&ai&&side==='p1'),selected=draft.phase==='ban'?banned:draft.picked[side].includes(id),starter=draft.starters[side]===id;
     return <article className="apd-card" key={id} data-banned={banned||undefined} data-selected={selected||undefined}>
      <span className="apd-position">{String(index+1).padStart(2,'0')}</span><button type="button" className="apd-details" aria-label={`查看${elf.name}`} onClick={()=>setProfile(elf)}>詳</button>
      <button type="button" className="apd-select" disabled={!editable||draft.phase==='pick'&&banned} aria-label={`${draft.phase==='ban'?'禁用':'選用'} ${side.toUpperCase()} 第${index+1}位 ${elf.name}`} aria-pressed={selected} onClick={()=>setDraft(togglePeakCard(draft,side,id,draft.phase==='ban'?banCount:count))}>
       <ElfAvatar elf={elf} kind="head" className="apd-avatar"/><strong>{elf.name}</strong><span><TypeIcon type={elf.type} size={14}/>{elf.type}</span>{banned?<i><ShieldOff size={13}/>禁用</i>:selected&&<i><Check size={13}/>已選</i>}
      </button>
      <div className="apd-starter-slot">{draft.phase==='pick'&&selected&&<button type="button" className="apd-starter" disabled={!editable} aria-label={`首發 ${side.toUpperCase()} 第${index+1}位`} aria-pressed={starter} onClick={()=>setDraft({...draft,starters:{...draft.starters,[side]:id}})}><Crown size={14}/>{starter?'首發':'設首發'}</button>}</div>
     </article>;
    })}</div>
   </section>;
  })}</div>
  <footer className="apd-footer"><span>卡片位置與尺寸全程固定 · 原陣容不會被禁選覆寫</span><button type="button" disabled={!canConfirm} onClick={confirm}><Swords size={18}/>{draft.phase==='ban'?'確認禁用，進入選用':'確認陣容，進入對戰'}</button></footer>
  {profile&&<ElfCardSheet elf={profile} onClose={()=>setProfile(undefined)}/>}
  {gear&&<div className="apd-gear-overlay" role="dialog" aria-modal="true" aria-label="巔峰配裝"><header><b>{gear.side.toUpperCase()} 配裝</b><button type="button" aria-label="關閉配裝" onClick={()=>setGear(undefined)}><X size={18}/></button></header><Suspense fallback={<p>載入配裝…</p>}><Equipment kind={gear.kind} equippedId={readEquipment(gear.side)[gear.kind]} onEquip={id=>{const actual=writeEquipment(gear.side,gear.kind,id);if(actual[gear.kind]!==id)setError('配裝未能儲存');else{setGearVersion(v=>v+1);setGear(undefined);}}}/></Suspense></div>}
 </section>;
}
