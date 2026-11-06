/** 手動時鐘：原生序列只在換影格／版面改變時繪製一次，不跟螢幕刷新率重畫待機圖。 */
export function startPetRenderLoop(options:{advance:(seconds:number)=>void;draw:()=>void;request:(callback:FrameRequestCallback)=>number;cancel:(id:number)=>void;now:()=>number;visible:()=>boolean;/** 頁面可見性事件來源；預設用全域 document 的 visibilitychange。沒有來源時維持舊行為（背景仍持續排程但不推進／不繪製）。 */subscribeVisibility?:(listener:()=>void)=>()=>void}){
 let stopped=false,dirty=true,last=options.now(),ticket=0,idle=false;
 const subscribe=options.subscribeVisibility??(typeof document!=='undefined'&&typeof document.addEventListener==='function'?(listener:()=>void)=>{document.addEventListener('visibilitychange',listener);return()=>document.removeEventListener('visibilitychange',listener);}:undefined);
 let draws=0,totalWork=0,maxWork=0,started=last;
 const tick=(time:number)=>{
  if(stopped)return;
  const elapsed=Math.max(0,time-last);last=time;
  if(options.visible()){
   const before=options.now();options.advance(elapsed/1000);
   if(dirty){dirty=false;options.draw();draws++;const work=options.now()-before;totalWork+=work;maxWork=Math.max(maxWork,work);}
  }else if(subscribe){idle=true;return;}// 背景分頁：停止排程，visibilitychange 回前景時再續（不再每幀空轉）。
  ticket=options.request(tick);
 };
 // 回前景：重置時間基準（背景期間不累積 dt，動畫時間不跳），並補畫背景期間累積的 dirty。
 const wake=()=>{if(stopped||!idle||!options.visible())return;idle=false;last=options.now();ticket=options.request(tick);};
 const unsubscribe=subscribe?.(wake);
 ticket=options.request(tick);
 return {idle:()=>idle,invalidate:()=>{dirty=true;},resetTime:()=>{last=options.now();},stats:()=>({draws,drawsPerSecond:draws/Math.max(.001,(options.now()-started)/1000),averageWorkMs:draws?totalWork/draws:0,maxWorkMs:maxWork}),stop:()=>{stopped=true;unsubscribe?.();options.cancel(ticket);}};
}
