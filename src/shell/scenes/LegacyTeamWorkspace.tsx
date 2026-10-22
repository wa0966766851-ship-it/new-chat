import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Elf, BattleMode } from '../../types';
import { ElfAvatar, TypeIcon } from '../../components/SeerImages';
import { ElfPicker } from '../../components/shared/ElfPicker';
import { SUIT_CATALOG, EYEWEAR_CATALOG } from '../../data/suitsAndEyewears';
import { TITLE_CATALOG } from '../../data/titles';
import { SuitRail } from '../art/SuitRail';
import { ElfCardSheet } from '../art/ElfCardSheet';
import { AegisBackdrop } from '../art/backdrop';
import { Swords, Shield, Package, Shirt, Glasses, Award, ArrowLeftRight, Move, Star, Layers, X, ArrowLeft, Library, Settings2, Plus, Save, FolderOpen, Copy, Dices, Trash2, ShieldOff } from 'lucide-react';

export type WorkspaceSide = 'p1' | 'p2';
export interface LegacyTeamSide {
  team: Elf[]; starterId: string; annual: boolean;
  suit: string; eyewear: string; title: string;
  presets: Record<number, { name: string; team: Elf[]; starterId: string }>;
  hasRecord: boolean;
  setAnnual: (value: boolean) => void;
  setSuit: (value: string) => void; setEyewear: (value: string) => void; setTitle: (value: string) => void;
  starter: (id: string) => void; remove: (id: string) => void;
  choose: (index: number) => void; swap: (from: number, to: number) => void;
  swapStandby: () => void; clear: () => void; randomize: () => void; copyOther: () => void;
  save: () => void; load: () => void; savePreset: (slot: number) => void; loadPreset: (slot: number) => void;
  add: (elf: Elf) => void;
}
export interface LegacyTeamWorkspaceProps {
  sides: Record<WorkspaceSide, LegacyTeamSide>; elves: Elf[]; message: string;
  detail: (elf: Elf) => void; create: () => void; start: () => void; swapTeams: () => void;
  manageLibrary: () => void;
  /** 返回首頁（2026-10-22：workspace 自己的返回鈕） */
  back: () => void;
  mode: BattleMode; setMode: (mode: BattleMode) => void;
  host: WorkspaceSide; setHost: (side: WorkspaceSide) => void;
  format: string; setFormat: (value: any) => void;
  banCount: number; setBanCount: (value: number) => void;
  pickCount: number; setPickCount: (value: number) => void;
}

