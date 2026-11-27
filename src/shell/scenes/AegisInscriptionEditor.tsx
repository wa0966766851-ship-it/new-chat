import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Diamond,Gem,Palette,SlidersHorizontal,Trash2,X} from 'lucide-react';
import type {Inscription,Skill} from '../../types';
import {getDefaultInscriptions,INSCRIPTION_PRESETS} from '../../data/inscriptionsCatalog';
import {buildInscriptionDraft,emptyInscription} from '../../training/inscriptionDraft';
import {InscriptionGemPicker} from '../../training/InscriptionGemPicker';
import {InscriptionAppearancePicker} from '../../training/InscriptionAppearancePicker';
import '../art/aegisInscription.css';

type Tab='stats'|'gem'|'appearance';
const labels={hp:'體力',atk:'攻擊',def:'防禦',spatk:'特攻',spdef:'特防',speed:'速度'} as const;
export function AegisInscriptionEditor({slotIndex,inscription,skills=[],onSave,onClose}:{slotIndex:number;inscription?:Inscription;skills?:Skill[];onSave:(value?:Inscription)=>void;onClose:()=>void}){
 const [draft,setDraft]=useState<Inscription>(()=>structuredClone(inscription||getDefaultInscriptions()[slotIndex]));
 const [tab,setTab]=useState<Tab>('stats');
 const dialog=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close.current();return;}
   if(e.key!=='Tab')return;
   const controls=Array.from<HTMLElement>(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary')||[]).filter(e=>e.getClientRects().length);
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};
 },[]);
 const tabs=[{id:'stats' as const,label:'能力',icon:SlidersHorizontal},{id:'gem' as const,label:'寶石',icon:Gem},{id:'appearance' as const,label:'外觀',icon:Palette}];
 return createPortal(<div className="aic-root" onClick={onClose}>
  <div ref={dialog} className="aic-sheet" role="dialog" aria-modal="true" aria-label={`第 ${slotIndex+1} 刻印孔裝備與調校`} data-aegis-inscription onClick={e=>e.stopPropagation()}>
   <header className="aic-head"><Diamond size={27}/><div><small>刻印調校 · 第 {slotIndex+1} 孔</small><h2>{draft.name}</h2></div><button type="button" className="atr-icon" aria-label="關閉刻印調校" onClick={onClose}><X size={17}/></button></header>
   <nav className="aic-tabs" aria-label="刻印調校分頁">{tabs.map(t=><button type="button" key={t.id} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}><t.icon size={20}/><span>{t.label}</span></button>)}</nav>
   <div className="aic-content">
    {tab==='stats'&&<>
     <label className="aic-name">刻印名稱<input aria-label="刻印名稱" value={draft.name} maxLength={100} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
     <section className="aic-stat-grid" aria-label="刻印能力">{Object.entries(labels).map(([key,label])=><label key={key}><span>{label}</span><input aria-label={`刻印${label}`} type="number" min={0} value={draft.stats[key as keyof typeof labels]||0} onChange={e=>setDraft({...draft,stats:{...draft.stats,[key]:Math.max(0,Number(e.target.value)||0)}})}/></label>)}</section>
     <details open><summary>套用能力預設</summary><p className="aic-hint">套用預設會更換能力；寶石與外觀保留。</p><div className="aic-presets">{INSCRIPTION_PRESETS.map(p=><button type="button" key={p.id} aria-pressed={draft.id===p.id} onClick={()=>setDraft({...draft,id:p.id,name:p.name,description:p.description,stats:{...p.stats}})}><b>{p.name}</b><small>{Object.entries(labels).filter(([k])=>p.stats[k as keyof typeof labels]).map(([k,l])=>`${l}+${p.stats[k as keyof typeof labels]}`).join(' · ')}</small></button>)}</div></details>
    </>}
    {tab==='gem'&&<InscriptionGemPicker value={draft.gem} skills={skills} onChange={gem=>setDraft({...draft,gem})}/>}
    {tab==='appearance'&&<InscriptionAppearancePicker expanded value={draft.skinId} onChange={skinId=>setDraft({...draft,skinId})}/>}
   </div>
   <footer className="aic-footer"><button type="button" className="aic-remove" onClick={()=>onSave(emptyInscription(slotIndex))}><Trash2 size={15}/>卸下刻印</button><button type="button" onClick={onClose}>取消</button><button type="button" className="aic-save" onClick={()=>onSave(buildInscriptionDraft(inscription,draft))}><Check size={16}/>確認保存並嵌入</button></footer>
  </div>
 </div>,document.body);
}
