/** 手動時鐘：原生序列只在換影格／版面改變時繪製一次，不跟螢幕刷新率重畫待機圖。 */
export function startPetRenderLoop(options:{advance:(seconds:number)=>void;draw:()=>void;request:(callback:FrameRequestCallback)=>number;cancel:(id:number)=>void;now:()=>number;visible:()=>boolean}){
 let stopped=false,dirty=true,last=options.now(),ticket=0;
 let draws=0,totalWork=0,maxWork=0,started=last;
 const tick=(time:number)=>{
  if(stopped)return;
  const elapsed=Math.max(0,time-last);last=time;
  if(options.visible()){
   const before=options.now();options.advance(elapsed/1000);
   if(dirty){dirty=false;options.draw();draws++;const work=options.now()-before;totalWork+=work;maxWork=Math.max(maxWork,work);}
  }
  ticket=options.request(tick);
 };
 ticket=options.request(tick);
 return {invalidate:()=>{dirty=true;},resetTime:()=>{last=options.now();},stats:()=>({draws,drawsPerSecond:draws/Math.max(.001,(options.now()-started)/1000),averageWorkMs:draws?totalWork/draws:0,maxWorkMs:maxWork}),stop:()=>{stopped=true;options.cancel(ticket);}};
}
