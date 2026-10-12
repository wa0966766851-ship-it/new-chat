import { useMemo } from 'react';
import { compileEffectPlan, type EffectDefinition, type EffectExecutionMode } from '../effects/effectConnection';
import { BlockProgramView } from './BlockProgramView';
import { distillEffect } from '../effects/distillEffect';
import { damageScopeLabel } from '../effects/damageChoices';

const MODES: Record<EffectExecutionMode, string> = { auto: '自動（保留既有來源）', registry: '專屬註冊表', description: '原文語意積木', kit: '手動積木' };
export function EffectConnectionInspector({ definition, kind, hasHandler = false, onModeChange, onKitChange, legacyExecution }: {
  definition: EffectDefinition; kind: 'skill' | 'soul'; hasHandler?: boolean;
  onModeChange?: (mode: EffectExecutionMode) => void;
  onKitChange?: (kit: NonNullable<EffectDefinition['kit']>) => void;
  legacyExecution?: { source: string; program: import('../blocks/model').Program };
}) {
  const plan = useMemo(() => compileEffectPlan(definition, kind, hasHandler), [definition, kind, hasHandler]);
  const distilled = useMemo(() => onKitChange ? distillEffect(definition, kind) : null, [definition, kind, onKitChange]);
  const legacy = (!definition.effectMode || definition.effectMode === 'auto') ? legacyExecution : undefined;
  return <section aria-label="效果連接狀態" className="ios-card rounded-xl p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-cyan-200">{definition.name || '未命名效果'} · 連接核對</h4>
      {onModeChange && <select aria-label="效果執行來源" value={definition.effectMode || 'auto'} onChange={e => onModeChange(e.target.value as EffectExecutionMode)} className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-xs">
        {Object.entries(MODES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>}
    </div>
    <p className="text-xs text-slate-300">執行來源：{legacy?.source || MODES[plan.route]} · {legacy ? '維持既有路由；解析不代表已實裝' : plan.connected === null ? '專屬程式逐句驗證另計' : `可連接 ${plan.connected}/${plan.total}`} · 來源核對待處理 {plan.issues.length}</p>
    <p className="text-xs text-slate-400">同一效果只用一個來源。手動積木執行時，描述只作說明，不再執行第二次。可連接不等於語意已驗收。</p>
    {onKitChange && distilled && <details className="rounded-lg border border-blue-500/20 p-2"><summary className="cursor-pointer text-xs text-blue-200">原文 → 可編輯畫布（嚴格轉換）</summary>
      <p className="my-2 text-xs text-slate-400">完整等價才能取代畫布。原描述保留；不把未解析句子丟掉，也不保留兩套執行。</p>
      <button type="button" disabled={!distilled.complete} className="ios-button-primary text-xs px-3 py-2 disabled:opacity-40" onClick={() => {
        if (!definition.kit?.length || window.confirm('將以完整轉換結果取代目前積木，保留原描述。確認？')) { onKitChange(distilled.kit); onModeChange?.('kit'); }
      }}>煉成可編輯積木</button>
      <p className="mt-2 text-xs">可轉換 {distilled.kit.length} 條 · 未等價 {distilled.issues.length} 項</p>
      {distilled.issues.map((issue,i) => <p key={i} className="mt-1 text-xs text-amber-200">{issue.text}：{issue.reason}</p>)}
    </details>}
    {kind === 'skill' && onKitChange && definition.kit?.length ? <details><summary className="text-xs cursor-pointer text-blue-200">技能效果身分（固有／附加／攜帶）</summary>
      {definition.kit.map((entry,i) => <label key={i} className="flex items-center gap-2 mt-2 text-xs"><span className="flex-1">{entry.customText || entry.codeId}</span>
        <select aria-label={`效果 ${i + 1} 身分`} value={entry.role || 'attached'} className="bg-slate-900 rounded-lg p-1" onChange={e => onKitChange(definition.kit!.map((item,n) => n === i ? { ...item, role: e.target.value as typeof entry.role } : item))}>
          <option value="innate">■ 固有</option><option value="attached">🎯 附加</option><option value="carried">◇ 攜帶</option>
        </select>
      </label>)}
    </details> : null}
    {onKitChange && definition.kit?.some(entry => ['damage_multiplier','damage_reduce'].includes(entry.codeId)) && <details><summary className="text-xs cursor-pointer text-blue-200">增減傷作用範圍（可複選）</summary>
      <p className="text-xs text-slate-400 mt-2">攻擊傷害屬於技能傷害。非真實包含技能、固定、百分比，不包含真實傷害或體力調整。至少保留一種類別；舊資料未填範圍時不自行改寫。</p>
      {definition.kit.map((entry,i) => ['damage_multiplier','damage_reduce'].includes(entry.codeId) && <fieldset key={i} className="mt-2 border border-white/10 rounded-lg p-2"><legend className="text-xs">{entry.customText || (entry.codeId === 'damage_reduce' ? '減傷' : '增傷')}</legend>
        <div className="flex flex-wrap gap-3">{['attack','skill','fixed','percent','true','non_true'].map(type => <label key={type} className="text-xs flex items-center gap-1"><input type="checkbox" aria-label={`效果 ${i + 1} 範圍 ${type}`} checked={entry.params.damageTypes?.includes(type) || false} onChange={e => {
          const types = new Set<string>(entry.params.damageTypes || []);
          if (e.target.checked) types.add(type); else types.delete(type);
          // 空集合在舊引擎代表全部，不可把取消最後一項變成全範圍。
          if (!types.size) return;
          onKitChange(definition.kit!.map((item,n) => n === i ? { ...item, params: { ...item.params, damageTypes: [...types] } } : item));
        }} />{damageScopeLabel(type)}</label>)}</div>
        {!entry.params.damageTypes?.length && <p className="mt-1 text-xs text-amber-200">舊範圍未明確化，請選至少一個類別。</p>}
      </fieldset>)}
    </details>}
    {plan.issues.length > 0 && <details open><summary className="text-xs text-amber-300 cursor-pointer">未接通／有疑義（原文保留）</summary><ol className="mt-2 space-y-2 text-xs text-amber-200">
      {plan.issues.map((issue, index) => <li key={index} className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2"><p className="whitespace-pre-wrap">{issue.text}</p><p className="mt-1 text-amber-300/80">{issue.reason}</p></li>)}
    </ol></details>}
    <details><summary className="text-xs text-blue-200 cursor-pointer">執行積木與完整參數</summary><div className="mt-2"><BlockProgramView program={legacy?.program || plan.program} source={legacy?.source || MODES[plan.route]} /></div></details>
  </section>;
}
