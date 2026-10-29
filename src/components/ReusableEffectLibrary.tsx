import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_ELVES } from '../data/defaultElves';
import { collectEffectPresetsAsync, type EffectKind, type EffectPreset } from '../effects/effectPresets';

// 只在打開效果庫時建立索引；分頁不掛載數百個畫布／原文解析視圖。
let catalog: Promise<EffectPreset[]> | undefined;
export function ReusableEffectLibrary({ kind, onSelect, onClose }: { kind: EffectKind; onSelect: (preset: EffectPreset) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ready' | 'blocked'>('ready');
  const [page, setPage] = useState(0);
  const [all, setAll] = useState<EffectPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    (catalog ??= collectEffectPresetsAsync(DEFAULT_ELVES)).then(rows => {if (!cancelled) {setAll(rows);setLoading(false);}},reason => {catalog=undefined;if(!cancelled){setError(String(reason));setLoading(false);}});
    return () => {cancelled=true;};
  },[]);
  const matches = useMemo(() => all.filter(p => p.kind === kind && p.complete === (filter === 'ready') &&
    `${p.elfId} ${p.elfName} ${p.definition.name} ${p.definition.description}`.toLowerCase().includes(query.toLowerCase())), [all, kind, filter, query]);
  const pages = Math.max(1, Math.ceil(matches.length / 12));
  const current = Math.min(page, pages - 1);
  return <section className="ios-card p-4 sm:p-5 space-y-4" aria-label="可執行效果庫">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold">套用既存效果</h3>
      <p className="text-xs text-slate-400 mt-1">複製原句、戰鬥節點、條件與參數；不複製原主能力或專屬身分。接通不代表逐句驗收完成。</p></div>
      <button type="button" className="ios-button-secondary px-3 py-2 text-xs" onClick={onClose}>關閉</button></div>
    <div className="flex flex-col sm:flex-row gap-3">
      <input aria-label="搜尋可套用效果" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} className="ios-input min-w-0 flex-1 px-3 py-2 text-sm" placeholder="精靈 ID、名稱、效果、傷害類型…" />
      <nav className="ios-segment" aria-label="效果库接通分類">{([['ready','可套用'],['blocked','待接通']] as const).map(([key,label])=><button key={key} type="button" data-active={filter===key} onClick={()=>{setFilter(key);setPage(0);}}>{label}</button>)}</nav>
    </div>
    <p role="status" className="text-xs text-slate-400">{loading?'分批建立效果索引…':`${matches.length} 筆`} · 僅顯示{kind === 'skill' ? '技能' : '魂印／特質'}相容時點</p>
    {error && <p role="alert" className="text-xs text-amber-200">效果庫載入失敗：{error}</p>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {matches.slice(current*12,(current+1)*12).map(p=><article key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-2">
        <div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{p.definition.name}</h4><p className="text-[11px] text-slate-400">{p.elfName} · #{p.elfId} · {p.category}</p></div>
          <button type="button" disabled={!p.complete} onClick={()=>onSelect(p)} className="ios-button-primary shrink-0 p-2 text-xs disabled:opacity-40">{p.complete?'套用效果':'尚未接通'}</button></div>
        <p className="whitespace-pre-wrap text-xs leading-6 max-h-28 overflow-y-auto">{p.definition.description || '無描述'}</p>
        {p.complete ? <p className="text-[11px] text-blue-300">{p.kit.length} 個可執行積木 · 使用獨立副本</p> : <details className="text-xs text-amber-200"><summary className="cursor-pointer">未接通原因（{p.issues.length}）</summary>{p.issues.map((i,n)=><p key={n} className="mt-2">{i.text}：{i.reason}</p>)}{!p.issues.length && <p>沒有可執行詞條。</p>}</details>}
      </article>)}
    </div>
    {!loading && !error && !matches.length && <p className="text-sm text-slate-400 py-4">沒有符合條件的效果。</p>}
    <div className="flex items-center justify-center gap-4 text-xs"><button type="button" className="ios-button-secondary p-2" disabled={current===0} onClick={()=>setPage(current-1)}>上一頁</button><span>{current+1}／{pages}</span><button type="button" className="ios-button-secondary p-2" disabled={current+1>=pages} onClick={()=>setPage(current+1)}>下一頁</button></div>
  </section>;
}
