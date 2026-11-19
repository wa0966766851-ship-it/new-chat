import React,{useEffect,useState} from 'react';
import {readTurnTimer,writeTurnTimer,TURN_TIMER_EVENT} from '../battle/turnTimer';
export function BattleTimerSettingsPanel() {
  const [settings,setSettings]=useState(readTurnTimer);
  useEffect(() => {const refresh=()=>setSettings(readTurnTimer());window.addEventListener(TURN_TIMER_EVENT,refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener(TURN_TIMER_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
  return <section className="space-y-2 rounded-lg border border-slate-700 p-3" data-testid="battle-timer-settings">
    <h3 className="font-bold">對戰計時器（所有對戰與死亡換人）</h3>
    <select aria-label="對戰計時器模式" className="w-full bg-slate-900 p-2" value={settings.mode} onChange={e=>setSettings(writeTurnTimer({...settings,mode:e.target.value as typeof settings.mode}))}>
      <option value="off">關閉計時器（預設）</option><option value="ordered">模式 1：第五技 → 1 → 2 → 3 → 4 → 空過</option><option value="auto">模式 2：逾時開啟託管</option>
    </select>
    <label className="flex justify-between">每次選擇時間（5–60 秒）<input aria-label="對戰計時秒數" type="number" min="5" max="60" className="w-20 bg-slate-900 p-1" value={settings.seconds} onChange={e=>setSettings(writeTurnTimer({...settings,seconds:Number(e.target.value)}))}/></label>
    <p className="text-slate-400">演出及 AI 思考不扣時。模式 1 跳過不可選技能；死亡時依隊伍順序換人。模式 2 持續託管，可手動關閉。</p>
  </section>;
}