/** 只有呈現與選取狀態；所有隊伍、配裝、存檔與開戰操作都由原 StartScreen 提供。 */
export function LegacyTeamWorkspace(p: LegacyTeamWorkspaceProps) {
  const [moving, setMoving] = useState<{side: WorkspaceSide; index: number} | null>(null);
  const [dragged, setDragged] = useState<{side: WorkspaceSide; index: number} | null>(null);
  const [library, setLibrary] = useState(false);
  const [libraryAction, setLibraryAction] = useState<'detail' | WorkspaceSide>('detail');
  const [cardElf, setCardElf] = useState<Elf | null>(null);
  // 手機單欄：用 P1/P2 切換（使用者要求 2026-10-22）
  const [mobileSide, setMobileSide] = useState<WorkspaceSide>('p1');
  const [gear, setGear] = useState<{side: WorkspaceSide; slot: 'suit' | 'eyewear' | 'title'} | null>(null);
  const btn = 'workspace-button disabled:opacity-40';
  const iconBtn = 'workspace-icon-button';
  const gearSide = gear ? p.sides[gear.side] : null;
  const setGearValue = (value: string) => {
    if (!gear || !gearSide) return;
    (gear.slot === 'suit' ? gearSide.setSuit : gear.slot === 'eyewear' ? gearSide.setEyewear : gearSide.setTitle)(value);
  };
  return <section data-scene="shared-team" className="team-workspace h-full min-h-0 flex flex-col gap-2 text-slate-100">
    <AegisBackdrop image="/aegis/lobby-spatial.png" sceneOpacity={1} />
    <div className="workspace-orbit" aria-hidden="true" />
    <header className="workspace-toolbar flex flex-wrap gap-2 items-center shrink-0">
      <h1 className="font-bold mr-auto"><span className="workspace-kicker" aria-hidden="true">SQUAD / DEPLOYMENT</span><Package size={20} aria-hidden="true"/>背包與編成</h1>
      <button className={iconBtn} title={library ? '返回隊伍' : '精靈倉庫'} aria-label={library ? '返回隊伍' : '精靈倉庫'} data-active={library} onClick={() => setLibrary(v => !v)}>{library ? <ArrowLeft size={16}/> : <Library size={16}/>}</button>
      <button className={iconBtn} title="進階精靈管理" aria-label="進階精靈管理" onClick={p.manageLibrary}><Settings2 size={16}/></button>
      <button className={iconBtn} title="新增精靈" aria-label="新增精靈" onClick={p.create}><Plus size={16}/></button>
      <button className={iconBtn} title="對調雙方" aria-label="對調雙方" onClick={p.swapTeams}><ArrowLeftRight size={16}/></button>
      <button className={`${btn} workspace-launch`} onClick={p.start}><Swords size={16} aria-hidden="true"/>開始對戰／選禁</button>
    </header>
    <div className="workspace-settings flex flex-wrap items-center gap-2 text-xs shrink-0" aria-label="戰前設定">
      <label>模式 <select className="bg-slate-900 p-1.5" value={p.mode} onChange={e => p.setMode(e.target.value as BattleMode)}><option value="PVE">對戰 AI</option><option value="PVP">雙人同屏</option></select></label>
      <label>房主 <select className="bg-slate-900 p-1.5" value={p.host} onChange={e => p.setHost(e.target.value as WorkspaceSide)}><option value="p1">P1</option><option value="p2">{p.mode === 'PVE' ? 'AI（P2）' : 'P2'}</option></select></label>
      <label>賽制 <select className="bg-slate-900 p-1.5" value={p.format} onChange={e => {p.setFormat(e.target.value); if(e.target.value.startsWith('peak')) {p.setBanCount(e.target.value === 'peak_3v3' ? 2 : 3); p.setPickCount(e.target.value === 'peak_3v3' ? 3 : 6);}}}><option value="normal_6v6">自由 6V6</option><option value="solo_1v1">單挑</option><option value="peak_6v6">巔峰 6V6</option><option value="peak_3v3">巔峰 3V3</option></select></label>
      {p.format.startsWith('peak') && <><label>禁用 <select className="bg-slate-900 p-1.5" value={p.banCount} onChange={e=>p.setBanCount(Number(e.target.value))}>{[1,2,3].map(n=><option key={n}>{n}</option>)}</select></label><label>選用 <select className="bg-slate-900 p-1.5" value={p.pickCount} onChange={e=>p.setPickCount(Number(e.target.value))}>{[3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label></>}
      <span className="text-amber-200">修改後按各隊「保存紀錄」；使用原版保存規則。</span>
    </div>
    {p.message && <p role="status" className="text-sm text-emerald-300">{p.message}</p>}
    {moving && <p role="status" className="text-sm text-cyan-200">已選 {moving.side.toUpperCase()} 第 {moving.index+1} 格，請點同隊目標格交換。<button className={btn} onClick={()=>setMoving(null)}>取消移動</button></p>}
    <div className="workspace-scroll flex-1 min-h-0 overflow-y-auto">
      {library ? <><label className="block text-sm mb-2">點選精靈時：<select className="bg-slate-900 p-2" value={libraryAction} onChange={e=>setLibraryAction(e.target.value as typeof libraryAction)}><option value="detail">查看資料／編輯</option><option value="p1">加入 P1</option><option value="p2">加入 P2</option></select></label><ElfPicker elves={p.elves} onPick={e=>libraryAction==='detail'?p.detail(e):p.sides[libraryAction].add(e)} isDisabled={()=>libraryAction!=='detail'&&p.sides[libraryAction].team.length>=12?'隊伍已滿，請使用隊伍格的替換功能':undefined} getKey={(e,i)=>`${e.id}-${i}`} renderItem={e=><span className="flex items-center gap-2"><ElfAvatar elf={e} kind="head" className="w-12 h-12"/><span>{e.name}<TypeIcon type={e.type} size={16}/></span></span>}/></> :

      <div>
      <div className="workspace-side-switch" role="tablist" aria-label="切換編輯隊伍">
        {(['p1','p2'] as const).map(sd => (
          <button
            key={sd}
            type="button"
            role="tab"
            aria-selected={mobileSide === sd}
            onClick={() => setMobileSide(sd)}
            className="workspace-side-tab"
            data-active={mobileSide === sd}
          >
            {sd.toUpperCase()} · {p.sides[sd].team.length}/12
          </button>
        ))}
      </div>
      <div className="workspace-teams grid grid-cols-2 gap-2 items-start">
        {(['p1','p2'] as const).map(side => {
          const s = p.sides[side];
          return <section key={side} data-team-side={side} data-mobile-hidden={mobileSide !== side} aria-label={`${side.toUpperCase()} 隊伍`} className="workspace-team min-w-0 p-2 flex flex-col gap-2">
            <div className="workspace-team-heading flex flex-wrap items-center gap-2"><h2 className="font-bold"><Shield size={18} aria-hidden="true"/>{side.toUpperCase()} · {s.team.length}/12</h2><label className="text-xs"><input type="checkbox" checked={s.annual} onChange={e=>s.setAnnual(e.target.checked)}/> 年費全能力＋10</label></div>
            <div className="flex flex-wrap gap-1">
    <button className={iconBtn} title="保存紀錄" aria-label="保存紀錄" onClick={s.save}><Save size={15}/></button>
    <button className={iconBtn} title="載入紀錄" aria-label="載入紀錄" onClick={s.load} disabled={!s.hasRecord}><FolderOpen size={15}/></button>
    <button className={iconBtn} title={`複製 ${side==='p1'?'P2':'P1'} 的隊伍`} aria-label="複製對方隊伍" onClick={s.copyOther}><Copy size={15}/></button>
    <button className={iconBtn} title="隨機 12 隻" aria-label="隨機 12 隻" onClick={s.randomize}><Dices size={15}/></button>
    <button className={iconBtn} title="清空隊伍" aria-label="清空隊伍" onClick={s.clear}><Trash2 size={15}/></button>
  </div>
            <div className="workspace-gear grid grid-cols-2 gap-1">{(['suit','eyewear','title'] as const).map(slot => { const catalog = slot === 'suit' ? SUIT_CATALOG : slot === 'eyewear' ? EYEWEAR_CATALOG : TITLE_CATALOG; const Icon=slot==='suit'?Shirt:slot==='eyewear'?Glasses:Award; return <button key={slot} className={`${btn} text-left truncate`} onClick={()=>setGear({side,slot})}><Icon size={15} aria-hidden="true"/>{slot==='suit'?'套裝':slot==='eyewear'?'目鏡':'稱號'}：{catalog[s[slot]]?.name || '未裝備'}</button>; })}
            <button className={iconBtn} title="一鍵卸下全部配裝" aria-label="一鍵卸下全部配裝" onClick={()=>{s.setSuit('');s.setEyewear('');s.setTitle('');}}><ShieldOff size={15}/></button>
            </div>
            {['出戰','待命'].map((zone,z)=><React.Fragment key={zone}>
              <div className="flex flex-wrap gap-1 items-center"><h3 className="text-sm font-bold mr-auto">{zone} · 第 {z*6+1}–{z*6+6} 格</h3>{z===1&&<button className={btn} onClick={s.swapStandby}>全部出戰⇄待命</button>}</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                {Array.from({length:6},(_,i)=>i+z*6).map(index=>{const e=s.team[index];const id=e?.battleId || '';return <div key={index} data-workspace-slot={`${side}-${index}`} data-starter={!!e&&id===s.starterId} data-zone={z===0?'active':'standby'} draggable={!!e} onDragStart={()=>setDragged({side,index})} onDragEnd={()=>setDragged(null)} onDragOver={ev=>ev.preventDefault()} onDrop={ev=>{ev.preventDefault();if(dragged?.side===side)s.swap(dragged.index,index);setDragged(null);}} className={`workspace-slot min-w-0 p-2 rounded-lg border ${moving?.side===side&&moving.index===index?'border-cyan-400':'border-slate-700'}`}>
                  <button className="flex items-center gap-2 w-full text-left min-w-0" onClick={()=>{if(moving?.side===side){s.swap(moving.index,index);setMoving(null);}else if(e)p.detail(e);else s.choose(index);}}>
                    {e?<><ElfAvatar elf={e} kind="head" className="w-10 h-10 shrink-0"/><span className="min-w-0"><span className="block text-xs truncate">{index+1}. {e.name}{id===s.starterId?' ★':''}</span><TypeIcon type={e.type} size={16}/><span className="block text-xs text-emerald-200">HP {e.calculatedStats?.hp} · 速 {e.calculatedStats?.speed}</span></span></>:<span className="py-3 text-xs">＋ 第 {index+1} 格加入精靈</span>}
                  </button>
                  {e&&<><div className="text-xs text-slate-300 my-1">攻 {e.calculatedStats?.atk}／特攻 {e.calculatedStats?.spatk} · 防 {e.calculatedStats?.def}／特防 {e.calculatedStats?.spdef}</div><div className="flex flex-wrap gap-1 mt-1"><button className={iconBtn} title="替換精靈" aria-label="替換精靈" onClick={()=>s.choose(index)}><ArrowLeftRight size={15}/></button><button className={iconBtn} title="移動位置" aria-label="移動位置" data-active={moving?.side===side&&moving.index===index} onClick={()=>setMoving({side,index})}><Move size={15}/></button><button className={iconBtn} title="設為首發" aria-label="設為首發" onClick={()=>s.starter(id)} disabled={z===1||id===s.starterId}><Star size={15}/></button><button className={iconBtn} title="查看卡牌" aria-label="查看卡牌" onClick={()=>setCardElf(e)}><Layers size={15}/></button><button className={iconBtn} title="移出隊伍" aria-label="移出隊伍" onClick={()=>s.remove(id)}><X size={15}/></button></div>{cardElf && <ElfCardSheet elf={cardElf} onClose={() => setCardElf(null)} />}
    </>}
                </div>;})}
              </div>
            </React.Fragment>)}
            <details className="workspace-presets"><summary className="cursor-pointer text-xs py-1">預設陣容插槽</summary>{[1,2,3].map(n=><div key={n} className="flex flex-wrap gap-1 items-center py-2 border-t border-slate-800"><span className="text-xs flex-1 min-w-0">#{n} {s.presets[n]?.name || '空插槽'} · {s.presets[n]?.team.length || 0} 隻</span><button className={btn} onClick={()=>s.savePreset(n)}>保存</button><button className={btn} disabled={!s.presets[n]?.team.length} onClick={()=>s.loadPreset(n)}>載入</button></div>)}</details>
          </section>;
        })}
      {/* 手機單欄切換（桌面隱藏） */}
      </div>
      </div>}
    </div>
    {gear&&gearSide&&createPortal(<div role="dialog" aria-modal="true" aria-label={`${gear.side.toUpperCase()} 配裝`} className="fixed inset-0 z-[230] bg-slate-950/95 p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between"><h2>{gear.side.toUpperCase()} 配裝（全隊生效）</h2><button className={btn} onClick={()=>setGear(null)}>完成</button></header>
      <button className={btn} onClick={()=>setGearValue('')}>卸下目前裝備</button>
      <SuitRail kind={gear.slot} equippedId={gearSide[gear.slot]} onEquip={id=>setGearValue(id===gearSide[gear.slot]?'':id)} />
    </div>, document.body)}
  </section>;
}