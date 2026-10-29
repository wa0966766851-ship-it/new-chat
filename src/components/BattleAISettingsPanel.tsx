import React, { useEffect, useState } from 'react';
import { AI_DECISION_EVENT, AI_SETTINGS_EVENT, DEFAULT_AI_SETTINGS, readAISettings, writeAISettings, latestDecisions } from '../battle/ai/settings';
import { POSITION_WEIGHTS, WEIGHT_LABELS } from '../battle/ai/evaluation';
import { AI_STYLES, AI_RISKS } from '../battle/ai/styles';
import { SegmentRow, type SegmentOption } from './SegmentRow';
import { actionKey, type AISettings, type DecisionReport } from '../battle/ai/types';

/** 控制中心只訂閱精簡決策報告，不讀取或保存完整戰局。 */
export function BattleAISettingsPanel() {
  const [settings, setSettings] = useState(readAISettings);
  const [reports, setReports] = useState(latestDecisions);
  useEffect(() => {
    const refresh = () => setSettings(readAISettings()), report = () => setReports(latestDecisions());
    window.addEventListener(AI_SETTINGS_EVENT, refresh); window.addEventListener('storage', refresh);
    window.addEventListener(AI_DECISION_EVENT, report);
    return () => { window.removeEventListener(AI_SETTINGS_EVENT, refresh); window.removeEventListener('storage', refresh); window.removeEventListener(AI_DECISION_EVENT, report); };
  }, []);
  const update = (patch: Partial<AISettings>) => setSettings(writeAISettings({ ...settings, ...patch }));
  const styleOptions: SegmentOption<AISettings['style']>[] = Object.entries(AI_STYLES).map(([value,info]) => ({ value: value as AISettings['style'], label: info.label, tip: info.description }));
  const riskOptions: SegmentOption<NonNullable<AISettings['risk']>>[] = Object.entries(AI_RISKS).map(([value,info]) => ({ value: value as NonNullable<AISettings['risk']>, label: info.label, tip: `${info.description} 風險與戰術風格分開；激進不等於只攻擊，保守不等於只防守。` }));
  return <section className="space-y-3 text-xs text-slate-300" data-testid="battle-ai-settings">
    <div className="flex items-center justify-between"><h3 className="font-bold" title="不連接 AI 模型、不消耗 token。比較己方行動與對手可能回應，使用同一套戰鬥引擎結算。設定同時適用於對戰 AI 與己方托管。隱匿／幻化敵人以公開資訊作假設，不保證預知其真正效果。">本地對戰 AI</h3>
      <button type="button" onClick={() => setSettings(writeAISettings(DEFAULT_AI_SETTINGS))} className="text-slate-400 hover:text-white">重設</button></div>
    <div>
      <SegmentRow compact label="決策方式" ariaLabel="AI決策方式" value={settings.mode} onChange={mode => update({ mode })} options={[
        {value:'planner',label:'背景推演',tip:'背景推演己方行動與對手可能回應；尚未載入、逾時或效果無法安全複製時會回退。'},
        {value:'heuristic',label:'快速評估',tip:'快速評估不取樣機率波動；保守／激進需背景推演完成多組比較才有可用的最差／最佳結果。'}]}/>
      <SegmentRow compact label="AI 思考強度" ariaLabel="AI難度" value={settings.difficulty} onChange={difficulty => update({ difficulty })} options={[
        {value:'easy',label:'簡單',tip:'分支較少，反應較快'},{value:'balanced',label:'標準',tip:'預設分支數量'},{value:'hard',label:'深入',tip:'分支較多；思考強度只控制分支數量，不代表戰術偏好'}]}/>
      <SegmentRow compact label="敵方 AI 風格" ariaLabel="AI風格" value={settings.style} onChange={style => update({ style })} options={styleOptions}/>
      <SegmentRow compact label="我方託管風格" ariaLabel="我方託管風格" value={settings.ownStyle||'follow'} onChange={ownStyle => update({ ownStyle })} options={[{value:'follow',label:'跟隨',tip:'跟隨 AI 風格'},...styleOptions]}/>
      <SegmentRow compact label="思考上限" ariaLabel="AI思考上限" value={String(settings.budgetMs)} onChange={v => update({ budgetMs: Number(v) })}
        options={[100,250,600,1200,2000,settings.budgetMs].filter((v,i,a) => a.indexOf(v) === i).sort((a,b)=>a-b).map(n => ({value:String(n),label:n%1000===0?`${n/1000}s`:`${+(n/1000).toFixed(2)}s`,tip:`${n} 毫秒`}))}/>
      <SegmentRow compact label="敵方風險傾向" ariaLabel="AI風險傾向" value={settings.risk||'balanced'} onChange={risk => update({ risk })} options={riskOptions}/>
      <SegmentRow compact label="我方託管風險" ariaLabel="我方託管風險" value={settings.ownRisk||'follow'} onChange={ownRisk => update({ ownRisk })} options={[{value:'follow',label:'跟隨',tip:'跟隨 AI 風險'},...riskOptions]}/>
    </div>
    <label className="flex items-center justify-between rounded-lg border border-slate-800 p-3">保留最近一次決策說明
      <input type="checkbox" checked={settings.explain} onChange={e => update({ explain: e.target.checked })} /></label>
    <details className="rounded-lg border border-slate-800 p-3"><summary className="cursor-pointer">局面評分權重（唯讀）</summary>
      <p className="my-2 text-slate-500">僅影響 AI 選擇，不改變傷害公式。護盾超過最大體力後降低邊際價值；能力等級依可用攻擊類型折算；風格再乘各項偏好，額外精靈折算 0.3 倍。</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">{Object.entries(POSITION_WEIGHTS).map(([k,v]) => <React.Fragment key={k}>
        <dt>{WEIGHT_LABELS[k]}</dt><dd className="text-right tabular-nums">{v}</dd></React.Fragment>)}</dl>
    </details>
    {settings.explain && (Object.values(reports) as DecisionReport[]).map(report => report && <details key={report.side} className="rounded-lg border border-slate-800 p-3">
      <summary className="cursor-pointer">{report.side.toUpperCase()} 第 {report.turn} 回合 · {report.candidates.find(c => actionKey(c.action) === actionKey(report.action))?.label || '等待'}</summary>
      <p className="my-2 text-slate-400">{report.mode === 'planner' ? '引擎推演' : '快速評估'}{report.style?` · ${AI_STYLES[report.style].label}`:''}{report.risk?` · ${AI_RISKS[report.risk].label}`:''} · {Math.round(report.elapsedMs)}ms · {report.simulations} 分支 · {report.completedSweeps} 輪完整比較{report.timedOut ? ' · 已達上限' : ''}</p>
      {report.fallbackReason && <p className="mb-2 text-amber-300">{report.fallbackReason}</p>}
      {report.assumptions.map(a => <p key={a} className="mb-2 text-slate-500">{a}</p>)}
      <div className="space-y-2">{report.candidates.map(c => <details key={actionKey(c.action)} className="rounded bg-slate-950 p-2">
        <summary className="cursor-pointer flex justify-between gap-2"><span>{c.label}</span><span className="tabular-nums">{c.score.toFixed(1)}</span></summary>
        <p className="my-1 text-slate-500">{c.reason} · {c.samples} 樣本 · 最差差值 {c.worst.toFixed(1)}{c.best===undefined?'':` · 最佳差值 ${c.best.toFixed(1)}`}</p>
        {c.parts.map(p => <p key={p.key} className="flex justify-between"><span>{p.label}</span><span>{p.value.toFixed(1)}</span></p>)}
      </details>)}</div>
    </details>)}
  </section>;
}
