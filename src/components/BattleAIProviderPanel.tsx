import React, {useEffect,useState} from 'react';
import type {AISettings} from '../battle/ai/types';
import {providerPost,providerStatus} from '../battle/ai/providerApi';

export function BattleAIProviderPanel({settings,update}:{settings:AISettings;update:(patch:Partial<AISettings>)=>void}) {
  const [key,setKey] = useState(''), [remember,setRemember] = useState(false), [status,setStatus] = useState<Awaited<ReturnType<typeof providerStatus>>>(), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); void providerStatus(controller.signal).then(setStatus).catch(() => setMessage('模型設定僅支援本機啟動的專案。')); return () => controller.abort(); },[]);
  const run = async (action:'save'|'delete'|'test') => { setBusy(true); setMessage('處理中…');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(),(settings.modelTimeoutMs || 15000)+1500);
    try {
      if (action === 'test') { const result = await providerPost('decide',{timeoutMs:settings.modelTimeoutMs || 15000,input:{context:'Connection test. Pick the valid option.',candidates:[{id:'a0',label:'Valid option',score:1}]}},controller.signal); setMessage(`連線成功，信心 ${Math.round(result.confidence*100)}%，輸入 ${result.inputTokens} tokens。`); }
      else { await providerPost('key',{key:action === 'delete' ? '' : key.trim(),remember:action === 'save' && remember},controller.signal); setKey(''); setStatus(await providerStatus(controller.signal)); setMessage(action === 'delete' ? '已刪除金鑰。' : '金鑰已設定。'); }
    } catch { setMessage('未完成。請確認本機服務、金鑰權限與網路，或延長模型等待時間。'); }
    finally { clearTimeout(timer); setBusy(false); }
  };
  return <div className="space-y-2 rounded-lg border border-slate-700 p-3" data-testid="battle-ai-provider">
    <label className="flex justify-between">Gemini 模型輔助（預設關閉）<input type="checkbox" checked={!!settings.modelEnabled} onChange={e => update({modelEnabled:e.target.checked})}/></label>
    <p className="text-slate-400">開啟後會將精簡戰況傳給 Google，可能產生費用。對戰會在思考時間內採用已收到的建議。模型信心是模型評分。</p>
    <label className="flex items-center justify-between">模型請求上限（1–120 秒）<input aria-label="模型等待秒數" className="w-20 bg-slate-900 p-1" type="number" min="1" max="120" value={(settings.modelTimeoutMs || 15000)/1000} onChange={e => update({modelTimeoutMs:Number(e.target.value)*1000})}/></label>
    <p>{status?.configured ? `已設定金鑰 · ${status.remembered ? '已加密保存' : '僅本次執行'}` : '尚未設定金鑰'}</p>
    <input aria-label="Gemini API 金鑰" type="password" autoComplete="off" spellCheck={false} placeholder="輸入自己的 Gemini API 金鑰" value={key} onChange={e => setKey(e.target.value)} className="w-full bg-slate-900 p-2"/>
    <label className="flex gap-2"><input type="checkbox" disabled={!status?.canRemember} checked={remember} onChange={e => setRemember(e.target.checked)}/>在這台電腦記住（Windows 使用者加密）</label>
    <div className="flex gap-4"><button disabled={busy || !key.trim() || !status} onClick={() => void run('save')}>儲存金鑰</button><button disabled={busy || !status?.configured} onClick={() => void run('delete')}>刪除</button><button disabled={busy || !status?.configured} onClick={() => void run('test')}>測試連線（會呼叫 API）</button></div>
    <p role="status">{message}</p>
    <div className="border-t border-slate-700 pt-2">AI 藥劑使用（特殊藥劑、解除與指定幻化保留）</div>
    {([['allowOffensivePotions','允許攻擊／干擾藥劑'],['allowStatusPotions','允許控制／異常藥劑'],['allowDamagePotions','允許直接／附加藥劑傷害']] as const).map(([field,label]) => <label key={field} className="flex justify-between">{label}<input type="checkbox" checked={settings[field] !== false} onChange={e => update({[field]:e.target.checked})}/></label>)}
  </div>;
}
