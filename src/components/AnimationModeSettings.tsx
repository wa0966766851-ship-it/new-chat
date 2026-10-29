import React from 'react';
import type {Elf} from '../types';
import {ANIMATION_MODES,animationModeFor,elfAnimationKey,readAnimationSettings,writeAnimationSettings,withAnimationMode,setElfAnimationMode,BATTLE_ANIMATION_EVENT,type BattleAnimationSettings,type AnimationMode} from '../battle/animationSettings';
import {petAnimationBinding} from '../battle/petAnimationRegistry';
import {PET_ANIMATION_ASSETS} from '../battle/petAnimationAssets';

export function GlobalAnimationMode({settings,onChange}:{settings:BattleAnimationSettings;onChange:(s:BattleAnimationSettings)=>void}){
 return <div className="space-y-2"><label className="text-sm text-cyan-200">全域播放模式
  <select aria-label="全域播放模式" title="精靈動作：按需取得遊戲素材並快取，僅限個人使用" className="ml-3 rounded-lg bg-slate-950 border border-slate-700 p-2" value={animationModeFor(settings)} onChange={e=>onChange(withAnimationMode(settings,e.target.value as AnimationMode))}>
   {ANIMATION_MODES.map(m=><option key={m.value} value={m.value} title={m.value==='actions'?'按需取得遊戲素材並快取，僅限個人使用':undefined}>{m.label}</option>)}
  </select></label>
  <p className="text-xs text-slate-400">簡易演出沿用目前的前移、閃光與受擊晃動。精靈動作使用已核對的素材，尚未就緒時沿用簡易演出。每隻精靈可在外觀設定單獨調整。</p>
  <p className="text-xs text-slate-400">已支援的動作素材會自動按需下載並沿用快取。預設快取上限 512 MiB，舊素材自動清理；首次下載期間可繼續操作。</p>
  {!!Object.keys(settings.elfModes||{}).length && <div className="space-y-1">{Object.entries(settings.elfModes||{}).map(([key,mode])=><div key={key} className="flex items-center justify-between text-xs text-slate-300"><span>{key.slice(key.indexOf(':')+1)} · {ANIMATION_MODES.find(m=>m.value===mode)?.label}</span><button type="button" onClick={()=>{const elfModes={...settings.elfModes};delete elfModes[key];onChange({...settings,elfModes});}} className="text-cyan-300">恢復跟隨全域</button></div>)}</div>}
 </div>;
}
export function ElfAnimationModePicker({elf}:{elf:Elf}){
 const assetId=petAnimationBinding(elf);
 const [settings,setSettings]=React.useState(readAnimationSettings);
 React.useEffect(()=>{const refresh=()=>setSettings(readAnimationSettings());window.addEventListener(BATTLE_ANIMATION_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(BATTLE_ANIMATION_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
 return <div className="border-t border-slate-800 pt-3 space-y-2"><label className="text-sm text-cyan-200">這隻精靈的播放模式
  <select aria-label="這隻精靈的播放模式" title="精靈動作：按需取得遊戲素材並快取，僅限個人使用" className="ml-3 rounded-lg bg-slate-950 border border-slate-700 p-2" value={settings.elfModes?.[elfAnimationKey(elf)]||'inherit'} onChange={e=>writeAnimationSettings(setElfAnimationMode(readAnimationSettings(),elf,e.target.value as AnimationMode|'inherit'))}>
   <option value="inherit">跟隨全域（{ANIMATION_MODES.find(m=>m.value===animationModeFor(settings))?.label}）</option>
   {ANIMATION_MODES.map(m=><option key={m.value} value={m.value} title={m.value==='actions'?'按需取得遊戲素材並快取，僅限個人使用':undefined}>{m.label}</option>)}
  </select></label><p className="text-xs text-slate-400">{assetId?PET_ANIMATION_ASSETS[assetId].name+'動作 · 首次使用可自動取得素材，下載後沿用快取':'目前外觀尚未綁定動作素材；動作模式會沿用簡易演出。'} · 同一種精靈共用此偏好，皮膚仍分別保存。</p></div>;
}
