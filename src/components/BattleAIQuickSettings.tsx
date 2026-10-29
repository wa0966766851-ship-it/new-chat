import React, {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {AI_SETTINGS_EVENT,readAISettings,writeAISettings} from '../battle/ai/settings';
import {AI_STYLES,AI_RISKS} from '../battle/ai/styles';
import type {AISettings} from '../battle/ai/types';
import {SegmentRow,type SegmentOption} from './SegmentRow';
/** 首頁僅載入輕量設定，不載入推演引擎或戰局資料。 */
const DIFFICULTIES:SegmentOption<AISettings['difficulty']>[]=[
  {value:'easy',label:'簡單',tip:'分支較少，反應較快'},
  {value:'balanced',label:'標準',tip:'預設分支數量'},
  {value:'hard',label:'深入',tip:'分支較多，思考較久'},
];
const styleOptions=():SegmentOption<AISettings['style']>[]=>Object.entries(AI_STYLES).map(([value,info])=>({value:value as AISettings['style'],label:info.label,tip:info.description}));
const riskOptions=():SegmentOption<AISettings['risk']&string>[]=>Object.entries(AI_RISKS).map(([value,info])=>({value:value as AISettings['risk']&string,label:info.label,tip:`${info.description} 保守／激進與強攻／穩守可自由搭配。`}));
const FOLLOW_TIP='跟隨敵方 AI 設定';
const OPEN_KEY='seer.homeAIStrategyOpen';
const readOpen=()=>{try{return localStorage.getItem(OPEN_KEY)==='1';}catch{return false;}};
const writeOpen=(open:boolean)=>{try{localStorage.setItem(OPEN_KEY,open?'1':'0');}catch{/* 無法儲存時仍可使用 */}};
/** 收合列摘要：敵方風格・我方託管風格・思考強度；風險非預設時再附加。 */
export function summarizeAISettings(s:AISettings):string {
  const parts=[AI_STYLES[s.style].label,s.ownStyle&&s.ownStyle!=='follow'?AI_STYLES[s.ownStyle].label:'跟隨',DIFFICULTIES.find(d=>d.value===s.difficulty)?.label||'標準'];
  if(s.risk&&s.risk!=='balanced')parts.push(`風險${AI_RISKS[s.risk].label}`);
  if(s.ownRisk&&s.ownRisk!=='follow')parts.push(`託管${AI_RISKS[s.ownRisk].label}`);
  return parts.join('・');
}
export function BattleAIQuickSettings({pve=true}:{pve?:boolean}) {
  const [settings,setSettings]=useState(readAISettings);
  const [open,setOpen]=useState(readOpen);
  useEffect(()=>{const refresh=()=>setSettings(readAISettings());window.addEventListener(AI_SETTINGS_EVENT,refresh);window.addEventListener('storage',refresh);
    return()=>{window.removeEventListener(AI_SETTINGS_EVENT,refresh);window.removeEventListener('storage',refresh);};},[]);
  const change=(patch:Partial<AISettings>)=>setSettings(writeAISettings({...settings,...patch}));
  const toggle=()=>setOpen(prev=>{writeOpen(!prev);return !prev;});
  const styles=styleOptions(),risks=riskOptions();
  if(!pve)return null;
  return <section data-testid="homepage-ai-settings">
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] cursor-pointer select-none" onClick={toggle}
      title="免連線，不消耗 token。設定與控制中心同步；只影響自動選招／換人，不改傷害規則、不代替手動操作。思考時間與快速模式可至控制中心調整。">
      <h2 className="text-[15px] text-slate-100 shrink-0">本地 AI 策略</h2>
      <div className="flex items-center gap-2 min-w-0">
        <span data-testid="homepage-ai-summary" className="ios-chip text-xs text-slate-300 truncate">{summarizeAISettings(settings)}</span>
        <button type="button" aria-expanded={open} aria-controls="homepage-ai-rows" aria-label={open?'收合本地 AI 策略':'展開本地 AI 策略'} className="text-slate-400 hover:text-white p-1 -m-1 shrink-0">
          <ChevronDown className="w-4 h-4 ai-chevron"/></button>
      </div>
    </div>
    <div id="homepage-ai-rows" className="ai-collapse" data-open={open}><div>
      <SegmentRow label="敵方 AI 風格" ariaLabel="首頁敵方AI風格" value={settings.style} options={styles} onChange={style=>change({style})}/>
      <SegmentRow label="我方託管風格" ariaLabel="首頁我方託管風格" value={settings.ownStyle||'follow'} options={[{value:'follow',label:'跟隨',tip:FOLLOW_TIP},...styles]} onChange={ownStyle=>change({ownStyle})}/>
      <SegmentRow label="AI 思考強度" ariaLabel="首頁AI難度" value={settings.difficulty} options={DIFFICULTIES} onChange={difficulty=>change({difficulty})}/>
      <SegmentRow label="敵方風險傾向" ariaLabel="首頁敵方AI風險" value={settings.risk||'balanced'} options={risks} onChange={risk=>change({risk})}/>
      <SegmentRow label="我方託管風險" ariaLabel="首頁我方託管風險" value={settings.ownRisk||'follow'} options={[{value:'follow',label:'跟隨',tip:FOLLOW_TIP},...risks]} onChange={ownRisk=>change({ownRisk})}/>
    </div></div>
  </section>;
}
