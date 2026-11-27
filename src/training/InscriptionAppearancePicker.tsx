import React,{useState} from 'react';
import rows from './inscriptionSkins.json';
export function InscriptionAppearancePicker({value,onChange,expanded=false}:{value?:string;onChange:(id?:string)=>void;expanded?:boolean}){
 const [query,setQuery]=useState('');const found=rows.filter(s=>`${s.id} ${s.name}`.includes(query));
 return <details open={expanded||undefined} className="text-xs space-y-2" aria-label="刻印皮膚"><summary className="text-cyan-200 cursor-pointer">刻印外觀 · {rows.find(s=>s.id===value)?.name||'預設圖樣'}</summary>
  <p className="text-slate-400">使用原廠刻印圖樣，僅改外觀，不替換能力或寶石。</p><input aria-label="搜尋刻印外觀" className="w-full bg-slate-900 rounded p-2" placeholder="輸入刻印名稱或編號" value={query} onChange={e=>setQuery(e.target.value)}/>
  {value&&<div className="flex items-center gap-3"><img key={value} alt="已選刻印外觀" src={`/seer/countermark/${value}.png`} className="w-14 h-14 object-contain" loading="lazy"/><span>{rows.find(s=>s.id===value)?.name} · 外觀預覽</span></div>}
  <button type="button" className="p-2 text-cyan-200" onClick={()=>onChange(undefined)}>恢復預設圖樣</button>
  <div className="grid grid-cols-3 gap-1 max-h-48 overflow-auto">{found.slice(0,60).map(s=><button type="button" aria-pressed={s.id===value} className={`p-2 border rounded ${s.id===value?'border-cyan-400':'border-slate-700'}`} key={s.id} onClick={()=>onChange(s.id)}>{s.name}<small className="block text-slate-500">#{s.id}</small></button>)}</div><small className="text-slate-500">顯示前 {Math.min(60,found.length)}／{found.length} 款，輸入名稱可縮小範圍。圖片只載入已選外觀。</small>
 </details>;
}
