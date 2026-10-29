import { orderSkillsForDisplay } from '../battle/skillSlot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Swords, Orbit, ShieldPlus, Flame, BatteryMedium, Zap } from 'lucide-react';
import { skillResourceView } from './SkillResources';
import { skillDisplayTypeLabel } from '../utils/skillPresentation';
import type { Elf, Skill } from '../types';
import { ElfAvatar, TypeIcon, SkillTypeIcon } from './SeerImages';
import { getElfTraitEntries } from './ElfTraitCards';
import { typeColor } from '../shell/art/figure';
import { ElfFilterBar, useElfFilter } from './shared/ElfPicker';
import { readSpotlightTextSize, saveSpotlightTextSize } from '../utils/spotlightPreferences';
const STORAGE = 'seer_featured_elf';
function SkillFacts({elf,skill}:{elf:Elf;skill:Skill}) {
 const resource=skillResourceView(elf,skill);
 const Category=skill.category==='物理'?Swords:skill.category==='特殊'?Orbit:ShieldPlus;
 return <span className="spot-skill-meta">
  <span title={skillDisplayTypeLabel(skill)} aria-label={skillDisplayTypeLabel(skill)}><SkillTypeIcon skill={skill} size={18}/></span>
  <span title={skill.category+'技能'} aria-label={skill.category+'技能'}><Category size={14} aria-hidden="true"/></span>
  <span title={'威力 '+(skill.power||0)} aria-label={'威力 '+(skill.power||0)}><Flame size={13} aria-hidden="true"/>{skill.power||'—'}</span>
  <span title={'PP '+resource.pp+' / '+resource.maxPp+(resource.permanentFull?'（恆滿）':'')} aria-label={'PP '+resource.pp+' / '+resource.maxPp}><BatteryMedium size={14} aria-hidden="true"/>{resource.pp}/{resource.maxPp}</span>
  {resource.charge!==undefined&&<span title={'充能 '+resource.charge} aria-label={'充能 '+resource.charge}><Zap size={13} aria-hidden="true"/>{resource.charge}</span>}
 </span>;
}
/** 共用介紹模板：更新入口可替換展示；舊面板鎖定目前選取的精靈。 */
export interface ElfSpotlightProps {
 elves: Elf[];
 selectedElf?: Elf;
 onClose: () => void;
 onBack?: () => void;
 onEdit?: (elf: Elf) => void;
}
export function ElfSpotlight({elves,selectedElf,onClose,onBack,onEdit}:ElfSpotlightProps) {
 const [id,setId]=useState(()=>{try{return localStorage.getItem(STORAGE)||'5021';}catch{return '5021';}});
 const [choosing,setChoosing]=useState(false);
 const filter=useElfFilter();
 const choices=useMemo(()=>filter.filter(elves),[filter.filter,elves]);
 const [textSize,setTextSize]=useState(readSpotlightTextSize);
 const resize=(value:number)=>setTextSize(saveSpotlightTextSize(value));
 const close=useRef<HTMLButtonElement>(null),picker=useRef<HTMLDivElement>(null);
 const elf=selectedElf||elves.find(e=>e.id===id)||elves.find(e=>e.id==='5021')||elves.at(-1);
 const title=selectedElf?'精靈介紹':'新精靈介紹';
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>previous?.isConnected&&previous.focus();},[]);
 useEffect(()=>{if(choosing)picker.current?.querySelector('input')?.focus();},[choosing]);
 const traits=elf?getElfTraitEntries(elf,{includeConfigurable:false}):[];
 // 主列只收五格；技能池不參與介紹頁。沿用戰鬥介面的第五格優先順序。
 const skills=orderSkillsForDisplay(elf?.skills).map(row=>row.skill);
 const select=(next:string)=>{setId(next);try{localStorage.setItem(STORAGE,next);}catch{}setChoosing(false);filter.setQuery('');};
 const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(choosing){setChoosing(false);close.current?.focus();}else onClose();}if(e.key==='Tab'){const scope=choosing?picker.current:e.currentTarget;const items:HTMLElement[]=scope?Array.from((scope as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')):[];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 return createPortal(<section className="elf-spotlight" role="dialog" aria-modal="true" aria-label={title} onKeyDown={keydown} style={{'--spot-text-scale':textSize/100,'--spot-tone':typeColor(elf?.type||'普通','#83a9c4')} as CSSProperties}>
  <header className="spot-top"><div><span className="spot-eyebrow">SEER / FIELD ARCHIVE</span><h1>{title} <span>{selectedElf?elf?.name:'每次，認識一位新夥伴。'}</span></h1></div><div className="spot-actions"><div className="spot-text-controls" role="group" aria-label="介紹文字大小"><button aria-label="縮小介紹文字" disabled={textSize<=80} onClick={()=>resize(textSize-10)}>A−</button><label>文字 <input aria-label="介紹文字大小" type="range" min="80" max="160" step="10" value={textSize} onChange={e=>resize(Number(e.target.value))}/><output>{textSize}%</output></label><button aria-label="放大介紹文字" disabled={textSize>=160} onClick={()=>resize(textSize+10)}>A＋</button><button onClick={()=>resize(100)}>重設字級</button></div>{onBack&&<button onClick={onBack}>更新公告</button>}{onEdit&&elf&&<button onClick={()=>onEdit(elf)}>修改這隻精靈</button>}{!selectedElf&&<button onClick={()=>setChoosing(true)} disabled={!elves.length}>替換展示精靈 ↗</button>}<button ref={close} onClick={onClose} aria-label="關閉精靈介紹">關閉 ×</button></div></header>
  {elf?<main className="spot-grid" key={elf.id}>
   <aside className="spot-identity"><span className="spot-index">精靈檔案 / {elf.id}</span><div className="spot-art"><div className="spot-orbit"/><ElfAvatar elf={elf} kind="body" className="spot-body"/></div><div className="spot-name"><TypeIcon type={elf.type} size={26}/><span>{elf.type}</span>{(elf.isAlienElf||elf.category==='異能精靈')&&<span className="spot-elf-kind">異能精靈</span>}<h2>{elf.name}</h2></div><div className="spot-stats"><h3>種族能力 <b>{Object.values(elf.baseStats||{}).reduce((a,b)=>a+b,0)}</b></h3><div>{([['hp','體力'],['atk','攻擊'],['def','防禦'],['spatk','特攻'],['spdef','特防'],['speed','速度']] as const).map(([key,label])=><div key={key}><span>{label}</span><strong>{elf.baseStats?.[key]??'—'}</strong><i style={{width:Math.min(100,(elf.baseStats?.[key]||0)/2)+'%'}}/></div>)}</div></div><p className="spot-source">目前資料同步呈現 · 可隨版本更新<br/>{selectedElf?'目前選取的精靈檔案':'展示選擇儲存在此裝置'}</p></aside>
   <section className="spot-panel spot-traits"><header><span>01 / ORIGIN</span><h2>魂印</h2></header><div className="spot-prose">{traits.length?traits.map((t,i)=><article key={i}><h3><small>{t.kind}</small>{t.name}</h3><p>{t.description||'尚無描述'}</p></article>):<p>尚無已登記的魂印效果。</p>}</div></section>
   <section className="spot-panel spot-skills"><header><span>02 / ARSENAL</span><h2>技能全覽 <small>{skills.length} 招</small></h2></header><div className="spot-skill-list">{skills.map((s,i)=><article key={i} className="spot-skill"><header><span className="spot-skill-index">{String(i+1).padStart(2,'0')}</span><h3>{s.name}</h3><SkillFacts elf={elf} skill={s}/></header><p>{s.description||'無特殊效果'}</p></article>)}{!skills.length&&<p>尚無已登記的技能。</p>}</div></section>
  </main>:<p role="status">目前沒有精靈資料。</p>}
  {choosing&&<div className="spot-picker-backdrop"><div className="spot-picker" ref={picker} role="dialog" aria-modal="true" aria-label="替換展示精靈"><header><div><span className="spot-eyebrow">CHOOSE YOUR SPOTLIGHT</span><h2>下一位，誰登場？</h2></div><button onClick={()=>{setChoosing(false);close.current?.focus();}} aria-label="取消替換">×</button></header><ElfFilterBar state={filter} count={`${choices.length} / ${elves.length}`}/><div className="spot-choices">{choices.map(e=><button key={e.id} onClick={()=>select(e.id)} aria-pressed={e.id===elf?.id}><ElfAvatar elf={e} className="spot-choice-avatar"/><span>{e.name}<small>{e.type} / {e.id}</small></span><b>{e.id===elf?.id?'展示中':'↗'}</b></button>)}{!choices.length&&<p>找不到符合的精靈。</p>}</div></div></div>}
 </section>,document.body);
}
