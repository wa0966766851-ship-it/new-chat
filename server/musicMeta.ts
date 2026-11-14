import type {Express} from 'express';
/**
 * 背景音樂長度查詢（2026-11-08）：B站嵌入播放器沒有跨站「播放結束」事件，
 * 由本機後端查影片（分P）長度，前端據此在播完後間隔幾秒重新播放。
 * 只查公開影片資訊；結果快取 6 小時；失敗時前端不排重播（維持原狀）。
 */
const cache=new Map<string,{duration:number;at:number}>();
const TTL=6*3600_000;
export function registerMusicMeta(app:Express,fetcher:typeof fetch=fetch){
 app.get('/api/music/bilibili-duration/:bvid',async(req,res)=>{
  const bvid=String(req.params.bvid||''),page=Math.max(1,Number(req.query.p)||1);
  if(!/^BV[0-9A-Za-z]{10}$/.test(bvid))return res.status(400).json({error:'BV 號格式錯誤'});
  const key=bvid+'|'+page,hit=cache.get(key);
  if(hit&&Date.now()-hit.at<TTL)return res.json({duration:hit.duration});
  try{
   const ctl=AbortSignal.timeout(8000);
   const r=await fetcher('https://api.bilibili.com/x/web-interface/view?bvid='+bvid,{signal:ctl,headers:{'User-Agent':'Mozilla/5.0 SeerBattleSimulator'}});
   const j:any=await r.json();
   const pages=j?.data?.pages;const duration=Number((Array.isArray(pages)&&pages[page-1]?.duration)||j?.data?.duration||0);
   if(!(duration>0))return res.status(404).json({error:'查不到影片長度'});
   cache.set(key,{duration,at:Date.now()});return res.json({duration});
  }catch{return res.status(502).json({error:'暫時無法查詢影片長度'});}
 });
}
