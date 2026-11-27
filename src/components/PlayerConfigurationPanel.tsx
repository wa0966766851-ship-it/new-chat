import React,{useEffect,useState} from 'react';
import {Copy,Download,Upload,ScanLine,Undo2,PackageCheck,KeyRound} from 'lucide-react';
import {decodeConfiguration,encodeConfiguration,MAX_CONFIG_TEXT} from '../playerConfig/codec';
import {captureConfiguration,loadConfigCatalog,prepareConfiguration,type ImportPlan,type ConfigCatalog} from '../playerConfig/model';
import {applyConfiguration,configRollbackStore,undoConfiguration} from '../playerConfig/transaction';
import {flushPlayerSaveNow} from '../utils/playerSaveBridge';
import {currentSiteVersion} from '../utils/siteUpdates';
import './playerConfiguration.css';

const version=()=>currentSiteVersion.version||'development';
export default function PlayerConfigurationPanel({canApply,catalogLoader=loadConfigCatalog,onReload=()=>location.reload()}:{canApply:boolean;catalogLoader?:()=>Promise<ConfigCatalog>;onReload?:()=>void}){
 const [text,setText]=useState(''),[password,setPassword]=useState(''),[label,setLabel]=useState('我的配置'),[settings,setSettings]=useState(false);
 const [plan,setPlan]=useState<ImportPlan>(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[restoreAt,setRestoreAt]=useState('');
 const [generated,setGenerated]=useState(false);
 useEffect(()=>{let mounted=true;void configRollbackStore.get().then(v=>{if(mounted)setRestoreAt(v?.createdAt||'');}).catch(()=>{});return()=>{mounted=false;};},[]);
 const work=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const invalidate=()=>{setPlan(undefined);setGenerated(false);setMessage('');};
 const generate=()=>work(async()=>{
  const result=await encodeConfiguration(captureConfiguration(localStorage,label,version(),settings),password);
  setText(result);setPlan(undefined);setGenerated(true);setMessage(`已產生${password?'加密':'未加密'}配置碼（${result.length.toLocaleString()}字元）。${result.length>20000?'內容較多，建議下載檔案分享。':'可直接複製分享。'}`);
 });
 const preview=()=>work(async()=>{
  const decoded=await decodeConfiguration(text,password),catalog=await catalogLoader();
  setPlan(prepareConfiguration(decoded,localStorage,catalog,version(),settings));setMessage('預覽完成，尚未更動存檔。');
 });
 const apply=()=>work(async()=>{
  if(!canApply||!plan)throw Error('請回首頁並完成預覽後再套用');
  await flushPlayerSaveNow();await applyConfiguration(plan,localStorage);setRestoreAt(new Date().toISOString());
  setMessage('配置已寫入本機，正在同步並重新載入…');
  await flushPlayerSaveNow();onReload();
 });
 const undo=()=>work(async()=>{
  if(!canApply)throw Error('請回首頁再復原配置');
  await flushPlayerSaveNow();await undoConfiguration(localStorage);setRestoreAt('');await flushPlayerSaveNow();onReload();
 });
 const file=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const chosen=event.target.files?.[0];event.target.value='';if(!chosen)return;
  await work(async()=>{if(chosen.size>MAX_CONFIG_TEXT)throw Error('檔案超過6 MB');setText(await chosen.text());setPlan(undefined);setGenerated(false);setMessage('已讀取檔案，請按預覽。');});
 };
 const download=()=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`seer-config-${Date.now()}.seerconfig`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="ios-card p-4 space-y-3" aria-label="配置碼與存檔" data-player-configuration>
  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2"><PackageCheck className="w-5 h-5"/>配置碼與存檔</h3>
  <p className="text-xs text-slate-400">像肉鴿局碼一樣貼上帶入：精靈、練度、技能、陣容與配裝。不需上傳。</p>
  <div className="grid gap-2 sm:grid-cols-2">
   <label className="text-xs text-slate-300">配置名稱<input aria-label="配置名稱" disabled={busy} maxLength={80} value={label} onChange={e=>setLabel(e.target.value)} className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2"/></label>
   <label className="text-xs text-slate-300"><span className="inline-flex items-center gap-1"><KeyRound className="w-3 h-3"/>密碼（選填）</span><input aria-label="配置密碼" type="password" disabled={busy} autoComplete="new-password" maxLength={1024} value={password} onChange={e=>{setPassword(e.target.value);invalidate();}} className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg p-2"/></label>
  </div>
  <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" disabled={busy} checked={settings} onChange={e=>{setSettings(e.target.checked);invalidate();}}/>同時帶入遊戲設定（音樂、背景、動畫、計時器）</label>
  <textarea aria-label="配置碼或存檔內容" disabled={busy} rows={4} wrap="off" maxLength={MAX_CONFIG_TEXT} spellCheck={false} value={text} onChange={e=>{setText(e.target.value);invalidate();}} placeholder="貼上SCFG1／SCFGE1配置碼，或讀取舊版JSON備份" className="w-full resize-y bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200"/>
  <div className="flex flex-wrap gap-2">
   <button className="ios-button inline-flex items-center gap-1" disabled={busy} onClick={()=>void generate()}><PackageCheck className="w-4 h-4"/>產生配置碼</button>
   <button className="ios-button inline-flex items-center gap-1" disabled={busy||!generated} onClick={()=>void work(async()=>{await navigator.clipboard.writeText(text);setMessage('已複製配置碼。');})}><Copy className="w-4 h-4"/>複製</button>
   <button className="ios-button inline-flex items-center gap-1" disabled={busy||!generated} onClick={download}><Download className="w-4 h-4"/>下載</button>
   <label className="ios-button inline-flex items-center gap-1 cursor-pointer"><Upload className="w-4 h-4"/>讀取檔案<input aria-label="讀取配置檔案" type="file" accept=".seerconfig,.json,.txt" hidden disabled={busy} onChange={e=>void file(e)}/></label>
   <button className="ios-button inline-flex items-center gap-1" disabled={busy||!text} onClick={()=>void preview()}><ScanLine className="w-4 h-4"/>預覽</button>
  </div>
  {plan&&<div className="rounded-lg bg-slate-950 border border-cyan-900 p-3 space-y-2 text-xs text-slate-300" data-config-preview>
   <strong className="text-cyan-200">{plan.label}</strong>
   <p>帶入{plan.customCount}隻自訂精靈、{plan.overrideCount}份內建精靈培養配置。相同識別碼套用來源配置，其餘精靈保留。</p>
   {plan.teams.map(t=><p key={t.side}>{t.side.toUpperCase()}：{t.names.join('、')||'空陣容'}{t.starter&&`｜首發：${t.starter}`}</p>)}
   {plan.equipment.map(e=><p key={e.side+e.slot}>{e.side.toUpperCase()} {({suit:'套裝',eyewear:'目鏡',title:'稱號',flame:'火焰',annual_bonus:'年費加成'} as Record<string,string>)[e.slot]}：{e.name||e.id||'未裝備'}</p>)}
   {plan.warnings.length>0&&<details open={plan.warnings.length<=6}><summary className="text-amber-300 cursor-pointer">相容性說明與略過項目（{plan.warnings.length}項）</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-amber-300">{plan.warnings.join('\n')}</pre></details>}
   <button className="ios-button-primary" disabled={busy||!canApply} onClick={()=>void apply()}>套用並重新載入</button>
  </div>}
  {!canApply&&<p className="text-xs text-amber-300">可產生與預覽；請結束戰鬥／編輯並回首頁，再套用。</p>}
  {restoreAt&&<button className="ios-button inline-flex items-center gap-1" disabled={busy||!canApply} onClick={()=>void undo()}><Undo2 className="w-4 h-4"/>復原上次套用（{new Date(restoreAt).toLocaleString('zh-TW')}）</button>}
  <p role="status" aria-live="polite" className="text-xs text-slate-300">{busy?'處理中…':message}</p>
  <p className="text-xs text-slate-500" data-settings-note>只帶入相容部分，略過項目保留原配置。配置碼含壓縮資料，可離線分享與選擇密碼加密；密碼不儲存。套用前保存一份還原點。肉鴿進度與種子獨立，帳號、API金鑰、連線身分與對戰紀錄不分享。</p>
 </section>;
}
