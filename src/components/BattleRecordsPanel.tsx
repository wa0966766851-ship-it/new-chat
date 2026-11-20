import React,{useEffect,useState} from 'react';
import {providerStatus} from '../battle/ai/providerApi';
import {recordingEnabled,setRecordingEnabled,RECORDING_EVENT} from '../battle/records/schema';
import {recordingMessage,RECORD_STATUS_EVENT} from '../battle/records/recorder';
export function BattleRecordsPanel(){
  const [on,setOn]=useState(recordingEnabled),[message,setMessage]=useState(recordingMessage),[files,setFiles]=useState<{id:string;name:string;bytes:number}[]>([]),[directory,setDirectory]=useState(''),[busy,setBusy]=useState(false),[importText,setImportText]=useState('');
  const refresh=async()=>{const r=await fetch('/api/battle-ai/records',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.files))throw Error();setFiles(data.files);setDirectory(data.directory);};
  useEffect(()=>{const status=()=>setMessage(recordingMessage()),setting=()=>setOn(recordingEnabled());window.addEventListener(RECORD_STATUS_EVENT,status);window.addEventListener(RECORDING_EVENT,setting);void refresh().catch(()=>setMessage('本機記錄服務尚未就緒；請開啟最新版桌面程式。'));return()=>{window.removeEventListener(RECORD_STATUS_EVENT,status);window.removeEventListener(RECORDING_EVENT,setting);};},[]);
  const post=async(route:string,body:unknown)=>{const s=await providerStatus();const r=await fetch('/api/battle-ai/records'+route,{method:'POST',headers:{'Content-Type':'application/json','x-seer-ai-session':s.session},body:JSON.stringify(body)});if(!r.ok)throw Error();};
  const run=async(action:()=>Promise<void>,success:string)=>{setBusy(true);try{await action();await refresh();setMessage(success);}catch{setMessage('未完成，請確認本機記錄服務或重新整理清單。');}finally{setBusy(false);}};
  return <section className="space-y-2 rounded-lg border border-slate-700 p-3" data-testid="battle-records-panel">
    <label className="flex justify-between">保存對戰與 AI 決策 TXT（最多 10 場）<input aria-label="保存對戰 TXT" type="checkbox" checked={on} onChange={e=>{setRecordingEnabled(e.target.checked);setOn(e.target.checked);}}/></label>
    <p className="text-slate-400">本機保存，超過 10 場先刪最老一場。含隊伍、體力／PP、行動、傷害帳本與候選評分；不含 API 金鑰或模型思考鏈。</p>
    <div className="flex gap-4"><button disabled={busy} onClick={()=>void run(()=>post('/open',{}),'已開啟資料夾，可直接刪除 TXT。')}>開啟記錄資料夾</button><button disabled={busy} onClick={()=>void run(async()=>{},'已更新清單。')}>重新整理</button><button disabled={busy||!files.length} onClick={()=>void run(()=>post('/delete',{all:true}),'已刪除全部對戰記錄。')}>刪除全部記錄</button></div>
    {directory&&<p className="break-all text-slate-500">{directory}</p>}
    {!files.length&&<p>尚無已保存的對戰。</p>}
    <ul className="space-y-1">{files.map(file=><li key={file.id} className="flex items-center justify-between gap-2"><a className="min-w-0 truncate text-cyan-300" href={'/api/battle-ai/records/'+file.id} download={file.name}>{new Date(Number(file.id.slice(0,13))).toLocaleString()} · {Math.ceil(file.bytes/1024)} KB · TXT</a><button disabled={busy} aria-label={'刪除 '+file.name} onClick={()=>void run(()=>post('/delete',{id:file.id}),'已刪除指定記錄。')}>刪除</button></li>)}</ul>
    <details><summary className="cursor-pointer">補存舊戰報文字</summary><p>舊戰報無法補回未保留的回合或歷史 AI 評分；補存時會標記為部分資料。</p><textarea aria-label="舊戰報文字" className="h-28 w-full bg-slate-900 p-2" maxLength={100000} value={importText} onChange={e=>setImportText(e.target.value)}/><button disabled={busy||!importText.trim()} onClick={()=>void run(async()=>{await post('',{id:`${Date.now()}-${crypto.randomUUID()}`,create:true,events:[{kind:'import',at:new Date().toISOString(),data:{coverage:'舊畫面補存，可能不完整；沒有當時 AI 決策評分。',text:importText}}]});setImportText('');},'已補存舊戰報 TXT。')}>保存舊戰報</button></details>
    <p role="status">{message}</p>
  </section>;
}

