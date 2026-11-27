import React,{lazy,Suspense,useState,useRef,useCallback} from 'react';
import type {Elf} from '../../types';
import type {ShellBridge} from '../bridge';
import {BagScene} from './BagScene';
import {TeamScene} from './TeamScene';
import {readLastUsedRecord} from '../lastTeam';
import {normalizeElfStats} from '../../utils/elfStats';
import {launchBattle} from '../battleLaunch';
import {NativeBattlePreferences} from './NativeBattlePreferences';
import {swapBattlePreferences} from '../swapBattlePreferences';
const PeakDraft=lazy(()=>import('./AegisPeakDraft').then(m=>({default:m.AegisPeakDraft})));
const Training=lazy(()=>import('./AegisTraining').then(m=>({default:m.AegisTraining})));
const Inscriptions=lazy(()=>import('./AegisInscriptionEditor').then(m=>({default:m.AegisInscriptionEditor})));
const Introduction=lazy(()=>import('../art/ElfCardSheet').then(m=>({default:m.ElfCardSheet})));
export function RosterWorkspace({b}:{b:ShellBridge}){
 const [editing,setEditing]=useState<string>(),[slot,setSlot]=useState<number>(),[notice,setNotice]=useState(''),[setupOpen,setSetupOpen]=useState(false),[intro,setIntro]=useState(false);
 const [bp,setBp]=useState(false),[rosterVersion,setRosterVersion]=useState(0),commit=useRef(()=>true);
 const registerCommit=useCallback((value:()=>boolean)=>{commit.current=value;},[]);
 const elf=b.allElvesCombined.find(e=>e.id===editing);
 const update=(next:Elf)=>{b.updateElf(normalizeElfStats(next));};
 const heal=()=>{if(!commit.current()){setNotice('陣容未能儲存，未修改體力');return;}const ids=new Set(['p1','p2'].flatMap(side=>readLastUsedRecord(side as 'p1'|'p2')?.team.map(e=>e.id)||[]));for(const e of b.allElvesCombined)if(ids.has(e.id))update({...e,startingHp:{mode:'percent',value:100}});setNotice(`已將雙方背包${ids.size}隻精靈的開戰體力設為滿血`);};
 const launch=()=>{if(!commit.current()){setNotice('陣容未能儲存，請檢查可用空間');return;}if(b.battleFormat.startsWith('peak')){setBp(true);return;}const result=launchBattle(b);setNotice(result.ok?'':'請先儲存雙方陣容');};
 const swap=()=>{if(!commit.current()){setNotice('陣容未能儲存，未對調');return;}try{swapBattlePreferences();setRosterVersion(v=>v+1);setNotice('已對調雙方陣容、首發、配裝、火焰與年費加成');}catch{setNotice('對調未完成，已嘗試恢復原設定；請檢查可用空間');}};
 if(bp)return <Suspense fallback={<p>載入巔峰選禁…</p>}><PeakDraft b={b} onBack={()=>setBp(false)}/></Suspense>;
 return <div className="roster-workspace" data-native-roster style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column'}}>
  <header className="flex flex-wrap gap-2 p-2 shrink-0 text-xs"><button type="button" className="rounded-lg bg-slate-800 px-3 py-2" onClick={heal}>背包全滿血</button><button type="button" className="rounded-lg bg-cyan-800 px-3 py-2" onClick={launch}>{b.battleFormat.startsWith('peak')?'進入巔峰選禁':'進入對戰'}</button><button type="button" className="rounded-lg bg-slate-800 px-3 py-2" onClick={()=>{b.setEditingElf(null);b.setEditorTab('manual');b.setView('custom');}}>新增／進階編輯精靈</button></header>
  {notice&&<p role="status" className="text-xs text-cyan-200 px-3">{notice}</p>}
  <div className="px-2 shrink-0"><button type="button" className="text-xs py-2 text-cyan-200" aria-expanded={setupOpen} onClick={()=>setSetupOpen(!setupOpen)}>場地／火焰／賽制設定</button>{setupOpen&&<><NativeBattlePreferences key={rosterVersion} b={b}/><button type="button" className="atr-pill mb-3" onClick={swap}>對調雙方配置</button></>}</div>
  <div key={rosterVersion} style={{flex:1,minHeight:0}}>{b.view==='bag'?<BagScene b={b} onSetup={()=>setSetupOpen(true)} onTrain={e=>setEditing(e.id)}/>:<TeamScene b={b} onCommitReady={registerCommit} onSetup={()=>setSetupOpen(true)} onTrain={e=>setEditing(e.id)}/>}</div>
  {elf&&<Suspense fallback={<p>載入培養…</p>}><Training elf={elf} skillSources={b.allElvesCombined} groupSources={b.allElvesCombined} onChange={update} onIntro={()=>setIntro(true)} onEdit={()=>{b.setEditingElf(elf);b.setEditorTab('manual');b.setView('custom');}} onClose={()=>{setEditing(undefined);setSlot(undefined);setIntro(false);}} onEditInscription={setSlot}/></Suspense>}
  {elf&&intro&&<Suspense fallback={null}><Introduction elf={elf} onClose={()=>setIntro(false)}/></Suspense>}
  {elf&&slot!==undefined&&<Suspense fallback={null}><Inscriptions skills={elf.skills} slotIndex={slot} inscription={elf.inscriptions?.[slot]} onClose={()=>setSlot(undefined)} onSave={value=>{const inscriptions=[...(elf.inscriptions||[])];inscriptions[slot]=value;update({...elf,inscriptions});setSlot(undefined);}}/></Suspense>}
 </div>;
}
