import React,{lazy,Suspense,useEffect,useState} from 'react';
import {Crown,Network,Search,Settings2,Shield,Swords,Users,X} from 'lucide-react';
import type {Elf} from '../types';
import {DEFAULT_ELVES,loadImportedElves} from '../data/defaultElves';
import {ElfAvatar,TypeIcon} from '../components/SeerImages';
import {FullscreenButton} from '../components/FullscreenSettings';
import {BATTLE_FLAMES} from '../data/battleFlames';
import {readBattleGameSkin} from '../components/battle/gameHud';
import {initialPreparation,readPreparation,savePreparation,preparationError,type OnlinePreparation} from './preparation';
import {normalizeElfStats} from '../utils/elfStats';
import '../components/battle/battleGameSkin.css';
import './onlineLobby.css';

const PeerRoom=lazy(()=>import('./PeerRoom'));
const Training=lazy(()=>import('../shell/scenes/AegisTraining').then(m=>({default:m.AegisTraining})));
const Inscriptions=lazy(()=>import('../shell/scenes/AegisInscriptionEditor').then(m=>({default:m.AegisInscriptionEditor})));
const Equipment=lazy(()=>import('../shell/art/SuitRail').then(m=>({default:m.SuitRail})));

export default function OnlineLobby(){
 const [catalog,setCatalog]=useState<Elf[]>([]),[draft,setDraft]=useState<OnlinePreparation>(),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<string>(),[inscription,setInscription]=useState<number>(),[equipment,setEquipment]=useState<'suit'|'eyewear'|'title'>('suit'),[equipmentOpen,setEquipmentOpen]=useState(false);
 const [match,setMatch]=useState<{intent:'random'|'invite';prepared:OnlinePreparation}>();
 useEffect(()=>{let live=true;void loadImportedElves().then(()=>{
  if(!live)return;const rows=DEFAULT_ELVES.filter(e=>!e.isExtra&&!e.isCustom);setCatalog(rows);
  try{setDraft(readPreparation(localStorage,rows));}catch(cause){setError(String(cause));setDraft(initialPreparation(rows));}
 });return()=>{live=false;};},[]);
 const elf=draft?.team.find(e=>e.id===editing);
 const persist=()=>{if(!draft)return;try{savePreparation(localStorage,draft,catalog);setNotice('雙人配置已儲存');setError('');return true;}catch(cause){setError(cause instanceof Error?cause.message:String(cause));return false;}};
 const begin=(intent:'random'|'invite')=>{
  if(!draft)return;const problem=preparationError(draft);if(problem){setError(problem);return;}
  if(!persist())return;setMatch({intent,prepared:structuredClone(draft)});
 };
 const update=(next:Elf)=>{const normalized=normalizeElfStats(next);setDraft(d=>d&&({...d,configurations:{...d.configurations,[next.id]:normalized},team:d.team.map(e=>e.id===next.id?normalized:e)}));};
 if(!draft)return <main className="online-loading" role="status">正在載入雙人遊戲大廳…</main>;
 return <main className="online-lobby" data-layout="game" data-gskin={readBattleGameSkin()} data-online-modern-only>
  <header className="online-top"><div><small>AEGIS · ONLINE</small><h1><Network size={23}/>雙人對戰</h1></div><nav><FullscreenButton/><button type="button" onClick={persist}><Shield size={16}/>儲存配置</button></nav></header>
  <div className="online-flow" aria-label="對戰流程"><span data-active>01 編隊培養</span><span>02 選擇匹配</span><span>03 確認對手</span><span>04 對戰</span></div>
  <div className="online-workspace">
   <section className="online-team" aria-label="我的雙人隊伍"><header><h2><Users size={18}/>我的隊伍 <small>{draft.team.length}/6</small></h2><button type="button" onClick={()=>begin('invite')}>邀請對手</button></header>
    <div className="online-team-grid">{draft.team.map(e=><article key={e.id} data-online-elf={e.id}>
     <button className="online-elf-art" type="button" aria-label={`培養 ${e.name}`} onClick={()=>setEditing(e.id)}><ElfAvatar elf={e} kind="body" className="online-body"/></button>
     <h3 title={e.name}>{e.name}</h3><p><TypeIcon type={e.type} size={14}/>{e.type} · Lv.{e.level}</p>
     <div><button type="button" aria-pressed={draft.starterId===e.id} onClick={()=>setDraft({...draft,starterId:e.id})}><Crown size={14}/>{draft.starterId===e.id?'首發':'設為首發'}</button><button type="button" aria-label={`培養 ${e.name}`} onClick={()=>setEditing(e.id)}><Settings2 size={14}/></button><button type="button" aria-label={`移除 ${e.name}`} onClick={()=>setDraft({...draft,team:draft.team.filter(x=>x.id!==e.id)})}><X size={14}/></button></div>
    </article>)}</div>
    <section className="online-library" aria-label="精靈倉庫"><label><Search size={15}/><input aria-label="搜尋可加入精靈" placeholder="搜尋精靈名稱、編號、屬性" value={query} onChange={e=>setQuery(e.target.value)}/></label><div>{catalog.filter(e=>`${e.name} ${e.id} ${e.type}`.includes(query)).map(e=><button type="button" key={e.id} disabled={draft.team.length>=6||draft.team.some(x=>x.id===e.id)} onClick={()=>setDraft({...draft,team:[...draft.team,structuredClone(draft.configurations?.[e.id]||e)]})}>{e.name}<small>{e.type}</small></button>)}</div></section>
   </section>
   <aside className="online-setup"><section><h2><Swords size={18}/>對戰模式</h2><div className="online-modes">{(['peak','destiny'] as const).map(mode=><button type="button" key={mode} aria-pressed={draft.mode===mode} onClick={()=>setDraft({...draft,mode})}>{mode==='peak'?'巔峰對戰':'命運之輪'}</button>)}</div><p>{draft.mode==='peak'?'先完成隊伍與培養，再尋找相同模式的對手。':'先完成培養配置；命運抽取、禁選與最後配裝於配對後依共用規則進行。'}</p></section>
    <section className="online-equipment"><h2>隊伍裝備</h2><button type="button" aria-expanded={equipmentOpen} onClick={()=>setEquipmentOpen(!equipmentOpen)}>調整裝備</button><p>{[draft.equipment.suit,draft.equipment.eyewear,draft.equipment.title].filter(Boolean).length} 項已選擇</p>{equipmentOpen&&<><nav>{(['suit','eyewear','title'] as const).map((key,i)=><button type="button" key={key} aria-pressed={equipment===key} onClick={()=>setEquipment(key)}>{['套裝','目鏡','稱號'][i]}</button>)}</nav><Suspense fallback={<p>載入裝備…</p>}><Equipment kind={equipment} equippedId={draft.equipment[equipment]} onEquip={id=>setDraft({...draft,equipment:{...draft.equipment,[equipment]:id}})}/></Suspense></> }</section>
    <section><h2>火焰</h2><select aria-label="雙人隊伍火焰" value={draft.equipment.flame} onChange={e=>setDraft({...draft,equipment:{...draft.equipment,flame:e.target.value}})}><option value="">不使用</option>{BATTLE_FLAMES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></section>
    <button className="online-match" type="button" disabled={!!preparationError(draft)} onClick={()=>begin('random')}><Swords size={20}/>開始匹配</button>
    <p className="online-note">無遊戲收費或付費 API。公網匹配服務尚未設定，連線方式可在匹配視窗調整。</p>
   </aside>
  </div>
  {(error||notice)&&<p className="online-notice" role={error?'alert':'status'}>{error||notice}</p>}
  {elf&&<Suspense fallback={<p role="status">載入培養…</p>}><Training elf={elf} skillSources={catalog} groupSources={catalog} onChange={update} onClose={()=>{setEditing(undefined);setInscription(undefined);}} onEditInscription={setInscription}/></Suspense>}
  {elf&&inscription!==undefined&&<Suspense fallback={null}><Inscriptions skills={elf.skills} slotIndex={inscription} inscription={elf.inscriptions?.[inscription]} onSave={next=>{const items=[...(elf.inscriptions||[])];items[inscription]=next;update({...elf,inscriptions:items});setInscription(undefined);}} onClose={()=>setInscription(undefined)}/></Suspense>}
  {match&&<Suspense fallback={<p role="status">正在開啟匹配…</p>}><PeerRoom prepared={match.prepared} autoMatch={match.intent==='random'} starterId={match.prepared.starterId} onClose={()=>setMatch(undefined)}/></Suspense>}
 </main>;
}
