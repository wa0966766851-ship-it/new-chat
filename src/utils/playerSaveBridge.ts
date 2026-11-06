// 瀏覽器仍使用原有 localStorage；桌面另保存不依賴網址埠號的副本。
const META='seer_desktop_save_revision';
export function readPlayerEntries(storage:Storage):Record<string,string> {
  const entries:Record<string,string>={};
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(key && key!==META && !key.startsWith('seer_before_desktop_restore_') && /^seer_[a-zA-Z0-9_.:-]+$/.test(key))entries[key]=storage.getItem(key)!;
  }
  return entries;
}
export async function initializePlayerSave(storage:Storage=localStorage,request:typeof fetch=fetch) {
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
  const warn=(message:string)=>{
    console.error('[桌面存檔]',message);
    // 持續顯示；不能讓使用者誤以為已安全保存。
    const notice=document.createElement('div');notice.setAttribute('role','alert');
    notice.textContent=message;notice.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#422006;color:#fef3c7;padding:12px;text-align:center';
    document.body.appendChild(notice);
  };
  let saved:{schema:number;revision:string;entries:Record<string,string>};
  try{
    const response=await request('/api/player-save',{signal:AbortSignal.timeout(3000),cache:'no-store'});
    if(response.status===404)return;
    if(response.ok && !response.headers.get('content-type')?.includes('application/json'))return;
    if(!response.ok)throw Error('桌面存檔無法讀取；目前瀏覽器資料保留，暫停同步，請先匯出備份。');
    saved=await response.json();
    if(saved.schema!==1 || typeof saved.revision!=='string' || !saved.entries || typeof saved.entries!=='object' ||
      Array.isArray(saved.entries) || !Object.entries(saved.entries).every(([k,v])=>/^seer_[a-zA-Z0-9_.:-]+$/.test(k)&&typeof v==='string'))throw Error('桌面存檔格式異常，未套用。');
  }catch(error){warn(String(error));return;}
  let local=readPlayerEntries(storage), previousRevision=storage.getItem(META);
  const hasSaved=Object.keys(saved.entries).length>0;
  // 新埠沒有資料，或是已知舊副本：在 React 與資料遷移之前還原。
  if(hasSaved && (!Object.keys(local).length || previousRevision && previousRevision!==saved.revision)){
    // 先檢查新副本能否寫入；失敗時保留現有資料，不啟動同步。
    try{
      const old=JSON.stringify(local);
      if(Object.keys(local).length)storage.setItem('seer_before_desktop_restore_'+Date.now(),old);
      for(const [key,value] of Object.entries(saved.entries))storage.setItem(key,value);
      for(const key of Object.keys(local))if(!(key in saved.entries))storage.removeItem(key);
      local=readPlayerEntries(storage);
    }catch{warn('瀏覽器儲存空間不足，還原未完成；磁碟原存檔保留，暫停同步。');return;}
  }else if(hasSaved && !previousRevision && (Object.keys(local).length!==Object.keys(saved.entries).length ||
    Object.entries(local).some(([key,value])=>saved.entries[key]!==value))){
    warn('發現兩份不同的舊存檔，已保留雙方並暫停同步；請先匯出目前資料，避免覆蓋。');return;
  }
  let revision=saved.revision, last=JSON.stringify(saved.entries), stopped=false, busy=false;
  const flush=async()=>{
    if(stopped || busy)return;
    const entries=readPlayerEntries(storage), raw=JSON.stringify(entries);
    if(raw===last)return;
    busy=true;
    try{
      const response=await request('/api/player-save',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({revision,entries}),signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw Error(response.status===409?'另一視窗已有新存檔，未覆蓋；請先匯出目前資料再重開。':'桌面存檔寫入失敗，請先匯出目前資料；瀏覽器資料仍保留。');
      revision=(await response.json()).revision;last=raw;storage.setItem(META,revision);
    }catch(error){stopped=true;warn(String(error));}finally{busy=false;}
  };
  // 先保存舊資料，再讓既有來源升級與畫面初始化寫入。
  await flush();if(stopped)return;
  try{storage.setItem(META,revision);}catch{
    warn('瀏覽器儲存空間不足，無法記錄同步版本；磁碟存檔保留，暫停同步。');return;
  }
  const timer=setInterval(()=>void flush(),1500);
  const hidden=()=>{if(document.hidden)void flush();};
  document.addEventListener('visibilitychange',hidden);
  return {flush,stop:()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',hidden);}};
}
