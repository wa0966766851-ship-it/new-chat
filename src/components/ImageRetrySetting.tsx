import React from 'react';
import {readImageRetryMode,writeImageRetryMode,IMAGE_RETRY_SETTINGS_EVENT,type ImageRetryMode} from '../utils/imageRetrySettings';
export function ImageRetrySetting(){
 const [mode,setMode]=React.useState(readImageRetryMode);
 React.useEffect(()=>{const update=()=>setMode(readImageRetryMode());window.addEventListener(IMAGE_RETRY_SETTINGS_EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(IMAGE_RETRY_SETTINGS_EVENT,update);window.removeEventListener('storage',update);};},[]);
 return <label className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3"><span><span className="block text-sm font-bold text-cyan-200">圖片載入失敗時</span><span className="text-xs text-slate-400">自動：稍後重試；手動：點備用圖片重試；不重試：保留備用圖。</span></span><select aria-label="圖片重試方式" className="rounded bg-slate-900 px-2 py-1 text-sm" value={mode} onChange={e=>{const next=e.target.value as ImageRetryMode;setMode(next);writeImageRetryMode(next);}}><option value="auto">自動重試</option><option value="manual">手動重試</option><option value="off">不重試</option></select></label>;
}
